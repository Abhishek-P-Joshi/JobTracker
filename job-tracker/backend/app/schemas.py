from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


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
