import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { getCurrentUser } from '../controllers/authController.js';

const router = express.Router();

router.get('/me', requireAuth, getCurrentUser);

export default router;