import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireRole } from '../middlewares/requireRole.js';
import {
  getOfficerDashboardSummary,
  getOfficerActiveElection,
  getOfficerElectionSetup,
  getOfficerPublishedResults,
  getOfficerElections
} from '../controllers/officerController.js';

const router = express.Router();

router.get(
  '/dashboard-summary',
  requireAuth,
  requireRole('election_officer'),
  getOfficerDashboardSummary
);

router.get(
  '/election/active',
  requireAuth,
  requireRole('election_officer'),
  getOfficerActiveElection
);

router.get(
  '/elections/:electionId/setup',
  requireAuth,
  requireRole('election_officer'),
  getOfficerElectionSetup
);

router.get(
  '/results',
  requireAuth,
  requireRole('election_officer'),
  getOfficerPublishedResults
);

router.get(
  '/elections',
  requireAuth,
  requireRole('election_officer'),
  getOfficerElections
);

export default router;