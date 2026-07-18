import express from "express";

import { getElectionInsights } from "../controllers/electionController";

const router = express.Router();

router.get(
  "/:id/ai-insights",
  authenticateUser,
  authorizeRoles("admin", "election_officer"),
  getElectionInsights,
);

export default router;
