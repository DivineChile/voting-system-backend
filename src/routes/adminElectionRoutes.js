import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireRole } from '../middlewares/requireRole.js';
import {
  getAdminElections,
  createElection,
  updateElection,
  updateElectionStatus,
} from '../controllers/adminElectionController.js';

const router = express.Router();

router.get('/elections', requireAuth, requireRole('admin'), getAdminElections);
router.post('/elections', requireAuth, requireRole('admin'), createElection);
router.patch('/elections/:electionId', requireAuth, requireRole('admin'), updateElection);
router.patch('/elections/:electionId/status', requireAuth, requireRole('admin'), updateElectionStatus);

export default router;