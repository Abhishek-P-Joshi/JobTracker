from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import profiles, jobs, analytics, export

Base.metadata.create_all(bind=engine)

app = FastAPI(title="JobTrack API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    # TODO (low): pin to your specific extension ID once stable, e.g.
    # allow_origin_regex=r"chrome-extension://abcdefghijklmnopabcdefghijklmnop"
    allow_origin_regex=r"chrome-extension://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profiles.router)
app.include_router(jobs.router)
app.include_router(analytics.router)
app.include_router(export.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "JobTrack API"}
