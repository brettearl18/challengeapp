import express from 'express';
import { body } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate } from '../middleware/auth';
import { submitCheckIn, getCheckInHistory, getCheckInAnalysis } from '../controllers/checkIns';
import { upload } from '../middleware/upload';

const router = express.Router();

// Submit a new check-in
router.post(
  '/',
  authenticate,
  upload.array('photos', 3),
  [
    body('challengeId').isUUID().withMessage('Invalid challenge ID'),
    body('weekNumber').isInt({ min: 1 }).withMessage('Invalid week number'),
    body('weight').optional().isFloat({ min: 0 }).withMessage('Invalid weight'),
    body('measurements').optional().isObject().withMessage('Invalid measurements'),
    body('mood').optional().isString().withMessage('Invalid mood'),
    body('sleepHours').optional().isFloat({ min: 0, max: 24 }).withMessage('Invalid sleep hours'),
    body('energyLevel').optional().isInt({ min: 1, max: 10 }).withMessage('Invalid energy level'),
    body('notes').optional().isString().withMessage('Invalid notes'),
  ],
  validateRequest,
  submitCheckIn
);

// Get check-in history
router.get(
  '/history/:challengeId',
  authenticate,
  getCheckInHistory
);

// Get AI analysis for a specific check-in
router.get(
  '/analysis/:checkInId',
  authenticate,
  getCheckInAnalysis
);

export default router; 