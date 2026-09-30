# Hanka Brain — canonical source

This directory is the permanent, provider-independent source for Hanka's compact knowledge.

## Non-negotiable rule

Vectorize is a disposable search index, never the only copy of knowledge.

Every compact fact taught to Hanka must be reconstructable from either:

1. the public ZapytajHanki.com source in this repository; or
2. a canonical knowledge record stored under `hanka-ai/brain/`.

If a Vectorize index is deleted, corrupted, replaced, or moved to another provider, Hanka Brain must be rebuildable from these sources.

## Record format

Canonical records are JSON. Each record must contain:

- `id` — permanent unique ID; do not change when updating a fact.
- `country` — ISO-style country code, initially `US`.
- `jurisdiction` — e.g. `federal`, `state`, `local`, `general`.
- `region` — state/local code when applicable, otherwise null.
- `topic` and `subtopic`.
- `title`.
- `facts` — compact factual statements intended for retrieval.
- `effective_from` / `effective_to` when known.
- `last_verified` — verification date.
- `official_sources` — authoritative source URLs used to verify the record.
- `related_public_pages` — optional ZapytajHanki.com pages for “Przeczytaj też”.

Do not store generated embedding vectors in Git. They are derived data.

## USA layout

```
brain/
  us/
    federal/
    states/
    general/
```

The folders are organizational only. Retrieval metadata, not folder names, determines what Hanka can find.

## Rebuild contract

A rebuild process must:

1. read the canonical compact records;
2. read approved public ZapytajHanki.com content;
3. normalize and chunk both sources;
4. create fresh embeddings;
5. upsert them into a new Vectorize index;
6. preserve canonical record IDs and source metadata;
7. verify the new index before switching Hanka to it.

Never delete or overwrite the old working index until the rebuilt index passes verification.

## Updating knowledge

Update the existing canonical record rather than creating a duplicate for a changed rate, limit, deadline, or rule. Preserve the permanent `id`, update the effective dates and verification metadata, then re-index that record.

The live web is a gap-filler. A web result does not become permanent Hanka Brain knowledge until it is saved as an approved canonical record or incorporated into an approved public ZapytajHanki.com page.
