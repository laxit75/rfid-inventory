# RFID Inventory Management System

Tracks tagged lab equipment and alerts operators when equipment leaves its assigned zone.

## Prerequisites
- Node.js (v16+)
- MongoDB running locally (`mongod`)
- npm

## Setup

### 1. Clone and install dependencies
```bash
# Install backend and frontend deps from repository root
npm run install-all
```

### 2. Run locally (single command)
```bash
# from repo root, start backend and frontend concurrently
npm run dev
```

Alternatively start services individually:

```bash
# Backend only
cd backend && npm install && npm run dev

# Frontend only
cd frontend && npm install && npm run dev
```

## Email delivery with RabbitMQ

Alarm and overdue notifications are placed on the durable `email_alerts` RabbitMQ queue by
the tag logic and scheduler. The leader instance runs the email worker, which sends through
SMTP and acknowledges a job only after delivery. Failed jobs are sent to the
`email_alerts_dlq` dead-letter queue for investigation.

Set `RABBITMQ_URL`, `RABBITMQ_USER`, and `RABBITMQ_PASS` in `backend/.env`. For local
containers, use `backend/docker-compose.yml` to run MongoDB, RabbitMQ, and the backend.

## RFID hardware webhook

Hardware readers post to `POST /api/rfid/ingest` with an `x-rfid-secret` header matching
`RFID_WEBHOOK_SECRET`. Reader records map each antenna port to an `ENTRY` or `EXIT`
direction, and the webhook passes the event to the existing tag state machine.

For a new installation, first send the device payload to `POST /api/rfid/debug` with the
same secret. It logs the raw request body so the payload parser can be confirmed before
enabling `/api/rfid/ingest` in production.
