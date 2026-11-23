# AgriVoice — Database Architecture & Guidelines

## 1. Overview
The AgriVoice database uses **PostgreSQL 16** enhanced with the **PostGIS** spatial extension. It serves as the single source of truth for persistent application state, transactional records, and geospatial relationships.

---

## 2. Directory Structure

```text
backend/database/
├── migrations/      # Version-controlled incremental SQL migration files
│   ├── meta/        # Drizzle snapshot and journal metadata
│   └── 0000_init.sql# Baseline migration establishing PostGIS & foundational tables
├── schema/          # Authoritative DDL schema definitions by module
│   ├── types.ts     # PostGIS custom geometry types (Point, Polygon)
│   ├── users.ts     # Foundational User schema (UUID decoupled, E.164 phone)
│   ├── farmers.ts   # Farmer Profiles (decoupled from User, agricultural profile)
│   ├── farms.ts     # Farms & Fields with PostGIS geometry & GIST indexes
│   ├── crops.ts     # Crops catalog & CropSeasons cultivation tracking
│   ├── outbox.ts    # Transactional Outbox for atomic event publication
│   └── index.ts     # Aggregated schema exports
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
   - Foundational identity only: authentication tokens, sessions, Voice PINs, and passwords are not stored in core foundation schemas.

3. **Geospatial Coordinates & Spatial Indexing:**
   - Farm centroids use PostGIS geometry: `geometry(Point, 4326)`.
   - Field plots use PostGIS point markers: `geometry(Point, 4326)` and polygon boundaries: `geometry(Polygon, 4326)`.
   - Spatial indices (`CREATE INDEX ... USING GIST(...)`) are enforced on all geometry columns.

4. **Timestamps:**
   - Standard audit columns on all persistent tables: `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
   - All timestamps stored in UTC.

5. **Soft Deletion:**
   - Soft deletion (`deleted_at TIMESTAMPTZ NULL`) supported where audit or legal constraints apply.

6. **Transactional Outbox:**
   - The `outbox_events` table captures domain mutation events within the same database transaction.
   - Guaranteed at-least-once delivery with retry metadata, aggregate tracking, and event ordering indexes.

---

## 4. Entity Ownership & Relational Integrity

The foundational schema implements strict hierarchical and relational integrity across the 7 core entities:

```text
users (id, phone, status)
  └── farmer_profiles (user_id [UNIQUE, ON DELETE RESTRICT])
        ├── farms (farmer_id [ON DELETE RESTRICT], location [Point])
        │     └── fields (farm_id [ON DELETE CASCADE], location [Point], boundary [Polygon])
        │           └── crop_seasons (field_id [ON DELETE CASCADE], crop_id [ON DELETE RESTRICT], farmer_id [ON DELETE RESTRICT])
        │                 └── crops (id, name, category)
        └── crop_seasons (farmer_id [ON DELETE RESTRICT])

outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status, retry_count)
```

- **Cross-Farmer Protection:** Application-level authorization must verify that `farmer_profile.user_id` matches the authenticated session user UUID on all queries. Foreign keys ensure referential integrity, but authorization logic must enforce ownership checks at the API boundary.
- **Row-Level Security (RLS) Groundwork & Implications:**
  - Database-level RLS policies provide a defense-in-depth barrier:
    - `farmer_profiles`: `user_id = current_setting('app.current_user_id')::uuid`
    - `farms`: `farmer_id IN (SELECT id FROM farmer_profiles WHERE user_id = current_setting('app.current_user_id')::uuid)`
    - `fields`: `farm_id IN (SELECT id FROM farms WHERE farmer_id IN (...))`
    - `crop_seasons`: `farmer_id IN (SELECT id FROM farmer_profiles WHERE user_id = current_setting('app.current_user_id')::uuid)`
  - **Connection Pooling Implication:** Fastify uses pooled connections (`pg.Pool`). Because connections are shared across requests, setting session variables (`SET app.current_user_id = ...`) must be scoped strictly within transactions (`SET LOCAL ...`) using `db.transaction()` to avoid session pollution. Application-level authorization in Fastify route handlers remains the primary line of defense.

---

## 5. Migration Workflow — Mandatory Rules

Strictly adhere to the controlled migration workflow:

```bash
# 1. Modify schema in backend/api/src/database/schema/ and backend/database/schema/
# 2. Generate migration SQL (reviewed via git diff)
npm run db:generate --prefix backend/api

# 3. Check migration integrity
npm run db:check --prefix backend/api

# 4. Review generated SQL in backend/database/migrations/
# 5. Apply migration to local target database
npm run db:migrate --prefix backend/api
```

> [!CAUTION]
> **Strict Prohibition:** `drizzle-kit push` is strictly prohibited in shared and production environments because it bypasses reviewable migration history. All database schema evolutions must be captured in reviewable migration files under `backend/database/migrations/`.

---

## 6. Local Development with Docker

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
