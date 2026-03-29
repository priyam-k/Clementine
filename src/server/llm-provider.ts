import { ChatOpenAI } from "@langchain/openai";

const K2_BASE_URL = "https://api.k2think.ai/v1";
const K2_MODEL = "MBZUAI-IFM/K2-Think-v2";

let k2Model: ChatOpenAI | null = null;

export function getK2Model(): ChatOpenAI {
  const apiKey = process.env.K2_API_KEY;
  if (!apiKey) {
    throw new Error("K2_API_KEY is not configured");
  }

  if (!k2Model) {
    k2Model = new ChatOpenAI({
      model: K2_MODEL,
      apiKey,
      temperature: 0.2,
      configuration: {
        baseURL: K2_BASE_URL,
      },
    });
  }

  return k2Model;
}
