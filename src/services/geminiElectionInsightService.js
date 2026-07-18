import { geminiModel } from "../config/gemini.js";

import { buildElectionPrompt } from "./aiPromptBuilder.js";

import { getElectionIntelligence } from "./electionAnalyticsService.js";

import {
  getCachedInsight,
  saveCachedInsight,
  updateCachedInsight,
  isCacheExpired,
} from "./aiCacheService.js";

const MODEL_NAME = "gemini-3.1-flash-lite";

function extractGeminiText(result) {
  return result?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

export async function generateElectionInsights(supabase, electionId) {
  try {
    /*
    |--------------------------------------------------------------------------
    | Build Latest Election Intelligence
    |--------------------------------------------------------------------------
    */

    const intelligence = await getElectionIntelligence(supabase, electionId);

    const status = intelligence.election.status;

    /*
    |--------------------------------------------------------------------------
    | Check Cached AI Report
    |--------------------------------------------------------------------------
    */

    const cached = await getCachedInsight(supabase, electionId);

    /*
    |--------------------------------------------------------------------------
    | Draft Elections
    |--------------------------------------------------------------------------
    */

    if (status === "draft") {
      return {
        success: true,

        generatedAt: null,

        intelligence,

        ai: null,

        summary:
          "This election has not started yet. AI monitoring will become available once the election is active.",
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Published / Closed Elections
    |--------------------------------------------------------------------------
    */

    if (cached && (status === "published" || status === "closed")) {
      return {
        success: true,

        generatedAt: cached.generated_at,

        intelligence,

        ai: {
          provider: cached.provider,

          model: cached.model,
        },

        summary: cached.summary,
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Active Election Cache
    |--------------------------------------------------------------------------
    */

    if (cached && status === "active" && !isCacheExpired(cached.generated_at)) {
      return {
        success: true,

        generatedAt: cached.generated_at,

        intelligence,

        ai: {
          provider: cached.provider,

          model: cached.model,
        },

        summary: cached.summary,
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Generate New AI Summary
    |--------------------------------------------------------------------------
    */

    const prompt = buildElectionPrompt(intelligence);

    const result = await geminiModel.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    const summary = extractGeminiText(result);

    if (!summary) {
      throw new Error("Gemini returned an empty response.");
    }

    /*
    |--------------------------------------------------------------------------
    | Cache Report
    |--------------------------------------------------------------------------
    */

    const generatedAt = new Date().toISOString();

    const report = {
      election_id: electionId,

      summary,

      intelligence,

      provider: "Gemini",

      model: MODEL_NAME,

      generated_at: generatedAt,
    };

    if (cached) {
      await updateCachedInsight(supabase, electionId, report);
    } else {
      await saveCachedInsight(supabase, report);
    }

    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    return {
      success: true,

      generatedAt,

      intelligence,

      ai: {
        provider: report.provider,

        model: report.model,
      },

      summary,
    };
  } catch (error) {
    console.error(error);

    return {
      success: false,

      error: error.message,
    };
  }
}
