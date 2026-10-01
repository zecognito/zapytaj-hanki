# Hanka Brain structured-data importer

Reusable candidate-record pipeline for Hanka Brain. GitHub remains canonical; upstream structured sources are inputs, never the runtime Brain.

## Architecture

One engine is shared across knowledge domains:

`entity families -> profile manifest -> source query -> enrichment -> normalization -> quality gates -> dedupe -> schema validation -> staging`

Entity families live in `families/registry.json`. Profiles live in `profiles/manifest.json`. A profile supplies subject-specific mapping/query rules; it does not create a new import engine.

## Automatic orchestration

```bash
cd hanka-ai/tools/import-wikidata
npm install
npm run import:all
npm run validate
```

The orchestrator runs every enabled profile, advances offsets automatically, stops when a source page is exhausted, and respects each profile's batch/page safety limits.

A family or profile can also be targeted without manually managing offsets:

```bash
npm run import:family -- places
npm run import:family -- country-enrichment
```

## Safety model

1. Select source entities.
2. Enrich and normalize into Hanka records.
3. Write only to ignored `staging/`.
4. Deduplicate against canonical Brain IDs.
5. Validate against `brain/schema/knowledge-record.schema.json`.
6. Produce reviewable candidates/artifacts.
7. Never overwrite curated Brain records automatically.
8. Never write to canonical Brain or Vectorize from the importer.

## Scaling rule

Do not create a bespoke importer for every Brain category. Reuse a small number of entity families and add declarative profiles/mappings. Change the shared engine only for genuine cross-category infrastructure bugs.

## Schema note

The current canonical schema requires a two-character `country` value. Some existing World records use `GLOBAL`; this pre-existing mismatch is not changed by this importer.
