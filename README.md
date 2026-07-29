# RFID Inventory Management System

Tracks tagged lab equipment and alerts operators when equipment leaves its assigned zone.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────┐
│  Frontend   │────▶│   Backend   │────▶│ MongoDB  │
│  (React +   │     │  (Express   │     │          │
│   Vite)     │◀────│  + Socket   │◀────│          │
└─────────────┘     │    .io)     │     └──────────┘
                    │             │     ┌──────────┐
                    │             │────▶│ RabbitMQ │
                    │             │     │ (Email   │
                    │             │     │  Queue)  │
                    └─────────────┘     └──────────┘
```

- **Frontend**: React 18 + Vite + Framer Motion + React Router
- **Backend**: Express + Mongoose + Socket.io + JWT auth
- **Database**: MongoDB (with optional Change Streams for realtime)
- **Message Queue**: RabbitMQ (durable email delivery)
- **Email**: Nodemailer (SMTP or Ethereal test account)

## Quick Start

### Prerequisites
- Node.js 20+
- MongoDB 7+ (running locally or via Docker)
- npm

### 1. Install dependencies
```bash
npm run install-all
```

### 2. Configure environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your settings
```

### 3. Start development
```bash
# Starts both backend and frontend
npm run dev
```

Backend runs on `http://localhost:5000`, frontend on `http://localhost:3000`.

### 4. Seed sample data (optional)
```bash
cd backend
SEED_ADMIN_PASSWORD=admin123 SEED_USER_PASSWORD=user123 node seed.js
```

Default admin login: `admin` / `admin123`

## Deployment

### Docker (Recommended)

The project includes a complete `docker-compose.yml` with all services:

```bash
# 1. Set required secrets
export JWT_SECRET=$(openssl rand -hex 64)
export RFID_WEBHOOK_SECRET=$(openssl rand -hex 64)

# 2. Start all services
docker compose -f backend/docker-compose.yml up -d

# 3. Seed data (first time only)
docker compose -f backend/docker-compose.yml exec backend node seed.js

# Access: http://localhost (frontend) or http://localhost:5000 (API)
```

### Manual Deployment

```bash
# Backend
cd backend
npm ci --production
NODE_ENV=production node server.js

# Frontend
cd frontend
npm ci && npm run build
# Serve dist/ with nginx (see frontend/nginx.conf)
```

### Environment Variables

#### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | Yes | — | MongoDB connection string |
| `JWT_SECRET` | Yes | — | JWT signing secret (generate with `openssl rand -hex 64`) |
| `RFID_WEBHOOK_SECRET` | Yes | — | Secret for RFID hardware webhook (`POST /api/rfid/*`) |
| `PORT` | No | `5000` | HTTP server port |
| `NODE_ENV` | No | `development` | `production` or `development` |
| `ALLOWED_ORIGINS` | No | `http://localhost:3000` | Comma-separated CORS origins |
| `RABBITMQ_URL` | No | `amqp://guest:guest@localhost:5672` | RabbitMQ connection URL |
| `RABBITMQ_USER` | No | `guest` | RabbitMQ username |
| `RABBITMQ_PASS` | No | `guest` | RabbitMQ password |
| `SMTP_HOST` | No | `localhost` | SMTP server host |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASS` | No | — | SMTP password |
| `SMTP_FROM` | No | `RFID System <no-reply@rfid.local>` | Email from address |
| `MARKTRACE_LISTEN_HOST` | No | `0.0.0.0` | Marktrace TCP listener host |
| `MARKTRACE_LISTEN_PORT` | No | `4600` | Marktrace TCP listener port |
| `LOGIN_LIMIT_WINDOW_MS` | No | `900000` | Login rate limit window (15 min) |
| `LOGIN_LIMIT_MAX` | No | `10` | Max login attempts per window |
| `USE_CHANGE_STREAMS` | No | `false` | Set `true` to use MongoDB Change Streams |

#### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | `/api` (proxied in dev) | Backend API URL for production |

## Features

- **Real-time dashboard** with live tag tracking via Socket.io
- **RFID tag management** — create, assign zones, disable temporarily/permanently
- **Zone-based alerts** — alarms and email notifications when equipment leaves assigned zones
- **Bulk operations** — batch enable/disable tags
- **Violation trends** — daily/weekly charts with interactive date range filtering
- **Audit trail** — full movement and alert history with CSV export
- **Role-based access** — ADMIN, USER, ZONE_MANAGER, AUDITOR, OPERATOR, INTEGRATION
- **Dark mode** — toggle in topbar, persists across sessions
- **Keyboard shortcuts** — `Ctrl+1-5` for navigation, `Ctrl+Shift+L` for logout
- **Email notifications** via RabbitMQ queue + SMTP
- **Rate limiting** on login and admin endpoints
- **Session management** with inactivity timeout and JWT refresh
- **Leader election** for multi-instance deployments

## API Overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | No | User login |
| GET | `/api/auth/me` | Yes | Current user info |
| POST | `/api/auth/refresh` | No | Refresh JWT token |
| GET | `/api/health` | No | Health check |
| GET/POST | `/api/tags` | Yes/Admin | List/create tags |
| PATCH | `/api/tags/:id` | Yes | Update tag |
| GET | `/api/tags/:id/history` | Yes | Tag history |
| POST | `/api/tags/:id/silence` | Yes | Silence alarm |
| GET/POST | `/api/equipment` | Yes | List/create equipment |
| GET/POST | `/api/readers` | Yes/Admin | List/create readers |
| GET/POST | `/api/zones` | Yes/Admin | List/create zones |
| GET/PUT | `/api/settings` | Admin | Alarm/notification settings |
| GET/POST | `/api/recipients` | Admin | Email recipient management |
| GET/POST | `/api/users` | Admin | User management |
| GET | `/api/audit/movements` | Yes | Movement audit log |
| GET | `/api/audit/alerts` | Yes | Alert audit log |
| GET | `/api/reports/summary` | Yes | Summary report |
| GET | `/api/reports/trends` | Yes | Trend data |
| GET | `/api/reports/audit.csv` | Yes | CSV export |
| POST | `/api/rfid/ingest` | Webhook | RFID hardware ingestion |
| POST | `/api/rfid/debug` | Webhook | Debug RFID payload |

## RFID Hardware Integration

The system supports Marktrace RFID readers that connect over TCP:

1. Reader dials out to the server's public IP on port `4600` (configurable)
2. Server receives raw frames via the Marktrace TCP listener
3. Parsed tag events are processed by the tag state machine
4. Zone violations trigger alarms and email notifications

For hardware testing:
```bash
node backend/scripts/dev-only/mockMarktraceReaderClient.js
```

## Project Structure

```
├── backend/
│   ├── server.js              # Express app entry point
│   ├── routes/                # API route handlers
│   ├── models/                # Mongoose schemas
│   ├── services/              # Business logic (tagLogic, scheduler, email, etc.)
│   ├── middleware/             # Auth, validation, error handling
│   ├── workers/               # Email & speaker queue workers
│   ├── utils/                 # Logger, validation utilities
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── hooks/             # Custom hooks (useToast)
│   │   ├── utils/             # Date formatting, pagination, Zod validation
│   │   ├── App.jsx            # Root with routing & auth
│   │   └── index.css          # Global styles + dark mode
│   ├── Dockerfile
│   └── nginx.conf             # Production nginx config
└── docker-compose.yml
```
