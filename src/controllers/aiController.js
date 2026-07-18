import { generateElectionInsights } from "../services/geminiElectionInsightService.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getAvailableElectionIntelligence } from "../services/aiService.js";

export async function getElectionInsights(req, res) {
  try {
    const { id } = req.params;

    console.log("Controller electionId:", id);

    const insights = await generateElectionInsights(supabaseAdmin, id);

    if (!insights.success) {
      return res.status(500).json(insights);
    }

    return res.status(200).json(insights);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate AI election insights.",
      error: error.message,
    });
  }
}

export async function getAvailableElections(req, res) {
  try {
    const elections = await getAvailableElectionIntelligence(supabaseAdmin);

    return res.status(200).json({
      success: true,
      data: elections,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to load elections.",
      error: error.message,
    });
  }
}
