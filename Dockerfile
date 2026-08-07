# --- Stage 1: build the React frontend ---
FROM node:20-slim AS frontend-build
WORKDIR /app/react
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY react/package.json react/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY react/ ./
RUN pnpm run build

# --- Stage 2: Python backend + serve the built frontend ---
FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server/ .
# Built React files land in Flask's static folder
COPY --from=frontend-build /app/react/dist ./static

ENV PORT=5000
EXPOSE 5000

CMD ["gunicorn", "-b", "0.0.0.0:5000", "--threads", "8", "--timeout", "120", "server:app"]
