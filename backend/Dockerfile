FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Uploaded resumes live here (a named volume in compose); owned by the non-root app user.
RUN mkdir -p /data/media && chown -R 1000:1000 /data

COPY . .
