CREATE TABLE "buyer_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"business_name" varchar(160) NOT NULL,
	"contact_name" varchar(128) NOT NULL,
	"business_type" varchar(64) DEFAULT 'wholesaler' NOT NULL,
	"state" varchar(64) NOT NULL,
	"district" varchar(64) NOT NULL,
	"city" varchar(64) NOT NULL,
	"pin_code" varchar(10) NOT NULL,
	"gst_or_license_number" varchar(64),
	"verification_status" varchar(32) DEFAULT 'self_declared' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "buyer_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "chk_buyer_profiles_status" CHECK ("buyer_profiles"."status" IN ('incomplete', 'active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "buyer_saved_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"farmer_id" uuid NOT NULL,
	"request_type" varchar(32) DEFAULT 'purchase_request' NOT NULL,
	"requested_quantity_quintals" numeric(10, 2) NOT NULL,
	"offered_price_inr" numeric(10, 2) NOT NULL,
	"message" text,
	"farmer_response" text,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(24) NOT NULL,
	"category" varchar(48) NOT NULL,
	"title" varchar(160) NOT NULL,
	"message" text NOT NULL,
	"related_entity_id" uuid,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" varchar(24) DEFAULT 'farmer' NOT NULL;--> statement-breakpoint
ALTER TABLE "buyer_profiles" ADD CONSTRAINT "buyer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_saved_listings" ADD CONSTRAINT "buyer_saved_listings_buyer_id_buyer_profiles_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_saved_listings" ADD CONSTRAINT "buyer_saved_listings_listing_id_buyer_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."buyer_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_listing_id_buyer_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."buyer_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_buyer_id_buyer_profiles_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_farmer_id_farmer_profiles_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_buyer_profiles_location" ON "buyer_profiles" USING btree ("state","district");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_buyer_saved_listing" ON "buyer_saved_listings" USING btree ("buyer_id","listing_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_requests_buyer" ON "purchase_requests" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_requests_farmer" ON "purchase_requests" USING btree ("farmer_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_requests_listing" ON "purchase_requests" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_read" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "chk_users_role" CHECK ("users"."role" IN ('farmer', 'buyer'));