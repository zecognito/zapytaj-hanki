export async function askModel(env, messages) {
  const model = env.HANKA_MODEL || "@cf/zai-org/glm-4.7-flash";
  return env.AI.run(model, {
    messages,
    max_completion_tokens: 900,
    temperature: 0.65
  });
}

export function extractText(result) {
  if (typeof result === "string") return result;
  if (typeof result?.response === "string") return result.response;
  if (typeof result?.result?.response === "string") return result.result.response;
  return "";
}
