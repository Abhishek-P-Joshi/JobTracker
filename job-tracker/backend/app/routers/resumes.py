import os
from datetime import datetime, UTC
from typing import Optional

from docx import Document as DocxDocument
import pypdf
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AppSettings
from ..schemas import ResumeConfig, ResumeConfigUpdate, ResumeFilenameUpdate, ResumeFileOut, ResumeTextOut

router = APIRouter(prefix="/resumes", tags=["resumes"])

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
MAX_RESUME_FILES = 500

# ── Settings helpers ──────────────────────────────────────────────────────────

def _get(db: Session, key: str) -> Optional[str]:
    row = db.query(AppSettings).filter(AppSettings.key == key).first()
    return row.value if row else None


def _set(db: Session, key: str, value: str) -> None:
    row = db.query(AppSettings).filter(AppSettings.key == key).first()
    if row:
        row.value = value
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
        raise HTTPException(
            status_code=400,
            detail="Resume folder not configured or no longer accessible. Set it via PUT /resumes/config.",
        )
    return path


# ── Path safety ───────────────────────────────────────────────────────────────

def _safe_join(folder: str, filename: str) -> str:
    """Resolve the full path and reject anything that escapes the folder."""
    resolved = os.path.realpath(os.path.join(folder, filename))
    folder_real = os.path.realpath(folder)
    if resolved != folder_real and not resolved.startswith(folder_real + os.sep):
        raise HTTPException(status_code=400, detail="Invalid filename.")
    return resolved


def _validate_resume_filename(folder: str, filename: str) -> str:
    """Check extension and path safety; return the resolved absolute path."""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use .pdf or .docx.")
    return _safe_join(folder, filename)


# ── Text extraction ───────────────────────────────────────────────────────────

def extract_resume_text(folder_path: str, filename: str) -> str:
    """Extract plain text from a .pdf or .docx inside folder_path."""
    path = _safe_join(folder_path, filename)
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
            doc = DocxDocument(path)
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

    entries = sorted(os.listdir(folder))
    # TODO (medium): add pagination if this limit becomes too restrictive
    if len(entries) > MAX_RESUME_FILES:
        raise HTTPException(status_code=400, detail=f"Resume folder contains more than {MAX_RESUME_FILES} files.")

    files = []
    for name in entries:
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
    path = _validate_resume_filename(folder, data.filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail=f"File not found in resume folder: {data.filename}")
    _set(db, "master_resume_filename", data.filename)


@router.put("/default", status_code=204)
def set_default(data: ResumeFilenameUpdate, db: Session = Depends(get_db)):
    folder = _require_folder(db)
    path = _validate_resume_filename(folder, data.filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail=f"File not found in resume folder: {data.filename}")
    _set(db, "default_resume_filename", data.filename)


@router.get("/read", response_model=ResumeTextOut)
def read_resume(filename: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    folder = _require_folder(db)
    _validate_resume_filename(folder, filename)  # extension + path traversal check
    text = extract_resume_text(folder, filename)
    if len(text.strip()) < 50:
        raise HTTPException(
            status_code=422,
            detail="Extracted text is too short — the file may be image-based or empty.",
        )
    return ResumeTextOut(filename=filename, text=text, char_count=len(text))
