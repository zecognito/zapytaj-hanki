// Cloudflare Worker for genuine recipe ratings. Bind D1 database as DB.
// Configure RATING_SALT as a Worker secret before enabling votes.
const SITE = "https://zapytajhanki.com";
const headers = { "Access-Control-Allow-Origin": SITE, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin", "Cache-Control": "no-store" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
const validSlug = s => typeof s === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 100;
async function digest(s) {
  const bytes = new TextEncoder().encode(s);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function totals(db, slug) {
  const result = await db.prepare("SELECT COUNT(*) AS ratingCount, ROUND(AVG(rating), 2) AS ratingValue FROM recipe_votes WHERE slug = ?").bind(slug).first();
  return { slug, ratingCount: result?.ratingCount || 0, ratingValue: result?.ratingValue || null };
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (!env.DB) return json({ error: "Database not configured" }, 503);
    if (url.pathname !== "/api/ratings") return json({ error: "Not found" }, 404);
    if (request.method === "GET") {
      const slug = url.searchParams.get("slug");
      if (!validSlug(slug)) return json({ error: "Invalid recipe" }, 400);
      return json(await totals(env.DB, slug));
    }
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (request.headers.get("Origin") !== SITE) return json({ error: "Forbidden origin" }, 403);
    if (!request.headers.get("Content-Type")?.startsWith("application/json")) return json({ error: "JSON required" }, 415);
    if (Number(request.headers.get("Content-Length") || 0) > 2048) return json({ error: "Request too large" }, 413);
    if (!env.RATING_SALT) return json({ error: "Voting not configured" }, 503);
    let data;
    try { data = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const { slug, rating, voterId } = data || {};
    if (!validSlug(slug) || !Number.isInteger(rating) || rating < 1 || rating > 5 || typeof voterId !== "string" || !/^[a-f0-9]{32}$/.test(voterId)) return json({ error: "Invalid vote" }, 400);
    // Store hashed pseudonymous identifiers only. A browser may change its vote, not multiply votes.
    const voterHash = await digest(env.RATING_SALT + ":" + voterId);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const ipHash = await digest(env.RATING_SALT + ":ip:" + ip);
    const day = new Date().toISOString().slice(0, 10);
    // Daily per-IP rate cap to slow bulk abuse without retaining raw IPs.
    const rate = await env.DB.prepare("SELECT count FROM recipe_rating_limits WHERE day = ? AND ip_hash = ?").bind(day, ipHash).first();
    if ((rate?.count || 0) >= 30) return json({ error: "Rate limit reached" }, 429);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO recipe_rating_limits(day, ip_hash, count) VALUES (?, ?, 1) ON CONFLICT(day, ip_hash) DO UPDATE SET count = count + 1").bind(day, ipHash),
      env.DB.prepare("INSERT INTO recipe_votes(slug, voter_hash, rating, updated_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(slug, voter_hash) DO UPDATE SET rating = excluded.rating, updated_at = excluded.updated_at").bind(slug, voterHash, rating)
    ]);
    return json({ ...await totals(env.DB, slug), yourRating: rating });
  }
};
