from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Job, StatusHistory, Profile
from ..schemas import JobCreate, JobUpdate, JobOut, MoveJobsRequest

router = APIRouter(prefix="/jobs", tags=["jobs"])

VALID_STATUSES = {"wishlist", "applied", "screening", "interview", "offer", "rejected", "ghosted"}
VALID_WORK_TYPES = {"remote", "hybrid", "onsite", "unknown"}
SORTABLE_FIELDS = {"created_at", "updated_at", "company", "title", "applied_date", "status", "salary_min"}


def _write_status_history(db: Session, job_id: int, old_status: Optional[str], new_status: str, note: Optional[str] = None):
    entry = StatusHistory(job_id=job_id, old_status=old_status, new_status=new_status, note=note)
    db.add(entry)


# PATCH /jobs/move is declared before /{job_id} routes to prevent route shadowing (C2).
@router.patch("/move", response_model=list[JobOut])
def move_jobs(data: MoveJobsRequest, db: Session = Depends(get_db)):
    target = db.query(Profile).filter(Profile.id == data.target_profile_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target profile not found.")

    jobs = db.query(Job).filter(Job.id.in_(data.job_ids)).all()
    if not jobs:
        raise HTTPException(status_code=404, detail="No matching jobs found.")

    # TODO (low): if len(jobs) != len(data.job_ids), some IDs were silently skipped.
    # Consider returning a 207 partial response or 404 listing the missing IDs.
    for job in jobs:
        job.profile_id = data.target_profile_id

    db.commit()
    for job in jobs:
        db.refresh(job)
    return jobs


@router.get("", response_model=list[JobOut])
def list_jobs(
    profile_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    work_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("created_at"),
    order: str = Query("desc"),
    db: Session = Depends(get_db),
):
    # C1: validate sort_by against allowlist to prevent attribute injection / server crash.
    if sort_by not in SORTABLE_FIELDS:
        sort_by = "created_at"
    # M3: normalise and validate order to prevent silent wrong-direction sorts.
    if order.lower() not in {"asc", "desc"}:
        raise HTTPException(status_code=400, detail="order must be 'asc' or 'desc'.")
    order = order.lower()

    q = db.query(Job)
    if profile_id is not None:
        q = q.filter(Job.profile_id == profile_id)
    if status:
        q = q.filter(Job.status == status)
    if work_type:
        q = q.filter(Job.work_type == work_type)
    if search:
        term = f"%{search}%"
        q = q.filter(
            Job.company.ilike(term) | Job.title.ilike(term) | Job.location.ilike(term)
        )
    col = getattr(Job, sort_by)
    # TODO (low): add .options(selectinload(Job.status_history)) here and in get_job
    # to eliminate N+1 lazy loads when returning lists of jobs with history.
    q = q.order_by(col.desc() if order == "desc" else col.asc())
    return q.all()


@router.post("", response_model=JobOut, status_code=201)
def create_job(data: JobCreate, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == data.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    if data.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Choose from: {', '.join(sorted(VALID_STATUSES))}")
    if data.work_type not in VALID_WORK_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid work_type. Choose from: {', '.join(sorted(VALID_WORK_TYPES))}")

    if data.url:
        existing = db.query(Job).filter(Job.profile_id == data.profile_id, Job.url == data.url).first()
        if existing:
            # Intentional: detail is a dict here (not a string like other errors)
            # so the client can surface the conflicting job's identity.
            raise HTTPException(
                status_code=409,
                detail={"message": "duplicate_url", "job_id": existing.id, "company": existing.company, "title": existing.title},
            )

    job = Job(**data.model_dump())
    db.add(job)
    db.flush()
    _write_status_history(db, job.id, None, job.status)
    db.commit()
    db.refresh(job)
    return job


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


@router.put("/{job_id}", response_model=JobOut)
def update_job(job_id: int, data: JobUpdate, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    update_data = data.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"] not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Choose from: {', '.join(sorted(VALID_STATUSES))}")
    if "work_type" in update_data and update_data["work_type"] not in VALID_WORK_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid work_type. Choose from: {', '.join(sorted(VALID_WORK_TYPES))}")

    old_status = job.status
    for field, value in update_data.items():
        setattr(job, field, value)

    if "url" in update_data and update_data["url"]:
        dup = (
            db.query(Job)
            .filter(
                Job.profile_id == job.profile_id,
                Job.url == update_data["url"],
                Job.id != job_id,
            )
            .first()
        )
        if dup:
            raise HTTPException(
                status_code=409,
                detail={"message": "duplicate_url", "job_id": dup.id, "company": dup.company, "title": dup.title},
            )

    if "status" in update_data and update_data["status"] != old_status:
        _write_status_history(db, job.id, old_status, update_data["status"])

    db.commit()
    db.refresh(job)
    return job


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    db.delete(job)
    db.commit()
