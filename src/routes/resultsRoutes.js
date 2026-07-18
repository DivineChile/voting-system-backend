import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireRole } from '../middlewares/requireRole.js';
import {
  getElectionResultsForAdmin,
  getPublishedResultsForStudent,
} from '../controllers/resultsController.js';

const router = express.Router();

router.get(
  '/admin/elections/:electionId/results',
  requireAuth,
  requireRole('admin'),
  getElectionResultsForAdmin
);

router.get(
  '/student/results',
  requireAuth,
  requireRole('student'),
  getPublishedResultsForStudent
);

export default router;