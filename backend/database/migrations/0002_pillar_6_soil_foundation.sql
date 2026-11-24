CREATE TABLE "input_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" uuid NOT NULL,
	"product_name" varchar(256) NOT NULL,
	"category" varchar(64) NOT NULL,
	"brand" varchar(128),
	"manufacturer" varchar(128),
	"batch_number" varchar(128),
	"registration_number" varchar(128),
	"verification_status" varchar(32) NOT NULL,
	"provider" varchar(64) NOT NULL,
	"evidence" jsonb,
	"notes" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_input_verification_status" CHECK ("input_verifications"."verification_status" IN ('verified', 'not_verified', 'inconclusive', 'not_found', 'expired', 'recall_alert', 'provider_unavailable', 'demo')),
	CONSTRAINT "chk_input_category" CHECK ("input_verifications"."category" IN ('fertilizer', 'seed', 'pesticide', 'bio_stimulant', 'other'))
);
--> statement-breakpoint
CREATE TABLE "soil_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" uuid NOT NULL,
	"farm_id" uuid,
	"field_id" uuid,
	"card_id" varchar(64),
	"report_id" varchar(128) NOT NULL,
	"source" varchar(64) NOT NULL,
	"source_authority" varchar(128),
	"sample_date" timestamp with time zone,
	"testing_date" timestamp with time zone,
	"report_date" timestamp with time zone NOT NULL,
	"state" varchar(64),
	"district" varchar(64),
	"mandal" varchar(64),
	"village" varchar(64),
	"soil_type" varchar(64),
	"ph" numeric(4, 2),
	"ec" numeric(6, 3),
	"organic_carbon" numeric(5, 2),
	"nitrogen" numeric(10, 2),
	"phosphorus" numeric(10, 2),
	"potassium" numeric(10, 2),
	"sulphur" numeric(10, 2),
	"zinc" numeric(8, 2),
	"iron" numeric(8, 2),
	"copper" numeric(8, 2),
	"manganese" numeric(8, 2),
	"boron" numeric(8, 2),
	"nutrient_ratings" jsonb,
	"recommendations" jsonb,
	"status" varchar(32) DEFAULT 'available' NOT NULL,
	"is_demo" varchar(16) DEFAULT 'false',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_soil_ph" CHECK ("soil_reports"."ph" IS NULL OR ("soil_reports"."ph" >= 0 AND "soil_reports"."ph" <= 14)),
	CONSTRAINT "chk_soil_status" CHECK ("soil_reports"."status" IN ('available', 'pending', 'partial', 'not_found', 'failed', 'provider_unavailable', 'demo'))
);
--> statement-breakpoint
ALTER TABLE "input_verifications" ADD CONSTRAINT "input_verifications_farmer_id_farmer_profiles_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmer_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soil_reports" ADD CONSTRAINT "soil_reports_farmer_id_farmer_profiles_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmer_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soil_reports" ADD CONSTRAINT "soil_reports_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soil_reports" ADD CONSTRAINT "soil_reports_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_input_verifications_farmer" ON "input_verifications" USING btree ("farmer_id");--> statement-breakpoint
CREATE INDEX "idx_input_verifications_batch" ON "input_verifications" USING btree ("batch_number");--> statement-breakpoint
CREATE INDEX "idx_soil_reports_farmer" ON "soil_reports" USING btree ("farmer_id");--> statement-breakpoint
CREATE INDEX "idx_soil_reports_field" ON "soil_reports" USING btree ("field_id");--> statement-breakpoint
CREATE INDEX "idx_soil_reports_farm" ON "soil_reports" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "idx_soil_reports_card_id" ON "soil_reports" USING btree ("card_id");