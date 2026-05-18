from datetime import date, timedelta
from app.database import SessionLocal, engine, Base
from app.models import Profile, Job, StatusHistory


def main() -> None:
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        if db.query(Profile).count() > 0:
            print("Database already seeded.")
            return

        profiles_data = [
            {"name": "Ravi Kumar", "color": "#6366f1"},
            {"name": "Priya Sharma", "color": "#10b981"},
            {"name": "Arjun Mehta", "color": "#f59e0b"},
        ]
        profiles = []
        for p in profiles_data:
            profile = Profile(**p)
            db.add(profile)
            profiles.append(profile)
        db.flush()

        today = date.today()
        jobs_data = [
            {
                "profile_id": profiles[0].id,
                "company": "Razorpay",
                "title": "Senior Backend Engineer",
                "url": "https://razorpay.com/jobs/senior-backend",
                "location": "Bengaluru, Karnataka",
                "work_type": "hybrid",
                "salary_min": 3000000,
                "salary_max": 4500000,
                "currency": "INR",
                "status": "interview",
                "source": "linkedin",
                "applied_date": today - timedelta(days=14),
                "notes": "Had a great intro call. Technical round next week.",
            },
            {
                "profile_id": profiles[0].id,
                "company": "Swiggy",
                "title": "Software Engineer II",
                "url": "https://swiggy.com/careers",
                "location": "Bengaluru, Karnataka",
                "work_type": "onsite",
                "salary_min": 2000000,
                "salary_max": 3000000,
                "currency": "INR",
                "status": "applied",
                "source": "naukri",
                "applied_date": today - timedelta(days=7),
            },
            {
                "profile_id": profiles[0].id,
                "company": "Zepto",
                "title": "Backend Engineer",
                "location": "Mumbai, Maharashtra",
                "work_type": "remote",
                "status": "wishlist",
                "source": "linkedin",
            },
            {
                "profile_id": profiles[1].id,
                "company": "CRED",
                "title": "Product Designer",
                "url": "https://cred.club/careers",
                "location": "Bengaluru, Karnataka",
                "work_type": "hybrid",
                "salary_min": 2500000,
                "salary_max": 3500000,
                "currency": "INR",
                "status": "screening",
                "source": "linkedin",
                "applied_date": today - timedelta(days=5),
            },
            {
                "profile_id": profiles[2].id,
                "company": "Ola",
                "title": "Data Engineer",
                "location": "Bengaluru, Karnataka",
                "work_type": "hybrid",
                "salary_min": 1800000,
                "salary_max": 2800000,
                "currency": "INR",
                "status": "rejected",
                "source": "indeed",
                "applied_date": today - timedelta(days=21),
                "notes": "Rejected after technical round. Keep practicing DSA.",
            },
        ]

        for job_data in jobs_data:
            job = Job(**job_data)
            db.add(job)
            db.flush()
            history = StatusHistory(job_id=job.id, old_status=None, new_status=job.status)
            db.add(history)

        db.commit()
        print(f"Seeded {len(profiles)} profiles and {len(jobs_data)} jobs.")


if __name__ == "__main__":
    main()
