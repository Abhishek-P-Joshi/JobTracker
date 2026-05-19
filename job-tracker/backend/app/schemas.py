from datetime import datetime, date
from typing import Optional
from urllib.parse import urlparse, urlunparse
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _normalise_url(v: object) -> object:
    if not isinstance(v, str):
        return v
    stripped = v.strip()
    if not stripped:
        return None
    try:
        parsed = urlparse(stripped)
        return urlunparse(parsed._replace(scheme=parsed.scheme.lower(), netloc=parsed.netloc.lower()))
    except Exception:
        return stripped


# ── Profiles ──────────────────────────────────────────────────────────────────

class ProfileCreate(BaseModel):
    name: str = Field(..., max_length=100)
    color: str = Field("#6366f1", pattern=r'^#[0-9a-fA-F]{6}$')


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    color: Optional[str] = Field(None, pattern=r'^#[0-9a-fA-F]{6}$')


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: str
    created_at: datetime


# ── Status History ─────────────────────────────────────────────────────────────

class StatusHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: int
    # TODO (low): add explicit `= None` defaults once Pydantic v2 Optional
    # inference is confirmed stable across all deployment targets.
    old_status: Optional[str] = None
    new_status: str
    changed_at: datetime
    note: Optional[str] = None


# ── Jobs ───────────────────────────────────────────────────────────────────────

class JobCreate(BaseModel):
    profile_id: int
    company: str = Field(..., max_length=200)
    title: str = Field(..., max_length=200)
    url: Optional[str] = Field(None, max_length=2048)
    location: Optional[str] = Field(None, max_length=200)
    work_type: str = "unknown"
    salary_min: Optional[int] = Field(None, ge=0)
    salary_max: Optional[int] = Field(None, ge=0)
    currency: str = "INR"
    status: str = "wishlist"
    source: Optional[str] = Field(None, max_length=100)
    applied_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=10_000)
    job_description: Optional[str] = Field(None, max_length=50_000)

    @field_validator("url", mode="before")
    @classmethod
    def normalise_url(cls, v: object) -> object:
        return _normalise_url(v)

    @model_validator(mode="after")
    def check_salary_range(self) -> "JobCreate":
        if self.salary_min is not None and self.salary_max is not None:
            if self.salary_min > self.salary_max:
                raise ValueError("salary_min must not exceed salary_max")
        return self


class JobUpdate(BaseModel):
    company: Optional[str] = Field(None, max_length=200)
    title: Optional[str] = Field(None, max_length=200)
    url: Optional[str] = Field(None, max_length=2048)
    location: Optional[str] = Field(None, max_length=200)
    work_type: Optional[str] = None
    salary_min: Optional[int] = Field(None, ge=0)
    salary_max: Optional[int] = Field(None, ge=0)
    currency: Optional[str] = None
    status: Optional[str] = None
    source: Optional[str] = Field(None, max_length=100)
    applied_date: Optional[date] = None
    # TODO (medium): JobUpdate cannot distinguish "unset" from "explicitly null"
    # for nullable fields. A client cannot clear notes/url via this schema.
    # Consider a sentinel value or a dedicated PATCH field-clear endpoint.
    notes: Optional[str] = Field(None, max_length=10_000)
    job_description: Optional[str] = Field(None, max_length=50_000)

    @field_validator("url", mode="before")
    @classmethod
    def normalise_url(cls, v: object) -> object:
        return _normalise_url(v)

    @model_validator(mode="after")
    def check_salary_range(self) -> "JobUpdate":
        if self.salary_min is not None and self.salary_max is not None:
            if self.salary_min > self.salary_max:
                raise ValueError("salary_min must not exceed salary_max")
        return self


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profile_id: int
    company: str
    title: str
    url: Optional[str]
    location: Optional[str]
    work_type: str
    salary_min: Optional[int]
    salary_max: Optional[int]
    currency: str
    status: str
    source: Optional[str]
    applied_date: Optional[date]
    notes: Optional[str]
    job_description: Optional[str]
    created_at: datetime
    updated_at: datetime
    # TODO (low): add selectinload(Job.status_history) to list_jobs and get_job
    # queries in routers/jobs.py to eliminate N+1 lazy loads.
    status_history: list[StatusHistoryOut] = []


class MoveJobsRequest(BaseModel):
    job_ids: list[int]
    target_profile_id: int


# ── Analytics ──────────────────────────────────────────────────────────────────

class AnalyticsSummary(BaseModel):
    total: int
    by_status: dict[str, int]
    response_rate: float


class TimelinePoint(BaseModel):
    week_label: str
    count: int


class LocationStat(BaseModel):
    location: str
    count: int


class SalaryStat(BaseModel):
    min_salary_min: Optional[float] = None
    max_salary_max: Optional[float] = None
    avg_salary_min: Optional[float] = None
    avg_salary_max: Optional[float] = None


class SourceStat(BaseModel):
    source: str
    count: int


class WorkTypeStat(BaseModel):
    work_type: str
    count: int


# ── Import ─────────────────────────────────────────────────────────────────────

class ImportRequest(BaseModel):
    profile_id: int
    jobs: list[JobCreate]


# ── Resumes ────────────────────────────────────────────────────────────────────

class ResumeConfig(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    folder_path: Optional[str] = None
    master_resume: Optional[str] = None
    default_resume: Optional[str] = None


class ResumeConfigUpdate(BaseModel):
    folder_path: Optional[str] = Field(None, min_length=1, max_length=4096)
    master_resume: Optional[str] = Field(None, min_length=1, max_length=255)
    default_resume: Optional[str] = Field(None, min_length=1, max_length=255)


class ResumeFileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    filename: str
    size_bytes: int
    modified_at: datetime
    is_master: bool
    is_default: bool


class ResumeTextOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    filename: str
    text: str
    char_count: int


# ── AI Analysis ────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    profile_id: int
    job_description: str = Field(..., min_length=1, max_length=50_000)
    scored_resume_filename: str = Field(..., min_length=1, max_length=255)
    master_resume_filename: str = Field(..., min_length=1, max_length=255)
    job_title: Optional[str] = Field(None, max_length=200)
    company: Optional[str] = Field(None, max_length=200)
    url: Optional[str] = Field(None, max_length=2048)
    job_id: Optional[int] = None

    @field_validator("job_description")
    @classmethod
    def jd_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("job_description must not be blank or whitespace-only")
        return v


class Suggestion(BaseModel):
    text: str
    score_impact: int


class AnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profile_id: int
    job_id: Optional[int] = None
    job_title: Optional[str] = None
    company: Optional[str] = None
    url: Optional[str] = None
    job_description: str
    scored_resume_filename: str
    master_resume_filename: str
    is_single_mode: bool
    current_score: int
    projected_score: Optional[int] = None
    strengths: list[str] = []
    gaps: list[str] = []
    suggestions: list[Suggestion] = []
    verdict: Optional[str] = None
    run_at: datetime


class AnalysisSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: Optional[int] = None
    job_title: Optional[str] = None
    company: Optional[str] = None
    scored_resume_filename: str
    current_score: int
    projected_score: Optional[int] = None
    verdict: Optional[str] = None
    run_at: datetime
