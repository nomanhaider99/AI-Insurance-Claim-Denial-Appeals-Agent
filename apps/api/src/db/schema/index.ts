import {
  date,
  index,
  inet,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';
import {
  appealStatuses,
  claimStatuses,
  denialCategories,
  documentKinds,
  roles,
} from '@appeal/shared';

/** Embedding size for policy_chunks. Changing it needs a new migration + re-embed. */
export const EMBEDDING_DIMENSIONS = 1024;

export const roleEnum = pgEnum('role', roles);
export const claimStatusEnum = pgEnum('claim_status', claimStatuses);
export const appealStatusEnum = pgEnum('appeal_status', appealStatuses);
export const denialCategoryEnum = pgEnum('denial_category', denialCategories);
export const documentKindEnum = pgEnum('document_kind', documentKinds);

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
/** Tenant key. Every table except organizations has it; every query filters on it. */
const orgId = () =>
  uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' });

export const organizations = pgTable('organizations', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const users = pgTable(
  'users',
  {
    id: id(),
    orgId: orgId(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: roleEnum('role').notNull().default('biller'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('users_email_uq').on(t.email), index('users_org_idx').on(t.orgId)],
);

export const claims = pgTable(
  'claims',
  {
    id: id(),
    orgId: orgId(),
    claimNumber: text('claim_number').notNull(),
    payerName: text('payer_name').notNull(),
    /** De-identified patient reference only. Never a real name/MRN. */
    patientRef: text('patient_ref'),
    serviceDate: date('service_date'),
    billedAmount: numeric('billed_amount', { precision: 12, scale: 2 }),
    cptCodes: text('cpt_codes').array().notNull().default([]),
    icd10Codes: text('icd10_codes').array().notNull().default([]),
    status: claimStatusEnum('status').notNull().default('denied'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('claims_org_number_uq').on(t.orgId, t.claimNumber),
    index('claims_org_status_idx').on(t.orgId, t.status),
  ],
);

export const denials = pgTable(
  'denials',
  {
    id: id(),
    orgId: orgId(),
    claimId: uuid('claim_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    carcCodes: text('carc_codes').array().notNull().default([]),
    rarcCodes: text('rarc_codes').array().notNull().default([]),
    reasonText: text('reason_text'),
    category: denialCategoryEnum('category'),
    appealableScore: real('appealable_score'),
    deniedOn: date('denied_on'),
    appealDeadline: date('appeal_deadline'),
    /** Raw structured extraction + per-field confidence. */
    extraction: jsonb('extraction'),
    /** Audit of the AI step: model, promptVersion, inputs, token usage. */
    aiMeta: jsonb('ai_meta'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('denials_org_claim_idx').on(t.orgId, t.claimId),
    index('denials_org_deadline_idx').on(t.orgId, t.appealDeadline),
  ],
);

export const documents = pgTable(
  'documents',
  {
    id: id(),
    orgId: orgId(),
    claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'cascade' }),
    kind: documentKindEnum('kind').notNull(),
    storageKey: text('storage_key').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: text('sha256').notNull(),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('documents_org_claim_idx').on(t.orgId, t.claimId),
    uniqueIndex('documents_storage_key_uq').on(t.storageKey),
  ],
);

export const appeals = pgTable(
  'appeals',
  {
    id: id(),
    orgId: orgId(),
    claimId: uuid('claim_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    denialId: uuid('denial_id')
      .notNull()
      .references(() => denials.id, { onDelete: 'cascade' }),
    version: integer('version').notNull().default(1),
    status: appealStatusEnum('status').notNull().default('draft'),
    content: text('content').notNull(),
    /** [{ chunkId, policyDocId, section, page }] — every claim in the letter traces here. */
    citations: jsonb('citations').notNull().default([]),
    aiMeta: jsonb('ai_meta'),
    reviewerComment: text('reviewer_comment'),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('appeals_denial_version_uq').on(t.denialId, t.version),
    index('appeals_org_status_idx').on(t.orgId, t.status),
  ],
);

export const policyDocs = pgTable(
  'policy_docs',
  {
    id: id(),
    orgId: orgId(),
    payerName: text('payer_name').notNull(),
    title: text('title').notNull(),
    sourceUrl: text('source_url'),
    storageKey: text('storage_key'),
    effectiveDate: date('effective_date'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('policy_docs_org_payer_idx').on(t.orgId, t.payerName)],
);

export const policyChunks = pgTable(
  'policy_chunks',
  {
    id: id(),
    orgId: orgId(),
    policyDocId: uuid('policy_doc_id')
      .notNull()
      .references(() => policyDocs.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    section: text('section'),
    page: integer('page'),
    content: text('content').notNull(),
    tokenCount: integer('token_count'),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }),
    createdAt: createdAt(),
  },
  (t) => [
    index('policy_chunks_org_doc_idx').on(t.orgId, t.policyDocId),
    uniqueIndex('policy_chunks_doc_index_uq').on(t.policyDocId, t.chunkIndex),
    index('policy_chunks_embedding_hnsw').using('hnsw', t.embedding.op('vector_cosine_ops')),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    orgId: orgId(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    /** Never PHI — ids and field names only. */
    metadata: jsonb('metadata'),
    ip: inet('ip'),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_logs_org_created_idx').on(t.orgId, t.createdAt),
    index('audit_logs_entity_idx').on(t.orgId, t.entityType, t.entityId),
  ],
);
