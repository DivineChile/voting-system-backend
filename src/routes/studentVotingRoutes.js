import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireRole } from '../middlewares/requireRole.js';
import {
  getActiveElectionForStudent,
  submitBallot,
} from '../controllers/studentVotingController.js';

const router = express.Router();

router.get('/election/active', requireAuth, requireRole('student'), getActiveElectionForStudent);
router.post('/ballots', requireAuth, requireRole('student'), submitBallot);

export default router;