import csv
import io
import json
from datetime import datetime, UTC
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Job, Profile, StatusHistory
from ..schemas import ImportRequest, JobOut

router = APIRouter(tags=["export"])

CSV_FIELDS = [
    "id", "profile_id", "company", "title", "url", "location", "work_type",
    "salary_min", "salary_max", "currency", "status", "source",
    "applied_date", "notes", "created_at", "updated_at",
]

VALID_STATUSES = {"wishlist", "applied", "screening", "interview", "offer", "rejected", "ghosted"}
VALID_WORK_TYPES = {"remote", "hybrid", "onsite", "unknown"}


def _utc_stamp() -> str:
    return datetime.now(UTC).strftime("%Y%m%d")


@router.get("/export/csv")
def export_csv(profile_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    q = db.query(Job)
    if profile_id is not None:
        q = q.filter(Job.profile_id == profile_id)
    jobs = q.order_by(Job.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=CSV_FIELDS)
    writer.writeheader()
    for job in jobs:
        row = {f: getattr(job, f, None) for f in CSV_FIELDS}
        writer.writerow(row)

    output.seek(0)
    # M5: quote filename in Content-Disposition per RFC 6266.
    suffix = f"profile{profile_id}" if profile_id else "all"
    filename = f"jobs_{suffix}_{_utc_stamp()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/json")
def export_json(profile_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    q = db.query(Job)
    if profile_id is not None:
        q = q.filter(Job.profile_id == profile_id)
    jobs = q.order_by(Job.created_at.desc()).all()

    data = [JobOut.model_validate(job).model_dump(mode="json") for job in jobs]
    payload = json.dumps(data, default=str, indent=2)

    suffix = f"profile{profile_id}" if profile_id else "all"
    filename = f"jobs_{suffix}_{_utc_stamp()}.json"
    return StreamingResponse(
        iter([payload]),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import/json", response_model=list[JobOut])
def import_json(data: ImportRequest, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == data.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")

    # C3: validate each job's status and work_type, and write status_history so
    # imported jobs appear correctly in the timeline and analytics views.
    created = []
    for idx, job_data in enumerate(data.jobs):
        d = job_data.model_dump()
        d["profile_id"] = data.profile_id  # override with the target profile

        if d["status"] not in VALID_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Job {idx}: invalid status '{d['status']}'. Choose from: {', '.join(sorted(VALID_STATUSES))}",
            )
        if d["work_type"] not in VALID_WORK_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Job {idx}: invalid work_type '{d['work_type']}'. Choose from: {', '.join(sorted(VALID_WORK_TYPES))}",
            )

        job = Job(**d)
        db.add(job)
        db.flush()
        history = StatusHistory(job_id=job.id, old_status=None, new_status=job.status)
        db.add(history)
        created.append(job)

    db.commit()
    for job in created:
        db.refresh(job)
    return created
