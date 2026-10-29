# Backend API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Django REST API for the job application tracker, running in Docker Compose with PostgreSQL. It covers token auth, applications with an event timeline, resume versions with authenticated file downloads, dashboard metrics, and a `seed_testing` QA dataset, all covered by pytest.

**Architecture:** One Django project (`config`) with five apps: `core`, `accounts`, `applications`, `resumes`, `dashboard`. Business rules live in plain service functions (`applications/services.py`, `dashboard/services.py`), and the DRF views stay thin. Every viewset that returns user-owned rows inherits `OwnedByUserViewSet`, which limits queries to the requesting user, so another user's object returns 404.

**Tech Stack:** Python 3.13, Django 5.2, Django REST Framework 3.16, PostgreSQL 17, psycopg 3, pytest + pytest-django, factory_boy, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-27-job-app-tracker-design.md`

**Not in this plan:** the React frontend and the production compose file. Those are separate plans.

## Global Constraints

Every task must follow all of these.

### How to run commands (read this first)

- The Bash tool runs **Windows Git Bash**, but the repo, Docker, and git SSH access all live in **WSL**. Run **every** shell command through WSL from the repo root, like this:

  ```bash
  wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && <command>"
  ```

  Keep the `-i` flag. It loads `~/.bashrc`, which sets up the SSH agent that git needs. If you see `bash: cannot set terminal process group` or `no job control in this shell`, ignore it; it's harmless noise.
- Use these paths with the Read/Write/Edit tools: `//wsl.localhost/Ubuntu/home/atlas/projects/job-app-tracking-app/<path>`. Example: `//wsl.localhost/Ubuntu/home/atlas/projects/job-app-tracking-app/backend/config/settings.py`.
- **Never** run `pip`, `python`, or `pytest` directly on the host. They always run inside the backend container:
  - Run tests: `docker compose run --rm backend pytest <path> -v`
  - Run a manage.py command: `docker compose run --rm backend python manage.py <command>`
  - After changing `backend/requirements.txt` or `backend/Dockerfile`: `docker compose build backend`
- The container runs as uid/gid `1000:1000` (the WSL user `atlas`), so files it generates, like migrations, are editable from the host.

### Commits

- Commit at the end of every task, using exactly this form (replace the subject line):

  ```bash
  wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && git add <files> && git commit -q -F - <<'EOF'
  <type>: <short summary>

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01RB2bbsCup8DUXijebkCiKi
  EOF
  git log --oneline -1"
  ```

- Commit subjects must not contain `$`, backticks, or double quotes, because those break the wrapper.
- Don't push. The user pushes.

### Content rules

- Code, comments, docs, and commit messages describe this only as a personal job-application tracker. Don't add any other framing about why it was built or who it's for.
- Match the comment density of the code in this plan: short docstrings on non-obvious functions, and no narration comments.

### Fixed values (copy exactly)

| Thing | Value |
|---|---|
| Status values, in order | `applied`, `phone_screen`, `interview`, `offer`, `rejected`, `withdrawn` |
| Pipeline stages (ordered) | `applied` < `phone_screen` < `interview` < `offer` |
| Outcomes (not stages) | `rejected`, `withdrawn` |
| Source values | `linkedin`, `indeed`, `company_site`, `referral`, `other` |
| Event types | `status_change`, `note` |
| Allowed resume extensions | `.pdf`, `.doc`, `.docx` |
| Max resume size | 5 MB (`5 * 1024 * 1024` bytes), setting `RESUME_MAX_UPLOAD_BYTES` |
| Seed users / password | `tester1`, `tester2` / `testing-pass-123` |
| Test user password | `test-pass-123` |
| API prefix | `/api/` |
| Auth header | `Authorization: Token <key>` |

---

## File Structure

```
docker-compose.yml                 # db + backend services (dev)
README.md                          # how to run, test, seed
.gitignore
backend/
  Dockerfile
  .dockerignore
  requirements.txt
  pytest.ini
  conftest.py                      # shared pytest fixtures (clients, users, temp media)
  manage.py
  config/
    __init__.py
    settings.py
    urls.py                        # all URL wiring lives here
    wsgi.py
  core/
    __init__.py
    apps.py
    views.py                       # health check
    viewsets.py                    # OwnedByUserViewSet
    factories.py                   # factory_boy factories + MINIMAL_PDF + apply_status_path
    management/__init__.py
    management/commands/__init__.py
    management/commands/seed_testing.py
    tests/__init__.py
    tests/test_health.py
    tests/test_factories.py
    tests/test_isolation.py
    tests/test_seed_testing.py
  accounts/
    __init__.py
    apps.py
    serializers.py                 # SignupSerializer, LoginSerializer
    views.py                       # signup_view, login_view, logout_view
    urls.py
    tests/__init__.py
    tests/test_auth.py
  applications/
    __init__.py
    apps.py
    models.py                      # Status, Source, EventType, Application, ApplicationEvent
    admin.py
    services.py                    # create_application, change_status, add_note
    serializers.py
    views.py                       # ApplicationViewSet (+ events action)
    urls.py
    migrations/                    # generated
    tests/__init__.py
    tests/test_models.py
    tests/test_services.py
    tests/test_api_applications.py
    tests/test_api_events.py
  resumes/
    __init__.py
    apps.py
    models.py                      # ResumeVersion, resume_upload_to
    admin.py
    serializers.py
    views.py                       # ResumeVersionViewSet (+ download action)
    urls.py
    migrations/                    # generated
    tests/__init__.py
    tests/test_models.py
    tests/test_api_resumes.py
  dashboard/
    __init__.py
    apps.py
    services.py                    # pipeline_counts, funnel, applications_per_week, resume_performance, dashboard_stats
    views.py                       # stats_view
    tests/__init__.py
    tests/test_stats.py
```

---

### Task 0: Prerequisites (done by the user, not a subagent)

- [ ] **Step 1: Turn on Docker Desktop's WSL integration**

In Docker Desktop on Windows, open **Settings → Resources → WSL integration**, switch on **Ubuntu**, then click **Apply & restart**.

- [ ] **Step 2: Verify Docker works from WSL**

Run: `wsl.exe -e bash -ic "docker --version && docker compose version && id -u"`
Expected: a Docker version, a Compose version (v2.x), and `1000`. If `id -u` doesn't print `1000`, replace every `1000:1000` in this plan with your uid:gid before starting.

---

### Task 1: Docker + Django skeleton with a health check

**Files:**
- Create: `docker-compose.yml`, `README.md`
- Modify: `.gitignore`
- Create: `backend/Dockerfile`, `backend/.dockerignore`, `backend/requirements.txt`, `backend/pytest.ini`, `backend/conftest.py`, `backend/manage.py`
- Create: `backend/config/__init__.py`, `backend/config/settings.py`, `backend/config/urls.py`, `backend/config/wsgi.py`
- Create, for each app in `core`, `accounts`, `applications`, `resumes`, `dashboard`: `backend/<app>/__init__.py`, `backend/<app>/apps.py`, `backend/<app>/tests/__init__.py`
- Create: `backend/core/views.py`
- Test: `backend/core/tests/test_health.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `GET /api/health/` → `200 {"status": "ok"}`, no auth needed. The pytest fixtures `media_root` (autouse) and `api_client` (unauthenticated `APIClient`). Settings `RESUME_MAX_UPLOAD_BYTES` and `MEDIA_ROOT`. All five apps are registered in `INSTALLED_APPS`.

- [ ] **Step 1: Create `docker-compose.yml` at the repo root**

```yaml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_DB: jobtracker
      POSTGRES_USER: jobtracker
      POSTGRES_PASSWORD: jobtracker
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U jobtracker -d jobtracker"]
      interval: 2s
      timeout: 5s
      retries: 15

  backend:
    build: ./backend
    user: "1000:1000"
    command: sh -c "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"
    environment:
      DJANGO_DEBUG: "1"
      DJANGO_SECRET_KEY: dev-only-not-secret
      DJANGO_ALLOWED_HOSTS: localhost,127.0.0.1,backend
      POSTGRES_HOST: db
      POSTGRES_DB: jobtracker
      POSTGRES_USER: jobtracker
      POSTGRES_PASSWORD: jobtracker
      MEDIA_ROOT: /data/media
      HOME: /tmp
    volumes:
      - ./backend:/app
      - media_data:/data/media
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy

volumes:
  pg_data:
  media_data:
```

- [ ] **Step 2: Create `backend/requirements.txt`**

```
Django~=5.2.0
djangorestframework~=3.16.0
psycopg[binary]~=3.2.0
pytest~=8.4.0
pytest-django~=4.11.0
factory-boy~=3.3.0
```

- [ ] **Step 3: Create `backend/Dockerfile`**

```dockerfile
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Uploaded resumes live here (a named volume in compose); owned by the non-root app user.
RUN mkdir -p /data/media && chown -R 1000:1000 /data

COPY . .
```

- [ ] **Step 4: Create `backend/.dockerignore`**

```
__pycache__/
*.pyc
.pytest_cache/
media/
```

- [ ] **Step 5: Replace `.gitignore` at the repo root with:**

```
# Private working notes
notes/

# Python
__pycache__/
*.pyc
.pytest_cache/

# Local uploads (dev media lives in a Docker volume)
backend/media/
```

- [ ] **Step 6: Create `backend/manage.py`**

```python
#!/usr/bin/env python
import os
import sys


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
```

- [ ] **Step 7: Create `backend/config/__init__.py` (empty file) and `backend/config/wsgi.py`**

`backend/config/wsgi.py`:

```python
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

application = get_wsgi_application()
```

- [ ] **Step 8: Create `backend/config/settings.py`**

```python
"""Django settings. Environment-specific values come from environment variables."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-not-secret")
DEBUG = os.environ.get("DJANGO_DEBUG", "0") == "1"
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if host.strip()
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "core",
    "accounts",
    "applications",
    "resumes",
    "dashboard",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "jobtracker"),
        "USER": os.environ.get("POSTGRES_USER", "jobtracker"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "jobtracker"),
        "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "America/New_York"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

# Uploaded files are never served by URL; downloads go through an authenticated API endpoint.
MEDIA_ROOT = os.environ.get("MEDIA_ROOT", str(BASE_DIR / "media"))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.TokenAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}

RESUME_MAX_UPLOAD_BYTES = 5 * 1024 * 1024
```

- [ ] **Step 9: Create the five app packages**

For each app, create three files. `__init__.py` and `tests/__init__.py` are empty. `apps.py` follows this pattern:

`backend/core/apps.py`:

```python
from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"
```

`backend/accounts/apps.py`:

```python
from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"
```

`backend/applications/apps.py`:

```python
from django.apps import AppConfig


class ApplicationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "applications"
```

`backend/resumes/apps.py`:

```python
from django.apps import AppConfig


class ResumesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "resumes"
```

`backend/dashboard/apps.py`:

```python
from django.apps import AppConfig


class DashboardConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "dashboard"
```

Empty files to create: `backend/core/__init__.py`, `backend/core/tests/__init__.py`, `backend/accounts/__init__.py`, `backend/accounts/tests/__init__.py`, `backend/applications/__init__.py`, `backend/applications/tests/__init__.py`, `backend/resumes/__init__.py`, `backend/resumes/tests/__init__.py`, `backend/dashboard/__init__.py`, `backend/dashboard/tests/__init__.py`.

- [ ] **Step 10: Create `backend/config/urls.py` (no health route yet)**

```python
from django.contrib import admin
from django.urls import path

urlpatterns = [
    path("admin/", admin.site.urls),
]
```

- [ ] **Step 11: Create `backend/pytest.ini` and `backend/conftest.py`**

`backend/pytest.ini`:

```ini
[pytest]
DJANGO_SETTINGS_MODULE = config.settings
python_files = test_*.py
addopts = -p no:cacheprovider
```

`backend/conftest.py`:

```python
import pytest
from rest_framework.test import APIClient


@pytest.fixture(autouse=True)
def media_root(settings, tmp_path):
    """Send every test's uploads to a throwaway directory."""
    settings.MEDIA_ROOT = str(tmp_path / "media")
    return settings.MEDIA_ROOT


@pytest.fixture
def api_client():
    return APIClient()
```

- [ ] **Step 12: Build the image**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose build backend"`
Expected: the build finishes and the output ends with a line naming the built image (for example `job-app-tracking-app-backend  Built`). The first build downloads `python:3.13-slim` and takes a few minutes.

- [ ] **Step 13: Write the failing test `backend/core/tests/test_health.py`**

```python
import pytest


@pytest.mark.django_db
def test_health_returns_ok_without_auth(api_client):
    response = api_client.get("/api/health/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 14: Run it and confirm it fails**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest core/tests/test_health.py -v"`
Expected: `FAILED core/tests/test_health.py::test_health_returns_ok_without_auth` with `assert 404 == 200`. Compose starts `db` first and waits for it to report healthy.

- [ ] **Step 15: Create `backend/core/views.py`**

```python
from django.db import connection
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    """Liveness check that also proves the database is reachable."""
    connection.ensure_connection()
    return Response({"status": "ok"})
```

- [ ] **Step 16: Replace `backend/config/urls.py` with:**

```python
from django.contrib import admin
from django.urls import path

from core.views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health),
]
```

- [ ] **Step 17: Run the test and confirm it passes**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest core/tests/test_health.py -v"`
Expected: `1 passed`.

- [ ] **Step 18: Smoke-test the running server**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose up -d && sleep 8 && curl -s http://localhost:8000/api/health/ && docker compose down"`
Expected: `{"status":"ok"}` appears in the output. If curl prints nothing, run `docker compose logs backend` to see the error.

- [ ] **Step 19: Create `README.md` at the repo root (replaces the one-line file)**

````markdown
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
````

- [ ] **Step 20: Commit**

```bash
wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && git add docker-compose.yml README.md .gitignore backend && git status --short && git commit -q -F - <<'EOF'
feat: add Docker Compose and Django skeleton with health check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RB2bbsCup8DUXijebkCiKi
EOF
git log --oneline -1"
```

Expected: `git status --short` lists only files under `backend/` plus `docker-compose.yml`, `README.md`, and `.gitignore`. No `__pycache__` entries.

---

### Task 2: Data model (ResumeVersion, Application, ApplicationEvent)

**Files:**
- Create: `backend/resumes/models.py`, `backend/resumes/admin.py`
- Create: `backend/applications/models.py`, `backend/applications/admin.py`
- Generated: `backend/resumes/migrations/0001_initial.py`, `backend/applications/migrations/0001_initial.py` (plus each folder's `__init__.py`)
- Test: `backend/applications/tests/test_models.py`, `backend/resumes/tests/test_models.py`

**Interfaces:**
- Consumes: Task 1 settings and fixtures.
- Produces:
  - `resumes.models.resume_upload_to(instance, filename: str) -> str`, which returns `"resumes/<32 hex chars><lowercase ext>"`
  - `resumes.models.ResumeVersion` with fields `user`, `name`, `description`, `file`, `original_filename`, `created_at`; reverse names `user.resume_versions` and `resume.applications`
  - `applications.models.Status`, `Source`, `EventType` (Django `TextChoices`)
  - `applications.models.PIPELINE_STAGES: list[Status]` = `[APPLIED, PHONE_SCREEN, INTERVIEW, OFFER]`
  - `applications.models.stages_at_or_after(stage) -> list[Status]`, which raises `ValueError` for outcomes
  - `applications.models.Application` with fields `user`, `company`, `job_title`, `source`, `link`, `date_applied`, `location`, `salary_range`, `contact_person`, `resume_version`, `current_status`, `created_at`, `updated_at`; reverse names `user.applications` and `application.events`
  - `applications.models.ApplicationEvent` with fields `application`, `event_type`, `from_status`, `to_status`, `note`, `created_at`; default ordering newest first (`-created_at`, `-id`)

- [ ] **Step 1: Write the failing test `backend/resumes/tests/test_models.py`**

```python
import re

import pytest
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.db import IntegrityError, transaction

from resumes.models import ResumeVersion, resume_upload_to


def test_upload_to_uses_uuid_and_lowercase_extension():
    path = resume_upload_to(None, "My Resume.PDF")
    assert re.fullmatch(r"resumes/[0-9a-f]{32}\.pdf", path)


def test_upload_to_never_reuses_a_name():
    assert resume_upload_to(None, "cv.pdf") != resume_upload_to(None, "cv.pdf")


@pytest.mark.django_db
def test_resume_names_are_unique_per_user():
    User = get_user_model()
    alice = User.objects.create_user(username="alice", password="test-pass-123")
    bob = User.objects.create_user(username="bob", password="test-pass-123")

    def make(owner):
        return ResumeVersion.objects.create(
            user=owner,
            name="Backend v1",
            original_filename="cv.pdf",
            file=ContentFile(b"%PDF-1.4", name="cv.pdf"),
        )

    make(alice)
    make(bob)  # same name, different user: allowed
    with pytest.raises(IntegrityError), transaction.atomic():
        make(alice)
```

- [ ] **Step 2: Write the failing test `backend/applications/tests/test_models.py`**

```python
import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from applications.models import (
    Application,
    ApplicationEvent,
    EventType,
    Status,
    stages_at_or_after,
)


@pytest.fixture
def application(db):
    owner = get_user_model().objects.create_user(username="owner", password="test-pass-123")
    return Application.objects.create(user=owner, company="Acme", job_title="Engineer")


def test_stages_at_or_after_returns_the_stage_and_later_stages():
    assert stages_at_or_after(Status.APPLIED) == [
        Status.APPLIED,
        Status.PHONE_SCREEN,
        Status.INTERVIEW,
        Status.OFFER,
    ]
    assert stages_at_or_after(Status.INTERVIEW) == [Status.INTERVIEW, Status.OFFER]
    assert stages_at_or_after(Status.OFFER) == [Status.OFFER]


@pytest.mark.parametrize("outcome", [Status.REJECTED, Status.WITHDRAWN])
def test_stages_at_or_after_rejects_outcomes(outcome):
    with pytest.raises(ValueError):
        stages_at_or_after(outcome)


def test_new_application_defaults(application):
    assert application.current_status == Status.APPLIED
    assert application.date_applied is not None
    assert application.resume_version is None


def test_status_change_event_requires_to_status(application):
    with pytest.raises(IntegrityError), transaction.atomic():
        ApplicationEvent.objects.create(application=application, event_type=EventType.STATUS_CHANGE)


def test_note_event_requires_text(application):
    with pytest.raises(IntegrityError), transaction.atomic():
        ApplicationEvent.objects.create(application=application, event_type=EventType.NOTE, note="")


def test_note_event_cannot_carry_a_status(application):
    with pytest.raises(IntegrityError), transaction.atomic():
        ApplicationEvent.objects.create(
            application=application,
            event_type=EventType.NOTE,
            note="Recruiter called",
            to_status=Status.OFFER,
        )


def test_valid_events_save(application):
    ApplicationEvent.objects.create(
        application=application,
        event_type=EventType.STATUS_CHANGE,
        from_status=None,
        to_status=Status.APPLIED,
    )
    ApplicationEvent.objects.create(application=application, event_type=EventType.NOTE, note="Recruiter called")
    assert application.events.count() == 2


def test_deleting_an_application_deletes_its_events(application):
    ApplicationEvent.objects.create(application=application, event_type=EventType.NOTE, note="hello")
    application.delete()
    assert ApplicationEvent.objects.count() == 0
```

- [ ] **Step 3: Run both test files and confirm they fail**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest resumes/tests/test_models.py applications/tests/test_models.py -v"`
Expected: collection errors such as `ImportError: cannot import name 'ResumeVersion' from 'resumes.models'` (or `ModuleNotFoundError`).

- [ ] **Step 4: Create `backend/resumes/models.py`**

```python
import uuid
from pathlib import Path

from django.conf import settings
from django.db import models


def resume_upload_to(instance, filename):
    """Store uploads under a random name so paths reveal nothing and never collide."""
    extension = Path(filename).suffix.lower()
    return f"resumes/{uuid.uuid4().hex}{extension}"


class ResumeVersion(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="resume_versions",
    )
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to=resume_upload_to, max_length=255)
    original_filename = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["user", "name"], name="unique_resume_name_per_user"),
        ]

    def __str__(self):
        return self.name
```

- [ ] **Step 5: Create `backend/applications/models.py`**

```python
from django.conf import settings
from django.db import models
from django.utils import timezone


class Status(models.TextChoices):
    APPLIED = "applied", "Applied"
    PHONE_SCREEN = "phone_screen", "Phone Screen"
    INTERVIEW = "interview", "Interview"
    OFFER = "offer", "Offer"
    REJECTED = "rejected", "Rejected"
    WITHDRAWN = "withdrawn", "Withdrawn"


# Ordered progress stages. Rejected and Withdrawn are outcomes, not progress.
PIPELINE_STAGES = [Status.APPLIED, Status.PHONE_SCREEN, Status.INTERVIEW, Status.OFFER]


def stages_at_or_after(stage):
    """Return `stage` and every later pipeline stage (used for "ever reached X" metrics)."""
    if stage not in PIPELINE_STAGES:
        raise ValueError(f"{stage!r} is not a pipeline stage")
    return PIPELINE_STAGES[PIPELINE_STAGES.index(stage):]


class Source(models.TextChoices):
    LINKEDIN = "linkedin", "LinkedIn"
    INDEED = "indeed", "Indeed"
    COMPANY_SITE = "company_site", "Company Site"
    REFERRAL = "referral", "Referral"
    OTHER = "other", "Other"


class EventType(models.TextChoices):
    STATUS_CHANGE = "status_change", "Status change"
    NOTE = "note", "Note"


class Application(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="applications",
    )
    company = models.CharField(max_length=200)
    job_title = models.CharField(max_length=200)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.OTHER)
    link = models.URLField(max_length=500, blank=True)
    date_applied = models.DateField(default=timezone.localdate)
    location = models.CharField(max_length=200, blank=True)
    salary_range = models.CharField(max_length=100, blank=True)
    contact_person = models.CharField(max_length=200, blank=True)
    resume_version = models.ForeignKey(
        "resumes.ResumeVersion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="applications",
    )
    # Denormalized from the event log for cheap list/dashboard queries.
    # Only applications.services may change it.
    current_status = models.CharField(max_length=20, choices=Status.choices, default=Status.APPLIED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date_applied", "-created_at"]
        indexes = [models.Index(fields=["user", "current_status"])]

    def __str__(self):
        return f"{self.job_title} at {self.company}"


class ApplicationEvent(models.Model):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="events")
    event_type = models.CharField(max_length=20, choices=EventType.choices)
    from_status = models.CharField(max_length=20, choices=Status.choices, null=True, blank=True)
    to_status = models.CharField(max_length=20, choices=Status.choices, null=True, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["application", "created_at"])]
        constraints = [
            # A status change always has a target; a note has text and never touches status.
            models.CheckConstraint(
                condition=(
                    models.Q(event_type="status_change", to_status__isnull=False)
                    | (
                        models.Q(event_type="note", from_status__isnull=True, to_status__isnull=True)
                        & ~models.Q(note="")
                    )
                ),
                name="application_event_shape_valid",
            ),
        ]

    def __str__(self):
        return f"{self.event_type} on {self.application_id}"
```

- [ ] **Step 6: Create the admin registrations**

`backend/resumes/admin.py`:

```python
from django.contrib import admin

from .models import ResumeVersion


@admin.register(ResumeVersion)
class ResumeVersionAdmin(admin.ModelAdmin):
    list_display = ["name", "user", "original_filename", "created_at"]
    exclude = ["file"]
    readonly_fields = ["original_filename"]

    def has_add_permission(self, request):
        # Uploads go through the API so validation and naming rules always apply.
        return False
```

`backend/applications/admin.py`:

```python
from django.contrib import admin

from .models import Application, ApplicationEvent


class ApplicationEventInline(admin.TabularInline):
    model = ApplicationEvent
    extra = 0
    can_delete = False
    readonly_fields = ["event_type", "from_status", "to_status", "note", "created_at"]


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ["company", "job_title", "user", "current_status", "date_applied"]
    list_filter = ["current_status", "source"]
    search_fields = ["company", "job_title"]
    readonly_fields = ["current_status"]
    inlines = [ApplicationEventInline]

    def has_add_permission(self, request):
        # Creation must go through the service layer so the first event is written.
        return False
```

- [ ] **Step 7: Generate the migrations**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend python manage.py makemigrations resumes applications"`
Expected output includes:

```
Migrations for 'resumes':
  resumes/migrations/0001_initial.py
    + Create model ResumeVersion
Migrations for 'applications':
  applications/migrations/0001_initial.py
    + Create model Application
    + Create model ApplicationEvent
```

The exact lines can differ slightly, but there must be one `0001_initial.py` file for each app.

- [ ] **Step 8: Run the tests and confirm they pass**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest -v"`
Expected: `13 passed` (the 12 model tests plus the health test).

- [ ] **Step 9: Commit**

```bash
wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && git add backend && git commit -q -F - <<'EOF'
feat: add application, event, and resume version models

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RB2bbsCup8DUXijebkCiKi
EOF
git log --oneline -1"
```

---

### Task 3: Service layer, test factories, and shared fixtures

**Files:**
- Create: `backend/applications/services.py`
- Create: `backend/core/factories.py`
- Modify (replace whole file): `backend/conftest.py`
- Test: `backend/applications/tests/test_services.py`, `backend/core/tests/test_factories.py`

**Interfaces:**
- Consumes: the Task 2 models.
- Produces:
  - `applications.services.ApplicationRuleError(Exception)`
  - `applications.services.create_application(*, user, **fields) -> Application`. Always starts at `applied`, ignores any `current_status` passed in, and writes the creation event (`from_status=None`, `to_status="applied"`).
  - `applications.services.change_status(*, application, to_status: str, note: str = "") -> ApplicationEvent`. Raises `ApplicationRuleError` for an unknown status or a no-op move. Also updates `application.current_status` on the object passed in.
  - `applications.services.add_note(*, application, note: str) -> ApplicationEvent`. Strips whitespace and raises `ApplicationRuleError` when the note is blank.
  - `core.factories.TEST_PASSWORD = "test-pass-123"`, `core.factories.MINIMAL_PDF: bytes`
  - `core.factories.UserFactory`, `ResumeVersionFactory`, `ApplicationFactory` (`ApplicationFactory` creates through `create_application`)
  - `core.factories.apply_status_path(application, statuses: list[str], note: str = "") -> Application`
  - pytest fixtures: `user`, `other_user`, `auth_client` (token auth as `user`), `other_client` (token auth as `other_user`), plus the existing `api_client` and `media_root`

- [ ] **Step 1: Write the failing test `backend/applications/tests/test_services.py`**

```python
import pytest
from django.contrib.auth import get_user_model

from applications.models import ApplicationEvent, EventType, Status
from applications.services import (
    ApplicationRuleError,
    add_note,
    change_status,
    create_application,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner():
    return get_user_model().objects.create_user(username="owner", password="test-pass-123")


@pytest.fixture
def application(owner):
    return create_application(user=owner, company="Acme", job_title="Engineer")


def latest_status_event(application):
    return (
        application.events.filter(event_type=EventType.STATUS_CHANGE)
        .order_by("-created_at", "-id")
        .first()
    )


def test_create_writes_the_first_event(application):
    assert application.current_status == Status.APPLIED
    event = application.events.get()
    assert event.event_type == EventType.STATUS_CHANGE
    assert event.from_status is None
    assert event.to_status == Status.APPLIED


def test_create_ignores_a_requested_status(owner):
    application = create_application(
        user=owner, company="Acme", job_title="Engineer", current_status=Status.OFFER
    )
    assert application.current_status == Status.APPLIED


def test_change_status_updates_field_and_log(application):
    event = change_status(application=application, to_status=Status.INTERVIEW, note="  Onsite Friday  ")
    assert (event.from_status, event.to_status, event.note) == (
        Status.APPLIED,
        Status.INTERVIEW,
        "Onsite Friday",
    )
    assert application.current_status == Status.INTERVIEW
    application.refresh_from_db()
    assert application.current_status == Status.INTERVIEW


def test_change_status_allows_any_transition(application):
    change_status(application=application, to_status=Status.REJECTED)
    change_status(application=application, to_status=Status.INTERVIEW)
    application.refresh_from_db()
    assert application.current_status == Status.INTERVIEW


def test_change_to_the_current_status_is_rejected(application):
    with pytest.raises(ApplicationRuleError, match="already"):
        change_status(application=application, to_status=Status.APPLIED)
    assert application.events.count() == 1


def test_change_to_an_unknown_status_is_rejected(application):
    with pytest.raises(ApplicationRuleError, match="Unknown status"):
        change_status(application=application, to_status="hired")
    assert application.events.count() == 1


def test_current_status_always_matches_the_latest_status_event(application):
    for status in [Status.PHONE_SCREEN, Status.INTERVIEW, Status.REJECTED, Status.INTERVIEW]:
        change_status(application=application, to_status=status)
        add_note(application=application, note=f"after {status}")
    application.refresh_from_db()
    assert application.current_status == latest_status_event(application).to_status == Status.INTERVIEW


def test_add_note_keeps_the_status(application):
    event = add_note(application=application, note="  Recruiter emailed  ")
    assert (event.event_type, event.note, event.to_status) == (EventType.NOTE, "Recruiter emailed", None)
    application.refresh_from_db()
    assert application.current_status == Status.APPLIED


def test_add_note_rejects_blank_text(application):
    with pytest.raises(ApplicationRuleError, match="required"):
        add_note(application=application, note="   ")
    assert ApplicationEvent.objects.filter(event_type=EventType.NOTE).count() == 0
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest applications/tests/test_services.py -v"`
Expected: `ModuleNotFoundError: No module named 'applications.services'`.

- [ ] **Step 3: Create `backend/applications/services.py`**

```python
"""Business rules for applications. Views call these; they never write events directly."""
from django.db import transaction

from .models import Application, ApplicationEvent, EventType, Status


class ApplicationRuleError(Exception):
    """A request broke an application business rule (the API maps this to HTTP 400)."""


@transaction.atomic
def create_application(*, user, **fields):
    """Create an application at `applied` and write its first status event."""
    fields.pop("current_status", None)
    application = Application.objects.create(user=user, current_status=Status.APPLIED, **fields)
    ApplicationEvent.objects.create(
        application=application,
        event_type=EventType.STATUS_CHANGE,
        from_status=None,
        to_status=Status.APPLIED,
    )
    return application


def change_status(*, application, to_status, note=""):
    """Move an application to `to_status`, logging the change in the same transaction."""
    if to_status not in Status.values:
        raise ApplicationRuleError(f"Unknown status: {to_status!r}.")
    with transaction.atomic():
        # Lock the row so two concurrent changes can't both read the same "from" status.
        locked = Application.objects.select_for_update().get(pk=application.pk)
        if locked.current_status == to_status:
            raise ApplicationRuleError(f"Application is already in status {to_status!r}.")
        event = ApplicationEvent.objects.create(
            application=locked,
            event_type=EventType.STATUS_CHANGE,
            from_status=locked.current_status,
            to_status=to_status,
            note=(note or "").strip(),
        )
        locked.current_status = to_status
        locked.save(update_fields=["current_status", "updated_at"])
    application.current_status = to_status
    return event


def add_note(*, application, note):
    """Attach a free-form note to the application's timeline without changing status."""
    note = (note or "").strip()
    if not note:
        raise ApplicationRuleError("Note text is required.")
    return ApplicationEvent.objects.create(application=application, event_type=EventType.NOTE, note=note)
```

- [ ] **Step 4: Run the service tests and confirm they pass**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest applications/tests/test_services.py -v"`
Expected: `9 passed`.

- [ ] **Step 5: Write the failing test `backend/core/tests/test_factories.py`**

```python
import re

import pytest

from applications.models import EventType, Status
from core.factories import (
    MINIMAL_PDF,
    TEST_PASSWORD,
    ApplicationFactory,
    ResumeVersionFactory,
    UserFactory,
    apply_status_path,
)

pytestmark = pytest.mark.django_db


def test_user_factory_sets_a_usable_password():
    user = UserFactory()
    assert user.check_password(TEST_PASSWORD)


def test_application_factory_goes_through_the_service():
    application = ApplicationFactory()
    assert application.current_status == Status.APPLIED
    assert application.events.get().event_type == EventType.STATUS_CHANGE


def test_resume_factory_stores_a_real_file():
    resume = ResumeVersionFactory()
    assert re.fullmatch(r"resumes/[0-9a-f]{32}\.pdf", resume.file.name)
    with resume.file.open("rb") as handle:
        assert handle.read() == MINIMAL_PDF


def test_apply_status_path_logs_each_move():
    application = ApplicationFactory()
    apply_status_path(application, [Status.PHONE_SCREEN, Status.INTERVIEW])
    application.refresh_from_db()
    assert application.current_status == Status.INTERVIEW
    assert application.events.filter(event_type=EventType.STATUS_CHANGE).count() == 3
```

- [ ] **Step 6: Run it and confirm it fails**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest core/tests/test_factories.py -v"`
Expected: `ModuleNotFoundError: No module named 'core.factories'`.

- [ ] **Step 7: Create `backend/core/factories.py`**

```python
"""factory_boy factories shared by the test suite and the seed_testing command."""
import factory
from django.contrib.auth import get_user_model
from factory.django import DjangoModelFactory

from applications.models import Application, Source
from applications.services import change_status, create_application
from resumes.models import ResumeVersion

TEST_PASSWORD = "test-pass-123"

# Smallest file that PDF readers accept; good enough for upload/download tests.
MINIMAL_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n"
    b"trailer<</Root 1 0 R>>\n"
    b"%%EOF\n"
)


class UserFactory(DjangoModelFactory):
    class Meta:
        model = get_user_model()

    username = factory.Sequence(lambda n: f"user{n}")
    password = TEST_PASSWORD

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        return model_class.objects.create_user(*args, **kwargs)


class ResumeVersionFactory(DjangoModelFactory):
    class Meta:
        model = ResumeVersion

    user = factory.SubFactory(UserFactory)
    name = factory.Sequence(lambda n: f"Resume v{n}")
    description = "General software engineering resume"
    original_filename = factory.LazyAttribute(lambda o: f"{o.name.lower().replace(' ', '-')}.pdf")
    file = factory.django.FileField(filename="resume.pdf", data=MINIMAL_PDF)


class ApplicationFactory(DjangoModelFactory):
    class Meta:
        model = Application

    user = factory.SubFactory(UserFactory)
    company = factory.Faker("company")
    job_title = factory.Faker("job")
    source = Source.LINKEDIN
    link = factory.Faker("url")
    location = factory.Faker("city")
    salary_range = "$80k-$100k"
    contact_person = factory.Faker("name")
    resume_version = None

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        # Go through the service so every factory-made application has its first event.
        return create_application(**kwargs)


def apply_status_path(application, statuses, note=""):
    """Move an application through each status in order, logging one event per move."""
    for status in statuses:
        change_status(application=application, to_status=status, note=note)
    return application
```

- [ ] **Step 8: Replace `backend/conftest.py` with:**

```python
import pytest
from rest_framework.test import APIClient


@pytest.fixture(autouse=True)
def media_root(settings, tmp_path):
    """Send every test's uploads to a throwaway directory."""
    settings.MEDIA_ROOT = str(tmp_path / "media")
    return settings.MEDIA_ROOT


@pytest.fixture
def api_client():
    return APIClient()


def make_token_client(user):
    """An API client that authenticates the real way: with the user's DRF token."""
    from rest_framework.authtoken.models import Token

    token, _ = Token.objects.get_or_create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return client


@pytest.fixture
def user(db):
    from core.factories import UserFactory

    return UserFactory()


@pytest.fixture
def other_user(db):
    from core.factories import UserFactory

    return UserFactory()


@pytest.fixture
def auth_client(user):
    return make_token_client(user)


@pytest.fixture
def other_client(other_user):
    return make_token_client(other_user)
```

(The imports sit inside the functions on purpose. The root conftest loads before Django has finished setting up, so importing models at the top would crash.)

- [ ] **Step 9: Run the whole suite and confirm it passes**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest -v"`
Expected: `26 passed`.

- [ ] **Step 10: Commit**

```bash
wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && git add backend && git commit -q -F - <<'EOF'
feat: add application service layer and shared test factories

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RB2bbsCup8DUXijebkCiKi
EOF
git log --oneline -1"
```

---

### Task 4: Token auth (signup, login, logout)

**Files:**
- Create: `backend/accounts/serializers.py`, `backend/accounts/views.py`, `backend/accounts/urls.py`
- Modify (replace whole file): `backend/config/urls.py`
- Test: `backend/accounts/tests/test_auth.py`

**Interfaces:**
- Consumes: the `api_client` and `user` fixtures, `core.factories.TEST_PASSWORD`, `conftest.make_token_client`.
- Produces:
  - `POST /api/auth/signup/` with body `{"username", "password"}` → `201 {"token": str, "username": str}`
  - `POST /api/auth/login/` with body `{"username", "password"}` → `200 {"token": str, "username": str}`, or `400` on bad credentials
  - `POST /api/auth/logout/` with a token → `204`, and the token is deleted

- [ ] **Step 1: Write the failing test `backend/accounts/tests/test_auth.py`**

```python
import pytest
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

from conftest import make_token_client
from core.factories import TEST_PASSWORD

pytestmark = pytest.mark.django_db

SIGNUP = "/api/auth/signup/"
LOGIN = "/api/auth/login/"
LOGOUT = "/api/auth/logout/"


def test_signup_creates_user_and_returns_token(api_client):
    response = api_client.post(SIGNUP, {"username": "newbie", "password": "long-enough-pass"})
    assert response.status_code == 201
    body = response.json()
    assert body["username"] == "newbie"
    assert "password" not in body
    user = get_user_model().objects.get(username="newbie")
    assert Token.objects.get(user=user).key == body["token"]


def test_signup_rejects_taken_username_case_insensitively(api_client, user):
    response = api_client.post(SIGNUP, {"username": user.username.upper(), "password": "long-enough-pass"})
    assert response.status_code == 400
    assert "username" in response.json()


def test_signup_rejects_weak_password(api_client):
    response = api_client.post(SIGNUP, {"username": "newbie", "password": "123"})
    assert response.status_code == 400
    assert "password" in response.json()
    assert not get_user_model().objects.filter(username="newbie").exists()


def test_login_returns_the_same_token_each_time(api_client, user):
    first = api_client.post(LOGIN, {"username": user.username, "password": TEST_PASSWORD})
    second = api_client.post(LOGIN, {"username": user.username, "password": TEST_PASSWORD})
    assert first.status_code == second.status_code == 200
    assert first.json()["token"] == second.json()["token"]
    assert first.json()["username"] == user.username


def test_login_rejects_bad_password(api_client, user):
    response = api_client.post(LOGIN, {"username": user.username, "password": "wrong-password"})
    assert response.status_code == 400
    assert "token" not in response.json()


def test_logout_deletes_the_token(user):
    client = make_token_client(user)
    assert client.post(LOGOUT).status_code == 204
    assert not Token.objects.filter(user=user).exists()
    assert client.post(LOGOUT).status_code == 401


def test_logout_requires_a_token(api_client):
    assert api_client.post(LOGOUT).status_code == 401
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest accounts/tests/test_auth.py -v"`
Expected: the tests fail with `assert 404 == 201` (and similar), because the routes don't exist yet.

- [ ] **Step 3: Create `backend/accounts/serializers.py`**

```python
from django.contrib.auth import authenticate, get_user_model, password_validation
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

User = get_user_model()


class SignupSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, validators=[UnicodeUsernameValidator()])
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("That username is taken.")
        return value

    def validate(self, attrs):
        try:
            password_validation.validate_password(attrs["password"], user=User(username=attrs["username"]))
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(username=validated_data["username"], password=validated_data["password"])


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            username=attrs["username"],
            password=attrs["password"],
        )
        if user is None:
            raise serializers.ValidationError("Invalid username or password.")
        attrs["user"] = user
        return attrs
```

- [ ] **Step 4: Create `backend/accounts/views.py`**

```python
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .serializers import LoginSerializer, SignupSerializer


def _token_response(user, http_status):
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "username": user.username}, status=http_status)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def signup_view(request):
    serializer = SignupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return _token_response(user, status.HTTP_201_CREATED)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    return _token_response(serializer.validated_data["user"], status.HTTP_200_OK)


@api_view(["POST"])
def logout_view(request):
    request.auth.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
```

- [ ] **Step 5: Create `backend/accounts/urls.py`**

```python
from django.urls import path

from .views import login_view, logout_view, signup_view

urlpatterns = [
    path("signup/", signup_view),
    path("login/", login_view),
    path("logout/", logout_view),
]
```

- [ ] **Step 6: Replace `backend/config/urls.py` with:**

```python
from django.contrib import admin
from django.urls import include, path

from core.views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health),
    path("api/auth/", include("accounts.urls")),
]
```

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest -v"`
Expected: all tests pass, including the 7 new auth tests.

- [ ] **Step 8: Commit**

```bash
wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && git add backend && git commit -q -F - <<'EOF'
feat: add token-based signup, login, and logout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RB2bbsCup8DUXijebkCiKi
EOF
git log --oneline -1"
```

---

### Task 5: Owner-scoped viewset and the Applications API

**Files:**
- Create: `backend/core/viewsets.py`
- Create: `backend/applications/serializers.py`, `backend/applications/views.py`, `backend/applications/urls.py`
- Modify (replace whole file): `backend/config/urls.py`
- Test: `backend/applications/tests/test_api_applications.py`

**Interfaces:**
- Consumes: `create_application`, `add_note`, the factories, `apply_status_path`, and the `auth_client`, `api_client`, `user`, `other_user` fixtures.
- Produces:
  - `core.viewsets.OwnedByUserViewSet`: a `ModelViewSet` subclass. Subclasses set `queryset`. `get_queryset()` filters on `user=request.user`, and `perform_create` saves with `user=request.user`. Allowed methods: GET, POST, PATCH, DELETE (PUT returns 405).
  - `applications.serializers.ApplicationEventSerializer` (fields `id`, `event_type`, `from_status`, `to_status`, `note`, `created_at`; all read-only)
  - `applications.serializers.ApplicationSerializer` (fields `id`, `company`, `job_title`, `source`, `link`, `date_applied`, `location`, `salary_range`, `contact_person`, `resume_version`, `resume_version_name`, `current_status`, `created_at`, `updated_at`; `current_status` is read-only)
  - `applications.serializers.ApplicationDetailSerializer` (the above plus `events`, newest first)
  - `applications.views.ApplicationViewSet`, registered at `/api/applications/` (route basename `application`)
  - List query parameters: `status`, `source`, `search` (company or job title), `ordering` (`date_applied`, `company`, or `created_at`, with an optional `-` prefix). The default order is `-date_applied`, then `-created_at`.

- [ ] **Step 1: Write the failing test `backend/applications/tests/test_api_applications.py`**

```python
from datetime import date

import pytest

from applications.models import Application, ApplicationEvent, EventType, Source, Status
from applications.services import add_note
from core.factories import ApplicationFactory, ResumeVersionFactory, apply_status_path

pytestmark = pytest.mark.django_db

URL = "/api/applications/"

NEW_APPLICATION = {
    "company": "Acme",
    "job_title": "Backend Engineer",
    "source": "linkedin",
    "link": "https://example.com/jobs/1",
    "date_applied": "2026-10-20",
    "location": "Remote",
    "salary_range": "$90k-$110k",
    "contact_person": "Jo Recruiter",
}


def detail_url(application):
    return f"{URL}{application.pk}/"


def ids(response):
    return [row["id"] for row in response.json()]


def test_requires_authentication(api_client):
    assert api_client.get(URL).status_code == 401


def test_create_application(auth_client, user):
    response = auth_client.post(URL, NEW_APPLICATION)
    assert response.status_code == 201
    body = response.json()
    assert body["current_status"] == "applied"
    assert body["resume_version"] is None
    assert body["resume_version_name"] is None
    application = Application.objects.get(pk=body["id"])
    assert application.user == user
    event = application.events.get()
    assert (event.event_type, event.from_status, event.to_status) == (
        EventType.STATUS_CHANGE,
        None,
        Status.APPLIED,
    )


def test_create_ignores_current_status_in_payload(auth_client):
    response = auth_client.post(URL, {**NEW_APPLICATION, "current_status": "offer"})
    assert response.status_code == 201
    assert response.json()["current_status"] == "applied"


def test_create_requires_company_and_job_title(auth_client):
    response = auth_client.post(URL, {"source": "linkedin"})
    assert response.status_code == 400
    assert {"company", "job_title"} <= set(response.json())


def test_create_with_own_resume_version(auth_client, user):
    resume = ResumeVersionFactory(user=user, name="Backend v1")
    response = auth_client.post(URL, {**NEW_APPLICATION, "resume_version": resume.pk})
    assert response.status_code == 201
    assert response.json()["resume_version"] == resume.pk
    assert response.json()["resume_version_name"] == "Backend v1"


def test_create_with_another_users_resume_version_is_rejected(auth_client, other_user):
    resume = ResumeVersionFactory(user=other_user)
    response = auth_client.post(URL, {**NEW_APPLICATION, "resume_version": resume.pk})
    assert response.status_code == 400
    assert "resume_version" in response.json()
    assert not Application.objects.exists()


def test_list_returns_only_own_applications_newest_first(auth_client, user, other_user):
    older = ApplicationFactory(user=user, date_applied=date(2026, 10, 1))
    newer = ApplicationFactory(user=user, date_applied=date(2026, 10, 15))
    ApplicationFactory(user=other_user)
    response = auth_client.get(URL)
    assert response.status_code == 200
    assert ids(response) == [newer.pk, older.pk]


def test_list_filters_by_status(auth_client, user):
    moved = ApplicationFactory(user=user)
    apply_status_path(moved, [Status.INTERVIEW])
    ApplicationFactory(user=user)
    assert ids(auth_client.get(URL, {"status": "interview"})) == [moved.pk]


def test_list_filters_by_source(auth_client, user):
    referral = ApplicationFactory(user=user, source=Source.REFERRAL)
    ApplicationFactory(user=user, source=Source.INDEED)
    assert ids(auth_client.get(URL, {"source": "referral"})) == [referral.pk]


def test_list_search_matches_company_or_title(auth_client, user):
    by_company = ApplicationFactory(user=user, company="Globex", job_title="Engineer")
    by_title = ApplicationFactory(user=user, company="Initech", job_title="Globetrotter Analyst")
    ApplicationFactory(user=user, company="Umbrella", job_title="Analyst")
    assert set(ids(auth_client.get(URL, {"search": "glob"}))) == {by_company.pk, by_title.pk}


def test_list_ordering_by_company(auth_client, user):
    beta = ApplicationFactory(user=user, company="Beta")
    alpha = ApplicationFactory(user=user, company="Alpha")
    assert ids(auth_client.get(URL, {"ordering": "company"})) == [alpha.pk, beta.pk]


def test_retrieve_includes_events_newest_first(auth_client, user):
    application = ApplicationFactory(user=user)
    add_note(application=application, note="Recruiter emailed")
    response = auth_client.get(detail_url(application))
    assert response.status_code == 200
    assert [event["event_type"] for event in response.json()["events"]] == ["note", "status_change"]


def test_patch_updates_fields_but_never_status(auth_client, user):
    application = ApplicationFactory(user=user, company="Old Name")
    response = auth_client.patch(detail_url(application), {"company": "New Name", "current_status": "offer"})
    assert response.status_code == 200
    application.refresh_from_db()
    assert application.company == "New Name"
    assert application.current_status == Status.APPLIED


def test_put_is_not_allowed(auth_client, user):
    application = ApplicationFactory(user=user)
    assert auth_client.put(detail_url(application), NEW_APPLICATION).status_code == 405


def test_delete_removes_application_and_events(auth_client, user):
    application = ApplicationFactory(user=user)
    assert auth_client.delete(detail_url(application)).status_code == 204
    assert not Application.objects.exists()
    assert not ApplicationEvent.objects.exists()
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest applications/tests/test_api_applications.py -v"`
Expected: the tests fail with `404` status codes, except `test_requires_authentication`, which may also fail with a 404.

- [ ] **Step 3: Create `backend/core/viewsets.py`**

```python
from rest_framework import viewsets


class OwnedByUserViewSet(viewsets.ModelViewSet):
    """A ModelViewSet that can only ever see the requesting user's rows.

    Subclasses set `queryset` to the full model queryset; `get_queryset` narrows it.
    Another user's object is indistinguishable from a missing one, so it returns 404.
    """

    owner_field = "user"
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return super().get_queryset().filter(**{self.owner_field: self.request.user})

    def perform_create(self, serializer):
        serializer.save(**{self.owner_field: self.request.user})
```

- [ ] **Step 4: Create `backend/applications/serializers.py`**

```python
from rest_framework import serializers

from .models import Application, ApplicationEvent


class ApplicationEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApplicationEvent
        fields = ["id", "event_type", "from_status", "to_status", "note", "created_at"]
        read_only_fields = fields


class ApplicationSerializer(serializers.ModelSerializer):
    resume_version_name = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = [
            "id",
            "company",
            "job_title",
            "source",
            "link",
            "date_applied",
            "location",
            "salary_range",
            "contact_person",
            "resume_version",
            "resume_version_name",
            "current_status",
            "created_at",
            "updated_at",
        ]
        # Status only changes through the events endpoint, so the event log stays complete.
        read_only_fields = ["current_status", "created_at", "updated_at"]

    def get_resume_version_name(self, obj):
        return obj.resume_version.name if obj.resume_version else None

    def validate_resume_version(self, value):
        if value is not None and value.user_id != self.context["request"].user.id:
            raise serializers.ValidationError("Resume version not found.")
        return value


class ApplicationDetailSerializer(ApplicationSerializer):
    events = ApplicationEventSerializer(many=True, read_only=True)

    class Meta(ApplicationSerializer.Meta):
        fields = ApplicationSerializer.Meta.fields + ["events"]
```

- [ ] **Step 5: Create `backend/applications/views.py`**

```python
from rest_framework import filters

from core.viewsets import OwnedByUserViewSet

from .models import Application
from .serializers import ApplicationDetailSerializer, ApplicationSerializer
from .services import create_application


class ApplicationViewSet(OwnedByUserViewSet):
    queryset = Application.objects.select_related("resume_version")
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["company", "job_title"]
    ordering_fields = ["date_applied", "company", "created_at"]
    ordering = ["-date_applied", "-created_at"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ApplicationDetailSerializer
        return ApplicationSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        source_filter = self.request.query_params.get("source")
        if status_filter:
            queryset = queryset.filter(current_status=status_filter)
        if source_filter:
            queryset = queryset.filter(source=source_filter)
        if self.action == "retrieve":
            queryset = queryset.prefetch_related("events")
        return queryset

    def perform_create(self, serializer):
        serializer.instance = create_application(user=self.request.user, **serializer.validated_data)
```

- [ ] **Step 6: Create `backend/applications/urls.py`**

```python
from rest_framework.routers import SimpleRouter

from .views import ApplicationViewSet

router = SimpleRouter()
router.register("applications", ApplicationViewSet, basename="application")

urlpatterns = router.urls
```

- [ ] **Step 7: Replace `backend/config/urls.py` with:**

```python
from django.contrib import admin
from django.urls import include, path

from core.views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("applications.urls")),
]
```

- [ ] **Step 8: Run the tests and confirm they pass**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest -v"`
Expected: all tests pass, including the 15 new application API tests.

- [ ] **Step 9: Commit**

```bash
wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && git add backend && git commit -q -F - <<'EOF'
feat: add owner-scoped viewset and applications API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RB2bbsCup8DUXijebkCiKi
EOF
git log --oneline -1"
```

---

### Task 6: Events endpoint (notes and status changes)

**Files:**
- Modify: `backend/applications/serializers.py` (add `EventCreateSerializer` at the end)
- Modify (replace whole file): `backend/applications/views.py`
- Test: `backend/applications/tests/test_api_events.py`

**Interfaces:**
- Consumes: `change_status`, `add_note`, `ApplicationRuleError`, `ApplicationViewSet`, `ApplicationEventSerializer`.
- Produces: `POST /api/applications/{id}/events/` → `201` with an `ApplicationEventSerializer` body.
  - Add a note with `{"event_type": "note", "note": "text"}`.
  - Change status with `{"event_type": "status_change", "to_status": "<status>", "note": "optional"}`.
  - Returns `400` for a validation error or a rule violation (the body carries a message), and `404` for a missing application or one owned by someone else.

- [ ] **Step 1: Write the failing test `backend/applications/tests/test_api_events.py`**

```python
import pytest

from applications.models import EventType, Status
from core.factories import ApplicationFactory

pytestmark = pytest.mark.django_db


def events_url(application):
    return f"/api/applications/{application.pk}/events/"


@pytest.fixture
def application(user):
    return ApplicationFactory(user=user)


def test_add_note(auth_client, application):
    response = auth_client.post(
        events_url(application),
        {"event_type": "note", "note": "  Got an email from the recruiter  "},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["event_type"] == "note"
    assert body["note"] == "Got an email from the recruiter"
    assert body["to_status"] is None
    application.refresh_from_db()
    assert application.current_status == Status.APPLIED


def test_change_status(auth_client, application):
    response = auth_client.post(
        events_url(application),
        {"event_type": "status_change", "to_status": "interview", "note": "Onsite next week"},
    )
    assert response.status_code == 201
    body = response.json()
    assert (body["from_status"], body["to_status"], body["note"]) == ("applied", "interview", "Onsite next week")
    application.refresh_from_db()
    assert application.current_status == Status.INTERVIEW


def test_change_status_without_note(auth_client, application):
    response = auth_client.post(events_url(application), {"event_type": "status_change", "to_status": "rejected"})
    assert response.status_code == 201
    assert response.json()["note"] == ""


def test_change_to_current_status_is_rejected(auth_client, application):
    response = auth_client.post(events_url(application), {"event_type": "status_change", "to_status": "applied"})
    assert response.status_code == 400
    assert "already" in str(response.json())
    assert application.events.count() == 1


def test_status_change_requires_to_status(auth_client, application):
    response = auth_client.post(events_url(application), {"event_type": "status_change"})
    assert response.status_code == 400
    assert "to_status" in response.json()


def test_unknown_status_is_rejected(auth_client, application):
    response = auth_client.post(events_url(application), {"event_type": "status_change", "to_status": "hired"})
    assert response.status_code == 400
    assert "to_status" in response.json()


def test_note_requires_text(auth_client, application):
    response = auth_client.post(events_url(application), {"event_type": "note", "note": "   "})
    assert response.status_code == 400
    assert "note" in response.json()


def test_note_cannot_change_status(auth_client, application):
    response = auth_client.post(
        events_url(application),
        {"event_type": "note", "note": "hi", "to_status": "offer"},
    )
    assert response.status_code == 400
    assert "to_status" in response.json()
    application.refresh_from_db()
    assert application.current_status == Status.APPLIED


def test_unknown_event_type_is_rejected(auth_client, application):
    response = auth_client.post(events_url(application), {"event_type": "party"})
    assert response.status_code == 400
    assert "event_type" in response.json()


def test_status_always_matches_latest_status_event(auth_client, application):
    for status in ["phone_screen", "interview", "rejected", "interview"]:
        response = auth_client.post(events_url(application), {"event_type": "status_change", "to_status": status})
        assert response.status_code == 201
        auth_client.post(events_url(application), {"event_type": "note", "note": f"after {status}"})
    application.refresh_from_db()
    latest = (
        application.events.filter(event_type=EventType.STATUS_CHANGE)
        .order_by("-created_at", "-id")
        .first()
    )
    assert application.current_status == latest.to_status == Status.INTERVIEW


def test_events_on_missing_application_return_404(auth_client):
    response = auth_client.post("/api/applications/999999/events/", {"event_type": "note", "note": "hi"})
    assert response.status_code == 404
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest applications/tests/test_api_events.py -v"`
Expected: the tests fail with `404` status codes, because the route doesn't exist yet.

- [ ] **Step 3: Add `EventCreateSerializer` to the end of `backend/applications/serializers.py`**

First change the models import at the top of the file from `from .models import Application, ApplicationEvent` to:

```python
from .models import Application, ApplicationEvent, EventType, Status
```

Then append this to the end of the file:

```python
class EventCreateSerializer(serializers.Serializer):
    """Input for POST /applications/{id}/events/ — either a note or a status change."""

    event_type = serializers.ChoiceField(choices=EventType.choices)
    to_status = serializers.ChoiceField(choices=Status.choices, required=False, allow_null=True)
    note = serializers.CharField(allow_blank=True, default="")

    def validate(self, attrs):
        to_status = attrs.get("to_status")
        if attrs["event_type"] == EventType.STATUS_CHANGE:
            if not to_status:
                raise serializers.ValidationError({"to_status": "This field is required for a status change."})
        else:
            if to_status:
                raise serializers.ValidationError({"to_status": "Notes cannot change status."})
            if not attrs["note"].strip():
                raise serializers.ValidationError({"note": "Note text is required."})
        return attrs
```

- [ ] **Step 4: Replace `backend/applications/views.py` with:**

```python
from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.viewsets import OwnedByUserViewSet

from .models import Application, EventType
from .serializers import (
    ApplicationDetailSerializer,
    ApplicationEventSerializer,
    ApplicationSerializer,
    EventCreateSerializer,
)
from .services import ApplicationRuleError, add_note, change_status, create_application


class ApplicationViewSet(OwnedByUserViewSet):
    queryset = Application.objects.select_related("resume_version")
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["company", "job_title"]
    ordering_fields = ["date_applied", "company", "created_at"]
    ordering = ["-date_applied", "-created_at"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ApplicationDetailSerializer
        return ApplicationSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        source_filter = self.request.query_params.get("source")
        if status_filter:
            queryset = queryset.filter(current_status=status_filter)
        if source_filter:
            queryset = queryset.filter(source=source_filter)
        if self.action == "retrieve":
            queryset = queryset.prefetch_related("events")
        return queryset

    def perform_create(self, serializer):
        serializer.instance = create_application(user=self.request.user, **serializer.validated_data)

    @action(detail=True, methods=["post"], url_path="events")
    def events(self, request, pk=None):
        # get_object() goes through the owner-scoped queryset, so other users' IDs 404.
        application = self.get_object()
        serializer = EventCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            if data["event_type"] == EventType.STATUS_CHANGE:
                event = change_status(application=application, to_status=data["to_status"], note=data["note"])
            else:
                event = add_note(application=application, note=data["note"])
        except ApplicationRuleError as exc:
            raise ValidationError({"detail": str(exc)})
        return Response(ApplicationEventSerializer(event).data, status=status.HTTP_201_CREATED)
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest -v"`
Expected: all tests pass, including the 11 new event tests.

- [ ] **Step 6: Commit**

```bash
wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && git add backend && git commit -q -F - <<'EOF'
feat: add events endpoint for notes and status changes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RB2bbsCup8DUXijebkCiKi
EOF
git log --oneline -1"
```

---

### Task 7: Resume versions API with authenticated download

**Files:**
- Create: `backend/resumes/serializers.py`, `backend/resumes/views.py`, `backend/resumes/urls.py`
- Modify (replace whole file): `backend/config/urls.py`
- Test: `backend/resumes/tests/test_api_resumes.py`

**Interfaces:**
- Consumes: `OwnedByUserViewSet`, `ResumeVersion`, the factories, `MINIMAL_PDF`, and the `settings.RESUME_MAX_UPLOAD_BYTES` setting.
- Produces:
  - `GET /api/resume-versions/` → a list of `{"id", "name", "description", "original_filename", "application_count", "created_at"}`. There is never a `file` key and never a URL.
  - `POST /api/resume-versions/` (multipart: `name`, `description`, `file`) → `201`
  - `GET`, `PATCH` (name and description only), and `DELETE` on `/api/resume-versions/{id}/`. DELETE also removes the file from storage, and linked applications get `resume_version = null`.
  - `GET /api/resume-versions/{id}/file/` streams the file as an attachment under `original_filename`. Returns `404` when the version isn't yours or the file is gone.

- [ ] **Step 1: Write the failing test `backend/resumes/tests/test_api_resumes.py`**

```python
import re

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from core.factories import MINIMAL_PDF, ApplicationFactory, ResumeVersionFactory
from resumes.models import ResumeVersion

pytestmark = pytest.mark.django_db

URL = "/api/resume-versions/"


def detail_url(resume):
    return f"{URL}{resume.pk}/"


def file_url(resume):
    return f"{URL}{resume.pk}/file/"


def pdf(name="resume.pdf", content=MINIMAL_PDF):
    return SimpleUploadedFile(name, content, content_type="application/pdf")


def test_upload_resume_version(auth_client, user):
    response = auth_client.post(
        URL,
        {"name": "Backend v1", "description": "Django focus", "file": pdf("Atlas Resume.pdf")},
        format="multipart",
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Backend v1"
    assert body["original_filename"] == "Atlas Resume.pdf"
    assert body["application_count"] == 0
    assert "file" not in body
    resume = ResumeVersion.objects.get(pk=body["id"])
    assert resume.user == user
    assert re.fullmatch(r"resumes/[0-9a-f]{32}\.pdf", resume.file.name)
    assert resume.file.storage.exists(resume.file.name)


def test_upload_rejects_disallowed_file_type(auth_client):
    upload = SimpleUploadedFile("notes.txt", b"hello", content_type="text/plain")
    response = auth_client.post(URL, {"name": "Notes", "file": upload}, format="multipart")
    assert response.status_code == 400
    assert "file" in response.json()


def test_upload_rejects_oversized_file(auth_client, settings):
    settings.RESUME_MAX_UPLOAD_BYTES = 10
    response = auth_client.post(URL, {"name": "Big", "file": pdf()}, format="multipart")
    assert response.status_code == 400
    assert "file" in response.json()


def test_upload_requires_a_file(auth_client):
    response = auth_client.post(URL, {"name": "No file"}, format="multipart")
    assert response.status_code == 400
    assert "file" in response.json()


def test_names_are_unique_per_user_case_insensitively(auth_client, user):
    ResumeVersionFactory(user=user, name="Backend v1")
    response = auth_client.post(URL, {"name": "backend V1", "file": pdf()}, format="multipart")
    assert response.status_code == 400
    assert "name" in response.json()


def test_same_name_is_fine_for_different_users(auth_client, other_user):
    ResumeVersionFactory(user=other_user, name="Backend v1")
    response = auth_client.post(URL, {"name": "Backend v1", "file": pdf()}, format="multipart")
    assert response.status_code == 201


def test_list_includes_application_counts(auth_client, user):
    used = ResumeVersionFactory(user=user, name="Used")
    ResumeVersionFactory(user=user, name="Unused")
    ApplicationFactory(user=user, resume_version=used)
    ApplicationFactory(user=user, resume_version=used)
    counts = {row["name"]: row["application_count"] for row in auth_client.get(URL).json()}
    assert counts == {"Used": 2, "Unused": 0}


def test_patch_name_and_description(auth_client, user):
    resume = ResumeVersionFactory(user=user, name="Old")
    response = auth_client.patch(detail_url(resume), {"name": "New", "description": "Updated"})
    assert response.status_code == 200
    resume.refresh_from_db()
    assert (resume.name, resume.description) == ("New", "Updated")


def test_patch_cannot_replace_the_file(auth_client, user):
    resume = ResumeVersionFactory(user=user)
    response = auth_client.patch(detail_url(resume), {"file": pdf("other.pdf")}, format="multipart")
    assert response.status_code == 400
    assert "file" in response.json()


def test_download_returns_file_under_original_name(auth_client, user):
    resume = ResumeVersionFactory(user=user, original_filename="Atlas Resume.pdf")
    response = auth_client.get(file_url(resume))
    assert response.status_code == 200
    assert b"".join(response.streaming_content) == MINIMAL_PDF
    assert "attachment" in response["Content-Disposition"]
    assert "Atlas Resume.pdf" in response["Content-Disposition"]


def test_download_requires_authentication(api_client, user):
    resume = ResumeVersionFactory(user=user)
    assert api_client.get(file_url(resume)).status_code == 401


def test_download_of_missing_file_returns_404(auth_client, user):
    resume = ResumeVersionFactory(user=user)
    resume.file.storage.delete(resume.file.name)
    assert auth_client.get(file_url(resume)).status_code == 404


def test_delete_removes_row_and_file_and_unlinks_applications(auth_client, user):
    resume = ResumeVersionFactory(user=user)
    application = ApplicationFactory(user=user, resume_version=resume)
    storage, name = resume.file.storage, resume.file.name
    assert auth_client.delete(detail_url(resume)).status_code == 204
    assert not ResumeVersion.objects.filter(pk=resume.pk).exists()
    assert not storage.exists(name)
    application.refresh_from_db()
    assert application.resume_version is None
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest resumes/tests/test_api_resumes.py -v"`
Expected: the tests fail with `404` status codes.

- [ ] **Step 3: Create `backend/resumes/serializers.py`**

```python
from pathlib import Path

from django.conf import settings
from rest_framework import serializers

from .models import ResumeVersion

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx"}


class ResumeVersionSerializer(serializers.ModelSerializer):
    # Write-only: the stored file is never exposed by URL, only via the download endpoint.
    file = serializers.FileField(write_only=True, required=False)
    application_count = serializers.SerializerMethodField()

    class Meta:
        model = ResumeVersion
        fields = ["id", "name", "description", "file", "original_filename", "application_count", "created_at"]
        read_only_fields = ["original_filename", "created_at"]

    def get_application_count(self, obj):
        annotated = getattr(obj, "application_count", None)
        return annotated if annotated is not None else obj.applications.count()

    def validate_name(self, value):
        existing = ResumeVersion.objects.filter(user=self.context["request"].user, name__iexact=value)
        if self.instance is not None:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError("You already have a resume version with this name.")
        return value

    def validate_file(self, value):
        if Path(value.name).suffix.lower() not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError("Upload a PDF, DOC, or DOCX file.")
        if value.size > settings.RESUME_MAX_UPLOAD_BYTES:
            raise serializers.ValidationError("File must be 5 MB or smaller.")
        return value

    def validate(self, attrs):
        if self.instance is None and "file" not in attrs:
            raise serializers.ValidationError({"file": "A file is required."})
        if self.instance is not None and "file" in attrs:
            raise serializers.ValidationError(
                {"file": "A version's file can't be replaced; upload a new version instead."}
            )
        return attrs

    def create(self, validated_data):
        validated_data["original_filename"] = validated_data["file"].name
        return super().create(validated_data)
```

- [ ] **Step 4: Create `backend/resumes/views.py`**

```python
from django.db.models import Count
from django.http import FileResponse
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from core.viewsets import OwnedByUserViewSet

from .models import ResumeVersion
from .serializers import ResumeVersionSerializer


class ResumeVersionViewSet(OwnedByUserViewSet):
    queryset = ResumeVersion.objects.all()
    serializer_class = ResumeVersionSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return super().get_queryset().annotate(application_count=Count("applications"))

    def perform_destroy(self, instance):
        storage, name = instance.file.storage, instance.file.name
        instance.delete()
        if name:
            storage.delete(name)

    @action(detail=True, methods=["get"], url_path="file")
    def download(self, request, pk=None):
        resume = self.get_object()
        if not resume.file or not resume.file.storage.exists(resume.file.name):
            raise NotFound("The file for this resume version is missing.")
        return FileResponse(resume.file.open("rb"), as_attachment=True, filename=resume.original_filename)
```

- [ ] **Step 5: Create `backend/resumes/urls.py`**

```python
from rest_framework.routers import SimpleRouter

from .views import ResumeVersionViewSet

router = SimpleRouter()
router.register("resume-versions", ResumeVersionViewSet, basename="resume-version")

urlpatterns = router.urls
```

- [ ] **Step 6: Replace `backend/config/urls.py` with:**

```python
from django.contrib import admin
from django.urls import include, path

from core.views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("applications.urls")),
    path("api/", include("resumes.urls")),
]
```

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest -v"`
Expected: all tests pass, including the 13 new resume API tests.

- [ ] **Step 8: Commit**

```bash
wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && git add backend && git commit -q -F - <<'EOF'
feat: add resume versions API with authenticated download

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RB2bbsCup8DUXijebkCiKi
EOF
git log --oneline -1"
```

---

### Task 8: Cross-user isolation test

**Files:**
- Test: `backend/core/tests/test_isolation.py`

**Interfaces:**
- Consumes: every endpoint from Tasks 5–7, the factories, and the `user`, `other_client` fixtures.
- Produces: no new code. This task proves that user B can never read, change, or delete user A's data.

This task is test-only. The tests should **pass on the first run**. If any fail, that's a real data-leak bug: fix it in the viewset or serializer named in the failure, and don't touch the test.

- [ ] **Step 1: Write `backend/core/tests/test_isolation.py`**

```python
"""User B must never be able to read, change, or delete user A's data."""
import pytest

from core.factories import ApplicationFactory, ResumeVersionFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def owned(user):
    """Objects owned by `user` (A). Tests act as `other_client` (B)."""
    resume = ResumeVersionFactory(user=user, name="Original")
    application = ApplicationFactory(user=user, company="Original Co", resume_version=resume)
    return {"application": application, "resume": resume}


@pytest.mark.parametrize(
    "method, url_template, payload",
    [
        ("get", "/api/applications/{application}/", None),
        ("patch", "/api/applications/{application}/", {"company": "Hijacked"}),
        ("delete", "/api/applications/{application}/", None),
        ("post", "/api/applications/{application}/events/", {"event_type": "note", "note": "hi"}),
        ("get", "/api/resume-versions/{resume}/", None),
        ("patch", "/api/resume-versions/{resume}/", {"name": "Hijacked"}),
        ("delete", "/api/resume-versions/{resume}/", None),
        ("get", "/api/resume-versions/{resume}/file/", None),
    ],
)
def test_other_users_objects_look_like_they_do_not_exist(other_client, owned, method, url_template, payload):
    url = url_template.format(application=owned["application"].pk, resume=owned["resume"].pk)
    send = getattr(other_client, method)
    response = send(url, payload) if payload is not None else send(url)

    assert response.status_code == 404

    # Nothing changed (refresh_from_db raises if the row was deleted).
    owned["application"].refresh_from_db()
    owned["resume"].refresh_from_db()
    assert owned["application"].company == "Original Co"
    assert owned["resume"].name == "Original"
    assert owned["application"].events.count() == 1


def test_lists_never_include_other_users_rows(other_client, owned):
    assert other_client.get("/api/applications/").json() == []
    assert other_client.get("/api/resume-versions/").json() == []


def test_cannot_attach_another_users_resume_on_create(other_client, owned):
    response = other_client.post(
        "/api/applications/",
        {"company": "B Co", "job_title": "Engineer", "resume_version": owned["resume"].pk},
    )
    assert response.status_code == 400
    assert "resume_version" in response.json()


def test_cannot_attach_another_users_resume_on_update(other_client, other_user, owned):
    mine = ApplicationFactory(user=other_user)
    response = other_client.patch(f"/api/applications/{mine.pk}/", {"resume_version": owned["resume"].pk})
    assert response.status_code == 400
    mine.refresh_from_db()
    assert mine.resume_version is None
```

- [ ] **Step 2: Run it and confirm it passes**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest core/tests/test_isolation.py -v"`
Expected: `11 passed` (8 parametrized cases plus 3 other tests).

- [ ] **Step 3: Run the whole suite**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest"`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && git add backend && git commit -q -F - <<'EOF'
test: add cross-user isolation tests for every object endpoint

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RB2bbsCup8DUXijebkCiKi
EOF
git log --oneline -1"
```

---

### Task 9: Dashboard stats

**Files:**
- Create: `backend/dashboard/services.py`, `backend/dashboard/views.py`
- Modify (replace whole file): `backend/config/urls.py`
- Test: `backend/dashboard/tests/test_stats.py`

**Interfaces:**
- Consumes: `PIPELINE_STAGES`, `stages_at_or_after`, `Status`, `EventType`, `Application`, `ApplicationEvent`, `ResumeVersion`, the factories, and `apply_status_path`.
- Produces:
  - `dashboard.services.pipeline_counts(applications) -> list[{"status", "label", "count"}]`, covering all six statuses in `Status` order
  - `dashboard.services.funnel(applications) -> {"total": int, "stages": [{"stage", "label", "count", "percent"}]}`, with one entry per pipeline stage. `percent` is a float rounded to one decimal place, and `0.0` when `total` is 0.
  - `dashboard.services.applications_per_week(applications, *, weeks=12, today=None) -> list[{"week_start": "YYYY-MM-DD", "count"}]`, oldest first, gaps filled with 0, weeks starting on Monday
  - `dashboard.services.resume_performance(user) -> list[{"resume_version_id", "name", "total", "stages"}]`, one row per resume version ordered by name, plus a `"None"` row when some applications have no resume
  - `dashboard.services.dashboard_stats(user, *, today=None) -> {"pipeline", "funnel", "per_week", "resume_performance"}`
  - `GET /api/dashboard/stats/` → `200` with the `dashboard_stats(request.user)` payload

Each `applications` argument above is an `Application` queryset that's already filtered to one user.

- [ ] **Step 1: Write the failing test `backend/dashboard/tests/test_stats.py`**

```python
from datetime import date

import pytest

from applications.models import Application, Status
from core.factories import ApplicationFactory, ResumeVersionFactory, apply_status_path
from dashboard.services import applications_per_week, dashboard_stats, funnel, pipeline_counts

pytestmark = pytest.mark.django_db


@pytest.fixture
def dataset(user, other_user):
    """Four applications for `user` with known histories, plus noise owned by `other_user`.

    A: applied -> interview -> rejected   (reached phone screen and interview; now rejected)
    B: applied -> offer                   (skipped stages but still reached all of them)
    C: applied                            (no movement)
    D: applied -> phone_screen -> withdrawn
    A and B used resume "Backend v1"; C and D used no resume.
    """
    resume = ResumeVersionFactory(user=user, name="Backend v1")
    apply_status_path(ApplicationFactory(user=user, resume_version=resume), [Status.INTERVIEW, Status.REJECTED])
    apply_status_path(ApplicationFactory(user=user, resume_version=resume), [Status.OFFER])
    ApplicationFactory(user=user)
    apply_status_path(ApplicationFactory(user=user), [Status.PHONE_SCREEN, Status.WITHDRAWN])
    apply_status_path(ApplicationFactory(user=other_user), [Status.OFFER])


def stage_counts(result):
    return {row["stage"]: (row["count"], row["percent"]) for row in result["stages"]}


def test_funnel_counts_from_event_history(user, dataset):
    result = funnel(Application.objects.filter(user=user))
    assert result["total"] == 4
    assert stage_counts(result) == {
        "applied": (4, 100.0),
        "phone_screen": (3, 75.0),
        "interview": (2, 50.0),
        "offer": (1, 25.0),
    }


def test_funnel_with_no_applications(user):
    result = funnel(Application.objects.filter(user=user))
    assert result["total"] == 0
    assert all(row["count"] == 0 and row["percent"] == 0.0 for row in result["stages"])


def test_pipeline_counts_use_current_status(user, dataset):
    rows = pipeline_counts(Application.objects.filter(user=user))
    assert [row["status"] for row in rows] == [
        "applied",
        "phone_screen",
        "interview",
        "offer",
        "rejected",
        "withdrawn",
    ]
    assert {row["status"]: row["count"] for row in rows} == {
        "applied": 1,
        "phone_screen": 0,
        "interview": 0,
        "offer": 1,
        "rejected": 1,
        "withdrawn": 1,
    }


def test_applications_per_week_zero_fills_the_last_12_weeks(user):
    # 2026-10-27 is a Tuesday, so the current week starts Monday 2026-10-26.
    for day in [date(2026, 10, 27), date(2026, 10, 26), date(2026, 10, 21), date(2026, 8, 9)]:
        ApplicationFactory(user=user, date_applied=day)
    weeks = applications_per_week(Application.objects.filter(user=user), today=date(2026, 10, 27))
    assert len(weeks) == 12
    assert weeks[0] == {"week_start": "2026-08-10", "count": 0}
    assert weeks[-2] == {"week_start": "2026-10-19", "count": 1}
    assert weeks[-1] == {"week_start": "2026-10-26", "count": 2}
    assert sum(week["count"] for week in weeks) == 3  # 2026-08-09 falls before the window


def test_resume_performance_groups_by_version(user, dataset):
    rows = {row["name"]: row for row in dashboard_stats(user)["resume_performance"]}
    assert set(rows) == {"Backend v1", "None"}
    assert rows["Backend v1"]["total"] == 2
    assert stage_counts(rows["Backend v1"])["interview"] == (2, 100.0)
    assert stage_counts(rows["Backend v1"])["offer"] == (1, 50.0)
    assert rows["None"]["resume_version_id"] is None
    assert rows["None"]["total"] == 2
    assert stage_counts(rows["None"])["phone_screen"] == (1, 50.0)


def test_resume_performance_omits_none_row_when_every_application_has_a_resume(user):
    resume = ResumeVersionFactory(user=user, name="Only")
    ApplicationFactory(user=user, resume_version=resume)
    assert [row["name"] for row in dashboard_stats(user)["resume_performance"]] == ["Only"]


def test_stats_endpoint_returns_only_the_callers_data(auth_client, dataset):
    response = auth_client.get("/api/dashboard/stats/")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"pipeline", "funnel", "per_week", "resume_performance"}
    assert body["funnel"]["total"] == 4  # the other user's application is excluded


def test_stats_endpoint_requires_authentication(api_client):
    assert api_client.get("/api/dashboard/stats/").status_code == 401
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest dashboard/tests/test_stats.py -v"`
Expected: `ModuleNotFoundError: No module named 'dashboard.services'`.

- [ ] **Step 3: Create `backend/dashboard/services.py`**

```python
"""Dashboard metrics. Every function takes data already scoped to one user."""
from datetime import timedelta

from django.db.models import Count, Exists, OuterRef, Q
from django.db.models.functions import TruncWeek
from django.utils import timezone

from applications.models import (
    PIPELINE_STAGES,
    Application,
    ApplicationEvent,
    EventType,
    Status,
    stages_at_or_after,
)
from resumes.models import ResumeVersion


def _percent(part, total):
    return round(100 * part / total, 1) if total else 0.0


def pipeline_counts(applications):
    """How many applications currently sit in each status."""
    rows = applications.order_by().values("current_status").annotate(count=Count("pk"))
    counts = {row["current_status"]: row["count"] for row in rows}
    return [{"status": value, "label": label, "count": counts.get(value, 0)} for value, label in Status.choices]


def _reached(stage):
    """True when the application ever moved to `stage` or any later pipeline stage."""
    return Exists(
        ApplicationEvent.objects.filter(
            application=OuterRef("pk"),
            event_type=EventType.STATUS_CHANGE,
            to_status__in=stages_at_or_after(stage),
        )
    )


def funnel(applications):
    """Share of applications that ever reached each pipeline stage.

    Uses the event log, not current_status: an application that went
    Interview -> Rejected still counts as having reached Interview.
    """
    annotated = applications.order_by().annotate(
        **{f"reached_{stage.value}": _reached(stage) for stage in PIPELINE_STAGES}
    )
    counts = annotated.aggregate(
        total=Count("pk"),
        **{
            f"n_{stage.value}": Count("pk", filter=Q(**{f"reached_{stage.value}": True}))
            for stage in PIPELINE_STAGES
        },
    )
    total = counts["total"]
    return {
        "total": total,
        "stages": [
            {
                "stage": stage.value,
                "label": stage.label,
                "count": counts[f"n_{stage.value}"],
                "percent": _percent(counts[f"n_{stage.value}"], total),
            }
            for stage in PIPELINE_STAGES
        ],
    }


def applications_per_week(applications, *, weeks=12, today=None):
    """Applications per calendar week (Monday start) for the last `weeks` weeks, gaps filled with 0."""
    today = today or timezone.localdate()
    current_monday = today - timedelta(days=today.weekday())
    first_monday = current_monday - timedelta(weeks=weeks - 1)
    rows = (
        applications.filter(date_applied__gte=first_monday, date_applied__lte=today)
        .order_by()
        .annotate(week=TruncWeek("date_applied"))
        .values("week")
        .annotate(count=Count("pk"))
    )
    counts = {}
    for row in rows:
        week = row["week"]
        if hasattr(week, "date"):  # a datetime from some backends; normalise to a date
            week = week.date()
        counts[week] = row["count"]
    result = []
    for offset in range(weeks):
        week_start = first_monday + timedelta(weeks=offset)
        result.append({"week_start": week_start.isoformat(), "count": counts.get(week_start, 0)})
    return result


def resume_performance(user):
    """Funnel metrics per resume version, plus a "None" row for applications without one."""
    applications = Application.objects.filter(user=user)
    rows = [
        {"resume_version_id": resume.pk, "name": resume.name, **funnel(applications.filter(resume_version=resume))}
        for resume in ResumeVersion.objects.filter(user=user).order_by("name")
    ]
    unassigned = applications.filter(resume_version__isnull=True)
    if unassigned.exists():
        rows.append({"resume_version_id": None, "name": "None", **funnel(unassigned)})
    return rows


def dashboard_stats(user, *, today=None):
    applications = Application.objects.filter(user=user)
    return {
        "pipeline": pipeline_counts(applications),
        "funnel": funnel(applications),
        "per_week": applications_per_week(applications, today=today),
        "resume_performance": resume_performance(user),
    }
```

If `funnel` raises a `FieldError` about the `reached_*` names in `aggregate()`, replace the body of `funnel` from `annotated = ...` through `total = counts["total"]` with this simpler version, which runs one query per stage:

```python
    total = applications.count()
    counts = {f"n_{stage.value}": applications.filter(_reached(stage)).count() for stage in PIPELINE_STAGES}
```

- [ ] **Step 4: Create `backend/dashboard/views.py`**

```python
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .services import dashboard_stats


@api_view(["GET"])
def stats_view(request):
    return Response(dashboard_stats(request.user))
```

- [ ] **Step 5: Replace `backend/config/urls.py` with:**

```python
from django.contrib import admin
from django.urls import include, path

from core.views import health
from dashboard.views import stats_view

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("applications.urls")),
    path("api/", include("resumes.urls")),
    path("api/dashboard/stats/", stats_view),
]
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest -v"`
Expected: all tests pass, including the 8 new dashboard tests.

- [ ] **Step 7: Commit**

```bash
wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && git add backend && git commit -q -F - <<'EOF'
feat: add dashboard stats with event-based funnel metrics

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RB2bbsCup8DUXijebkCiKi
EOF
git log --oneline -1"
```

---

### Task 10: `seed_testing` QA dataset command

**Files:**
- Create: `backend/core/management/__init__.py` (empty), `backend/core/management/commands/__init__.py` (empty)
- Create: `backend/core/management/commands/seed_testing.py`
- Modify: `README.md` (append a section)
- Test: `backend/core/tests/test_seed_testing.py`

**Interfaces:**
- Consumes: `ApplicationFactory`, `ResumeVersionFactory`, `add_note`, `change_status`, the models, and `POST /api/auth/login/` and `GET /api/dashboard/stats/` (both used by the tests).
- Produces: `python manage.py seed_testing [--applications N] [--seed S]`. It deletes and recreates users `tester1` and `tester2` (password `testing-pass-123`). Each user gets 3 resume versions and N applications (default 40). Event histories are backdated across the last 60 days. The command is idempotent and deterministic for a given `--seed`.

- [ ] **Step 1: Write the failing test `backend/core/tests/test_seed_testing.py`**

```python
from datetime import timedelta
from io import StringIO
from pathlib import Path

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone

from applications.models import Application, EventType

pytestmark = pytest.mark.django_db

SEED_USERS = ["tester1", "tester2"]


def seed(applications=10):
    out = StringIO()
    call_command("seed_testing", applications=applications, stdout=out)
    return out.getvalue()


def test_creates_two_users_with_resumes_and_applications():
    output = seed()
    for username in SEED_USERS:
        user = get_user_model().objects.get(username=username)
        assert user.check_password("testing-pass-123")
        assert user.applications.count() == 10
        assert user.resume_versions.count() == 3
        assert f"{username} / testing-pass-123" in output


def test_is_idempotent():
    seed()
    seed()
    assert get_user_model().objects.filter(username__in=SEED_USERS).count() == 2
    for username in SEED_USERS:
        user = get_user_model().objects.get(username=username)
        assert user.applications.count() == 10
        assert user.resume_versions.count() == 3


def test_rerun_cleans_up_old_resume_files():
    seed()
    seed()
    stored = list((Path(settings.MEDIA_ROOT) / "resumes").iterdir())
    assert len(stored) == 6  # 3 resume versions x 2 users, nothing left over from the first run


def test_current_status_matches_latest_status_event():
    seed()
    for application in Application.objects.filter(user__username__in=SEED_USERS):
        latest = (
            application.events.filter(event_type=EventType.STATUS_CHANGE)
            .order_by("-created_at", "-id")
            .first()
        )
        assert application.current_status == latest.to_status


def test_history_is_backdated_and_consistent_with_date_applied():
    seed()
    now = timezone.now()
    applications = Application.objects.filter(user__username__in=SEED_USERS)
    all_event_times = []
    for application in applications:
        first = application.events.get(event_type=EventType.STATUS_CHANGE, from_status__isnull=True)
        assert timezone.localdate(first.created_at) == application.date_applied
        all_event_times.extend(application.events.values_list("created_at", flat=True))
    assert all(now - timedelta(days=61) <= moment <= now for moment in all_event_times)
    assert any(moment < now - timedelta(days=7) for moment in all_event_times)


def test_seeded_user_can_log_in_and_load_the_dashboard(api_client):
    seed()
    login = api_client.post("/api/auth/login/", {"username": "tester1", "password": "testing-pass-123"})
    assert login.status_code == 200
    api_client.credentials(HTTP_AUTHORIZATION=f"Token {login.json()['token']}")
    stats = api_client.get("/api/dashboard/stats/")
    assert stats.status_code == 200
    assert stats.json()["funnel"]["total"] == 10
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest core/tests/test_seed_testing.py -v"`
Expected: `django.core.management.base.CommandError: Unknown command: 'seed_testing'`.

- [ ] **Step 3: Create the empty files `backend/core/management/__init__.py` and `backend/core/management/commands/__init__.py`**

- [ ] **Step 4: Create `backend/core/management/commands/seed_testing.py`**

```python
"""Reset and load a realistic QA dataset for manually exercising the app."""
import random
from datetime import timedelta

import factory.random
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from applications.models import Application, ApplicationEvent, Source, Status
from applications.services import add_note, change_status
from core.factories import ApplicationFactory, ResumeVersionFactory
from resumes.models import ResumeVersion

SEED_USERS = ["tester1", "tester2"]
SEED_PASSWORD = "testing-pass-123"
HISTORY_DAYS = 60

RESUME_VERSIONS = [
    ("Backend v1", "Python/Django focus"),
    ("Cloud v2", "Infrastructure and deployment focus"),
    ("Generalist v3", "Full-stack, one page"),
]

# Possible journeys after "applied", with relative weights.
PATHS = [
    ([], 40),
    ([Status.REJECTED], 20),
    ([Status.PHONE_SCREEN, Status.REJECTED], 12),
    ([Status.PHONE_SCREEN], 6),
    ([Status.PHONE_SCREEN, Status.INTERVIEW], 6),
    ([Status.PHONE_SCREEN, Status.INTERVIEW, Status.REJECTED], 8),
    ([Status.PHONE_SCREEN, Status.INTERVIEW, Status.OFFER], 3),
    ([Status.INTERVIEW, Status.OFFER], 1),
    ([Status.WITHDRAWN], 4),
]

NOTES = [
    "Recruiter emailed to schedule a call.",
    "Sent a thank-you email.",
    "Followed up, no response yet.",
    "Asked about team size and on-call rotation.",
    "Take-home assignment received.",
]


class Command(BaseCommand):
    help = "Delete and recreate the QA users tester1 and tester2 with realistic, backdated data."

    def add_arguments(self, parser):
        parser.add_argument("--applications", type=int, default=40, help="Applications per user (default 40).")
        parser.add_argument("--seed", type=int, default=42, help="Random seed for repeatable data.")

    def handle(self, *args, **options):
        rng = random.Random(options["seed"])
        factory.random.reseed_random(options["seed"])
        now = timezone.now()

        for username in SEED_USERS:
            self._delete_user(username)
            with transaction.atomic():
                user = get_user_model().objects.create_user(username=username, password=SEED_PASSWORD)
                resumes = [ResumeVersionFactory(user=user, name=name, description=desc) for name, desc in RESUME_VERSIONS]
                for _ in range(options["applications"]):
                    self._create_application(user, resumes, rng, now)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(SEED_USERS)} users with {options['applications']} applications each."
            )
        )
        for username in SEED_USERS:
            self.stdout.write(f"  login: {username} / {SEED_PASSWORD}")

    def _delete_user(self, username):
        user = get_user_model().objects.filter(username=username).first()
        if user is None:
            return
        # Row deletes don't remove files from storage, so clean those up first.
        for resume in ResumeVersion.objects.filter(user=user):
            resume.file.delete(save=False)
        user.delete()

    def _create_application(self, user, resumes, rng, now):
        applied_at = now - timedelta(days=rng.randint(0, HISTORY_DAYS), hours=rng.randint(0, 23))
        application = ApplicationFactory(
            user=user,
            date_applied=timezone.localdate(applied_at),
            source=rng.choice(Source.values),
            resume_version=rng.choice(resumes + [None]),
        )
        Application.objects.filter(pk=application.pk).update(created_at=applied_at)
        self._backdate(application.events.get(), applied_at)

        path = rng.choices([steps for steps, _ in PATHS], weights=[weight for _, weight in PATHS])[0]
        moment = applied_at
        for status in path:
            moment = min(moment + timedelta(days=rng.randint(2, 10)), now)
            if rng.random() < 0.5:
                note = add_note(application=application, note=rng.choice(NOTES))
                # Never earlier than the application itself, even for very recent ones.
                self._backdate(note, max(applied_at, moment - timedelta(hours=rng.randint(1, 24))))
            self._backdate(change_status(application=application, to_status=status), moment)

    @staticmethod
    def _backdate(event, moment):
        ApplicationEvent.objects.filter(pk=event.pk).update(created_at=moment)
```

- [ ] **Step 5: Run the seed tests and confirm they pass**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest core/tests/test_seed_testing.py -v"`
Expected: `6 passed`.

- [ ] **Step 6: Run the command against the dev database**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend python manage.py migrate && docker compose run --rm backend python manage.py seed_testing"`
Expected output ends with:

```
Seeded 2 users with 40 applications each.
  login: tester1 / testing-pass-123
  login: tester2 / testing-pass-123
```

- [ ] **Step 7: Append this section to the end of `README.md`**

````markdown

## QA dataset

```bash
docker compose run --rm backend python manage.py seed_testing
```

Deletes and recreates two test users, `tester1` and `tester2` (password `testing-pass-123`), each with 3 resume versions and 40 applications whose status histories and notes are spread over the last 60 days. It uses the same factories as the test suite. Options: `--applications N` per user and `--seed S` for a different but repeatable dataset.
````

- [ ] **Step 8: Run the whole suite one last time**

Run: `wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && docker compose run --rm backend pytest"`
Expected: every test passes, with no failures and no errors.

- [ ] **Step 9: Commit**

```bash
wsl.exe -e bash -ic "cd ~/projects/job-app-tracking-app && git add backend README.md && git commit -q -F - <<'EOF'
feat: add seed_testing command for a realistic QA dataset

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RB2bbsCup8DUXijebkCiKi
EOF
git log --oneline -1"
```
