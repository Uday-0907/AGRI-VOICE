-- AgriVoice Baseline Migration 0000_init
-- Enable PostGIS spatial extension before creating spatial domain tables
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(16) NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "farmer_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"full_name" varchar(128) NOT NULL,
	"preferred_language" varchar(16) DEFAULT 'te' NOT NULL,
	"state" varchar(64) NOT NULL,
	"district" varchar(64) NOT NULL,
	"mandal" varchar(64) NOT NULL,
	"village" varchar(64) NOT NULL,
	"pin_code" varchar(10) NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "farmer_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "farms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" uuid NOT NULL,
	"farm_name" varchar(128) NOT NULL,
	"location" geometry(Point, 4326),
	"total_area_acres" numeric(10, 2),
	"ownership_type" varchar(32) DEFAULT 'owned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"field_name" varchar(128) NOT NULL,
	"area_acres" numeric(10, 2),
	"location" geometry(Point, 4326),
	"boundary" geometry(Polygon, 4326),
	"soil_type" varchar(64),
	"irrigation_source" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crop_seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_id" uuid NOT NULL,
	"crop_id" uuid NOT NULL,
	"farmer_id" uuid NOT NULL,
	"season" varchar(32) NOT NULL,
	"sowing_date" date,
	"expected_harvest_date" date,
	"actual_harvest_date" date,
	"area_planted_acres" numeric(10, 2),
	"status" varchar(32) DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"scientific_name" varchar(128),
	"category" varchar(64) NOT NULL,
	"typical_duration_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crops_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" varchar(64) NOT NULL,
	"aggregate_id" varchar(64) NOT NULL,
	"event_type" varchar(128) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 5 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "farmer_profiles" ADD CONSTRAINT "farmer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farms" ADD CONSTRAINT "farms_farmer_id_farmer_profiles_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmer_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crop_seasons" ADD CONSTRAINT "crop_seasons_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crop_seasons" ADD CONSTRAINT "crop_seasons_crop_id_crops_id_fk" FOREIGN KEY ("crop_id") REFERENCES "public"."crops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crop_seasons" ADD CONSTRAINT "crop_seasons_farmer_id_farmer_profiles_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmer_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_phone" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "idx_users_status" ON "users" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_farmer_profiles_user_id" ON "farmer_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_farmer_profiles_location" ON "farmer_profiles" USING btree ("state","district","mandal");--> statement-breakpoint
CREATE INDEX "idx_farms_farmer_id" ON "farms" USING btree ("farmer_id");--> statement-breakpoint
CREATE INDEX "idx_farms_location" ON "farms" USING gist ("location");--> statement-breakpoint
CREATE INDEX "idx_fields_farm_id" ON "fields" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "idx_fields_location" ON "fields" USING gist ("location");--> statement-breakpoint
CREATE INDEX "idx_fields_boundary" ON "fields" USING gist ("boundary");--> statement-breakpoint
CREATE INDEX "idx_crop_seasons_field_id" ON "crop_seasons" USING btree ("field_id");--> statement-breakpoint
CREATE INDEX "idx_crop_seasons_crop_id" ON "crop_seasons" USING btree ("crop_id");--> statement-breakpoint
CREATE INDEX "idx_crop_seasons_farmer_id" ON "crop_seasons" USING btree ("farmer_id");--> statement-breakpoint
CREATE INDEX "idx_crop_seasons_season_status" ON "crop_seasons" USING btree ("season","status");--> statement-breakpoint
CREATE INDEX "idx_crop_seasons_sowing_date" ON "crop_seasons" USING btree ("sowing_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_crops_name" ON "crops" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_crops_category" ON "crops" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_outbox_status_created_at" ON "outbox_events" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_outbox_aggregate" ON "outbox_events" USING btree ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE INDEX "idx_outbox_event_type" ON "outbox_events" USING btree ("event_type");