import OpenAI from 'openai';
import pool from '../config/database';
import { AppError } from '../middleware/errorHandler';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface CheckInData {
  userId: string;
  challengeId: string;
  weekNumber: number;
  weight?: number;
  measurements?: {
    waist?: number;
    hips?: number;
    chest?: number;
    [key: string]: number | undefined;
  };
  mood?: string;
  sleepHours?: number;
  energyLevel?: number;
  notes?: string;
  previousCheckIns?: any[];
}

export const analyzeCheckIn = async (data: CheckInData) => {
  try {
    // Get previous check-ins for trend analysis
    const previousCheckIns = await pool.query(
      `SELECT * FROM check_ins 
       WHERE user_id = $1 AND challenge_id = $2 AND week_number < $3
       ORDER BY week_number DESC
       LIMIT 4`,
      [data.userId, data.challengeId, data.weekNumber]
    );

    // Get user information
    const userResult = await pool.query(
      'SELECT name, role FROM users WHERE id = $1',
      [data.userId]
    );
    const user = userResult.rows[0];

    // Get challenge information
    const challengeResult = await pool.query(
      'SELECT name, duration_weeks FROM challenges WHERE id = $1',
      [data.challengeId]
    );
    const challenge = challengeResult.rows[0];

    // Prepare the prompt for OpenAI
    const prompt = createAnalysisPrompt(data, user, challenge, previousCheckIns.rows);

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert fitness coach analyzing client progress data. Provide detailed, professional, and encouraging feedback."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const analysis = completion.choices[0].message.content;
    if (!analysis) {
      throw new AppError('Failed to generate AI analysis', 500);
    }

    // Parse the analysis into structured format
    const structuredAnalysis = parseAnalysisResponse(analysis);

    // Store the analysis in the database
    await pool.query(
      `INSERT INTO ai_analysis 
       (user_id, challenge_id, week_number, summary, recommendations, flagged_issues, encouragement)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, challenge_id, week_number) 
       DO UPDATE SET 
         summary = $4,
         recommendations = $5,
         flagged_issues = $6,
         encouragement = $7,
         updated_at = CURRENT_TIMESTAMP`,
      [
        data.userId,
        data.challengeId,
        data.weekNumber,
        structuredAnalysis.summary,
        structuredAnalysis.recommendations,
        structuredAnalysis.flaggedIssues,
        structuredAnalysis.encouragement
      ]
    );

    return structuredAnalysis;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error analyzing check-in data', 500);
  }
};

const createAnalysisPrompt = (
  data: CheckInData,
  user: any,
  challenge: any,
  previousCheckIns: any[]
): string => {
  let prompt = `Analyze the following client check-in data and provide a comprehensive analysis:

Client: ${user.name}
Challenge: ${challenge.name}
Week: ${data.weekNumber} of ${challenge.duration_weeks}

Current Check-in Data:
${formatCheckInData(data)}

Previous Check-ins:
${formatPreviousCheckIns(previousCheckIns)}

Please provide:
1. A summary of progress and changes
2. Specific recommendations for improvement
3. Any potential issues to flag
4. An encouraging message

Format the response in JSON with the following structure:
{
  "summary": "string",
  "recommendations": "string",
  "flaggedIssues": "string",
  "encouragement": "string"
}`;

  return prompt;
};

const formatCheckInData = (data: CheckInData): string => {
  let formatted = '';
  if (data.weight) formatted += `Weight: ${data.weight}kg\n`;
  if (data.measurements) {
    formatted += 'Measurements:\n';
    Object.entries(data.measurements).forEach(([key, value]) => {
      if (value) formatted += `- ${key}: ${value}cm\n`;
    });
  }
  if (data.mood) formatted += `Mood: ${data.mood}\n`;
  if (data.sleepHours) formatted += `Sleep: ${data.sleepHours} hours\n`;
  if (data.energyLevel) formatted += `Energy Level: ${data.energyLevel}/10\n`;
  if (data.notes) formatted += `Notes: ${data.notes}\n`;
  return formatted;
};

const formatPreviousCheckIns = (checkIns: any[]): string => {
  if (checkIns.length === 0) return 'No previous check-ins available';
  
  return checkIns.map(checkIn => {
    let formatted = `Week ${checkIn.week_number}:\n`;
    if (checkIn.weight) formatted += `- Weight: ${checkIn.weight}kg\n`;
    if (checkIn.measurements) {
      const measurements = JSON.parse(checkIn.measurements);
      Object.entries(measurements).forEach(([key, value]) => {
        if (value) formatted += `- ${key}: ${value}cm\n`;
      });
    }
    return formatted;
  }).join('\n');
};

const parseAnalysisResponse = (response: string): {
  summary: string;
  recommendations: string;
  flaggedIssues: string;
  encouragement: string;
} => {
  try {
    return JSON.parse(response);
  } catch (error) {
    // If JSON parsing fails, split the response into sections
    const sections = response.split('\n\n');
    return {
      summary: sections[0] || '',
      recommendations: sections[1] || '',
      flaggedIssues: sections[2] || '',
      encouragement: sections[3] || ''
    };
  }
}; 