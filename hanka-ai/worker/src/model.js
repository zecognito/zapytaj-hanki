export async function askModel(env, messages) {
  const model = env.HANKA_MODEL || "@cf/zai-org/glm-4.7-flash";
  return env.AI.run(model, {
    messages,
    max_completion_tokens: 900,
    temperature: 0.65
  });
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
  return { resultType, resultKeys, choiceKeys, messageKeys };
}
