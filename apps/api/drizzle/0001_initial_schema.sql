CREATE TYPE "public"."appeal_status" AS ENUM('draft', 'in_review', 'approved', 'rejected', 'submitted');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('denied', 'drafted', 'in_review', 'approved', 'submitted', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."denial_category" AS ENUM('coding', 'medical_necessity', 'prior_auth', 'eligibility', 'duplicate', 'timely_filing', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('denial_letter', 'eob', 'clinical_record', 'other');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'reviewer', 'biller');--> statement-breakpoint
CREATE TABLE "appeals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"denial_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "appeal_status" DEFAULT 'draft' NOT NULL,
	"content" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_meta" jsonb,
	"reviewer_comment" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"metadata" jsonb,
	"ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"claim_number" text NOT NULL,
	"payer_name" text NOT NULL,
	"patient_ref" text,
	"service_date" date,
	"billed_amount" numeric(12, 2),
	"cpt_codes" text[] DEFAULT '{}' NOT NULL,
	"icd10_codes" text[] DEFAULT '{}' NOT NULL,
	"status" "claim_status" DEFAULT 'denied' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "denials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"carc_codes" text[] DEFAULT '{}' NOT NULL,
	"rarc_codes" text[] DEFAULT '{}' NOT NULL,
	"reason_text" text,
	"category" "denial_category",
	"appealable_score" real,
	"denied_on" date,
	"appeal_deadline" date,
	"extraction" jsonb,
	"ai_meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"claim_id" uuid,
	"kind" "document_kind" NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "policy_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"policy_doc_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"section" text,
	"page" integer,
	"content" text NOT NULL,
	"token_count" integer,
	"embedding" vector(1024),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"payer_name" text NOT NULL,
	"title" text NOT NULL,
	"source_url" text,
	"storage_key" text,
	"effective_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'biller' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_denial_id_denials_id_fk" FOREIGN KEY ("denial_id") REFERENCES "public"."denials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "denials" ADD CONSTRAINT "denials_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "denials" ADD CONSTRAINT "denials_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_chunks" ADD CONSTRAINT "policy_chunks_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_chunks" ADD CONSTRAINT "policy_chunks_policy_doc_id_policy_docs_id_fk" FOREIGN KEY ("policy_doc_id") REFERENCES "public"."policy_docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_docs" ADD CONSTRAINT "policy_docs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appeals_denial_version_uq" ON "appeals" USING btree ("denial_id","version");--> statement-breakpoint
CREATE INDEX "appeals_org_status_idx" ON "appeals" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "audit_logs_org_created_idx" ON "audit_logs" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("org_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "claims_org_number_uq" ON "claims" USING btree ("org_id","claim_number");--> statement-breakpoint
CREATE INDEX "claims_org_status_idx" ON "claims" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "denials_org_claim_idx" ON "denials" USING btree ("org_id","claim_id");--> statement-breakpoint
CREATE INDEX "denials_org_deadline_idx" ON "denials" USING btree ("org_id","appeal_deadline");--> statement-breakpoint
CREATE INDEX "documents_org_claim_idx" ON "documents" USING btree ("org_id","claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_storage_key_uq" ON "documents" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "policy_chunks_org_doc_idx" ON "policy_chunks" USING btree ("org_id","policy_doc_id");--> statement-breakpoint
CREATE UNIQUE INDEX "policy_chunks_doc_index_uq" ON "policy_chunks" USING btree ("policy_doc_id","chunk_index");--> statement-breakpoint
CREATE INDEX "policy_chunks_embedding_hnsw" ON "policy_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "policy_docs_org_payer_idx" ON "policy_docs" USING btree ("org_id","payer_name");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_org_idx" ON "users" USING btree ("org_id");