FROM python:3.12-slim

WORKDIR /app

# System deps (build tools for aiohttp/ssl wheels on slim images)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=5000
EXPOSE 5000

# Use gunicorn in production instead of Flask's dev server (server.py uses debug=True)
CMD ["gunicorn", "-b", "0.0.0.0:5000", "--threads", "8", "--timeout", "120", "server:app"]
