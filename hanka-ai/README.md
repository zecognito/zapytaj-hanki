# Hanka AI beta

Experimental Hanka AI foundation. This directory is developed on `feature/hanka-ai` and is not production.

## Milestone 1

Static `/ai/` chat UI -> Cloudflare Worker -> Workers AI -> Polish conversational Hanka.

No Vectorize, accounts, permanent chat history, uploads, or production homepage integration yet.

## Worker

The Worker uses a Workers AI binding named `AI`. The initial model is configured with `HANKA_MODEL`, currently `@cf/zai-org/glm-4.7-flash`.

The model call is isolated in `worker/src/model.js` so the provider/model layer can be replaced later without rewriting the chat controller.

Before public launch add abuse controls/rate limiting and Turnstile. Do not put Cloudflare credentials or other secrets in this repository.
