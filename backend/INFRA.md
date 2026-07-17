# Infrastructure Guidance (non-Docker)

This file provides actionable steps to run `rfid-inventory` in environments without Docker.

1. Process supervision
   - Use `systemd` or `pm2` to run the backend `server.js` as a service. Example `systemd` unit:

```ini
[Unit]
Description=RFID Inventory Backend
After=network.target mongod.service

[Service]
Type=simple
WorkingDirectory=/path/to/rfid-inventory/backend
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=MONGODB_URI=mongodb://localhost:27017/rfid-inventory

[Install]
WantedBy=multi-user.target
```

2. Frontend
   - Build the frontend (`npm run build`) and serve via a simple nginx configuration or static file server. Set up nginx with gzip and caching headers.

3. MongoDB
   - Run `mongod` as a replica set for change streams. Use a managed DB if you prefer.
   - Schedule regular backups using `mongodump` to an off-host location.

4. Secrets
   - Store `JWT_SECRET` and SMTP credentials in a secure vault or OS environment (do not commit `.env` with secrets).

5. Monitoring
   - Add a cron or monitoring check against `/api/health`. Configure alerts for service down or leader changes.

6. Deployment
   - Use a CI/CD pipeline to push updated code to the host and run `npm ci --production` and restart the service.
