import { HANKA_SYSTEM_PROMPT } from "./prompt.js";
import { askModel, cleanAnswer, describeResult, extractText, guardGroundedAnswer, validateEvidenceTags } from "./model.js";
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

function isClearlyCasual(text) {
  const value = String(text || "").trim().toLowerCase();
  if (!value || value.length > 220) return false;
  return /^(cześć|czesc|hej|hejka|siema|dzień dobry|dzien dobry|dobry wieczór|dobry wieczor|dzięki|dzieki|dziękuję|dziekuje|co tam|jak się masz|jak sie masz|kim jesteś|kim jestes|opowiedz żart|opowiedz zart|powiedz żart|powiedz zart)[!?.\s]*$/i.test(value);
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
  "https://zapytajhanki.com/dokumenty/zgubiona-karta-social-security/",
  "https://zapytajhanki.com/dokumenty/zmiana-adresu/",
  "https://zapytajhanki.com/pieniadze/konto-bankowe-po-przyjezdzie/",
  "https://zapytajhanki.com/pieniadze/credit-score-od-zera-po-przyjezdzie/",
  "https://zapytajhanki.com/pieniadze/pierwsza-karta-kredytowa/",
  "https://zapytajhanki.com/pieniadze/credit-report/",
  "https://zapytajhanki.com/pieniadze/identity-theft/",
  "https://zapytajhanki.com/pieniadze/koszty-zycia-w-usa/",
  "https://zapytajhanki.com/praca/i-9/",
  "https://zapytajhanki.com/praca/w4/",
  "https://zapytajhanki.com/praca/w2-vs-1099/",
  "https://zapytajhanki.com/praca/wyplata/",
  "https://zapytajhanki.com/praca/utrata-pracy/",
  "https://zapytajhanki.com/podatki/jak-dzialaja-podatki/",
  "https://zapytajhanki.com/podatki/przeprowadzka-do-usa-podatki/",
  "https://zapytajhanki.com/podatki/list-z-irs/",
  "https://zapytajhanki.com/zdrowie/ubezpieczenie-zdrowotne-po-przyjezdzie/",
  "https://zapytajhanki.com/zdrowie/marketplace-aca/",
  "https://zapytajhanki.com/zdrowie/primary-care-doctor/",
  "https://zapytajhanki.com/zdrowie/urgent-care-vs-er/",
  "https://zapytajhanki.com/dom/pierwsze-mieszkanie-po-przyjezdzie/",
  "https://zapytajhanki.com/dom/wynajem-mieszkania/",
  "https://zapytajhanki.com/samochod/pierwszy-samochod-po-przyjezdzie/",
  "https://zapytajhanki.com/samochod/kupno-samochodu/",
  "https://zapytajhanki.com/samochod/ubezpieczenie/",
  "https://zapytajhanki.com/emerytura/401k/",
  "https://zapytajhanki.com/emerytura/roth-ira/",
  "https://zapytajhanki.com/emerytura/social-security/",
  "https://zapytajhanki.com/emerytura/social-security-credits/",
  "https://zapytajhanki.com/emerytura/polska-usa/",
  "https://zapytajhanki.com/praca/401k/",
  "https://zapytajhanki.com/praca/401k-loan/",
  "https://zapytajhanki.com/praca/401k-rollover/",
  "https://zapytajhanki.com/praca/early-withdrawal-401k-ira/",
  "https://zapytajhanki.com/praca/traditional-vs-roth-ira/",
  "https://zapytajhanki.com/praca/rmd-required-minimum-distributions/",
  "https://zapytajhanki.com/praca/overtime/",
  "https://zapytajhanki.com/praca/minimum-wage/",
  "https://zapytajhanki.com/praca/gross-vs-net-usa/",
  "https://zapytajhanki.com/praca/weekly-vs-biweekly-paycheck/",
  "https://zapytajhanki.com/praca/final-paycheck/",
  "https://zapytajhanki.com/praca/severance-pay/",
  "https://zapytajhanki.com/praca/fired-at-will/",
  "https://zapytajhanki.com/praca/fmla/",
  "https://zapytajhanki.com/praca/pto-vacation-sick-leave/",
  "https://zapytajhanki.com/praca/workers-compensation/",
  "https://zapytajhanki.com/praca/unpaid-wages/",
  "https://zapytajhanki.com/praca/worker-misclassification/",
  "https://zapytajhanki.com/podatki/zwrot-podatku-irs/",
  "https://zapytajhanki.com/podatki/dochod-z-polski/",
  "https://zapytajhanki.com/podatki/konto-w-polsce/",
  "https://zapytajhanki.com/podatki/fbar/",
  "https://zapytajhanki.com/podatki/fbar-vs-form-8938/",
  "https://zapytajhanki.com/podatki/form-8938/",
  "https://zapytajhanki.com/podatki/polska-emerytura-w-usa/"
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
  const totalGuides = SEED_URLS.length;
  const totalBatches = Math.ceil(totalGuides / 6);
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Hanka Brain — seed</title><style>body{font:16px/1.45 system-ui;margin:0;background:#f7f7f3;color:#173f32}.w{max-width:620px;margin:auto;padding:28px 18px}input,button{width:100%;box-sizing:border-box;font:inherit;border-radius:14px;padding:14px}input{border:1px solid #ccd5d0;background:#fff}button{margin-top:12px;border:0;background:#173f32;color:#fff;font-weight:800}pre{white-space:pre-wrap;background:#fff;padding:14px;border-radius:14px;border:1px solid #e1e5e2}</style></head><body><main class="w"><h1>Hanka Brain</h1><p>Korpus Hanka Brain: ${totalGuides} przewodników. Sekret zostaje wysłany wyłącznie do tego Workera przez HTTPS i nie jest zapisywany przez stronę.</p><input id="s" type="password" autocomplete="off" placeholder="HANKA_INGEST_SECRET"><button id="b">Załaduj ${totalGuides} przewodników</button><pre id="o">Gotowe do testu.</pre></main><script>b.onclick=async()=>{const secret=s.value.trim();if(!secret){o.textContent="Wpisz sekret.";return}b.disabled=true;o.textContent="Ładowanie partii 1/${totalBatches}…";try{let docs=0,vectors=0,pages=[];for(let batch=0;batch<${totalBatches};batch++){o.textContent="Ładowanie partii "+(batch+1)+"/${totalBatches}…";const r=await fetch("/admin/seed?batch="+batch,{method:"POST",headers:{Authorization:"Bearer "+secret}});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.detail||d.error||("HTTP "+r.status));docs+=d.documents||0;vectors+=d.vectors||0;pages=pages.concat(d.pages||[])}o.textContent=JSON.stringify({ok:true,documents:docs,vectors,pages},null,2)}catch(e){o.textContent=JSON.stringify({error:"Seed failed",detail:e.message},null,2)}finally{b.disabled=false;s.value=""}}</script></body></html>`;
}

function testerPage() {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>Hanka AI Beta</title><style>*{box-sizing:border-box}body{margin:0;background:#f7f7f3;color:#17231d;font:16px/1.45 system-ui,-apple-system,sans-serif}.wrap{max-width:720px;margin:auto;min-height:100vh;padding:24px 16px 120px}h1{margin:8px 0 2px;font-size:30px}.beta{color:#68736d;font-size:14px}.chat{margin-top:24px;display:grid;gap:12px}.msg{padding:13px 15px;border-radius:18px;max-width:88%;white-space:pre-wrap}.user{justify-self:end;background:#173f32;color:#fff}.hanka{justify-self:start;background:#fff;border:1px solid #dfe4df}.sources{justify-self:start;max-width:88%;font-size:14px;color:#59665f}.sources b{display:block;margin-bottom:6px;color:#173f32}.sources a{display:block;color:#2f694c;text-decoration:none;font-weight:700;margin:5px 0}.sources a:hover{text-decoration:underline}.debug{justify-self:start;max-width:88%;font-size:12px;color:#68736d}.debug summary{cursor:pointer;font-weight:700}.debug pre{white-space:pre-wrap;word-break:break-word;background:#eef1ed;padding:10px;border-radius:12px;max-height:320px;overflow:auto}.composer{position:fixed;left:0;right:0;bottom:0;background:#f7f7f3;border-top:1px solid #e1e4e1;padding:12px 16px calc(12px + env(safe-area-inset-bottom))}.row{max-width:720px;margin:auto;display:flex;gap:8px}textarea{flex:1;resize:none;min-height:48px;max-height:120px;border:1px solid #cbd3ce;border-radius:16px;padding:12px 14px;font:inherit}button{border:0;border-radius:16px;padding:0 18px;background:#173f32;color:#fff;font-weight:700}button:disabled{opacity:.5}</style></head><body><main class="wrap"><h1>Hanka</h1><div class="beta">prywatny tester AI · beta</div><div id="chat" class="chat"><div class="msg hanka">Cześć! Jestem Hanka. O co chodzi?</div></div></main><div class="composer"><form id="form" class="row"><textarea id="input" rows="1" maxlength="4000" placeholder="Zapytaj Hankę…" required></textarea><button id="send">Wyślij</button></form></div><script>const form=document.getElementById("form"),input=document.getElementById("input"),chat=document.getElementById("chat"),send=document.getElementById("send"),messages=[];function add(t,w){const d=document.createElement("div");d.className="msg "+w;d.textContent=String(t).replace(/\\*\\*([^*]+)\\*\\*/g,"$1");chat.appendChild(d);scrollTo(0,document.body.scrollHeight)}function addSources(sources){if(!Array.isArray(sources)||!sources.length)return;const unique=[];for(const s of sources){if(s&&s.url&&!unique.some(x=>x.url===s.url))unique.push(s)}if(!unique.length)return;const box=document.createElement("div");box.className="sources";const label=document.createElement("b");label.textContent="Przeczytaj też:";box.appendChild(label);for(const s of unique.slice(0,3)){const a=document.createElement("a");a.href=s.url;a.target="_blank";a.rel="noopener";a.textContent="→ "+(s.title||"Przewodnik Hanki");box.appendChild(a)}chat.appendChild(box);scrollTo(0,document.body.scrollHeight)}function addDebug(debug){if(!debug||!Array.isArray(debug.matches)||!debug.matches.length)return;const d=document.createElement("details");d.className="debug";const s=document.createElement("summary");s.textContent="Brain debug · "+debug.matches.length+" fragmentów";d.appendChild(s);for(const m of debug.matches){const p=document.createElement("pre");p.textContent=(m.score==null?"?":Number(m.score).toFixed(3))+" · "+(m.title||"Bez tytułu")+" · chunk "+m.chunk+"\\n"+(m.text||"(brak tekstu)");d.appendChild(p)}chat.appendChild(d)}form.addEventListener("submit",async e=>{e.preventDefault();const q=input.value.trim();if(!q)return;messages.push({role:"user",content:q});add(q,"user");input.value="";send.disabled=true;send.textContent="…";try{const r=await fetch("/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages})}),data=await r.json();if(!r.ok){messages.pop();throw new Error(data.error+(data.code?" ["+data.code+"]":""))}messages.push({role:"assistant",content:data.answer});add(data.answer,"hanka");addSources(data.sources);addDebug(data.debug)}catch(err){if(messages[messages.length-1]?.role==="user"&&messages[messages.length-1]?.content===q)messages.pop();add("Ups. "+err.message,"hanka")}finally{send.disabled=false;send.textContent="Wyślij";input.focus()}});</script></body></html>`;
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
        const batchSize = 6;
        const requestedBatch = Number(url.searchParams.get("batch") || "0");
        const totalBatches = Math.ceil(SEED_URLS.length / batchSize);
        if (!Number.isInteger(requestedBatch) || requestedBatch < 0 || requestedBatch >= totalBatches) {
          return json({ error: "Invalid seed batch", totalBatches }, 400, request);
        }
        const batchUrls = SEED_URLS.slice(requestedBatch * batchSize, (requestedBatch + 1) * batchSize);
        const documents = [];
        for (const seedUrl of batchUrls) documents.push(await fetchSeedDocument(seedUrl));
        const result = await upsertDocuments(env, documents);
        return json({
          ok: true,
          batch: requestedBatch + 1,
          totalBatches,
          documents: documents.length,
          vectors: result.vectors,
          pages: documents.map((d) => ({ title: d.title, url: d.url }))
        }, 200, request);
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
      let rag = { context: "", sources: [], matches: [] };
      try {
        rag = await retrieveContext(env, latestQuestion);
      } catch (error) {
        console.warn("Hanka retrieval unavailable", error);
      }

      if (!rag.context && !isClearlyCasual(latestQuestion)) {
        return json({
          answer: "Nie mam teraz wystarczająco pewnych informacji, żeby odpowiedzieć bez zgadywania.",
          sources: rag.sources,
          debug: { brain: false, matches: rag.matches || [] }
        }, 200, request);
      }

      const ragInstruction = rag.context
        ? `HANKA BRAIN — JEDYNE ŹRÓDŁO FAKTÓW TEJ ODPOWIEDZI
Odpowiedz wyłącznie na podstawie fragmentów poniżej. Parafrazuj i skracaj, ale nie dodawaj wiedzy modelowej.
- Każdy fakt, przykład, produkt, instytucja, liczba, kwota, termin i zalecenie musi występować w trafnym fragmencie. Każdy punkt faktograficzny zakończ ID dowodu, np. [F1] lub [F1][F2].
- Cytuj tylko F1–F4, które rzeczywiście potwierdzają dany punkt. Zachowaj siłę twierdzeń: „kluczowy”, „najważniejszy”, „najlepszy”, wymogi i kolejność tylko gdy źródło mówi to wprost.
- Brakujący szczegół pomiń; nie zgaduj.
- Pisz wyłącznie po polsku, poza naturalnymi terminami USA (np. credit score, secured card).
- Zwykła odpowiedź: 120–180 słów, maks. 3–4 krótkie punkty/akapity. Bez powtórzeń, pobocznych porad i własnych linków.
Przed wysłaniem usuń wszystko, czego nie potwierdzają fragmenty.

${rag.context}`
        : "HANKA BRAIN: brak wystarczającego źródła. Jeśli pytanie wymaga faktów, liczb, aktualnych zasad lub konkretnej porady, nie odpowiadaj z wiedzy modelowej i nie zgaduj. Powiedz krótko po polsku, że nie masz teraz wystarczająco pewnych informacji w Hanka Brain. Możesz normalnie odpowiadać na luźną rozmowę, humor i wypowiedzi niefaktograficzne.";

      const result = await askModel(env, [
        { role: "system", content: HANKA_SYSTEM_PROMPT },
        { role: "system", content: ragInstruction },
        ...messages
      ]);
      const draftAnswer = extractText(result);
      const groundedAnswer = rag.context ? guardGroundedAnswer(draftAnswer, rag.context) : draftAnswer;
      const evidencedAnswer = rag.context ? validateEvidenceTags(groundedAnswer, rag.matches?.length || 0) : groundedAnswer;
      const answer = cleanAnswer(evidencedAnswer);

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

      return json({ answer, sources: rag.sources, debug: { brain: Boolean(rag.context), matches: rag.matches || [] } }, 200, request);
    } catch (error) {
      console.error("Hanka model error", error);
      return json({ error: "Hanka chwilowo nie odpowiada. Spróbuj ponownie za moment." }, 502, request);
    }
  }
};
