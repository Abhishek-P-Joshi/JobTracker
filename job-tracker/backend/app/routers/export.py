import csv
import io
import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Job, Profile
from ..schemas import ImportRequest, JobOut

router = APIRouter(tags=["export"])

CSV_FIELDS = [
    "id", "profile_id", "company", "title", "url", "location", "work_type",
    "salary_min", "salary_max", "currency", "status", "source",
    "applied_date", "notes", "created_at", "updated_at",
]


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
    filename = f"jobs_profile{profile_id}_{datetime.utcnow().strftime('%Y%m%d')}.csv" if profile_id else f"jobs_all_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/json")
def export_json(profile_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    q = db.query(Job)
    if profile_id is not None:
        q = q.filter(Job.profile_id == profile_id)
    jobs = q.order_by(Job.created_at.desc()).all()

    data = [JobOut.model_validate(job).model_dump(mode="json") for job in jobs]
    payload = json.dumps(data, default=str, indent=2)

    filename = f"jobs_profile{profile_id}_{datetime.utcnow().strftime('%Y%m%d')}.json" if profile_id else f"jobs_all_{datetime.utcnow().strftime('%Y%m%d')}.json"
    return StreamingResponse(
        iter([payload]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/import/json", response_model=list[JobOut])
def import_json(data: ImportRequest, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == data.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")

    created = []
    for job_data in data.jobs:
        job = Job(**job_data.model_dump())
        job.profile_id = data.profile_id
        db.add(job)
        created.append(job)

    db.commit()
    for job in created:
        db.refresh(job)
    return created
