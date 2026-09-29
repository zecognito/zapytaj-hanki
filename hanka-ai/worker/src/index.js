import { HANKA_SYSTEM_PROMPT } from "./prompt.js";
import { askModel, describeResult, extractText } from "./model.js";
import { retrieveContext, upsertDocuments } from "./rag.js";

const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 4000;
const ALLOWED_ROLES = new Set(["user", "assistant"]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = origin === "https://zapytajhanki.com" || origin === "https://www.zapytajhanki.com";
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://zapytajhanki.com",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

function json(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request)
    }
  });
}

function cleanMessages(input) {
  if (!Array.isArray(input)) return null;
  const recent = input.slice(-MAX_MESSAGES);
  const cleaned = [];

  for (const item of recent) {
    if (!item || !ALLOWED_ROLES.has(item.role) || typeof item.content !== "string") return null;
    const content = item.content.trim();
    if (!content || content.length > MAX_MESSAGE_CHARS) return null;
    cleaned.push({ role: item.role, content });
  }

  if (!cleaned.length || cleaned[cleaned.length - 1].role !== "user") return null;
  return cleaned;
}

const SEED_URLS = [
  "https://zapytajhanki.com/pierwsze-30-dni-w-usa/",
  "https://zapytajhanki.com/dokumenty/real-id/",
  "https://zapytajhanki.com/dokumenty/zmiana-adresu/"
];

function decodeHtml(text) {
  return String(text || "")
    .split("&nbsp;").join(" ")
    .split("&amp;").join("&")
    .split("&lt;").join("<")
    .split("&gt;").join(">")
    .split("&quot;").join(String.fromCharCode(34))
    .split("&#39;").join("'")
    .split("&apos;").join("'");
}
function htmlToText(html) {
  let text = String(html || "");
  text = text.replace(new RegExp("<script[^>]*>[\\s\\S]*?</script>", "gi"), " ");
  text = text.replace(new RegExp("<style[^>]*>[\\s\\S]*?</style>", "gi"), " ");
  text = text.replace(new RegExp("<br[^>]*>", "gi"), "\n");
  text = text.replace(new RegExp("</(p|li|h1|h2|h3|section|div|ol|ul)>", "gi"), "\n");
  text = text.replace(new RegExp("<[^>]+>", "g"), " ");
  return decodeHtml(text)
    .split("\n")
    .map((line) => line.trim().replace(/ +/g, " "))
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function fetchSeedDocument(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "HankaBrainIndexer/1.0 (+https://zapytajhanki.com/)" }
  });
  if (!response.ok) throw new Error(`Could not fetch ${url}: HTTP ${response.status}`);
  const html = await response.text();
  const titleStart = html.toLowerCase().indexOf("<title");
  const titleOpen = titleStart >= 0 ? html.indexOf(">", titleStart) : -1;
  const titleClose = titleOpen >= 0 ? html.toLowerCase().indexOf("</title>", titleOpen) : -1;
  const titleRaw = titleOpen >= 0 && titleClose > titleOpen ? html.slice(titleOpen + 1, titleClose) : url;
  const articleStart = html.search(new RegExp("<article[^>]*class=[^>]*prose", "i"));
  const articleOpen = articleStart >= 0 ? html.indexOf(">", articleStart) : -1;
  const articleClose = articleOpen >= 0 ? html.toLowerCase().indexOf("</article>", articleOpen) : -1;
  if (articleOpen < 0 || articleClose < 0) throw new Error(`Article body not found: ${url}`);
  const text = htmlToText(html.slice(articleOpen + 1, articleClose));
  if (text.length < 300) throw new Error(`Article body too short: ${url}`);
  return {
    title: htmlToText(titleRaw).split(" | Zapytaj Hanki")[0].trim(),
    url,
    text
  };
}

function authorized(request, env) {
  const expected = env.HANKA_INGEST_SECRET;
  const auth = request.headers.get("Authorization") || "";
  return Boolean(expected && auth === `Bearer ${expected}`);
}

function adminPage() {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Hanka Brain — seed</title><style>body{font:16px/1.45 system-ui;margin:0;background:#f7f7f3;color:#173f32}.w{max-width:620px;margin:auto;padding:28px 18px}input,button{width:100%;box-sizing:border-box;font:inherit;border-radius:14px;padding:14px}input{border:1px solid #ccd5d0;background:#fff}button{margin-top:12px;border:0;background:#173f32;color:#fff;font-weight:800}pre{white-space:pre-wrap;background:#fff;padding:14px;border-radius:14px;border:1px solid #e1e5e2}</style></head><body><main class="w"><h1>Hanka Brain</h1><p>Pierwszy test: 3 przewodniki. Sekret zostaje wysłany wyłącznie do tego Workera przez HTTPS i nie jest zapisywany przez stronę.</p><input id="s" type="password" autocomplete="off" placeholder="HANKA_INGEST_SECRET"><button id="b">Załaduj 3 przewodniki</button><pre id="o">Gotowe do testu.</pre></main><script>b.onclick=async()=>{const secret=s.value.trim();if(!secret){o.textContent="Wpisz sekret.";return}b.disabled=true;o.textContent="Ładowanie…";try{const r=await fetch("/admin/seed",{method:"POST",headers:{Authorization:"Bearer "+secret}});const d=await r.json();o.textContent=JSON.stringify(d,null,2)}catch(e){o.textContent="Błąd: "+e.message}finally{b.disabled=false;s.value=""}}</script></body></html>`;
}

function testerPage() {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>Hanka AI Beta</title><style>*{box-sizing:border-box}body{margin:0;background:#f7f7f3;color:#17231d;font:16px/1.45 system-ui,-apple-system,sans-serif}.wrap{max-width:720px;margin:auto;min-height:100vh;padding:24px 16px 120px}h1{margin:8px 0 2px;font-size:30px}.beta{color:#68736d;font-size:14px}.chat{margin-top:24px;display:grid;gap:12px}.msg{padding:13px 15px;border-radius:18px;max-width:88%;white-space:pre-wrap}.user{justify-self:end;background:#173f32;color:#fff}.hanka{justify-self:start;background:#fff;border:1px solid #dfe4df}.composer{position:fixed;left:0;right:0;bottom:0;background:#f7f7f3;border-top:1px solid #e1e4e1;padding:12px 16px calc(12px + env(safe-area-inset-bottom))}.row{max-width:720px;margin:auto;display:flex;gap:8px}textarea{flex:1;resize:none;min-height:48px;max-height:120px;border:1px solid #cbd3ce;border-radius:16px;padding:12px 14px;font:inherit}button{border:0;border-radius:16px;padding:0 18px;background:#173f32;color:#fff;font-weight:700}button:disabled{opacity:.5}</style></head><body><main class="wrap"><h1>Hanka</h1><div class="beta">prywatny tester AI · beta</div><div id="chat" class="chat"><div class="msg hanka">Cześć! Jestem Hanka. O co chodzi?</div></div></main><div class="composer"><form id="form" class="row"><textarea id="input" rows="1" maxlength="4000" placeholder="Zapytaj Hankę…" required></textarea><button id="send">Wyślij</button></form></div><script>const form=document.getElementById("form"),input=document.getElementById("input"),chat=document.getElementById("chat"),send=document.getElementById("send"),messages=[];function add(t,w){const d=document.createElement("div");d.className="msg "+w;d.textContent=t;chat.appendChild(d);scrollTo(0,document.body.scrollHeight)}form.addEventListener("submit",async e=>{e.preventDefault();const q=input.value.trim();if(!q)return;messages.push({role:"user",content:q});add(q,"user");input.value="";send.disabled=true;send.textContent="…";try{const r=await fetch("/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages})}),data=await r.json();if(!r.ok){messages.pop();throw new Error(data.error+(data.code?" ["+data.code+"]":""))}messages.push({role:"assistant",content:data.answer});add(data.answer,"hanka")}catch(err){if(messages[messages.length-1]?.role==="user"&&messages[messages.length-1]?.content===q)messages.pop();add("Ups. "+err.message,"hanka")}finally{send.disabled=false;send.textContent="Wyślij";input.focus()}});</script></body></html>`;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(testerPage(), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "hanka-ai-beta" }, 200, request);
    }

    if (url.pathname === "/admin" && request.method === "GET") {
      return new Response(adminPage(), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
    }

    if (url.pathname === "/admin/seed" && request.method === "POST") {
      if (!authorized(request, env)) return json({ error: "Unauthorized" }, 401, request);
      try {
        const documents = [];
        for (const seedUrl of SEED_URLS) documents.push(await fetchSeedDocument(seedUrl));
        const result = await upsertDocuments(env, documents);
        return json({ ok: true, documents: documents.length, vectors: result.vectors, pages: documents.map((d) => ({ title: d.title, url: d.url })) }, 200, request);
      } catch (error) {
        console.error("Hanka seed failed", error);
        return json({ error: "Seed failed", detail: String(error?.message || error) }, 502, request);
      }
    }

    if (url.pathname === "/admin/ingest" && request.method === "POST") {
      if (!authorized(request, env)) return json({ error: "Unauthorized" }, 401, request);
      const type = request.headers.get("Content-Type") || "";
      if (!type.includes("application/json")) return json({ error: "Content-Type must be application/json" }, 415, request);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, request); }
      if (!Array.isArray(body?.documents) || !body.documents.length || body.documents.length > 30) {
        return json({ error: "documents must contain 1 to 30 items" }, 400, request);
      }
      try {
        const result = await upsertDocuments(env, body.documents);
        return json({ ok: true, documents: body.documents.length, vectors: result.vectors }, 200, request);
      } catch (error) {
        console.error("Hanka ingest failed", error);
        return json({ error: "Ingest failed" }, 502, request);
      }
    }

    if (url.pathname !== "/chat" || request.method !== "POST") {
      return json({ error: "Not found" }, 404, request);
    }

    const type = request.headers.get("Content-Type") || "";
    if (!type.includes("application/json")) {
      return json({ error: "Content-Type must be application/json" }, 415, request);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, request);
    }

    const messages = cleanMessages(body?.messages);
    if (!messages) {
      return json({ error: "Invalid conversation" }, 400, request);
    }

    try {
      const latestQuestion = messages[messages.length - 1].content;
      let rag = { context: "", sources: [] };
      try {
        rag = await retrieveContext(env, latestQuestion);
      } catch (error) {
        console.warn("Hanka retrieval unavailable", error);
      }

      const ragInstruction = rag.context
        ? `KONTEKST Z HANKA BRAIN
Poniższe fragmenty pochodzą z treści Zapytaj Hanki. Użyj ich, gdy są istotne dla pytania. Nie wymyślaj informacji, których w nich nie ma. Jeśli odpowiedź opiera się na tych fragmentach, możesz naturalnie powiedzieć „według przewodnika Hanki”, ale nie udawaj, że sprawdziłaś internet na żywo.

${rag.context}`
        : "HANKA BRAIN: Nie znaleziono wystarczająco trafnego kontekstu. Odpowiedz ostrożnie z wiedzy modelowej i nie twierdź, że baza Hanki potwierdza odpowiedź.";

      const result = await askModel(env, [
        { role: "system", content: HANKA_SYSTEM_PROMPT },
        { role: "system", content: ragInstruction },
        ...messages
      ]);
      const answer = extractText(result);

      if (!answer) {
        const diagnostic = describeResult(result);
        const codeParts = [
          "AI_NO_TEXT",
          diagnostic.finishReason || "NO_FINISH",
          "C" + diagnostic.contentLength,
          "R" + diagnostic.reasoningLength
        ];
        const code = codeParts.join("_").toUpperCase().replace(/[^A-Z0-9_]/g, "");
        console.warn("Hanka empty model response", { code, diagnostic });
        return json({ error: "Model returned no text", code, diagnostic }, 502, request);
      }

      return json({ answer, sources: rag.sources }, 200, request);
    } catch (error) {
      console.error("Hanka model error", error);
      return json({ error: "Hanka chwilowo nie odpowiada. Spróbuj ponownie za moment." }, 502, request);
    }
  }
};
