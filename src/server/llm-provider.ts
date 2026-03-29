// ─── LLM Provider ─────────────────────────────────────────────────────────────
// Centralised LangChain model singletons.
//
// getK2Model()  — k2-think-v2 via api.k2think.ai (primary reasoning model)
// getLavaModel() — future multi-model gateway via lava.so (Gemini, Claude, etc.)

import { ChatOpenAI } from "@langchain/openai";

let _k2Model: ChatOpenAI | null = null;
let _lavaModel: ChatOpenAI | null = null;

export function getK2Model(): ChatOpenAI {
  if (!_k2Model) {
    const apiKey = process.env.K2_API_KEY;
    const baseURL = process.env.K2_BASE_URL ?? "https://api.k2think.ai/v1";
    const model = process.env.K2_MODEL ?? "MBZUAI-IFM/K2-Think-v2";
    if (!apiKey) throw new Error("K2_API_KEY is not set");
    _k2Model = new ChatOpenAI({
      apiKey,
      configuration: { baseURL },
      model,
      temperature: 0.2,
      maxTokens: 2000,
    });
  }
  return _k2Model;
}

export function getLavaModel(model = "gemini-2.0-flash-exp"): ChatOpenAI {
  if (!_lavaModel) {
    const apiKey = process.env.LAVA_API_KEY;
    const baseURL = process.env.LAVA_BASE_URL ?? "https://api.lava.so/v1";
    if (!apiKey) throw new Error("LAVA_API_KEY is not set");
    _lavaModel = new ChatOpenAI({
      apiKey,
      configuration: { baseURL },
      model,
      temperature: 0.3,
      maxTokens: 2000,
    });
  }
  return _lavaModel;
}
