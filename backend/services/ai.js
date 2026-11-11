/**
 * OpenRouter client.
 *
 * Tuned for accounts on free models: free models are tried first (several
 * times, since "openrouter/free" picks a different model each call), paid
 * routing only if the account has credits, and a model that answers
 * 402 (no credits) or 404 (gone) is not asked again.
 */
const axios = require("axios");
const { jsonrepair } = require("jsonrepair");

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_MODELS = [
  "openrouter/free",
  "openrouter/free",
  "openrouter/free",
  "openrouter/free",
  "openrouter/auto",
];

function getModels() {
  const list = (process.env.OPENROUTER_MODELS || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return list.length ? list : DEFAULT_MODELS;
}

const isFree = (model) => model === "openrouter/free" || model.endsWith(":free");

function paidMaxTokens() {
  const v = Number(process.env.OPENROUTER_MAX_TOKENS);
  return Number.isFinite(v) && v >= 500 ? v : 3000;
}

function errorMessage(error) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.code ||
    error?.message ||
    "Unknown error"
  );
}

async function callOnce(model, apiKey, messages, { maxTokens, json } = {}) {
  const body = {
    model,
    messages,
    temperature: 0.4,
    max_tokens: isFree(model) ? Math.max(maxTokens || 0, 6000) : maxTokens || paidMaxTokens(),
    // Reasoning models otherwise spend the whole budget thinking.
    reasoning: { effort: "low", exclude: true },
  };
  if (json) body.response_format = { type: "json_object" };

  const config = {
    timeout: 120000,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.PUBLIC_URL || "https://prompt2site.app",
      "X-Title": "Prompt2Site",
    },
  };

  let response;
  try {
    response = await axios.post(OPENROUTER_URL, body, config);
  } catch (error) {
    // Some providers reject optional parameters; retry once without them.
    if (error.response?.status === 400) {
      delete body.reasoning;
      delete body.response_format;
      response = await axios.post(OPENROUTER_URL, body, config);
    } else {
      throw error;
    }
  }

  const choice = response.data?.choices?.[0];
  const text = choice?.message?.content || choice?.text || "";
  if (!text.trim()) {
    throw new Error(
      choice?.finish_reason === "length" ? "model ran out of tokens before answering" : "empty response"
    );
  }
  return { text, truncated: choice?.finish_reason === "length", model: response.data?.model || model };
}

/**
 * Ask models in turn until `accept(text)` returns a value (not undefined).
 * `accept` may throw to reject an answer; its message is fed back on retry.
 */
async function ask({ system, user, apiKey, accept, json, maxTokens, onProgress, label = "AI", imageDataUrl }) {
  const key = apiKey || process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set on the backend");

  const failures = [];
  const skip = new Set();
  let feedback = "";
  const started = Date.now();
  const budgetMs = Number(process.env.AI_TIME_BUDGET_SECONDS || 240) * 1000;

  for (const [i, model] of getModels().entries()) {
    if (skip.has(model)) continue;
    if (i > 0 && Date.now() - started > budgetMs) {
      failures.push(`stopped after ${Math.round((Date.now() - started) / 1000)}s`);
      break;
    }
    onProgress?.(`${label} (attempt ${i + 1})`);
    try {
      const text = feedback ? `${user}\n\nYour previous answer was rejected: ${feedback}. Fix that.` : user;
      const messages = [
        { role: "system", content: system },
        {
          role: "user",
          content: imageDataUrl ? [{ type: "text", text }, { type: "image_url", image_url: { url: imageDataUrl } }] : text,
        },
      ];
      const { text: answer, truncated, model: usedModel } = await callOnce(model, key, messages, { json, maxTokens });
      try {
        const value = accept(answer);
        if (value !== undefined) return { value, model: usedModel };
        throw new Error("answer was not usable");
      } catch (e) {
        feedback = truncated ? `${e.message} (your answer was cut off; be shorter)` : e.message;
        throw e;
      }
    } catch (error) {
      const status = error.response?.status;
      const msg = errorMessage(error);
      failures.push(`${model}: ${msg}`);
      console.log(`[ai] ${label} failed with ${model}: ${msg}`);
      if (status === 402 || status === 404 || status === 401) skip.add(model);
      if (status === 401) break; // bad key: no model will work
      if (status === 429) await new Promise((r) => setTimeout(r, 4000));
    }
  }

  const useful = failures.filter((f) => !/more credits|unavailable for free/i.test(f));
  const err = new Error(`${label} failed: ${[...new Set(useful.length ? useful : failures)].slice(0, 3).join(" | ")}`);
  err.failures = failures;
  throw err;
}

/** Parse the first JSON object in a model reply, repairing small mistakes. */
function parseJson(text) {
  let t = String(text || "").trim();
  t = t.replace(/```(?:json)?/gi, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first === -1) throw new Error("no JSON object in the answer");
  t = last > first ? t.slice(first, last + 1) : t.slice(first);
  try {
    return JSON.parse(t);
  } catch {
    return JSON.parse(jsonrepair(t));
  }
}

module.exports = { ask, parseJson, errorMessage };
