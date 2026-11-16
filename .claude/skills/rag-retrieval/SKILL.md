---
name: rag-retrieval
description: Payer-policy RAG for AppealAI — chunking policy documents, embeddings in pgvector (policy_docs/policy_chunks), similarity queries scoped by org, the citation format (doc, section, page), and the "no source, no claim" rule for appeal drafting. Use for ingestion, retrieval, evidence or any cited AI output.
---

# RAG retrieval

## Ingestion

- **Source:** public payer policy documents only (PDF/HTML). Store the original in object storage and the metadata in `policy_docs` (payer, title, source URL, effective date).
- **Chunking:**
  - Split by document structure first (headings/sections), then by size: **~500–800 tokens per chunk with ~10–15% overlap**. Never split mid-sentence.
  - Keep `section` (nearest heading path, e.g. "Coverage Criteria > Indications") and `page` (1-based page of the chunk start) on every chunk. `chunk_index` is sequential per document.
  - Drop boilerplate (headers, footers, page numbers, ToC) before chunking.
- **Embedding:** one model, configured centrally. Its dimension must equal `EMBEDDING_DIMENSIONS` (1024). Embed in batches inside a queue job (see `agent-pipeline`). Re-ingesting a doc replaces its chunks in one transaction.

## Retrieval

- **The query text** is built from the denial: reason text + CARC/RARC codes + CPT/ICD-10 codes + payer.
- **Filter first, then rank:** `org_id = $orgId` (always) and payer, then order by cosine distance:
  ```ts
  sql`select id, policy_doc_id, section, page, content, embedding <=> ${vec}::vector as distance
      from policy_chunks
      where org_id = ${orgId} and policy_doc_id = any(${docIds})
      order by embedding <=> ${vec}::vector limit ${k}`;
  ```
- Return top-k (default 8) with `distance`. Drop results above a distance threshold rather than padding with weak matches. Optionally re-rank with keyword overlap on codes.

## Citation format

Every cited fact in an AI output carries:

```ts
{
  chunkId: string;
  policyDocId: string;
  docTitle: string;
  section: string | null;
  page: number | null;
  quote: string;
}
```

- `quote` is a short **verbatim** span from the chunk (≤ 300 chars), so a reviewer can verify it.
- In letter text, cite inline as `[n]` and render a reference list: `[n] <docTitle>, <section>, p. <page>`.
- Evidence from the clinic's own records uses the same shape with `documentId` instead of `policyDocId`.

## "No source, no claim"

- The drafting prompt receives **only** the retrieved chunks and evidence. Any statement about policy, coverage or medical necessity must cite one of them.
- If no chunk supports a needed point, the model outputs a **flag** (`{ type: 'missing_source', point: '...' }`) instead of making a claim. The UI shows flags to the reviewer.
- **Post-validation:** every `chunkId` in the output must be in the retrieved set, and every `quote` must appear in that chunk's content (normalised whitespace). Remove or flag citations that fail, never save them silently.

## Checklist

- [ ] Chunks keep section + page; size/overlap within limits
- [ ] Embedding dimension matches the column; ingestion runs as an idempotent job
- [ ] Every vector query filters `org_id`
- [ ] Citations use the shared format with a verbatim quote
- [ ] Output validator rejects unknown chunk ids and non-matching quotes
- [ ] Missing support produces a flag, not invented text
- [ ] Tests/eval: synthetic cases check citation accuracy (ids exist, quotes match) and completeness
