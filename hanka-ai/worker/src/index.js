import { HANKA_SYSTEM_PROMPT } from "./prompt.js";
import { askModel, describeResult, extractText } from "./model.js";

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
      const result = await askModel(env, [
        { role: "system", content: HANKA_SYSTEM_PROMPT },
        ...messages
      ]);
      const answer = extractText(result);

      if (!answer) {
        const diagnostic = describeResult(result);
        const code = "AI_NO_TEXT_" + diagnostic.resultKeys.join("_").slice(0, 48).toUpperCase().replace(/[^A-Z0-9_]/g, "") || "AI_NO_TEXT_EMPTY";
        console.warn("Hanka empty model response", { code, diagnostic });
        return json({ error: "Model returned no text", code, diagnostic }, 502, request);
      }

      return json({ answer }, 200, request);
    } catch (error) {
      console.error("Hanka model error", error);
      return json({ error: "Hanka chwilowo nie odpowiada. Spróbuj ponownie za moment." }, 502, request);
    }
  }
};
