# Job Application Tracker

Track job applications across platforms (LinkedIn, Indeed, company sites, referrals) in one place: link each posting, follow its status over time, keep notes, and see which resume versions perform best.

## Stack

Django + Django REST Framework, PostgreSQL, React (Vite), Docker Compose.

## Requirements

- Docker Desktop (on Windows, with WSL integration enabled)

## Run

```bash
docker compose up --build
```

- API: http://localhost:8000/api/
- Health check: http://localhost:8000/api/health/
- Django admin: http://localhost:8000/admin/ (create a login with `docker compose run --rm backend python manage.py createsuperuser`)

## Test

```bash
docker compose run --rm backend pytest
```
