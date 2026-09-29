# Hanka AI beta

Experimental Hanka AI foundation. This directory is developed on `feature/hanka-ai` and is not production.

## Milestone 1 — complete

Private tester -> Cloudflare Worker -> Workers AI -> Polish conversational Hanka.

The Worker uses a Workers AI binding named `AI`. The initial model is configured with `HANKA_MODEL`, currently `@cf/zai-org/glm-4.7-flash`.

The model call is isolated in `worker/src/model.js` so the provider/model layer can be replaced later without rewriting the chat controller.

## Milestone 2 — Hanka Brain pilot

`worker/src/brain.js` contains the first retrieval foundation:

- production pages at `https://zapytajhanki.com` remain the source of truth;
- a pilot manifest contains roughly 25 high-value USA guides;
- the extractor keeps the article `.prose` content and removes page chrome;
- content is chunked by article sections;
- chunks carry country, language, topic/state, title, section, source URL and verification metadata;
- `@cf/baai/bge-m3` is the pilot multilingual embedding model;
- helper functions are ready to upsert chunks into Vectorize and query them.

The Vectorize binding is intentionally NOT in `wrangler.jsonc` yet. Adding a binding before the Cloudflare index exists can break deployment.

### Cloudflare activation sequence

1. Create a Vectorize index for the Hanka Brain pilot using the dimensions returned by the selected embedding model and cosine distance.
2. Create metadata indexes before ingestion for fields that will be filtered, starting with `country`, `language`, `topic` and `state`.
3. Add the Worker Vectorize binding as `HANKA_BRAIN`.
4. Add a protected ingestion route or one-off ingestion command.
5. Ingest the pilot corpus.
6. Add retrieval to `/chat` and give the model the best matching Hanka chunks as grounded context.
7. Benchmark the agreed test questions and tune retrieval before expanding the corpus.

Do not expose ingestion publicly without authentication.

## Not in V1 yet

No accounts, permanent chat history, uploads, voice, mobile app, or production homepage integration.

Before public launch add abuse controls/rate limiting and Turnstile. Do not put Cloudflare credentials or other secrets in this repository.
