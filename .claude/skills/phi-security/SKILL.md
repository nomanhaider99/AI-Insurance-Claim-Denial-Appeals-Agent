---
name: phi-security
description: Protecting PHI and sensitive data in AppealAI — log redaction, encryption at rest for uploaded files, short-lived signed URLs, and audit logging of every read/write of claim data. Use when touching logging, file upload/download, storage, claim/denial/document/appeal data access, or error reporting.
---

# PHI & security

This repo uses **synthetic data only**, but code must be written as if the data were real PHI.

## Logging

- Use `logger` (`apps/api/src/logger.ts`) or `req.log`. No `console.*` (ESLint enforces `no-console`).
- `redactPaths` in `logger.ts` censors auth headers, cookies and PHI-like fields. **When you add a field that could hold PHI** (patient name, DOB, member id, address, document text, extracted fields, letter body), add it to `redactPaths`.
- Log **ids and metadata only**: `{ orgId, claimId, documentId, jobId }`. Never log request/response bodies of claim endpoints, prompts, model output, document text or file names that may contain patient names.
- Error responses never include stack traces or internal messages (see `errorHandler`).

## Files & storage

- **Encryption at rest:** upload with server-side encryption (`ServerSideEncryption: 'AES256'` on `PutObject`; enable bucket default encryption on MinIO/R2). Keep DB volumes on encrypted disks in production.
- **Keys:** `org/<orgId>/<kind>/<uuid>`. Never use the original file name in the key. Store the original name in `documents.file_name`.
- **Validation:** allowlist MIME types (PDF, PNG, JPEG, TIFF, CSV) by checking magic bytes, not only the extension. Enforce a size limit. Record `sha256`.
- **Signed URLs:** the bucket is private. Downloads and uploads use pre-signed URLs that expire in **≤ 5 minutes**. Generate them only after an org-scoped lookup of the document plus a role check. Never return permanent public URLs.

## Audit log

- Write an `audit_logs` row for **every read and write of claim data** (claims, denials, documents, appeals): `{ orgId, actorUserId, action: 'claim.read' | 'claim.update' | 'document.download' | 'appeal.approve' | ..., entityType, entityId, metadata, ip }`.
- `metadata` holds ids and **changed field names** only, never values that may be PHI.
- Use one helper (`audit(ctx, action, entity, metadata)`) called from services. List reads log one row per request, not one per item.
- Audit rows are append-only: no update or delete endpoints.

## Secrets

- Secrets only come from env vars (validated in `env.ts`) or K8s Secrets. Never commit `.env`. `.env.example` holds placeholders only.
- Never log `process.env` or config objects.

## Checklist

- [ ] New PHI-capable fields added to `redactPaths`; logs contain ids only
- [ ] Uploads: type check by magic bytes, size limit, SSE enabled, opaque org-prefixed key
- [ ] Downloads: org-scoped lookup → role check → signed URL with ≤5 min expiry
- [ ] Every claim-data read/write calls `audit()`
- [ ] No secrets or PHI in logs, errors, job payloads or test fixtures
- [ ] Tests: redaction (log a PHI field → `[REDACTED]`), audit row written, expired or cross-org URL refused
