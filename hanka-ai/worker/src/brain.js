const SITE_ORIGIN = "https://zapytajhanki.com";
export const EMBEDDING_MODEL = "@cf/baai/bge-m3";

export const PILOT_BRAIN_PATHS = [
  "/pieniadze/credit-score/",
  "/pieniadze/credit-report/",
  "/pieniadze/credit-utilization/",
  "/pieniadze/secured-credit-card/",
  "/pieniadze/pierwsza-karta-kredytowa/",
  "/pieniadze/apr-karta-kredytowa/",
  "/pieniadze/checking-vs-savings/",
  "/pieniadze/ach-vs-wire-transfer/",
  "/dom/escrow/",
  "/dom/mortgage/",
  "/dom/preapproval/",
  "/dom/closing-costs/",
  "/dom/property-tax/",
  "/praca/w2-vs-1099/",
  "/praca/overtime/",
  "/zdrowie/cobra/",
  "/zdrowie/marketplace-aca/",
  "/zdrowie/deductible-copay-coinsurance/",
  "/emerytura/401k/",
  "/podatki/w2/",
  "/podatki/1099/",
  "/samochod/ubezpieczenie-samochodu/",
  "/illinois/prawo-jazdy/",
  "/illinois/rejestracja-samochodu/",
  "/pierwsze-30-dni-w-usa/"
];

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function plainText(html) {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>|<\/li>|<\/h[1-6]>|<\/section>|<\/tr>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstMatch(html, pattern) {
  const match = html.match(pattern);
  return match ? plainText(match[1]) : "";
}

function sectionBlocks(articleHtml) {
  const marked = articleHtml
    .replace(/<(h2|h3)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, tag, heading) => `\n@@H@@${plainText(heading)}\n`)
    .replace(/<section\b[^>]*>/gi, "\n")
    .replace(/<\/section>/gi, "\n");

  const parts = marked.split(/\n@@H@@/).map((part) => part.trim()).filter(Boolean);
  return parts.map((part, index) => {
    if (index === 0 && !part.includes("\n")) return { heading: "", text: plainText(part) };
    const newline = part.indexOf("\n");
    if (newline === -1) return { heading: "", text: plainText(part) };
    return {
      heading: plainText(part.slice(0, newline)),
      text: plainText(part.slice(newline + 1))
    };
  }).filter((block) => block.text);
}

function splitLongText(text, maxChars = 1800) {
  if (text.length <= maxChars) return [text];
  const paragraphs = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n${paragraph}` : paragraph;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    if (paragraph.length <= maxChars) {
      current = paragraph;
      continue;
    }
    for (let i = 0; i < paragraph.length; i += maxChars) chunks.push(paragraph.slice(i, i + maxChars));
    current = "";
  }
  if (current) chunks.push(current);
  return chunks;
}

export function extractArticle(html, sourceUrl) {
  const articleMatch = html.match(/<article\b[^>]*class=["'][^"']*\bprose\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/i);
  if (!articleMatch) throw new Error("Article prose not found");

  const title =
    firstMatch(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i) ||
    firstMatch(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i).replace(/\s*\|\s*Zapytaj Hanki\s*$/i, "");
  const description = firstMatch(html, /<meta\s+name=["']description["']\s+content=["']([^"']*)["'][^>]*>/i);
  const verified = firstMatch(html, /<[^>]*class=["'][^"']*\bverified\b[^"']*["'][^>]*>([\s\S]*?)<\//i)
    .replace(/^Sprawdzono:\s*/i, "");

  const url = new URL(sourceUrl);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const topic = pathParts[0] || "general";
  const state = ["illinois", "california", "new-york", "pennsylvania", "wisconsin", "indiana", "michigan", "ohio", "florida", "texas"].includes(topic)
    ? topic
    : "";

  return {
    title,
    description,
    verified,
    sourceUrl: url.href,
    country: "US",
    language: "pl",
    topic,
    state,
    blocks: sectionBlocks(articleMatch[1])
  };
}

export function chunkArticle(document) {
  const chunks = [];
  let sequence = 0;

  for (const block of document.blocks) {
    for (const text of splitLongText(block.text)) {
      const heading = block.heading || document.title;
      const content = `Tytuł: ${document.title}\nSekcja: ${heading}\n${text}`;
      chunks.push({
        id: `${document.topic}:${new URL(document.sourceUrl).pathname.replace(/^\/|\/$/g, "").replaceAll("/", ":")}:${sequence++}`,
        text: content,
        metadata: {
          country: document.country,
          language: document.language,
          topic: document.topic,
          state: document.state,
          title: document.title.slice(0, 500),
          heading: heading.slice(0, 500),
          source_url: document.sourceUrl,
          verified: document.verified || ""
        }
      });
    }
  }
  return chunks;
}

function embeddingRows(result) {
  const candidates = [result?.data, result?.result?.data, result?.embeddings, result?.result?.embeddings];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    if (candidate.length && Array.isArray(candidate[0])) return candidate;
    if (candidate.length && Array.isArray(candidate[0]?.embedding)) return candidate.map((row) => row.embedding);
  }
  return [];
}

export async function embedTexts(env, texts) {
  const result = await env.AI.run(EMBEDDING_MODEL, { text: texts });
  const rows = embeddingRows(result);
  if (rows.length !== texts.length) throw new Error(`Embedding count mismatch: expected ${texts.length}, got ${rows.length}`);
  return rows;
}

export async function preparePilotDocument(path) {
  const sourceUrl = new URL(path, SITE_ORIGIN).href;
  const response = await fetch(sourceUrl, { headers: { "User-Agent": "HankaBrain/0.1" } });
  if (!response.ok) throw new Error(`Source fetch failed ${response.status}: ${sourceUrl}`);
  const html = await response.text();
  return chunkArticle(extractArticle(html, sourceUrl));
}

export async function indexPilotPath(env, path) {
  if (!env.HANKA_BRAIN) throw new Error("HANKA_BRAIN Vectorize binding is missing");
  const chunks = await preparePilotDocument(path);
  const vectors = [];

  for (let i = 0; i < chunks.length; i += 16) {
    const batch = chunks.slice(i, i + 16);
    const embeddings = await embedTexts(env, batch.map((chunk) => chunk.text));
    for (let j = 0; j < batch.length; j++) {
      vectors.push({
        id: batch[j].id,
        values: embeddings[j],
        metadata: { ...batch[j].metadata, text: batch[j].text }
      });
    }
  }

  const mutation = await env.HANKA_BRAIN.upsert(vectors);
  return { path, chunks: vectors.length, mutation };
}

export async function searchBrain(env, query, options = {}) {
  if (!env.HANKA_BRAIN) return [];
  const [vector] = await embedTexts(env, [query]);
  const result = await env.HANKA_BRAIN.query(vector, {
    topK: options.topK || 6,
    returnMetadata: "all",
    filter: options.filter
  });
  return (result?.matches || []).map((match) => ({
    id: match.id,
    score: match.score,
    ...match.metadata
  }));
}
