import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireRole } from '../middlewares/requireRole.js';
import {
  getElectionsForAdmin,
  createPosition,
  updatePosition,
} from '../controllers/adminPositionController.js';

const router = express.Router();

router.get('/elections', requireAuth, requireRole('admin'), getElectionsForAdmin);
router.post('/positions', requireAuth, requireRole('admin'), createPosition);
router.patch('/positions/:positionId', requireAuth, requireRole('admin'), updatePosition);

export default router;