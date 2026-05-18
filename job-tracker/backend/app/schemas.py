from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, ConfigDict


# ── Profiles ──────────────────────────────────────────────────────────────────

class ProfileCreate(BaseModel):
    name: str
    color: str = "#6366f1"


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


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
    old_status: Optional[str]
    new_status: str
    changed_at: datetime
    note: Optional[str]


# ── Jobs ───────────────────────────────────────────────────────────────────────

class JobCreate(BaseModel):
    profile_id: int
    company: str
    title: str
    url: Optional[str] = None
    location: Optional[str] = None
    work_type: str = "unknown"
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    currency: str = "INR"
    status: str = "wishlist"
    source: Optional[str] = None
    applied_date: Optional[date] = None
    notes: Optional[str] = None
    job_description: Optional[str] = None


class JobUpdate(BaseModel):
    company: Optional[str] = None
    title: Optional[str] = None
    url: Optional[str] = None
    location: Optional[str] = None
    work_type: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    currency: Optional[str] = None
    status: Optional[str] = None
    source: Optional[str] = None
    applied_date: Optional[date] = None
    notes: Optional[str] = None
    job_description: Optional[str] = None


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
    min_salary_min: Optional[float]
    max_salary_max: Optional[float]
    avg_salary_min: Optional[float]
    avg_salary_max: Optional[float]


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
