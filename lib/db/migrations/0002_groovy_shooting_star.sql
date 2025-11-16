-- Truncate existing data that exceeds limits before applying schema changes

-- Truncate Cypress test results
UPDATE "cypress_test_results" SET "test_uuid" = LEFT("test_uuid", 100) WHERE LENGTH("test_uuid") > 100;--> statement-breakpoint
UPDATE "cypress_test_results" SET "test_title" = LEFT("test_title", 500) WHERE LENGTH("test_title") > 500;--> statement-breakpoint
UPDATE "cypress_test_results" SET "full_title" = LEFT("full_title", 1000) WHERE LENGTH("full_title") > 1000;--> statement-breakpoint
UPDATE "cypress_test_results" SET "state" = LEFT("state", 20) WHERE LENGTH("state") > 20;--> statement-breakpoint
UPDATE "cypress_test_results" SET "spec_file" = LEFT("spec_file", 1000) WHERE LENGTH("spec_file") > 1000;--> statement-breakpoint
UPDATE "cypress_test_results" SET "suite_uuid" = LEFT("suite_uuid", 100) WHERE "suite_uuid" IS NOT NULL AND LENGTH("suite_uuid") > 100;--> statement-breakpoint
UPDATE "cypress_test_results" SET "parent_uuid" = LEFT("parent_uuid", 100) WHERE "parent_uuid" IS NOT NULL AND LENGTH("parent_uuid") > 100;--> statement-breakpoint
UPDATE "cypress_test_results" SET "error_message" = LEFT("error_message", 5000) WHERE "error_message" IS NOT NULL AND LENGTH("error_message") > 5000;--> statement-breakpoint
UPDATE "cypress_test_results" SET "error_name" = LEFT("error_name", 255) WHERE "error_name" IS NOT NULL AND LENGTH("error_name") > 255;--> statement-breakpoint
UPDATE "cypress_test_results" SET "speed" = LEFT("speed", 20) WHERE "speed" IS NOT NULL AND LENGTH("speed") > 20;--> statement-breakpoint

-- Truncate Playwright test results
UPDATE "playwright_test_results" SET "test_title" = LEFT("test_title", 500) WHERE LENGTH("test_title") > 500;--> statement-breakpoint
UPDATE "playwright_test_results" SET "full_title" = LEFT("full_title", 1000) WHERE LENGTH("full_title") > 1000;--> statement-breakpoint
UPDATE "playwright_test_results" SET "status" = LEFT("status", 20) WHERE LENGTH("status") > 20;--> statement-breakpoint
UPDATE "playwright_test_results" SET "file_path" = LEFT("file_path", 1000) WHERE LENGTH("file_path") > 1000;--> statement-breakpoint
UPDATE "playwright_test_results" SET "project_name" = LEFT("project_name", 255) WHERE "project_name" IS NOT NULL AND LENGTH("project_name") > 255;--> statement-breakpoint
UPDATE "playwright_test_results" SET "error_message" = LEFT("error_message", 5000) WHERE "error_message" IS NOT NULL AND LENGTH("error_message") > 5000;--> statement-breakpoint
UPDATE "playwright_test_results" SET "browser" = LEFT("browser", 100) WHERE "browser" IS NOT NULL AND LENGTH("browser") > 100;--> statement-breakpoint

-- Apply schema changes
ALTER TABLE "cypress_test_results" ALTER COLUMN "test_uuid" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "cypress_test_results" ALTER COLUMN "test_title" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "cypress_test_results" ALTER COLUMN "full_title" SET DATA TYPE varchar(1000);--> statement-breakpoint
ALTER TABLE "cypress_test_results" ALTER COLUMN "state" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "cypress_test_results" ALTER COLUMN "spec_file" SET DATA TYPE varchar(1000);--> statement-breakpoint
ALTER TABLE "cypress_test_results" ALTER COLUMN "suite_uuid" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "cypress_test_results" ALTER COLUMN "parent_uuid" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "cypress_test_results" ALTER COLUMN "error_message" SET DATA TYPE varchar(5000);--> statement-breakpoint
ALTER TABLE "cypress_test_results" ALTER COLUMN "error_name" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "cypress_test_results" ALTER COLUMN "speed" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "playwright_test_results" ALTER COLUMN "test_title" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "playwright_test_results" ALTER COLUMN "full_title" SET DATA TYPE varchar(1000);--> statement-breakpoint
ALTER TABLE "playwright_test_results" ALTER COLUMN "status" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "playwright_test_results" ALTER COLUMN "file_path" SET DATA TYPE varchar(1000);--> statement-breakpoint
ALTER TABLE "playwright_test_results" ALTER COLUMN "project_name" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "playwright_test_results" ALTER COLUMN "error_message" SET DATA TYPE varchar(5000);--> statement-breakpoint
ALTER TABLE "playwright_test_results" ALTER COLUMN "browser" SET DATA TYPE varchar(100);