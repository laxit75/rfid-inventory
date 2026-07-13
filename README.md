# RFID Inventory Management System (Software Prototype)

Simulates RFID tracking for a vehicle testing lab to prevent tools left inside vehicles.

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