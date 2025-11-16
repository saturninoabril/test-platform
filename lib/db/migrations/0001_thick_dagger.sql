CREATE TABLE "cypress_test_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifact_id" uuid NOT NULL,
	"test_uuid" text NOT NULL,
	"test_title" text NOT NULL,
	"full_title" text NOT NULL,
	"state" text NOT NULL,
	"duration" integer NOT NULL,
	"spec_file" text NOT NULL,
	"suite_uuid" text,
	"parent_uuid" text,
	"code" text,
	"error_message" text,
	"error_name" text,
	"speed" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playwright_test_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifact_id" uuid NOT NULL,
	"test_title" text NOT NULL,
	"full_title" text NOT NULL,
	"status" text NOT NULL,
	"duration" integer NOT NULL,
	"file_path" text NOT NULL,
	"project_name" text,
	"retry_attempt" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"error_stack" text,
	"browser" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "test_artifacts" ADD COLUMN "processing_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "test_artifacts" ADD COLUMN "processing_error" text;--> statement-breakpoint
ALTER TABLE "test_artifacts" ADD COLUMN "framework_version" text;--> statement-breakpoint
ALTER TABLE "test_artifacts" ADD COLUMN "processed_at" timestamp;--> statement-breakpoint
ALTER TABLE "test_artifacts" ADD COLUMN "processing_duration_ms" integer;--> statement-breakpoint
ALTER TABLE "cypress_test_results" ADD CONSTRAINT "cypress_test_results_artifact_id_test_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."test_artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playwright_test_results" ADD CONSTRAINT "playwright_test_results_artifact_id_test_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."test_artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cypress_artifact_created" ON "cypress_test_results" USING btree ("artifact_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_cypress_artifact_state" ON "cypress_test_results" USING btree ("artifact_id","state");--> statement-breakpoint
CREATE INDEX "idx_cypress_test_uuid" ON "cypress_test_results" USING btree ("test_uuid");--> statement-breakpoint
CREATE INDEX "idx_playwright_artifact_created" ON "playwright_test_results" USING btree ("artifact_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_playwright_artifact_status" ON "playwright_test_results" USING btree ("artifact_id","status");--> statement-breakpoint
CREATE INDEX "idx_artifacts_processing_status" ON "test_artifacts" USING btree ("processing_status");