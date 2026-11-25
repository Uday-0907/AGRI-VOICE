CREATE TABLE "buyer_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" uuid NOT NULL,
	"crop_name" varchar(80) NOT NULL,
	"variety" varchar(80),
	"quantity_quintals" numeric(10, 2) NOT NULL,
	"expected_price_inr" numeric(10, 2) NOT NULL,
	"quality_grade" varchar(32) DEFAULT 'FAQ',
	"district" varchar(64) NOT NULL,
	"state" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_price_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commodity" varchar(80) NOT NULL,
	"variety" varchar(80),
	"state" varchar(64) NOT NULL,
	"district" varchar(64) NOT NULL,
	"market_name" varchar(120) NOT NULL,
	"min_price_inr" numeric(10, 2) NOT NULL,
	"max_price_inr" numeric(10, 2) NOT NULL,
	"modal_price_inr" numeric(10, 2) NOT NULL,
	"unit" varchar(32) DEFAULT 'Rs/Quintal' NOT NULL,
	"price_date" timestamp with time zone DEFAULT now() NOT NULL,
	"source" varchar(64) DEFAULT 'farmer_reported' NOT NULL,
	"source_authority" varchar(128),
	"reported_by_farmer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machinery_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"renter_farmer_id" uuid NOT NULL,
	"farm_id" uuid,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"status" varchar(32) DEFAULT 'requested' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machinery_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_farmer_id" uuid NOT NULL,
	"equipment_name" varchar(120) NOT NULL,
	"category" varchar(48) NOT NULL,
	"hourly_rate_inr" numeric(10, 2) NOT NULL,
	"daily_rate_inr" numeric(10, 2),
	"district" varchar(64) NOT NULL,
	"state" varchar(64) NOT NULL,
	"availability_status" varchar(32) DEFAULT 'available' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institutional_schemes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheme_code" varchar(48) NOT NULL,
	"title" varchar(160) NOT NULL,
	"category" varchar(48) NOT NULL,
	"authority" varchar(128) NOT NULL,
	"eligibility_summary" text NOT NULL,
	"benefit_summary" text NOT NULL,
	"application_url" varchar(255),
	"source" varchar(64) DEFAULT 'public_reference' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "institutional_schemes_scheme_code_unique" UNIQUE("scheme_code")
);
--> statement-breakpoint
CREATE TABLE "scheme_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" uuid NOT NULL,
	"scheme_code" varchar(48) NOT NULL,
	"scheme_title" varchar(160) NOT NULL,
	"category" varchar(48) NOT NULL,
	"farm_id" uuid,
	"status" varchar(32) DEFAULT 'submitted' NOT NULL,
	"notes" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extension_bulletins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bulletin_code" varchar(48) NOT NULL,
	"title" varchar(180) NOT NULL,
	"crop" varchar(80) NOT NULL,
	"category" varchar(48) NOT NULL,
	"summary" text NOT NULL,
	"recommendation_text" text NOT NULL,
	"source_authority" varchar(128) NOT NULL,
	"state" varchar(64),
	"published_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extension_bulletins_bulletin_code_unique" UNIQUE("bulletin_code")
);
--> statement-breakpoint
CREATE TABLE "farmer_field_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" uuid NOT NULL,
	"crop" varchar(80) NOT NULL,
	"topic" varchar(120) NOT NULL,
	"question_text" text NOT NULL,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"answer_text" text,
	"answered_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advisory_rules" ALTER COLUMN "threshold" SET DATA TYPE numeric(10, 4);--> statement-breakpoint
ALTER TABLE "advisory_rules" ALTER COLUMN "condition2Threshold" SET DATA TYPE numeric(10, 4);--> statement-breakpoint
ALTER TABLE "crop_advisories" ALTER COLUMN "temperatureAtGeneration" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "crop_advisories" ALTER COLUMN "humidityAtGeneration" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "crop_advisories" ALTER COLUMN "rainfallAtGeneration" SET DATA TYPE numeric(6, 2);--> statement-breakpoint
ALTER TABLE "crop_advisories" ALTER COLUMN "rainfallProbabilityAtGeneration" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "crop_advisories" ALTER COLUMN "forecastRainfall" SET DATA TYPE numeric(6, 2);--> statement-breakpoint
ALTER TABLE "weather_forecasts" ALTER COLUMN "temperatureMin" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "weather_forecasts" ALTER COLUMN "temperatureMax" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "weather_forecasts" ALTER COLUMN "humidity" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "weather_forecasts" ALTER COLUMN "rainfall" SET DATA TYPE numeric(6, 2);--> statement-breakpoint
ALTER TABLE "weather_forecasts" ALTER COLUMN "rainfallProbability" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "weather_forecasts" ALTER COLUMN "precipitationSum" SET DATA TYPE numeric(6, 2);--> statement-breakpoint
ALTER TABLE "weather_forecasts" ALTER COLUMN "windSpeed" SET DATA TYPE numeric(6, 2);--> statement-breakpoint
ALTER TABLE "weather_forecasts" ALTER COLUMN "windGusts" SET DATA TYPE numeric(6, 2);--> statement-breakpoint
ALTER TABLE "weather_forecasts" ALTER COLUMN "cloudCover" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "weather_forecasts" ALTER COLUMN "sunshineDuration" SET DATA TYPE numeric(8, 2);--> statement-breakpoint
ALTER TABLE "weather_forecasts" ALTER COLUMN "uvIndex" SET DATA TYPE numeric(3, 1);--> statement-breakpoint
ALTER TABLE "weather_forecasts" ALTER COLUMN "sourceLatitude" SET DATA TYPE numeric(10, 7);--> statement-breakpoint
ALTER TABLE "weather_forecasts" ALTER COLUMN "sourceLongitude" SET DATA TYPE numeric(10, 7);--> statement-breakpoint
ALTER TABLE "weather_observations" ALTER COLUMN "temperature" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "weather_observations" ALTER COLUMN "temperatureMin" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "weather_observations" ALTER COLUMN "temperatureMax" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "weather_observations" ALTER COLUMN "humidity" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "weather_observations" ALTER COLUMN "windSpeed" SET DATA TYPE numeric(6, 2);--> statement-breakpoint
ALTER TABLE "weather_observations" ALTER COLUMN "windGusts" SET DATA TYPE numeric(6, 2);--> statement-breakpoint
ALTER TABLE "weather_observations" ALTER COLUMN "pressure" SET DATA TYPE numeric(7, 2);--> statement-breakpoint
ALTER TABLE "weather_observations" ALTER COLUMN "cloudCover" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "weather_observations" ALTER COLUMN "rainfall" SET DATA TYPE numeric(6, 2);--> statement-breakpoint
ALTER TABLE "weather_observations" ALTER COLUMN "rainfallProbability" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "weather_observations" ALTER COLUMN "precipitation" SET DATA TYPE numeric(6, 2);--> statement-breakpoint
ALTER TABLE "weather_observations" ALTER COLUMN "sourceLatitude" SET DATA TYPE numeric(10, 7);--> statement-breakpoint
ALTER TABLE "weather_observations" ALTER COLUMN "sourceLongitude" SET DATA TYPE numeric(10, 7);--> statement-breakpoint
ALTER TABLE "buyer_listings" ADD CONSTRAINT "buyer_listings_farmer_id_farmer_profiles_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_price_observations" ADD CONSTRAINT "market_price_observations_reported_by_farmer_id_farmer_profiles_id_fk" FOREIGN KEY ("reported_by_farmer_id") REFERENCES "public"."farmer_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machinery_bookings" ADD CONSTRAINT "machinery_bookings_listing_id_machinery_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."machinery_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machinery_bookings" ADD CONSTRAINT "machinery_bookings_renter_farmer_id_farmer_profiles_id_fk" FOREIGN KEY ("renter_farmer_id") REFERENCES "public"."farmer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machinery_bookings" ADD CONSTRAINT "machinery_bookings_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machinery_listings" ADD CONSTRAINT "machinery_listings_owner_farmer_id_farmer_profiles_id_fk" FOREIGN KEY ("owner_farmer_id") REFERENCES "public"."farmer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheme_applications" ADD CONSTRAINT "scheme_applications_farmer_id_farmer_profiles_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheme_applications" ADD CONSTRAINT "scheme_applications_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farmer_field_queries" ADD CONSTRAINT "farmer_field_queries_farmer_id_farmer_profiles_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_buyer_listings_farmer" ON "buyer_listings" USING btree ("farmer_id");--> statement-breakpoint
CREATE INDEX "idx_buyer_listings_status" ON "buyer_listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_market_prices_commodity_district" ON "market_price_observations" USING btree ("commodity","district");--> statement-breakpoint
CREATE INDEX "idx_machinery_bookings_renter" ON "machinery_bookings" USING btree ("renter_farmer_id");--> statement-breakpoint
CREATE INDEX "idx_machinery_bookings_listing" ON "machinery_bookings" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "idx_machinery_category_district" ON "machinery_listings" USING btree ("category","district");--> statement-breakpoint
CREATE INDEX "idx_machinery_owner" ON "machinery_listings" USING btree ("owner_farmer_id");--> statement-breakpoint
CREATE INDEX "idx_scheme_applications_farmer" ON "scheme_applications" USING btree ("farmer_id");--> statement-breakpoint
CREATE INDEX "idx_extension_bulletins_crop" ON "extension_bulletins" USING btree ("crop");--> statement-breakpoint
CREATE INDEX "idx_farmer_field_queries_farmer" ON "farmer_field_queries" USING btree ("farmer_id");