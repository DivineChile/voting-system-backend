import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireRole } from '../middlewares/requireRole.js';
import { getElectionSetup } from '../controllers/adminSetupController.js';

const router = express.Router();

router.get(
  '/elections/:electionId/setup',
  requireAuth,
  requireRole('admin'),
  getElectionSetup
);

export default router;