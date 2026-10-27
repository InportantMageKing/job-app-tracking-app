# Job Application Tracker — Design

**Status:** Approved in brainstorming, pending spec review

## Purpose

A personal system of record for a job search: record applications made across platforms (LinkedIn, Indeed, company sites, referrals), link to the original postings, track each application's status over time, attach notes, and see which resume versions perform best.

The design favors a small, well-reasoned system with clear boundaries over a wide feature set.

## Scope

**In scope**
- Multi-user accounts with a real login/signup screen
- Applications CRUD with a fixed status pipeline and a per-application event timeline (status changes and free-form notes)
- Resume versions with file upload and authenticated download
- Dashboard with pipeline and funnel metrics
- Backend unit and integration tests, plus light frontend component tests
- A `seed_testing` command that generates a realistic QA dataset
- Docker Compose for local development; a production-style compose as a stretch goal

**Out of scope**
- Cloud deployment and infrastructure-as-code (the app runs locally in Docker only)
- Email or notification reminders
- Job board scraping or importing
- User-defined pipeline stages

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Backend | Django + Django REST Framework (Python) | Mature, batteries-included framework the author knows deeply; built-in auth, ORM, and migrations |
| Frontend | React + Vite + TanStack Query | SPA; TanStack Query handles server-state caching, loading/error states, and invalidation |
| Database | PostgreSQL | Production-grade relational DB; plenty to discuss about constraints, indexes, and aggregation |
| Auth | DRF `TokenAuthentication` | Simple static per-user token; JWT is listed as a possible improvement |
| Tests | pytest-django + factory_boy; Vitest + React Testing Library | Shared factories serve both the tests and the seed command |
| Runtime | Docker Compose | Local only, no cloud spend |

## Architecture

```
React SPA (Vite)  --HTTP/JSON + Token-->  Django/DRF API  --ORM-->  PostgreSQL
                                               |
                                               +--> media volume (resume files, UUID names, never public)
```

Compose services (dev): `db` (Postgres, named volume, healthcheck), `backend` (`runserver`, bind-mounted code, waits for a healthy `db`, runs migrations at startup), `frontend` (Vite dev server, hot reload).

Stretch: `docker-compose.prod.yml` with gunicorn for Django and a multi-stage build that compiles the React app into static files served by nginx. nginx also reverse-proxies `/api`.

### Backend layout

- `accounts`: signup and login endpoints that return a DRF token
- `applications`: the `Application` and `ApplicationEvent` models, plus the service layer for status transitions
- `resumes`: the `ResumeVersion` model and the authenticated file download
- `dashboard`: read-only aggregation endpoint
- `core`: the `OwnedByUserViewSet` base class, shared test factories, and the `seed_testing` command

Business rules live in plain service functions (for example `applications/services.py`), not in views or serializers, so they can be tested on their own.

## Data Model

**User**: Django's built-in `auth.User`.

**ResumeVersion**
- `user` FK → User (required)
- `name` (short label, unique per user)
- `description` (text, optional)
- `file` (FileField; stored under a UUID filename; never exposed via `MEDIA_URL`)
- `original_filename` (shown in the UI and used as the download name)
- `created_at`

**Application**
- `user` FK → User (required)
- `company`, `job_title` (required)
- `source`: the platform the user applied through (choices: LinkedIn, Indeed, Company Site, Referral, Other)
- `link` (URL to the posting, optional)
- `date_applied` (date, required, defaults to today)
- `location` (free text, e.g. "Atlanta, GA" or "Remote")
- `salary_range` (free text)
- `contact_person` (free text)
- `resume_version` FK → ResumeVersion (nullable, `on_delete=SET_NULL`; must belong to the same user)
- `current_status` (choices below; changed only by the service layer)
- `created_at`, `updated_at`

**ApplicationEvent**
- `application` FK → Application (`on_delete=CASCADE`)
- `event_type`: `status_change` or `note`
- `from_status` (nullable; null for the creation event)
- `to_status` (required for `status_change`; null for `note`)
- `note` (text; required for `note`, optional for `status_change`)
- `created_at` (indexed together with `application`)

Events have no `user` field. Ownership comes from `application.user`.

### Status values

Pipeline stages, in order: `applied` < `phone_screen` < `interview` < `offer`.
Outcomes (not stages): `rejected`, `withdrawn`.

Transitions are **free**: any status can move to any other status. Real job searches aren't linear (a ghosting company can reach out months later; an offer can come with no screen), and the event log provides the audit trail. Setting the current status as the target is rejected as a no-op (400).

## Key Rules

1. **Creating an application writes the first event.** The service creates the `Application` with `current_status=applied` and a `status_change` event (`from_status=null`, `to_status=applied`) inside one transaction. The log is complete from the start.
2. **Status changes are atomic.** `change_status(application, to_status, note=None)` runs inside `transaction.atomic()` with `select_for_update()` on the application row. It inserts the event and updates `current_status` together. A test asserts that `current_status` always equals the newest `status_change` event's `to_status`.
3. **`current_status` is read-only through the API.** PATCH on an application ignores or rejects it. The only way to change status is the events endpoint.
4. **Data isolation.** Every viewset inherits from `OwnedByUserViewSet`, which filters the queryset to `request.user` and sets `user` on create. Requests for another user's object return **404** (not 403), so the API doesn't reveal that the ID exists. The events endpoint resolves the parent application through the same scoped queryset. `resume_version` on an application is validated to belong to the requesting user.
5. **Resume files are never public.** Files are stored under UUID filenames in a media volume that isn't served by URL. `GET /api/resume-versions/{id}/file/` checks the token and ownership, then streams the file with `FileResponse` using `original_filename`. Uploads are limited to PDF/DOC/DOCX and 5 MB.

## API

All endpoints are under `/api/` and require `Authorization: Token <key>` unless noted.

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/signup/` | Create a user and return a token (no auth) |
| POST | `/auth/login/` | Exchange username/password for a token (no auth) |
| POST | `/auth/logout/` | Delete the user's token |
| GET, POST | `/applications/` | List (filter by `status`, `source`; search `company`/`job_title`; order by `date_applied`) and create |
| GET, PATCH, DELETE | `/applications/{id}/` | Detail (includes events, newest first), edit fields, delete |
| POST | `/applications/{id}/events/` | Add a note (`{"event_type": "note", "note": "..."}`) or change status (`{"event_type": "status_change", "to_status": "interview", "note": "optional"}`) |
| GET, POST | `/resume-versions/` | List (with usage counts) and upload (multipart: `name`, `description`, `file`) |
| GET, PATCH, DELETE | `/resume-versions/{id}/` | Detail, edit name/description, delete (linked applications become `null`) |
| GET | `/resume-versions/{id}/file/` | Authenticated file download |
| GET | `/dashboard/stats/` | All dashboard metrics in one payload |

### Errors

DRF's standard JSON error shape. 400 for validation errors (bad status, no-op transition, a note event without text, a wrong file type or size, another user's resume version). 401 when the token is missing or invalid. 404 for objects that don't exist or belong to someone else.

## Dashboard Metrics

All metrics are scoped to `request.user`.

- **Pipeline now**: application counts grouped by `current_status`.
- **Funnel**: the percentage of applications that ever reached Phone Screen, Interview, and Offer. "Reached X" means a `status_change` event exists whose `to_status` is X **or any later pipeline stage**, so an `Applied → Offer` jump counts as having reached Interview. Outcomes never count as progress. Computed from the event log, not `current_status`, because an application that went `Interview → Rejected` still reached Interview.
- **Applications per week**: counts bucketed by the ISO week of `date_applied`, covering the last 12 weeks, with zero-filled gaps.
- **Resume version performance**: for each resume version, the application count and funnel percentages. Applications with no resume version are grouped as "None".

Stretch: average days from Applied to the first move out of Applied.

## Frontend

Pages:
- **Login / Signup**: the token is stored in `localStorage`; a 401 response clears it and redirects to login.
- **Dashboard**: pipeline counts, a funnel chart, a weekly bar chart, and a resume performance table.
- **Applications list**: a table with status and source filters, search, and a "New application" button.
- **Application detail**: editable fields, a resume version dropdown (with an "Upload new version" option that opens the upload form inline and selects the result), a timeline (events newest first), and controls for adding a note or changing status.
- **Resume Versions**: a list with name, description, a file download link, and usage stats; plus an upload form.

Data layer: a small `api.ts` client injects the token. TanStack Query handles reads, and mutations invalidate the affected queries (for example, adding an event invalidates the application detail, list, and dashboard).

## Testing

**Backend (pytest-django, real Postgres test DB)**
- Factories: `UserFactory`, `ResumeVersionFactory`, `ApplicationFactory` (which creates the initial event through the service), and a helper that builds a realistic event history.
- Service tests: creation writes the first event; `change_status` updates both the event log and the field atomically; no-op transitions are rejected; the `current_status` field matches the latest event's `to_status`.
- API integration tests for every endpoint: success paths, validation errors, 401 without a token.
- **Isolation test**: one parametrized test hits every object endpoint as user B against user A's objects and expects 404, including the file download and the events endpoint.
- Dashboard tests: funnel math checked against a hand-built dataset, including the `Interview → Rejected` and `Applied → Offer` cases.
- Upload tests: file type and size rejection, UUID storage name, and the download returning the original filename.

**Frontend (Vitest + React Testing Library)**
- Timeline renders status changes and notes in order.
- Dashboard charts render the data they're given.
- The add-event form validates input before submitting.

## Seed Data

`python manage.py seed_testing` is a QA tool built on the same factories as the tests. It creates two users with about 40 applications each, event histories backdated over the last two months (relative to the run date, so weekly charts are never empty), 3 resume versions with small generated PDFs, and notes. It's idempotent: re-running it resets those users' data. Credentials are printed when it finishes.

## Build Order

**Phase 1:** Compose skeleton, Postgres, models and migrations, token auth, the applications and events API with the service layer, backend tests as each piece is built, and a React shell with login, list, detail, and create.

**Phase 2:** Resume versions (upload, dropdown, authenticated download), dashboard endpoint and charts, the `seed_testing` command, frontend tests, polish, and the README. Stretch: the production compose and the time-in-stage metric.

If time runs short, cut in this order: the stretch goals, then frontend tests, then dashboard charts (keep the stats endpoint and a plain table). Resume versions and the isolation test stay.

## Possible Improvements

- Deploy to AWS (ECS Fargate + RDS + S3 for resume files, switched through Django's storage backend with no app-code changes)
- JWT with refresh tokens, or httpOnly cookie sessions, instead of tokens in `localStorage`
- Postgres row-level security as a second layer of data isolation
- Signed, expiring download URLs
- Follow-up reminders
- User-defined pipeline stages

## Working Notes

A private dev log at `notes/dev-log.md` (gitignored) records problems, decisions, and corrections to AI-generated code as they happen.
