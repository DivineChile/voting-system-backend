import { GoogleGenAI } from "@google/genai";
import env from "./config/env.js";

const ai = new GoogleGenAI({
  apiKey: env.geminiKey,
});

async function test() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: "Say hello in one sentence.",
    });

    console.log(response.text);
  } catch (err) {
    console.error(err);
  }
}

test();
