import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireRole } from '../middlewares/requireRole.js';
import { getAuditLogs } from '../controllers/auditLogController.js';

const router = express.Router();

router.get('/audit-logs', requireAuth, requireRole('admin'), getAuditLogs);

export default router;