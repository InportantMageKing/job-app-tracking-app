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

- App: http://localhost:5173
- API: http://localhost:8000/api/ (the app reaches it through the Vite proxy at `/api`)
- Health check: http://localhost:8000/api/health/
- Django admin: http://localhost:8000/admin/ (create a login with `docker compose run --rm backend python manage.py createsuperuser`)

## Test

```bash
docker compose run --rm backend pytest                          # backend
docker compose run --rm --no-deps frontend npm test             # frontend
docker compose run --rm --no-deps frontend npm run typecheck    # frontend types
```

## QA dataset

```bash
docker compose run --rm backend python manage.py seed_testing
```

Deletes and recreates two test users, `tester1` and `tester2` (password `testing-pass-123`), each with 3 resume versions and 40 applications whose status histories and notes are spread over the last 60 days. It uses the same factories as the test suite. Options: `--applications N` per user and `--seed S` for a different but repeatable dataset.
