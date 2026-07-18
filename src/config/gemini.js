import { GoogleGenAI } from "@google/genai";
import env from "./env.js";

const ai = new GoogleGenAI({
  apiKey: env.geminiKey,
});

export const geminiModel = ai.models;
