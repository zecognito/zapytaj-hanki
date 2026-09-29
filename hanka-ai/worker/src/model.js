export async function askModel(env, messages) {
  const model = env.HANKA_MODEL || "@cf/zai-org/glm-4.7-flash";
  return env.AI.run(model, {
    messages,
    max_completion_tokens: 900,
    temperature: 0.65
  });
}

export function extractText(result) {
  if (typeof result === "string") return result.trim();

  const candidates = [
    result?.response,
    result?.result?.response,
    result?.choices?.[0]?.message?.content,
    result?.result?.choices?.[0]?.message?.content,
    result?.choices?.[0]?.text,
    result?.result?.choices?.[0]?.text
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}
