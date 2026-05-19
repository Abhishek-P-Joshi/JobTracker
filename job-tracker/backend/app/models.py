from datetime import datetime, date, UTC
from typing import Optional
from sqlalchemy import Integer, String, Text, Date, DateTime, Boolean, ForeignKey, UniqueConstraint, event
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


def utc_now() -> datetime:
    """Return current UTC time as a naive datetime (avoids deprecated utcnow)."""
    return datetime.now(UTC).replace(tzinfo=None)


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    color: Mapped[str] = mapped_column(String, nullable=False, default="#6366f1")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    jobs: Mapped[list["Job"]] = relationship(
        "Job", back_populates="profile", cascade="all, delete-orphan"
    )


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        # Belt-and-suspenders uniqueness; the app-level 409 is the user-facing guard.
        # SQL NULL semantics (NULL != NULL) mean multiple null-URL jobs are allowed.
        # Requires DB recreation or a migration to apply to an existing database.
        UniqueConstraint("profile_id", "url", name="uq_job_profile_url"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey("profiles.id"), nullable=False)
    company: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[str | None] = mapped_column(String, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    work_type: Mapped[str] = mapped_column(String, default="unknown")
    salary_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    salary_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    currency: Mapped[str] = mapped_column(String, default="INR")
    status: Mapped[str] = mapped_column(String, default="wishlist")
    source: Mapped[str | None] = mapped_column(String, nullable=True)
    applied_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    job_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    profile: Mapped["Profile"] = relationship("Profile", back_populates="jobs")
    status_history: Mapped[list["StatusHistory"]] = relationship(
        "StatusHistory", back_populates="job", cascade="all, delete-orphan"
    )


class StatusHistory(Base):
    __tablename__ = "status_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    old_status: Mapped[str | None] = mapped_column(String, nullable=True)
    new_status: Mapped[str] = mapped_column(String, nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    job: Mapped["Job"] = relationship("Job", back_populates="status_history")


class AppSettings(Base):
    """Key-value store for app-wide settings (resume folder, master/default filenames)."""
    __tablename__ = "app_settings"

    id:         Mapped[int]      = mapped_column(Integer, primary_key=True, autoincrement=True)
    key:        Mapped[str]      = mapped_column(String, nullable=False, unique=True)
    value:      Mapped[str|None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)


class JobAnalysis(Base):
    __tablename__ = "job_analyses"

    id                     : Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id             : Mapped[int]           = mapped_column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    job_id                 : Mapped[int | None]    = mapped_column(Integer, ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True)
    job_title              : Mapped[str | None]    = mapped_column(String, nullable=True)
    company                : Mapped[str | None]    = mapped_column(String, nullable=True)
    url                    : Mapped[str | None]    = mapped_column(String, nullable=True)
    job_description        : Mapped[str]           = mapped_column(Text, nullable=False)
    scored_resume_filename : Mapped[str]           = mapped_column(String, nullable=False)
    master_resume_filename : Mapped[str]           = mapped_column(String, nullable=False)
    is_single_mode         : Mapped[bool]          = mapped_column(Boolean, default=False, nullable=False)
    current_score          : Mapped[int]           = mapped_column(Integer, nullable=False)
    projected_score        : Mapped[int | None]    = mapped_column(Integer, nullable=True)
    strengths_json         : Mapped[str | None]    = mapped_column(Text, nullable=True)
    gaps_json              : Mapped[str | None]    = mapped_column(Text, nullable=True)
    suggestions_json       : Mapped[str | None]    = mapped_column(Text, nullable=True)
    verdict                : Mapped[str | None]    = mapped_column(String, nullable=True)
    run_at                 : Mapped[datetime]      = mapped_column(DateTime, default=utc_now)

    profile : Mapped["Profile"]          = relationship("Profile")
    job     : Mapped[Optional["Job"]]    = relationship("Job")


# TODO (low): EmailMatch is scaffolded for future email integration but has no
# router or schema yet — implement or remove when that phase begins.
class EmailMatch(Base):
    __tablename__ = "email_matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True)
    subject: Mapped[str | None] = mapped_column(String, nullable=True)
    sender: Mapped[str | None] = mapped_column(String, nullable=True)
    matched_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    action: Mapped[str | None] = mapped_column(String, nullable=True)


@event.listens_for(Job, "before_update")
def update_updated_at(mapper, connection, target):
    target.updated_at = utc_now()
