import { GoogleGenAI } from "@google/genai";

// Use a direct Gemini API key if provided, otherwise fall back to the Replit integration proxy
const usingDirectKey = !!process.env.GEMINI_API_KEY;

if (!usingDirectKey) {
  if (!process.env.AI_INTEGRATIONS_GEMINI_BASE_URL) {
    throw new Error(
      "AI_INTEGRATIONS_GEMINI_BASE_URL must be set. Did you forget to provision the Gemini AI integration?",
    );
  }
  if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
    throw new Error(
      "AI_INTEGRATIONS_GEMINI_API_KEY must be set. Did you forget to provision the Gemini AI integration?",
    );
  }
}

export const ai = usingDirectKey
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  : new GoogleGenAI({
      apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
      httpOptions: {
        apiVersion: "",
        baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
      },
    });
