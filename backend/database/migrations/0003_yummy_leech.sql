CREATE TABLE "advisory_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"category" varchar(32) NOT NULL,
	"crop_id" uuid,
	"season" varchar(16),
	"growth_stage" varchar(64),
	"condition_type" varchar(64) NOT NULL,
	"threshold" numeric NOT NULL,
	"threshold_unit" varchar(32),
	"logical_operator" varchar(8) DEFAULT 'gte',
	"condition2_type" varchar(64),
	"condition2Threshold" numeric,
	"condition2_unit" varchar(32),
	"condition2_operator" varchar(8),
	"logical_combinator" varchar(8) DEFAULT 'AND',
	"advisory_text" text NOT NULL,
	"advisory_text_te" text,
	"advisory_text_hi" text,
	"severity" varchar(16) DEFAULT 'info',
	"priority" integer DEFAULT 0,
	"source_name" varchar(128),
	"source_url" varchar(512),
	"source_publication_date" timestamp,
	"evidence_strength" varchar(32) DEFAULT 'preliminary',
	"requires_human_confirmation" boolean DEFAULT false,
	"version" integer DEFAULT 1,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"status" varchar(32) DEFAULT 'active',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crop_advisories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid,
	"field_id" uuid,
	"farm_id" uuid,
	"farmer_id" uuid,
	"crop_season_id" uuid,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"advisory_text" text NOT NULL,
	"severity" varchar(16),
	"temperatureAtGeneration" numeric,
	"humidityAtGeneration" numeric,
	"rainfallAtGeneration" numeric,
	"rainfallProbabilityAtGeneration" numeric,
	"forecastRainfall" numeric,
	"verification_status" varchar(32) DEFAULT 'generated',
	"verification_notes" text,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"status" varchar(32) DEFAULT 'active',
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type" varchar(32) NOT NULL,
	"provider_id" uuid,
	"status" varchar(32) NOT NULL,
	"locations_requested" integer,
	"locations_processed" integer,
	"locations_succeeded" integer,
	"locations_failed" integer,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weather_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"location_type" varchar(16) NOT NULL,
	"provider_id" uuid,
	"alert_type" varchar(32) NOT NULL,
	"severity" varchar(16) NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone NOT NULL,
	"headline" varchar(256) NOT NULL,
	"description" text,
	"recommended_action" text,
	"is_active" boolean DEFAULT true,
	"acknowledged_at" timestamp with time zone,
	"farmer_id" uuid,
	"provider_alert_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weather_forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"location_type" varchar(16) NOT NULL,
	"provider_id" uuid,
	"issue_at" timestamp with time zone NOT NULL,
	"valid_at" timestamp with time zone NOT NULL,
	"forecast_type" varchar(16) NOT NULL,
	"temperatureMin" numeric,
	"temperatureMax" numeric,
	"humidity" numeric,
	"rainfall" numeric,
	"rainfallProbability" numeric,
	"precipitationSum" numeric,
	"windSpeed" numeric,
	"wind_direction" varchar(8),
	"windGusts" numeric,
	"cloudCover" numeric,
	"weather_code" integer,
	"weather_description" varchar(128),
	"sunshineDuration" numeric,
	"uvIndex" numeric,
	"data_status" varchar(16) DEFAULT 'LIVE' NOT NULL,
	"sourceLatitude" numeric,
	"sourceLongitude" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weather_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"location_type" varchar(16) NOT NULL,
	"provider_id" uuid,
	"observed_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"temperature" numeric,
	"temperatureMin" numeric,
	"temperatureMax" numeric,
	"humidity" numeric,
	"windSpeed" numeric,
	"wind_direction" varchar(8),
	"windGusts" numeric,
	"pressure" numeric,
	"cloudCover" numeric,
	"rainfall" numeric,
	"rainfallProbability" numeric,
	"precipitation" numeric,
	"weather_code" integer,
	"weather_description" varchar(128),
	"data_status" varchar(16) DEFAULT 'LIVE' NOT NULL,
	"sourceLatitude" numeric,
	"sourceLongitude" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weather_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"display_name" varchar(128) NOT NULL,
	"api_endpoint" varchar(512),
	"api_key_required" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"priority" integer DEFAULT 1,
	"rate_limit_per_day" integer,
	"attribution_required" boolean DEFAULT false,
	"attribution_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weather_providers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "advisory_rules" ADD CONSTRAINT "advisory_rules_crop_id_crops_id_fk" FOREIGN KEY ("crop_id") REFERENCES "public"."crops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crop_advisories" ADD CONSTRAINT "crop_advisories_rule_id_advisory_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."advisory_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crop_advisories" ADD CONSTRAINT "crop_advisories_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crop_advisories" ADD CONSTRAINT "crop_advisories_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crop_advisories" ADD CONSTRAINT "crop_advisories_farmer_id_farmer_profiles_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmer_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crop_advisories" ADD CONSTRAINT "crop_advisories_crop_season_id_crop_seasons_id_fk" FOREIGN KEY ("crop_season_id") REFERENCES "public"."crop_seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_provider_id_weather_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."weather_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weather_alerts" ADD CONSTRAINT "weather_alerts_provider_id_weather_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."weather_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weather_alerts" ADD CONSTRAINT "weather_alerts_farmer_id_farmer_profiles_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmer_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weather_forecasts" ADD CONSTRAINT "weather_forecasts_provider_id_weather_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."weather_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weather_observations" ADD CONSTRAINT "weather_observations_provider_id_weather_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."weather_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_advisory_rules_crop" ON "advisory_rules" USING btree ("crop_id");--> statement-breakpoint
CREATE INDEX "idx_advisory_rules_category" ON "advisory_rules" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_advisory_rules_season" ON "advisory_rules" USING btree ("season");--> statement-breakpoint
CREATE INDEX "idx_advisory_rules_status" ON "advisory_rules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_advisory_rules_condition" ON "advisory_rules" USING btree ("condition_type");--> statement-breakpoint
CREATE INDEX "idx_crop_advisories_field" ON "crop_advisories" USING btree ("field_id");--> statement-breakpoint
CREATE INDEX "idx_crop_advisories_farm" ON "crop_advisories" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "idx_crop_advisories_farmer" ON "crop_advisories" USING btree ("farmer_id");--> statement-breakpoint
CREATE INDEX "idx_crop_advisories_crop_season" ON "crop_advisories" USING btree ("crop_season_id");--> statement-breakpoint
CREATE INDEX "idx_crop_advisories_rule" ON "crop_advisories" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "idx_crop_advisories_generated" ON "crop_advisories" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "idx_crop_advisories_status" ON "crop_advisories" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crop_advisories_verification" ON "crop_advisories" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "idx_ingestion_jobs_type" ON "ingestion_jobs" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "idx_ingestion_jobs_status" ON "ingestion_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ingestion_jobs_started" ON "ingestion_jobs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_weather_alerts_location" ON "weather_alerts" USING btree ("location_id","location_type");--> statement-breakpoint
CREATE INDEX "idx_weather_alerts_valid" ON "weather_alerts" USING btree ("valid_from","valid_to");--> statement-breakpoint
CREATE INDEX "idx_weather_alerts_active" ON "weather_alerts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_weather_alerts_type" ON "weather_alerts" USING btree ("alert_type");--> statement-breakpoint
CREATE INDEX "idx_weather_alerts_severity" ON "weather_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_weather_fcst_location" ON "weather_forecasts" USING btree ("location_id","location_type");--> statement-breakpoint
CREATE INDEX "idx_weather_fcst_valid" ON "weather_forecasts" USING btree ("valid_at");--> statement-breakpoint
CREATE INDEX "idx_weather_fcst_issue" ON "weather_forecasts" USING btree ("issue_at");--> statement-breakpoint
CREATE INDEX "idx_weather_fcst_type" ON "weather_forecasts" USING btree ("forecast_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_weather_fcst_unique" ON "weather_forecasts" USING btree ("location_id","location_type","provider_id","issue_at","valid_at","forecast_type");--> statement-breakpoint
CREATE INDEX "idx_weather_obs_location" ON "weather_observations" USING btree ("location_id","location_type");--> statement-breakpoint
CREATE INDEX "idx_weather_obs_observed" ON "weather_observations" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "idx_weather_obs_fetched" ON "weather_observations" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "idx_weather_obs_status" ON "weather_observations" USING btree ("data_status");--> statement-breakpoint
CREATE INDEX "idx_weather_providers_active" ON "weather_providers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_weather_providers_priority" ON "weather_providers" USING btree ("priority");