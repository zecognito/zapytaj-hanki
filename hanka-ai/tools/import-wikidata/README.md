# Hanka Brain Wikidata importer

Candidate-record generator for Hanka Brain. GitHub remains canonical; Wikidata is an upstream structured-data source, never the runtime Brain.

## Safety model

1. Fetch structured source data.
2. Normalize into Hanka's schema and natural Polish facts.
3. Write only to local `staging/` (ignored by Git).
4. Deduplicate against existing Brain IDs.
5. Validate candidates against `brain/schema/knowledge-record.schema.json`.
6. Review candidates before any Brain commit.
7. Never overwrite curated Brain records automatically.

## First profile: cities

Requires Node.js 20+.

```bash
cd hanka-ai/tools/import-wikidata
npm install
npm run import:cities -- 100 0
npm run validate
```

Arguments after the profile are `limit` and `offset`. Increase them only after reviewing the previous batch. The city query requires an official website and an ISO 3166-1 alpha-2 country code, so generated records can satisfy the current canonical schema.

## Scaling

Additional profiles should live in `profiles/` with matching SPARQL in `queries/`. Keep import, validation, staging and canonical commit as separate stages. Large batches should be committed with Git tree/commit operations rather than thousands of one-file connector writes.

## Known schema note

The current canonical schema requires a two-character `country` value. Some manually curated World records use `GLOBAL`; this pre-existing mismatch is intentionally not changed by the importer. New entity records should use ISO alpha-2 country codes where a country exists.
