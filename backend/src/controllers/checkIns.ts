import { Request, Response } from 'express';
import pool from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { uploadToFirebase } from '../middleware/upload';
import { analyzeCheckIn } from '../services/aiAnalysis';

export const submitCheckIn = async (req: Request, res: Response) => {
  const {
    challengeId,
    weekNumber,
    weight,
    measurements,
    mood,
    sleepHours,
    energyLevel,
    notes,
  } = req.body;

  const userId = req.user.id;
  const files = req.files as Express.Multer.File[];

  try {
    // Start a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert check-in data
      const checkInResult = await client.query(
        `INSERT INTO check_ins 
         (user_id, challenge_id, week_number, weight, measurements, mood, sleep_hours, energy_level, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          userId,
          challengeId,
          weekNumber,
          weight,
          JSON.stringify(measurements),
          mood,
          sleepHours,
          energyLevel,
          notes,
        ]
      );

      const checkIn = checkInResult.rows[0];

      // Upload and save progress photos if any
      if (files && files.length > 0) {
        for (const file of files) {
          const path = `progress-photos/${userId}/${challengeId}/week-${weekNumber}/${Date.now()}-${file.originalname}`;
          const photoUrl = await uploadToFirebase(file, path);

          await client.query(
            `INSERT INTO progress_photos 
             (user_id, challenge_id, week_number, photo_url)
             VALUES ($1, $2, $3, $4)`,
            [userId, challengeId, weekNumber, photoUrl]
          );
        }
      }

      // Trigger AI analysis
      const analysis = await analyzeCheckIn({
        userId,
        challengeId,
        weekNumber,
        weight,
        measurements,
        mood,
        sleepHours,
        energyLevel,
        notes,
      });

      await client.query('COMMIT');

      res.status(201).json({
        status: 'success',
        data: {
          checkIn,
          analysis,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error submitting check-in', 500);
  }
};

export const getCheckInHistory = async (req: Request, res: Response) => {
  const { challengeId } = req.params;
  const userId = req.user.id;

  try {
    // Get check-in history
    const checkInsResult = await pool.query(
      `SELECT * FROM check_ins 
       WHERE user_id = $1 AND challenge_id = $2
       ORDER BY week_number DESC`,
      [userId, challengeId]
    );

    // Get progress photos
    const photosResult = await pool.query(
      `SELECT * FROM progress_photos 
       WHERE user_id = $1 AND challenge_id = $2
       ORDER BY week_number DESC, created_at DESC`,
      [userId, challengeId]
    );

    // Get AI analysis
    const analysisResult = await pool.query(
      `SELECT * FROM ai_analysis 
       WHERE user_id = $1 AND challenge_id = $2
       ORDER BY week_number DESC`,
      [userId, challengeId]
    );

    // Combine the data
    const history = checkInsResult.rows.map((checkIn) => {
      const photos = photosResult.rows.filter(
        (photo) => photo.week_number === checkIn.week_number
      );
      const analysis = analysisResult.rows.find(
        (a) => a.week_number === checkIn.week_number
      );

      return {
        ...checkIn,
        measurements: JSON.parse(checkIn.measurements),
        photos,
        analysis,
      };
    });

    res.json({
      status: 'success',
      data: history,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error retrieving check-in history', 500);
  }
};

export const getCheckInAnalysis = async (req: Request, res: Response) => {
  const { checkInId } = req.params;
  const userId = req.user.id;

  try {
    // Get the check-in
    const checkInResult = await pool.query(
      'SELECT * FROM check_ins WHERE id = $1 AND user_id = $2',
      [checkInId, userId]
    );

    if (checkInResult.rows.length === 0) {
      throw new AppError('Check-in not found', 404);
    }

    const checkIn = checkInResult.rows[0];

    // Get the AI analysis
    const analysisResult = await pool.query(
      `SELECT * FROM ai_analysis 
       WHERE user_id = $1 AND challenge_id = $2 AND week_number = $3`,
      [userId, checkIn.challenge_id, checkIn.week_number]
    );

    if (analysisResult.rows.length === 0) {
      throw new AppError('Analysis not found', 404);
    }

    res.json({
      status: 'success',
      data: analysisResult.rows[0],
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error retrieving analysis', 500);
  }
}; 