import json
import logging
import os
from typing import Optional

import anthropic
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

from ..database import get_db
from ..models import Job, JobAnalysis, Profile
# TODO (low): move _get_setting, _require_folder, extract_resume_text to app/services/resumes.py
# so ai.py doesn't depend on resumes.py internals.
from ..routers.resumes import _get as _get_setting, _require_folder, extract_resume_text
from ..schemas import AnalyzeRequest, AnalysisOut, AnalysisSummaryOut, Suggestion

router = APIRouter(prefix="/ai", tags=["ai"])

_SYSTEM_PROMPT = (
    "You are a professional resume analyst and career coach. "
    "Respond ONLY with valid JSON matching the schema provided. "
    "Do not include markdown fences or any text outside the JSON object."
)

_DUAL_MODE_TEMPLATE = """\
Analyse how well the scored resume matches the job description.
Then identify specific content from the master resume that is missing \
from the scored resume but is relevant to this job.

<job_description>
{job_description}
</job_description>

<scored_resume>
{scored_resume_text}
</scored_resume>

<master_resume>
{master_resume_text}
</master_resume>

Return a JSON object with exactly these keys:
{{
  "current_score": <integer 0-100>,
  "projected_score": <integer 0-100, after applying suggestions>,
  "verdict": "<one sentence summary>",
  "strengths": ["<what the scored resume already does well>", ...],
  "gaps": ["<what the job requires that is missing>", ...],
  "suggestions": [
    {{"text": "<specific, actionable improvement>", "score_impact": <integer points gained>}},
    ...
  ]
}}
"""

_SINGLE_MODE_TEMPLATE = """\
Analyse how well this resume matches the job description.
Suggest concrete improvements based solely on the job requirements.

<job_description>
{job_description}
</job_description>

<resume>
{scored_resume_text}
</resume>

Return a JSON object with exactly these keys:
{{
  "current_score": <integer 0-100>,
  "projected_score": <integer 0-100, after applying suggestions>,
  "verdict": "<one sentence summary>",
  "strengths": ["<what the resume already does well>", ...],
  "gaps": ["<what the job requires that is missing>", ...],
  "suggestions": [
    {{"text": "<specific, actionable improvement>", "score_impact": <integer points gained>}},
    ...
  ]
}}
"""


def _get_anthropic_client() -> anthropic.Anthropic:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise HTTPException(
            status_code=400,
            detail=(
                "ANTHROPIC_API_KEY environment variable is not set. "
                "Add it to backend/.env and restart the server."
            ),
        )
    return anthropic.Anthropic(api_key=key)


def _safe_int(value: object, field: str) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"AI returned non-numeric '{field}': {value!r}") from exc


def _parse_analysis(raw: str) -> dict:
    """Parse and structurally validate Claude's JSON response."""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        log.error("AI returned invalid JSON: %s | raw[:500]: %s", exc, raw[:500])
        raise HTTPException(status_code=502, detail="AI returned invalid JSON. Check server logs.") from exc

    for key in ("current_score", "projected_score", "verdict", "strengths", "gaps", "suggestions"):
        if key not in data:
            log.error("AI response missing key '%s'. raw[:500]: %s", key, raw[:500])
            raise HTTPException(status_code=502, detail=f"AI response missing required key '{key}'.")

    if data["projected_score"] is not None and not isinstance(data["projected_score"], (int, float)):
        raise HTTPException(status_code=502, detail="AI returned non-numeric 'projected_score'.")

    suggestions = data["suggestions"]
    if not isinstance(suggestions, list):
        raise HTTPException(status_code=502, detail="AI 'suggestions' must be a list.")
    for i, item in enumerate(suggestions):
        if not isinstance(item, dict) or "text" not in item or "score_impact" not in item:
            raise HTTPException(
                status_code=502,
                detail=f"Suggestion at index {i} must have 'text' and 'score_impact' keys.",
            )

    return data


def _analysis_to_out(row: JobAnalysis) -> AnalysisOut:
    return AnalysisOut(
        id=row.id,
        profile_id=row.profile_id,
        job_id=row.job_id,
        job_title=row.job_title,
        company=row.company,
        url=row.url,
        job_description=row.job_description,
        scored_resume_filename=row.scored_resume_filename,
        master_resume_filename=row.master_resume_filename,
        is_single_mode=row.is_single_mode,
        current_score=row.current_score,
        projected_score=row.projected_score,
        strengths=json.loads(row.strengths_json or "[]"),
        gaps=json.loads(row.gaps_json or "[]"),
        suggestions=[Suggestion(**s) for s in json.loads(row.suggestions_json or "[]")],
        verdict=row.verdict,
        run_at=row.run_at,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/analyze", response_model=AnalysisOut)
def analyze(req: AnalyzeRequest, db: Session = Depends(get_db)):
    # Validate profile
    profile = db.get(Profile, req.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")

    # If job_id given, pull its stored job_description
    job_description = req.job_description
    if req.job_id is not None:
        job = db.get(Job, req.job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found.")
        if not job.job_description:
            raise HTTPException(
                status_code=422,
                detail="This job has no saved description. Re-import it from LinkedIn first.",
            )
        job_description = job.job_description

    # Load resume folder
    folder = _require_folder(db)

    # Extract scored resume text
    scored_text = extract_resume_text(folder, req.scored_resume_filename)

    # Determine mode and build prompt
    is_single = req.scored_resume_filename == req.master_resume_filename
    if is_single:
        user_msg = _SINGLE_MODE_TEMPLATE.format(
            job_description=job_description,
            scored_resume_text=scored_text,
        )
    else:
        master_text = extract_resume_text(folder, req.master_resume_filename)
        user_msg = _DUAL_MODE_TEMPLATE.format(
            job_description=job_description,
            scored_resume_text=scored_text,
            master_resume_text=master_text,
        )

    # Call Claude
    client = _get_anthropic_client()
    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
        )
    except anthropic.APIError as exc:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {exc}") from exc

    raw = message.content[0].text
    data = _parse_analysis(raw)

    # Clamp scores to valid range
    current_score = max(0, min(100, _safe_int(data["current_score"], "current_score")))
    projected_score = data["projected_score"]
    if projected_score is not None:
        projected_score = max(0, min(100, _safe_int(projected_score, "projected_score")))

    # Persist
    row = JobAnalysis(
        profile_id=req.profile_id,
        job_id=req.job_id,
        job_title=req.job_title,
        company=req.company,
        url=req.url,
        job_description=job_description,
        scored_resume_filename=req.scored_resume_filename,
        master_resume_filename=req.master_resume_filename,
        is_single_mode=is_single,
        current_score=current_score,
        projected_score=projected_score,
        strengths_json=json.dumps(data.get("strengths") or []),
        gaps_json=json.dumps(data.get("gaps") or []),
        suggestions_json=json.dumps(data.get("suggestions") or []),
        verdict=data.get("verdict"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return _analysis_to_out(row)


@router.get("/analyses", response_model=list[AnalysisSummaryOut])
def list_analyses(
    profile_id: int,
    job_id: Optional[int] = None,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(JobAnalysis).filter(JobAnalysis.profile_id == profile_id)
    if job_id is not None:
        q = q.filter(JobAnalysis.job_id == job_id)
    rows = q.order_by(JobAnalysis.run_at.desc()).limit(limit).all()
    return [
        AnalysisSummaryOut(
            id=r.id,
            job_id=r.job_id,
            job_title=r.job_title,
            company=r.company,
            scored_resume_filename=r.scored_resume_filename,
            current_score=r.current_score,
            projected_score=r.projected_score,
            verdict=r.verdict,
            run_at=r.run_at,
        )
        for r in rows
    ]


@router.get("/analyses/job/{job_id}/history", response_model=list[AnalysisSummaryOut])
def job_analysis_history(job_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(JobAnalysis)
        .filter(JobAnalysis.job_id == job_id)
        .order_by(JobAnalysis.run_at.desc())
        .all()
    )
    return [
        AnalysisSummaryOut(
            id=r.id,
            job_id=r.job_id,
            job_title=r.job_title,
            company=r.company,
            scored_resume_filename=r.scored_resume_filename,
            current_score=r.current_score,
            projected_score=r.projected_score,
            verdict=r.verdict,
            run_at=r.run_at,
        )
        for r in rows
    ]


@router.get("/analyses/{analysis_id}", response_model=AnalysisOut)
def get_analysis(analysis_id: int, db: Session = Depends(get_db)):
    row = db.get(JobAnalysis, analysis_id)
    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return _analysis_to_out(row)
