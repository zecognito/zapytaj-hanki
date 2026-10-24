# Hanka recipe ratings (deployment preparation)

This Worker is **not deployed** by committing these files. No voting widget should be enabled until the backend is live.

## Cloudflare setup
1. Create a D1 database named `hanki-recipe-ratings`.
2. Add its database ID to `wrangler.toml` and uncomment the `[[d1_databases]]` section.
3. Run `npx wrangler d1 execute hanki-recipe-ratings --remote --file=recipe-ratings/schema.sql` from repository root.
4. Set a long random Worker secret: `npx wrangler secret put RATING_SALT --config recipe-ratings/wrangler.toml`.
5. Deploy: `npx wrangler deploy --config recipe-ratings/wrangler.toml`.
6. Confirm GET /api/ratings?slug=buffalo-wings returns `ratingCount:0` and then connect the recipe UI to the deployed Worker URL.

CORS permits the production site only. Votes use browser-generated random IDs, hashed with a secret, plus hashed daily IP rate limits. This is **basic** abuse resistance, not identity verification. Clean up old `recipe_rating_limits` rows periodically.

**Google rich results:** Do not publish fabricated `aggregateRating`. Static GitHub Pages HTML cannot automatically incorporate new D1 totals. A separate publishing sync/build step is required to put real rating counts into static Recipe JSON-LD. JavaScript-injected JSON-LD alone is not a reliable guarantee of rich results.
