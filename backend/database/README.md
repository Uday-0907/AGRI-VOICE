# AgriVoice — Database Architecture & Guidelines

## 1. Overview
The AgriVoice database uses **PostgreSQL 16** enhanced with the **PostGIS** spatial extension. It serves as the single source of truth for persistent application state, transactional records, and geospatial relationships.

---

## 2. Directory Structure

```text
backend/database/
├── migrations/      # Version-controlled incremental SQL / migration files
├── schema/          # Authoritative DDL schema definitions by module
├── seeds/           # Reference and seed data (states, districts, mandis, crops)
└── README.md        # Architecture guidelines and conventions
```

---

## 3. Core Database Design Conventions

1. **Primary Keys:**
   - All primary entities use `UUID v4` primary keys (`id UUID PRIMARY KEY DEFAULT gen_random_uuid()`).
   - Autoincrementing integer IDs are prohibited for public or entity primary keys.

2. **User Identity & Phone Numbers:**
   - The farmer/user's mobile number is a unique login credential (`phone VARCHAR(16) UNIQUE NOT NULL`).
   - All phone numbers must be stored normalized in E.164 standard format (`+91XXXXXXXXXX`).
   - The user's internal identity is permanently decoupled via their `UUID`.

3. **Geospatial Coordinates:**
   - Coordinates (farms, weather stations, mandis, equipment locations) use PostGIS geometry:
     ```sql
     location GEOMETRY(Point, 4326) NOT NULL
     ```
   - Spatial indices (`CREATE INDEX idx_... ON ... USING GIST(location)`) are required for proximity queries.

4. **Timestamps:**
   - Standard audit columns on all persistent tables:
     ```sql
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     ```
   - All timestamps stored in UTC.

5. **Soft Deletion & Audit:**
   - Sensitive financial and marketplace records use soft deletion (`deleted_at TIMESTAMPTZ NULL`) where legal or audit constraints apply.

---

## 4. Local Development with Docker

To run the PostgreSQL + PostGIS database container locally:

```bash
docker compose up -d postgres
```

Connect via client:
- Host: `localhost`
- Port: `5432`
- Database: `agrivoice`
- User: `postgres`
- Password: `postgres` (or as defined in your local `.env`)
