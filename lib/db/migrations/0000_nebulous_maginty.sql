CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "api_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"method" text NOT NULL,
	"endpoint" text NOT NULL,
	"status_code" integer NOT NULL,
	"request_timestamp" timestamp NOT NULL,
	"response_timestamp" timestamp NOT NULL,
	"duration_ms" integer NOT NULL,
	"authentication_status" text NOT NULL,
	"masked_jwt_token" text,
	"jwt_subject" text,
	"jwt_roles" text,
	"source_identifier" text,
	"error_type" text,
	"error_message" text,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"request_payload_size" integer,
	"response_payload_size" integer,
	"payload_truncated" text,
	"context" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"framework" text NOT NULL,
	"artifact" jsonb NOT NULL,
	"github_repository" text,
	"github_sha" text,
	"github_head_ref" text,
	"github_base_ref" text,
	"github_ref" text,
	"github_actor" text,
	"github_run_id" text,
	"github_run_number" integer,
	"github_run_attempt" integer,
	"github_job" text,
	"runner_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"image" text
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_api_events_created_at" ON "api_events" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_api_events_endpoint_created_at" ON "api_events" USING btree ("endpoint","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_api_events_status_created_at" ON "api_events" USING btree ("status_code","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_api_events_method_created_at" ON "api_events" USING btree ("method","created_at" DESC NULLS LAST);