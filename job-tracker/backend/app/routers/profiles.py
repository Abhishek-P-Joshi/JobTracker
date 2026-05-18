from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Profile
from ..schemas import ProfileCreate, ProfileUpdate, ProfileOut

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("", response_model=list[ProfileOut])
def list_profiles(db: Session = Depends(get_db)):
    return db.query(Profile).order_by(Profile.created_at).all()


@router.post("", response_model=ProfileOut, status_code=201)
def create_profile(data: ProfileCreate, db: Session = Depends(get_db)):
    existing = db.query(Profile).filter(Profile.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="A profile with this name already exists.")
    profile = Profile(name=data.name, color=data.color)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.put("/{profile_id}", response_model=ProfileOut)
def update_profile(profile_id: int, data: ProfileUpdate, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    if data.name is not None:
        conflict = db.query(Profile).filter(
            Profile.name == data.name, Profile.id != profile_id
        ).first()
        if conflict:
            raise HTTPException(status_code=400, detail="A profile with this name already exists.")
        profile.name = data.name
    if data.color is not None:
        profile.color = data.color
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/{profile_id}", status_code=204)
def delete_profile(profile_id: int, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    if profile.jobs:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a profile that has jobs. Move or delete the jobs first.",
        )
    db.delete(profile)
    db.commit()
