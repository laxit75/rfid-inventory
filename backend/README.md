# Backend Notes — rfid-inventory

This document covers runtime notes for production-ready features implemented in the backend:
- Change streams for realtime updates
- Leader election for single-instance scheduler and change-stream ownership
- Environment flags and run/seed steps

## Important environment variables
- `PORT` — HTTP port (default: 5000)
- `MONGODB_URI` — MongoDB connection string (required)
- `JWT_SECRET` — JWT signing secret
- `USE_CHANGE_STREAMS` — set to `true` to prefer MongoDB Change Streams as the authoritative realtime source (requires replica set)
- `ALLOWED_ORIGINS` — comma-separated frontend origins for CORS

## Change Streams
- The backend includes `services/changeStream.js` which opens a change stream on the `Tag` collection with `fullDocument: 'updateLookup'` and emits populated tag payloads over Socket.io.
- Change streams require a MongoDB replica set (single-node replica set is acceptable for small deployments). You can either use a managed MongoDB (Atlas) or run a local single-node replica set.

Local single-node replica set (no Docker):

1. Install MongoDB locally (follow platform instructions).
2. Create a local data directory and start `mongod` with replica-set enabled:

```bash
# create data dir (example)
mkdir -p /data/db
# start mongod with replica set name `rs0`
mongod --dbpath /data/db --replSet rs0 --bind_ip localhost --port 27017
```

3. In a separate shell, initiate the replica set:

```bash
mongosh --eval "rs.initiate()"
```

After the replica set is initiated the change-stream service can connect to the `MONGODB_URI` and leverage `USE_CHANGE_STREAMS=true`.

## Application-level emits vs change streams
- For development/single-instance setups the app emits events directly from the tag logic (fast path). For production with change streams enabled, set `USE_CHANGE_STREAMS=true` to disable in-app emits and rely on the change stream as the source of truth.

## Leader election and scheduler
- A lightweight Mongo-backed leader election (`services/leader.js`) ensures only one instance runs the background `scheduler` and opens the change stream. This prevents duplicate alarms and duplicate background jobs in multi-instance deployments.
- The leader lock is stored in the `leader_locks` collection and uses a heartbeat. Tune TTL and heartbeat intervals in `leader.start()` if needed.

## Starting the backend (development)

```bash
cd backend
npm install
# copy or edit .env (see .env.example if present)
npm run dev
```

To seed example data (includes Zones, Readers, Tags, Users):

```bash
cd backend
SEED_ADMIN_PASSWORD=admin123 SEED_USER_PASSWORD=user123 node seed.js
```

## Production notes
- Use a process manager (systemd, PM2, or container orchestrator) to keep the service running and ensure graceful restarts.
- Ensure `MONGODB_URI` points to a replica set for `USE_CHANGE_STREAMS=true`.
- Keep secrets in a secrets manager or environment injection (do not commit `.env` with secrets).
- Add monitoring/alerting for the scheduler and leader status (when the leader changes or the scheduler stops, generate an alert).

## Observability
- Structured logs are emitted by `utils/logger`. Route logs to a central system (Papertrail, CloudWatch, ELK) for long-term retention.
- Consider adding a small `/api/health` endpoint (already present) and monitoring that endpoint with uptime checks.
