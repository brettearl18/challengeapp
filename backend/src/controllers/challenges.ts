import { Request, Response } from 'express';
import pool from '../config/database';
import { AppError } from '../middleware/errorHandler';

export const createChallenge = async (req: Request, res: Response) => {
  const { name, description, durationWeeks, startDate, endDate } = req.body;
  const coachId = req.user.id;

  try {
    const result = await pool.query(
      `INSERT INTO challenges 
       (coach_id, name, description, duration_weeks, start_date, end_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'draft')
       RETURNING *`,
      [coachId, name, description, durationWeeks, startDate, endDate]
    );

    res.status(201).json({
      status: 'success',
      data: result.rows[0],
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error creating challenge', 500);
  }
};

export const getChallenges = async (req: Request, res: Response) => {
  const userId = req.user.id;
  const role = req.user.role;

  try {
    let query = '';
    let params: string[] = [];

    if (role === 'coach') {
      query = 'SELECT * FROM challenges WHERE coach_id = $1 ORDER BY created_at DESC';
      params = [userId];
    } else {
      query = `
        SELECT c.* FROM challenges c
        JOIN challenge_participants cp ON c.id = cp.challenge_id
        WHERE cp.user_id = $1
        ORDER BY c.created_at DESC
      `;
      params = [userId];
    }

    const result = await pool.query(query, params);

    res.json({
      status: 'success',
      data: result.rows,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error retrieving challenges', 500);
  }
};

export const getChallenge = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user.id;
  const role = req.user.role;

  try {
    let query = '';
    let params: string[] = [];

    if (role === 'coach') {
      query = 'SELECT * FROM challenges WHERE id = $1 AND coach_id = $2';
      params = [id, userId];
    } else {
      query = `
        SELECT c.* FROM challenges c
        JOIN challenge_participants cp ON c.id = cp.challenge_id
        WHERE c.id = $1 AND cp.user_id = $2
      `;
      params = [id, userId];
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      throw new AppError('Challenge not found', 404);
    }

    res.json({
      status: 'success',
      data: result.rows[0],
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error retrieving challenge', 500);
  }
};

export const joinChallenge = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // Check if challenge exists and is active
    const challengeResult = await pool.query(
      'SELECT * FROM challenges WHERE id = $1 AND status = $2',
      [id, 'active']
    );

    if (challengeResult.rows.length === 0) {
      throw new AppError('Challenge not found or not active', 404);
    }

    // Check if user is already a participant
    const participantResult = await pool.query(
      'SELECT * FROM challenge_participants WHERE challenge_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (participantResult.rows.length > 0) {
      throw new AppError('Already participating in this challenge', 400);
    }

    // Add user to challenge
    await pool.query(
      'INSERT INTO challenge_participants (challenge_id, user_id) VALUES ($1, $2)',
      [id, userId]
    );

    res.status(201).json({
      status: 'success',
      message: 'Successfully joined the challenge',
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error joining challenge', 500);
  }
};

export const updateChallenge = async (req: Request, res: Response) => {
  const { id } = req.params;
  const coachId = req.user.id;
  const updates = req.body;

  try {
    // Check if challenge exists and belongs to the coach
    const challengeResult = await pool.query(
      'SELECT * FROM challenges WHERE id = $1 AND coach_id = $2',
      [id, coachId]
    );

    if (challengeResult.rows.length === 0) {
      throw new AppError('Challenge not found', 404);
    }

    // Build update query dynamically
    const updateFields = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 3}`)
      .join(', ');

    const query = `
      UPDATE challenges 
      SET ${updateFields}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND coach_id = $2
      RETURNING *
    `;

    const values = [id, coachId, ...Object.values(updates)];

    const result = await pool.query(query, values);

    res.json({
      status: 'success',
      data: result.rows[0],
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error updating challenge', 500);
  }
};

export const deleteChallenge = async (req: Request, res: Response) => {
  const { id } = req.params;
  const coachId = req.user.id;

  try {
    // Check if challenge exists and belongs to the coach
    const challengeResult = await pool.query(
      'SELECT * FROM challenges WHERE id = $1 AND coach_id = $2',
      [id, coachId]
    );

    if (challengeResult.rows.length === 0) {
      throw new AppError('Challenge not found', 404);
    }

    // Delete challenge and related data in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete related data
      await client.query('DELETE FROM challenge_participants WHERE challenge_id = $1', [id]);
      await client.query('DELETE FROM check_ins WHERE challenge_id = $1', [id]);
      await client.query('DELETE FROM progress_photos WHERE challenge_id = $1', [id]);
      await client.query('DELETE FROM workouts WHERE challenge_id = $1', [id]);
      await client.query('DELETE FROM nutrition_plans WHERE challenge_id = $1', [id]);
      await client.query('DELETE FROM ai_analysis WHERE challenge_id = $1', [id]);
      await client.query('DELETE FROM chat_messages WHERE challenge_id = $1', [id]);
      await client.query('DELETE FROM user_points WHERE challenge_id = $1', [id]);

      // Delete the challenge
      await client.query('DELETE FROM challenges WHERE id = $1', [id]);

      await client.query('COMMIT');

      res.json({
        status: 'success',
        message: 'Challenge deleted successfully',
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error deleting challenge', 500);
  }
};

export const getChallengeParticipants = async (req: Request, res: Response) => {
  const { id } = req.params;
  const coachId = req.user.id;

  try {
    // Check if challenge exists and belongs to the coach
    const challengeResult = await pool.query(
      'SELECT * FROM challenges WHERE id = $1 AND coach_id = $2',
      [id, coachId]
    );

    if (challengeResult.rows.length === 0) {
      throw new AppError('Challenge not found', 404);
    }

    // Get participants with their progress
    const result = await pool.query(
      `SELECT 
        u.id, u.name, u.email,
        cp.joined_at,
        COUNT(DISTINCT ci.id) as check_ins_count,
        COUNT(DISTINCT pp.id) as photos_count
       FROM users u
       JOIN challenge_participants cp ON u.id = cp.user_id
       LEFT JOIN check_ins ci ON u.id = ci.user_id AND cp.challenge_id = ci.challenge_id
       LEFT JOIN progress_photos pp ON u.id = pp.user_id AND cp.challenge_id = pp.challenge_id
       WHERE cp.challenge_id = $1
       GROUP BY u.id, u.name, u.email, cp.joined_at
       ORDER BY cp.joined_at DESC`,
      [id]
    );

    res.json({
      status: 'success',
      data: result.rows,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error retrieving participants', 500);
  }
}; 