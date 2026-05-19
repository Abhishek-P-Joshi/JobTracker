import os
from datetime import datetime, UTC
from typing import Optional

import pypdf
import docx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AppSettings
from ..schemas import ResumeConfig, ResumeConfigUpdate, ResumeFilenameUpdate, ResumeFileOut, ResumeTextOut

router = APIRouter(prefix="/resumes", tags=["resumes"])

ALLOWED_EXTENSIONS = {".pdf", ".docx"}

# ── Settings helpers ──────────────────────────────────────────────────────────

def _get(db: Session, key: str) -> Optional[str]:
    row = db.query(AppSettings).filter(AppSettings.key == key).first()
    return row.value if row else None


def _set(db: Session, key: str, value: str) -> None:
    row = db.query(AppSettings).filter(AppSettings.key == key).first()
    if row:
        row.value = value
        row.updated_at = datetime.now(UTC).replace(tzinfo=None)
    else:
        db.add(AppSettings(key=key, value=value))
    db.commit()


def _get_config(db: Session) -> ResumeConfig:
    return ResumeConfig(
        folder_path=_get(db, "resume_folder_path"),
        master_resume=_get(db, "master_resume_filename"),
        default_resume=_get(db, "default_resume_filename"),
    )


def _require_folder(db: Session) -> str:
    path = _get(db, "resume_folder_path")
    if not path or not os.path.isdir(path):
        raise HTTPException(status_code=400, detail="Resume folder not configured or no longer accessible. Set it via PUT /resumes/config.")
    return path


# ── Text extraction ───────────────────────────────────────────────────────────

def extract_resume_text(folder_path: str, filename: str) -> str:
    path = os.path.join(folder_path, filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail=f"Resume file not found: {filename}")

    ext = os.path.splitext(filename)[1].lower()
    if ext == ".pdf":
        try:
            reader = pypdf.PdfReader(path)
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Could not read PDF: {exc}") from exc
    elif ext == ".docx":
        try:
            doc = docx.Document(path)
            text = "\n".join(p.text for p in doc.paragraphs)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Could not read DOCX: {exc}") from exc
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use .pdf or .docx.")

    return text


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/config", response_model=ResumeConfig)
def get_config(db: Session = Depends(get_db)):
    return _get_config(db)


@router.put("/config", response_model=ResumeConfig)
def set_folder(data: ResumeConfigUpdate, db: Session = Depends(get_db)):
    path = data.folder_path.strip()
    if not os.path.isdir(path):
        raise HTTPException(status_code=400, detail=f"Path does not exist or is not a directory: {path}")
    _set(db, "resume_folder_path", path)
    return _get_config(db)


@router.get("", response_model=list[ResumeFileOut])
def list_resumes(db: Session = Depends(get_db)):
    folder = _require_folder(db)
    master  = _get(db, "master_resume_filename")
    default = _get(db, "default_resume_filename")

    files = []
    for name in sorted(os.listdir(folder)):
        if os.path.splitext(name)[1].lower() not in ALLOWED_EXTENSIONS:
            continue
        full = os.path.join(folder, name)
        if not os.path.isfile(full):
            continue
        stat = os.stat(full)
        files.append(ResumeFileOut(
            filename=name,
            size_bytes=stat.st_size,
            modified_at=datetime.fromtimestamp(stat.st_mtime, tz=UTC).replace(tzinfo=None),
            is_master=(name == master),
            is_default=(name == default),
        ))
    return files


@router.put("/master", status_code=204)
def set_master(data: ResumeFilenameUpdate, db: Session = Depends(get_db)):
    folder = _require_folder(db)
    if not os.path.isfile(os.path.join(folder, data.filename)):
        raise HTTPException(status_code=404, detail=f"File not found in resume folder: {data.filename}")
    _set(db, "master_resume_filename", data.filename)


@router.put("/default", status_code=204)
def set_default(data: ResumeFilenameUpdate, db: Session = Depends(get_db)):
    folder = _require_folder(db)
    if not os.path.isfile(os.path.join(folder, data.filename)):
        raise HTTPException(status_code=404, detail=f"File not found in resume folder: {data.filename}")
    _set(db, "default_resume_filename", data.filename)


@router.get("/read", response_model=ResumeTextOut)
def read_resume(filename: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    folder = _require_folder(db)
    # Reject path traversal attempts
    if os.sep in filename or filename.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid filename.")
    text = extract_resume_text(folder, filename)
    if len(text.strip()) < 50:
        raise HTTPException(
            status_code=422,
            detail="Extracted text is too short — the file may be image-based or empty.",
        )
    return ResumeTextOut(filename=filename, text=text, char_count=len(text))
