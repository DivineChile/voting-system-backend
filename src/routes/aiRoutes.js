import express from "express";

import {
  getAvailableElections,
  getElectionInsights,
} from "../controllers/aiController.js";
import { requireRole } from "../middlewares/requireRole.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Election AI Monitor
|--------------------------------------------------------------------------
*/

router.get(
  "/elections/:id/insights",
  requireAuth,
  requireRole("admin", "election_officer"),
  getElectionInsights,
);

router.get(
  "/elections",
  requireAuth,
  requireRole("admin", "election_officer"),
  getAvailableElections,
);

export default router;
