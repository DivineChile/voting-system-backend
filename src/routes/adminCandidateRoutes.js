import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireRole } from '../middlewares/requireRole.js';
import {
  getPositionsByElection,
  createCandidate,
  updateCandidate,
  toggleCandidateStatus,
} from '../controllers/adminCandidateController.js';

const router = express.Router();

router.get('/positions', requireAuth, requireRole('admin'), getPositionsByElection);
router.post('/candidates', requireAuth, requireRole('admin'), createCandidate);
router.patch('/candidates/:candidateId', requireAuth, requireRole('admin'), updateCandidate);
router.patch('/candidates/:candidateId/status', requireAuth, requireRole('admin'), toggleCandidateStatus);

export default router;