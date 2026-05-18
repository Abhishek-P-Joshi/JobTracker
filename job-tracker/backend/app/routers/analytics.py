from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Job
from ..schemas import AnalyticsSummary, TimelinePoint, LocationStat, SalaryStat, SourceStat, WorkTypeStat

router = APIRouter(prefix="/analytics", tags=["analytics"])

ALL_STATUSES = ["wishlist", "applied", "screening", "interview", "offer", "rejected", "ghosted"]
RESPONDED_STATUSES = {"screening", "interview", "offer", "rejected"}


def _base_query(db: Session, profile_id: Optional[int]):
    q = db.query(Job)
    if profile_id is not None:
        q = q.filter(Job.profile_id == profile_id)
    return q


@router.get("/summary", response_model=AnalyticsSummary)
def get_summary(profile_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    jobs = _base_query(db, profile_id).all()
    total = len(jobs)
    by_status = {s: 0 for s in ALL_STATUSES}
    for job in jobs:
        if job.status in by_status:
            by_status[job.status] += 1

    applied_total = sum(by_status.get(s, 0) for s in ["applied", "screening", "interview", "offer", "rejected"])
    responded = sum(by_status.get(s, 0) for s in RESPONDED_STATUSES)
    response_rate = round((responded / applied_total * 100), 1) if applied_total > 0 else 0.0

    return AnalyticsSummary(total=total, by_status=by_status, response_rate=response_rate)


@router.get("/timeline", response_model=list[TimelinePoint])
def get_timeline(profile_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    now = datetime.utcnow()
    points = []
    for weeks_ago in range(11, -1, -1):
        week_start = (now - timedelta(weeks=weeks_ago)).replace(hour=0, minute=0, second=0, microsecond=0)
        week_start -= timedelta(days=week_start.weekday())
        week_end = week_start + timedelta(days=7)
        q = _base_query(db, profile_id).filter(
            Job.applied_date >= week_start.date(),
            Job.applied_date < week_end.date(),
        )
        count = q.count()
        label = week_start.strftime("%b %d")
        points.append(TimelinePoint(week_label=label, count=count))
    return points


@router.get("/locations", response_model=list[LocationStat])
def get_locations(profile_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    q = db.query(Job.location, func.count(Job.id).label("count"))
    if profile_id is not None:
        q = q.filter(Job.profile_id == profile_id)
    rows = (
        q.filter(Job.location.isnot(None))
        .group_by(Job.location)
        .order_by(func.count(Job.id).desc())
        .limit(8)
        .all()
    )
    return [LocationStat(location=r.location, count=r.count) for r in rows]


@router.get("/salary", response_model=SalaryStat)
def get_salary(profile_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    q = db.query(
        func.min(Job.salary_min).label("min_salary_min"),
        func.max(Job.salary_max).label("max_salary_max"),
        func.avg(Job.salary_min).label("avg_salary_min"),
        func.avg(Job.salary_max).label("avg_salary_max"),
    )
    if profile_id is not None:
        q = q.filter(Job.profile_id == profile_id)
    row = q.first()
    return SalaryStat(
        min_salary_min=row.min_salary_min,
        max_salary_max=row.max_salary_max,
        avg_salary_min=round(row.avg_salary_min, 0) if row.avg_salary_min else None,
        avg_salary_max=round(row.avg_salary_max, 0) if row.avg_salary_max else None,
    )


@router.get("/sources", response_model=list[SourceStat])
def get_sources(profile_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    q = db.query(Job.source, func.count(Job.id).label("count"))
    if profile_id is not None:
        q = q.filter(Job.profile_id == profile_id)
    rows = (
        q.filter(Job.source.isnot(None))
        .group_by(Job.source)
        .order_by(func.count(Job.id).desc())
        .all()
    )
    return [SourceStat(source=r.source, count=r.count) for r in rows]


@router.get("/work-types", response_model=list[WorkTypeStat])
def get_work_types(profile_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    q = db.query(Job.work_type, func.count(Job.id).label("count"))
    if profile_id is not None:
        q = q.filter(Job.profile_id == profile_id)
    rows = q.group_by(Job.work_type).order_by(func.count(Job.id).desc()).all()
    return [WorkTypeStat(work_type=r.work_type, count=r.count) for r in rows]
