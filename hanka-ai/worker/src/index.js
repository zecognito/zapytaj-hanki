import { HANKA_SYSTEM_PROMPT } from "./prompt.js";
import { askModel, extractText } from "./model.js";

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

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
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
        return json({ error: "Model returned no text" }, 502, request);
      }

      return json({ answer }, 200, request);
    } catch (error) {
      console.error("Hanka model error", error);
      return json({ error: "Hanka chwilowo nie odpowiada. Spróbuj ponownie za moment." }, 502, request);
    }
  }
};
