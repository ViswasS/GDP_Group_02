const { env } = require("../config/env");

async function groqChatCompletion({ messages, model = env.GROQ_MODEL, maxTokens = env.GROQ_MAX_TOKENS, temperature = env.GROQ_TEMPERATURE, timeoutMs = env.GROQ_TIMEOUT_MS }) {
  if (!env.GROQ_CHAT_ENABLED || !env.GROQ_API_KEY) {
    const err = new Error("GROQ_DISABLED");
    err.code = "GROQ_DISABLED";
    throw err;
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs || 15000);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false,
    }),
    signal: controller.signal,
  });
  clearTimeout(id);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Groq request failed (${res.status}) ${text}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  return { content, raw: data, modelUsed: data?.model };
}

module.exports = { groqChatCompletion };
