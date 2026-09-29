export async function askModel(env, messages) {
  const model = env.HANKA_MODEL || "@cf/zai-org/glm-4.7-flash";
  return env.AI.run(model, {
    messages,
    max_completion_tokens: 2048,
    temperature: 0.25
  });
}



export function validateEvidenceTags(answer, evidenceCount) {
  if (!answer || !evidenceCount) return answer;

  const max = Math.max(1, Math.min(9, Number(evidenceCount) || 0));
  // Drop only citations to evidence that was not supplied. Valid tags are stripped
  // after validation so the public answer stays conversational.
  return String(answer)
    .replace(/\[F(\d+)\]/gi, (tag, raw) => {
      const id = Number(raw);
      return id >= 1 && id <= max ? tag.toUpperCase() : "";
    })
    .replace(/\[F\d+\]/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function cleanAnswer(answer) {
  if (!answer) return answer;

  return String(answer)
    // The app renders related guide links separately; keep model prose link-free.
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/gi, "$1")
    .replace(/https?:\/\/\S+/gi, "")
    // Normalize model markdown and excessive whitespace without changing meaning.
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function guardGroundedAnswer(answer, context) {
  if (!answer || !context) return answer;

  const normalize = (value) => String(value || "")
    .toLowerCase()
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  const source = normalize(context);
  const numericToken = /(?:[$€£]\s*)?\d[\d\s.,]*(?:\s*%|\s*(?:dolar(?:a|ów|y)?|usd|dni(?:a|ach|ami)?|dzień|tygodni(?:e|a)?|miesięcy|miesiąc(?:e|a)?|lat(?:a)?|rok(?:u|i)?))?/giu;

  const unsupported = new Set();
  for (const match of answer.matchAll(numericToken)) {
    const raw = match[0].trim();
    if (!raw) continue;
    const token = normalize(raw);
    const digits = token.replace(/\D/g, "");
    if (!digits) continue;

    const variants = new Set([token, digits]);
    if (token.startsWith("$")) variants.add(token.slice(1).trim());
    const supported = [...variants].some((variant) => variant && source.includes(variant));
    if (!supported) unsupported.add(raw);
  }

  if (!unsupported.size) return answer;

  const sentences = answer.split(/(?<=[.!?])\s+|\n+/);
  const kept = sentences.filter((sentence) => {
    const normalizedSentence = normalize(sentence);
    return ![...unsupported].some((token) => normalizedSentence.includes(normalize(token)));
  });

  const cleaned = kept.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  return cleaned || answer;
}

function textFromContent(content) {
  if (typeof content === "string") return content.trim();

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  if (typeof content?.text === "string") return content.text.trim();
  return "";
}

export function extractText(result) {
  if (typeof result === "string") return result.trim();

  const candidates = [
    result?.response,
    result?.result?.response,
    result?.output_text,
    result?.result?.output_text,
    result?.choices?.[0]?.message?.content,
    result?.result?.choices?.[0]?.message?.content,
    result?.choices?.[0]?.text,
    result?.result?.choices?.[0]?.text,
    result?.output?.[0]?.content,
    result?.result?.output?.[0]?.content
  ];

  for (const candidate of candidates) {
    const text = textFromContent(candidate);
    if (text) return text;
  }

  return "";
}

export function describeResult(result) {
  const resultType = Array.isArray(result) ? "array" : typeof result;
  const resultKeys = result && typeof result === "object" ? Object.keys(result).slice(0, 12) : [];
  const choice = result?.choices?.[0] ?? result?.result?.choices?.[0];
  const choiceKeys = choice && typeof choice === "object" ? Object.keys(choice).slice(0, 12) : [];
  const message = choice?.message;
  const messageKeys = message && typeof message === "object" ? Object.keys(message).slice(0, 12) : [];
  const content = message?.content;
  const contentType = Array.isArray(content) ? "array" : typeof content;
  const finishReason = typeof choice?.finish_reason === "string" ? choice.finish_reason : "";
  const contentLength = typeof content === "string" ? content.length : Array.isArray(content) ? content.length : 0;
  const reasoningLength = typeof message?.reasoning_content === "string" ? message.reasoning_content.length : 0;
  return { resultType, resultKeys, choiceKeys, messageKeys, contentType, contentLength, reasoningLength, finishReason };
}
