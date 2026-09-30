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

function compactRecordText(record) {
  const scope = [
    record.country === "US" ? "Stany Zjednoczone (USA)" : record.country,
    record.jurisdiction,
    record.region,
    record.topic,
    record.subtopic
  ].filter(Boolean).join(" | ");
  return normalizeText([
    record.title,
    scope,
    ...(Array.isArray(record.facts) ? record.facts : [])
  ].filter(Boolean).join("\n"));
}

export function validateKnowledgeRecord(record) {
  const errors = [];
  if (!record || typeof record !== "object" || Array.isArray(record)) return ["record must be an object"];
  if (!/^[a-z0-9][a-z0-9-]*$/.test(String(record.id || ""))) errors.push("invalid id");
  if (!/^[A-Z]{2}$/.test(String(record.country || ""))) errors.push("country must be a 2-letter uppercase code");
  if (!["federal", "state", "local", "general"].includes(record.jurisdiction)) errors.push("invalid jurisdiction");
  if (record.region !== null && typeof record.region !== "string") errors.push("region must be a string or null");
  for (const key of ["topic", "subtopic", "title", "last_verified"]) if (!normalizeText(record[key])) errors.push(`${key} is required`);
  if (!Array.isArray(record.facts) || !record.facts.length || record.facts.some((x) => !normalizeText(x))) errors.push("facts must contain non-empty strings");
  if (!Array.isArray(record.official_sources) || !record.official_sources.length) errors.push("official_sources is required");
  for (const url of record.official_sources || []) {
    try { new URL(url); } catch { errors.push("official_sources contains an invalid URL"); break; }
  }
  if (!Array.isArray(record.related_public_pages)) errors.push("related_public_pages must be an array");
  for (const url of record.related_public_pages || []) {
    try {
      const parsed = new URL(url);
      if (!["zapytajhanki.com", "www.zapytajhanki.com"].includes(parsed.hostname)) throw new Error();
    } catch { errors.push("related_public_pages must contain ZapytajHanki.com URLs"); break; }
  }
  if (record.effective_from !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(record.effective_from || ""))) errors.push("invalid effective_from");
  if (record.effective_to !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(record.effective_to || ""))) errors.push("invalid effective_to");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(record.last_verified || ""))) errors.push("invalid last_verified");
  return [...new Set(errors)];
}

export async function retrieveContext(env, query) {
  const [vector] = await embed(env, [query]);
  const result = await env.VECTORIZE.query(vector, { topK: TOP_K, returnMetadata: "all" });
  const candidates = (result?.matches || []).filter((m) => m.metadata?.text);
  const bestScore = candidates[0]?.score ?? 0;
  const dynamicFloor = Math.max(MIN_SCORE, bestScore - MAX_SCORE_DROP);
  const matches = candidates.filter((m) => (m.score ?? 0) >= dynamicFloor);

  const sources = [];
  const seen = new Set();
  const sourceMatches = matches.length ? matches : candidates.slice(0, 3);
  for (const m of sourceMatches) {
    const meta = m.metadata || {};
    if (meta.url && !seen.has(meta.url)) {
      seen.add(meta.url);
      sources.push({ title: meta.title || meta.url, url: meta.url });
    }
  }
  if (!matches.length) return {
    context: "", sources,
    matches: candidates.slice(0, TOP_K).map((m) => ({ score:m.score??null,title:m.metadata?.title||"",url:m.metadata?.url||"",chunk:m.metadata?.chunk??null,text:m.metadata?.text||"",recordId:m.metadata?.recordId||"" }))
  };

  const blocks = matches.map((m, i) => `[F${i + 1}] ${m.metadata?.text || ""}`);
  return { context: blocks.join("\n\n"), sources, matches: matches.map((m) => ({ score:m.score??null,title:m.metadata?.title||"",url:m.metadata?.url||"",chunk:m.metadata?.chunk??null,text:m.metadata?.text||"",recordId:m.metadata?.recordId||"" })) };
}

export async function upsertDocuments(env, documents) {
  const vectors = [];
  let chunkCount = 0;
  for (const doc of documents) {
    const title = normalizeText(doc?.title);
    const url = normalizeText(doc?.url);
    const chunks = chunkText(doc?.text);
    if (!url || !chunks.length) continue;
    for (let offset=0; offset<chunks.length; offset+=16) {
      const batch=chunks.slice(offset,offset+16);
      const embeddings=await embed(env,batch);
      embeddings.forEach((values,j)=>{
        const chunkIndex=offset+j, text=batch[j];
        vectors.push({id:`hanka-${hashId(url)}-${chunkIndex}`,values,metadata:{kind:"page",title:title||url,url,chunk:chunkIndex,text}});
      });
      chunkCount += batch.length;
    }
  }
  for (let i=0;i<vectors.length;i+=100) await env.VECTORIZE.upsert(vectors.slice(i,i+100));
  return {vectors:chunkCount};
}

export async function upsertKnowledgeRecords(env, records) {
  const prepared=[];
  for (const record of records) {
    const errors=validateKnowledgeRecord(record);
    if (errors.length) throw new Error(`${record?.id || "unknown record"}: ${errors.join(", ")}`);
    prepared.push({record,text:compactRecordText(record)});
  }
  const vectors=[];
  for (let offset=0;offset<prepared.length;offset+=16) {
    const batch=prepared.slice(offset,offset+16);
    const embeddings=await embed(env,batch.map((x)=>x.text));
    embeddings.forEach((values,j)=>{
      const {record,text}=batch[j];
      const related=record.related_public_pages || [];
      vectors.push({
        id:`brain-${record.id}`,
        values,
        metadata:{
          kind:"record",recordId:record.id,country:record.country,jurisdiction:record.jurisdiction,
          region:record.region || "",topic:record.topic,subtopic:record.subtopic,title:record.title,
          url:related[0] || "",text,lastVerified:record.last_verified,
          effectiveFrom:record.effective_from || "",effectiveTo:record.effective_to || ""
        }
      });
    });
  }
  for (let i=0;i<vectors.length;i+=100) await env.VECTORIZE.upsert(vectors.slice(i,i+100));
  return {records:prepared.length,vectors:vectors.length};
}
