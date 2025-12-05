# Station Monitor Deployment Guide

This guide walks you through deploying the Station Monitor (frontend + backend + Nginx) on an Ubuntu server using Docker Compose. Internal app ports remain 3000 (frontend) and 4000 (backend); host ports are mapped via compose and proxied by Nginx.

## Prerequisites

- Ubuntu 22.04+ (or similar)
- A user with sudo privileges
- Installed:
  - Docker Engine
  - Docker Compose (Plugin)
- A domain and TLS certs (optional, recommended for production)

### Install Docker and Compose (Ubuntu)

```bash
# Update packages
sudo apt-get update -y

# Install dependencies
sudo apt-get install -y ca-certificates curl gnupg

# Add Docker’s official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repo
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine and Compose plugin
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Optional: allow current user to run docker without sudo
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect
```

## Clone repository on server

```bash
# Choose a directory
cd /opt
sudo mkdir -p /opt/station-monitor
sudo chown $USER:$USER /opt/station-monitor
cd /opt/station-monitor

# Clone your repo
git clone https://github.com/VButo/station-monitor.git .
```

## Environment variables

Create `backend/.env` with your production secrets:

```env
# Supabase
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

# CORS
ALLOWED_ORIGINS=https://your-domain.com
TRUST_PROXY=1

# Auth
ENABLE_AUTH_MIDDLEWARE=true

# Cookies (HTTPS recommended)
# If running HTTPS: COOKIE_SECURE=true and COOKIE_SAMESITE=none
# If running HTTP only: COOKIE_SECURE=false and COOKIE_SAMESITE=lax (default)
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
# COOKIE_DOMAIN=.your-domain.com  # Optional; set only if it matches the actual domain

# Rate limit (optional)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=600
LOGIN_RATE_LIMIT_WINDOW_MS=300000
LOGIN_RATE_LIMIT_MAX=50

# Scheduler
RUN_SCHEDULER=true

# Redis (optional for socket adapter)
# REDIS_URL=redis://user:pass@host:6379
```

Frontend env is provided by compose for production:
- `NEXT_PUBLIC_API_URL=/api` (client calls same-origin)
- `INTERNAL_API_URL=http://backend:4000/api` (middleware reaches backend via compose network)

You can add overrides in `frontend/.env.production.local` if needed.

## Build and run with Docker Compose

```bash
# From repo root
cd /opt/station-monitor

# Optional: validate compose
docker compose config

# Build images
docker compose build

# Start services
docker compose up -d

# Check logs
docker compose logs -f --tail=100
```

### Services and ports

- Nginx: listens on port 80 (and 443 if configured). Proxies:
  - `/` → `frontend:3000`
  - `/api` → `backend:4000/api`
  - `/socket.io` → `backend:4000/socket.io`
- Frontend: container port 3000 (host mapped to 3001 in compose)
- Backend: container port 4000 (host mapped to 4001 in compose)

In production, expose only Nginx publicly to simplify auth/cookies and avoid CORS.

## Enabling HTTPS (recommended)

1) Place your certificate and key on the server:
   - `/etc/nginx/certs/fullchain.pem`
   - `/etc/nginx/certs/privkey.pem`

2) Update `nginx/nginx.conf`:

- Add:
  ```nginx
  server {
    listen 443 ssl;
    server_name your-domain.com;
    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    # ... same proxy locations as the HTTP server ...
  }
  
  server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
  }
  ```
- Mount certs into the Nginx container via compose:
  ```yaml
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/nginx/certs:/etc/nginx/certs:ro
  ```
- Update backend cookies for HTTPS:
  - `COOKIE_SECURE=true`
  - `COOKIE_SAMESITE=none`

Restart:
```bash
docker compose up -d
```

## Health checks

- Backend:
  - `GET /api/healthz` → `{ status: "ok", uptime, timestamp }`
  - `GET /api/readyz` → `{ status: "ready" | "starting", scheduler, cache }`

## Operational tips

- Graceful shutdown: backend catches SIGTERM/SIGINT and closes cleanly.
- Logs: view with `docker compose logs -f`; consider mapping log volumes for long-term retention.
- Scaling: Nginx can sit in front of multiple backend pods; enable Redis adapter via `REDIS_URL` for socket.io scalability.
- Scheduler: runs every 10 minutes (9th minute of each cycle), caches advanced station data.

## Troubleshooting

- Docker not running: ensure `systemctl status docker` shows active.
- 401s from API:
  - Check cookies: for HTTP, keep `COOKIE_SAMESITE=lax` and `COOKIE_SECURE=false`.
  - For HTTPS, set `COOKIE_SECURE=true` and `COOKIE_SAMESITE=none`.
  - Ensure frontend calls `/api` (same-origin) in production.
- CORS issues:
  - If you access backend directly (without Nginx), set `ALLOWED_ORIGINS` to your frontend URL and keep `withCredentials:true` on the client.
- WebSockets disconnect:
  - Nginx timeouts are set to 600s; adjust if needed. Ensure `/socket.io` is proxied without buffering.

## Updating

```bash
# Pull latest changes
cd /opt/station-monitor
git pull

# Rebuild and restart
docker compose build
docker compose up -d
```

## Service teardown

```bash
docker compose down
```
