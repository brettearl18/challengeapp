import express from 'express';
import { body } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate, authorize } from '../middleware/auth';
import {
  createChallenge,
  getChallenge,
  getChallenges,
  joinChallenge,
  updateChallenge,
  deleteChallenge,
  getChallengeParticipants,
} from '../controllers/challenges';

const router = express.Router();

// Create a new challenge (coach only)
router.post(
  '/',
  authenticate,
  authorize(['coach']),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('description').optional().isString(),
    body('durationWeeks').isInt({ min: 1 }).withMessage('Invalid duration'),
    body('startDate').isISO8601().withMessage('Invalid start date'),
    body('endDate').isISO8601().withMessage('Invalid end date'),
  ],
  validateRequest,
  createChallenge
);

// Get all challenges for the authenticated user
router.get('/', authenticate, getChallenges);

// Get a specific challenge
router.get('/:id', authenticate, getChallenge);

// Join a challenge (client only)
router.post(
  '/:id/join',
  authenticate,
  authorize(['client']),
  joinChallenge
);

// Update a challenge (coach only)
router.patch(
  '/:id',
  authenticate,
  authorize(['coach']),
  [
    body('name').optional().notEmpty(),
    body('description').optional().isString(),
    body('status').optional().isIn(['draft', 'active', 'completed', 'cancelled']),
  ],
  validateRequest,
  updateChallenge
);

// Delete a challenge (coach only)
router.delete(
  '/:id',
  authenticate,
  authorize(['coach']),
  deleteChallenge
);

// Get challenge participants (coach only)
router.get(
  '/:id/participants',
  authenticate,
  authorize(['coach']),
  getChallengeParticipants
);

export default router; 