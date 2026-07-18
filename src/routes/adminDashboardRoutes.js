import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireRole } from '../middlewares/requireRole.js';
import { getAdminDashboardSummary } from '../controllers/adminDashboardController.js';

const router = express.Router();

router.get(
  '/dashboard/summary',
  requireAuth,
  requireRole('admin'),
  getAdminDashboardSummary
);

export default router;