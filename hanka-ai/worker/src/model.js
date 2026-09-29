export async function askModel(env, messages) {
  const model = env.HANKA_MODEL || "@cf/zai-org/glm-4.7-flash";
  return env.AI.run(model, {
    messages,
    max_completion_tokens: 4096,
    temperature: 0.25
  });
}

export async function verifyGroundedAnswer(env, question, context, draft) {
  const model = env.HANKA_MODEL || "@cf/zai-org/glm-4.7-flash";
  const result = await env.AI.run(model, {
    messages: [
      {
        role: "system",
        content: `Jesteś rygorystycznym redaktorem factual-grounding. Dostajesz pytanie, zamknięty kontekst źródłowy i szkic odpowiedzi. Zwróć wyłącznie poprawioną odpowiedź po polsku.

ZASADY:
- Zachowaj tylko twierdzenia faktograficzne bezpośrednio poparte kontekstem.
- Usuń każdą niepopartą liczbę, kwotę, procent, termin, limit, nazwę instytucji, wymóg lub konkretny przykład.
- Nie dodawaj żadnych nowych faktów.
- Nie zmieniaj sugestii w wymóg ani możliwości w pewnik.
- Usuń niepoparte rankingi i superlatywy, np. „najlepszy”, „najważniejszy”, „najpierw”.
- Możesz zachować naturalny, ciepły styl, o ile nie dodaje faktów.
- Jeśli zdanie miesza fakt poparty i niepoparty, przepisz je tak, by został tylko fakt poparty.
- Nie komentuj procesu weryfikacji i nie dodawaj nagłówka typu „poprawiona odpowiedź”.`
      },
      {
        role: "user",
        content: `PYTANIE:
${question}

KONTEKST:
${context}

SZKIC:
${draft}`
      }
    ],
    max_completion_tokens: 4096,
    temperature: 0
  });
  return extractText(result);
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
