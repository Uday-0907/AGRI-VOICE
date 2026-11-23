ALTER TABLE "crop_seasons" DROP CONSTRAINT "crop_seasons_farmer_id_farmer_profiles_id_fk";
--> statement-breakpoint
DROP INDEX "idx_users_phone";--> statement-breakpoint
DROP INDEX "idx_farmer_profiles_user_id";--> statement-breakpoint
DROP INDEX "idx_crop_seasons_farmer_id";--> statement-breakpoint
DROP INDEX "idx_crops_name";--> statement-breakpoint
ALTER TABLE "crop_seasons" DROP COLUMN "farmer_id";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "chk_users_status" CHECK ("users"."status" IN ('pending_verification', 'active', 'suspended', 'deactivated'));--> statement-breakpoint
ALTER TABLE "farmer_profiles" ADD CONSTRAINT "chk_farmer_profiles_status" CHECK ("farmer_profiles"."status" IN ('incomplete', 'active', 'archived'));--> statement-breakpoint
ALTER TABLE "farms" ADD CONSTRAINT "chk_farms_area" CHECK ("farms"."total_area_acres" > 0);--> statement-breakpoint
ALTER TABLE "farms" ADD CONSTRAINT "chk_farms_ownership" CHECK ("farms"."ownership_type" IN ('owned', 'leased', 'shared'));--> statement-breakpoint
ALTER TABLE "farms" ADD CONSTRAINT "chk_farms_location_valid" CHECK ("farms"."location" IS NULL OR (NOT ST_IsEmpty("farms"."location") AND ST_X("farms"."location") BETWEEN -180 AND 180 AND ST_Y("farms"."location") BETWEEN -90 AND 90));--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "chk_fields_area" CHECK ("fields"."area_acres" > 0);--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "chk_fields_location_valid" CHECK ("fields"."location" IS NOT NULL AND NOT ST_IsEmpty("fields"."location") AND ST_X("fields"."location") BETWEEN -180 AND 180 AND ST_Y("fields"."location") BETWEEN -90 AND 90);--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "chk_fields_boundary_valid" CHECK ("fields"."boundary" IS NOT NULL AND ST_IsValid("fields"."boundary") AND NOT ST_IsEmpty("fields"."boundary"));--> statement-breakpoint
ALTER TABLE "crop_seasons" ADD CONSTRAINT "chk_crop_seasons_area" CHECK ("crop_seasons"."area_planted_acres" > 0);--> statement-breakpoint
ALTER TABLE "crop_seasons" ADD CONSTRAINT "chk_crop_seasons_season" CHECK ("crop_seasons"."season" IN ('kharif', 'rabi', 'zaid'));--> statement-breakpoint
ALTER TABLE "crop_seasons" ADD CONSTRAINT "chk_crop_seasons_status" CHECK ("crop_seasons"."status" IN ('planned', 'sown', 'growing', 'harvested', 'failed', 'abandoned'));--> statement-breakpoint
ALTER TABLE "crop_seasons" ADD CONSTRAINT "chk_crop_seasons_expected_harvest" CHECK ("crop_seasons"."expected_harvest_date" >= "crop_seasons"."sowing_date");--> statement-breakpoint
ALTER TABLE "crop_seasons" ADD CONSTRAINT "chk_crop_seasons_actual_harvest" CHECK ("crop_seasons"."actual_harvest_date" >= "crop_seasons"."sowing_date");--> statement-breakpoint
ALTER TABLE "crops" ADD CONSTRAINT "chk_crops_duration" CHECK ("crops"."typical_duration_days" > 0);--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "chk_outbox_status" CHECK ("outbox_events"."status" IN ('pending', 'processing', 'published', 'failed'));--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "chk_outbox_retry_count" CHECK ("outbox_events"."retry_count" >= 0);--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "chk_outbox_max_retries" CHECK ("outbox_events"."max_retries" >= 0);