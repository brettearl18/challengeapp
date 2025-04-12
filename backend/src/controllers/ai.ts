import { Request, Response } from 'express';
import pool from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { analyzeCheckIn as analyzeCheckInService } from '../services/aiAnalysis';

export const analyzeCheckIn = async (req: Request, res: Response) => {
  const { checkInId } = req.params;
  const coachId = req.user.id;

  try {
    // Get the check-in data
    const checkInResult = await pool.query(
      `SELECT 
        ci.*,
        u.name as user_name,
        c.name as challenge_name,
        c.duration_weeks
       FROM check_ins ci
       JOIN users u ON ci.user_id = u.id
       JOIN challenges c ON ci.challenge_id = c.id
       WHERE ci.id = $1 AND c.coach_id = $2`,
      [checkInId, coachId]
    );

    if (checkInResult.rows.length === 0) {
      throw new AppError('Check-in not found', 404);
    }

    const checkIn = checkInResult.rows[0];

    // Prepare data for analysis
    const analysisData = {
      userId: checkIn.user_id,
      challengeId: checkIn.challenge_id,
      weekNumber: checkIn.week_number,
      weight: checkIn.weight,
      measurements: JSON.parse(checkIn.measurements),
      mood: checkIn.mood,
      sleepHours: checkIn.sleep_hours,
      energyLevel: checkIn.energy_level,
      notes: checkIn.notes,
    };

    // Perform analysis
    const analysis = await analyzeCheckInService(analysisData);

    res.json({
      status: 'success',
      data: analysis,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error analyzing check-in', 500);
  }
};

export const getAnalysisHistory = async (req: Request, res: Response) => {
  const { clientId } = req.params;
  const coachId = req.user.id;

  try {
    // Verify that the client belongs to the coach
    const clientCheck = await pool.query(
      `SELECT u.id FROM users u
       JOIN challenge_participants cp ON u.id = cp.user_id
       JOIN challenges c ON cp.challenge_id = c.id
       WHERE u.id = $1 AND c.coach_id = $2
       LIMIT 1`,
      [clientId, coachId]
    );

    if (clientCheck.rows.length === 0) {
      throw new AppError('Client not found or not associated with you', 404);
    }

    // Get analysis history
    const result = await pool.query(
      `SELECT 
        aa.*,
        c.name as challenge_name,
        ci.week_number,
        ci.created_at as check_in_date
       FROM ai_analysis aa
       JOIN challenges c ON aa.challenge_id = c.id
       JOIN check_ins ci ON aa.user_id = ci.user_id 
         AND aa.challenge_id = ci.challenge_id 
         AND aa.week_number = ci.week_number
       WHERE aa.user_id = $1
       ORDER BY ci.created_at DESC`,
      [clientId]
    );

    res.json({
      status: 'success',
      data: result.rows,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error retrieving analysis history', 500);
  }
};

export const regenerateAnalysis = async (req: Request, res: Response) => {
  const { analysisId } = req.params;
  const coachId = req.user.id;

  try {
    // Get the analysis and verify ownership
    const analysisResult = await pool.query(
      `SELECT aa.*, c.coach_id
       FROM ai_analysis aa
       JOIN challenges c ON aa.challenge_id = c.id
       WHERE aa.id = $1`,
      [analysisId]
    );

    if (analysisResult.rows.length === 0) {
      throw new AppError('Analysis not found', 404);
    }

    if (analysisResult.rows[0].coach_id !== coachId) {
      throw new AppError('Unauthorized access', 403);
    }

    const analysis = analysisResult.rows[0];

    // Get the corresponding check-in data
    const checkInResult = await pool.query(
      `SELECT 
        ci.*,
        u.name as user_name,
        c.name as challenge_name,
        c.duration_weeks
       FROM check_ins ci
       JOIN users u ON ci.user_id = u.id
       JOIN challenges c ON ci.challenge_id = c.id
       WHERE ci.user_id = $1 
         AND ci.challenge_id = $2 
         AND ci.week_number = $3`,
      [analysis.user_id, analysis.challenge_id, analysis.week_number]
    );

    if (checkInResult.rows.length === 0) {
      throw new AppError('Check-in data not found', 404);
    }

    const checkIn = checkInResult.rows[0];

    // Prepare data for analysis
    const analysisData = {
      userId: checkIn.user_id,
      challengeId: checkIn.challenge_id,
      weekNumber: checkIn.week_number,
      weight: checkIn.weight,
      measurements: JSON.parse(checkIn.measurements),
      mood: checkIn.mood,
      sleepHours: checkIn.sleep_hours,
      energyLevel: checkIn.energy_level,
      notes: checkIn.notes,
    };

    // Regenerate analysis
    const newAnalysis = await analyzeCheckInService(analysisData);

    // Update the analysis in the database
    await pool.query(
      `UPDATE ai_analysis 
       SET summary = $1, recommendations = $2, flagged_issues = $3, encouragement = $4
       WHERE id = $5`,
      [
        newAnalysis.summary,
        newAnalysis.recommendations,
        newAnalysis.flaggedIssues,
        newAnalysis.encouragement,
        analysisId,
      ]
    );

    res.json({
      status: 'success',
      data: newAnalysis,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error regenerating analysis', 500);
  }
}; 