import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireRole } from '../middlewares/requireRole.js';
import { createUser } from '../controllers/adminUserController.js';

const router = express.Router();

router.post('/users', requireAuth, requireRole('admin'), createUser);

export default router;