const EMBEDDING_MODEL = "@cf/baai/bge-m3";
const TOP_K = 4;
const MIN_SCORE = 0.55;
const MAX_SCORE_DROP = 0.10;

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function chunkText(text, maxChars = 1800, overlap = 220) {
  const clean = normalizeText(text);
  if (!clean) return [];
  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + maxChars, clean.length);
    if (end < clean.length) {
      const boundary = Math.max(clean.lastIndexOf(". ", end), clean.lastIndexOf(" ", end));
      if (boundary > start + Math.floor(maxChars * 0.6)) end = boundary + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.filter(Boolean);
}

function hashId(input) {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return (h1 >>> 0).toString(36);
}

async function embed(env, texts) {
  const result = await env.AI.run(EMBEDDING_MODEL, { text: texts });
  if (!Array.isArray(result?.data) || result.data.length !== texts.length) {
    throw new Error("Embedding model returned an unexpected result");
  }
  return result.data;
}

export async function retrieveContext(env, query) {
  const [vector] = await embed(env, [query]);
  const result = await env.VECTORIZE.query(vector, {
    topK: TOP_K,
    returnMetadata: "all"
  });
  const candidates = (result?.matches || []).filter((m) => m.metadata?.text);
  const bestScore = candidates[0]?.score ?? 0;
  const dynamicFloor = Math.max(MIN_SCORE, bestScore - MAX_SCORE_DROP);
  const matches = candidates.filter((m) => (m.score ?? 0) >= dynamicFloor);
  if (!matches.length) return { context: "", sources: [] };

  const sources = [];
  const seen = new Set();
  const blocks = matches.map((m, i) => {
    const meta = m.metadata || {};
    if (meta.url && !seen.has(meta.url)) {
      seen.add(meta.url);
      sources.push({ title: meta.title || meta.url, url: meta.url });
    }
    return `[Fragment ${i + 1}]\nTytuł: ${meta.title || "Zapytaj Hanki"}\nURL: ${meta.url || ""}\n${meta.text}`;
  });

  return { context: blocks.join("\n\n"), sources, matches: matches.map((m) => ({ score: m.score ?? null, title: m.metadata?.title || "", url: m.metadata?.url || "", chunk: m.metadata?.chunk ?? null, text: m.metadata?.text || "" })) };
}

export async function upsertDocuments(env, documents) {
  const vectors = [];
  let chunkCount = 0;

  for (const doc of documents) {
    const title = normalizeText(doc?.title);
    const url = normalizeText(doc?.url);
    const chunks = chunkText(doc?.text);
    if (!url || !chunks.length) continue;

    for (let offset = 0; offset < chunks.length; offset += 16) {
      const batch = chunks.slice(offset, offset + 16);
      const embeddings = await embed(env, batch);
      embeddings.forEach((values, j) => {
        const chunkIndex = offset + j;
        const text = batch[j];
        vectors.push({
          id: `hanka-${hashId(url)}-${chunkIndex}`,
          values,
          metadata: { title: title || url, url, chunk: chunkIndex, text }
        });
      });
      chunkCount += batch.length;
    }
  }

  for (let i = 0; i < vectors.length; i += 100) {
    await env.VECTORIZE.upsert(vectors.slice(i, i + 100));
  }
  return { vectors: chunkCount };
}
