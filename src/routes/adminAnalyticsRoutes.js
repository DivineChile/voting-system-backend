import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireRole } from '../middlewares/requireRole.js';
import {
  getAdminAnalyticsOverview,
  getElectionAnalyticsDetail,
} from '../controllers/adminAnalyticsController.js';

const router = express.Router();

router.get(
  '/analytics/overview',
  requireAuth,
  requireRole('admin'),
  getAdminAnalyticsOverview
);

router.get(
  '/analytics/elections/:electionId/intelligence',
  requireAuth,
  requireRole('admin'),
  getElectionAnalyticsDetail
);

export default router;
