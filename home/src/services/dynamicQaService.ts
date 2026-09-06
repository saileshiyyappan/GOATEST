/**
 * GOATEST Dynamic AI Daily Q/A Service
 * 
 * PMT-4: Daily 10-question AI Q/A pipeline.
 * 
 * CORE CONTRACT RULES:
 * 1. Generates 10 dynamic, non-diagnostic contextual assessment questions.
 * 2. Questions vary by target organs, completed tests, and daily assessment context.
 * 3. Never hard-codes the exact same questions every day.
 * 4. MCQ format with selectable options, feedback, and timestamps.
 * 5. Completed DAY requires 3 tests + 10 Q/A answers.
 * 6. Non-diagnostic safety: contextual only, never claims "you have disease X".
 * 7. Real Firestore persistence via qa_sessions collection.
 */

import { reportDatabaseService } from './reportDatabaseService';
import type { QaSessionRecord, QaQuestionItem } from '../types';
import { requestAiText } from './aiConfigService';
import { parseAiJsonResponse } from './aiJsonParser';

export interface GenerateQaOptions {
  userId: string;
  dayId: string;
  targetOrgans?: string[];
  dayDate?: string;
  isFixture?: boolean;
}

export const dynamicQaService = {
  /**
   * Fetches or generates a 10-question Q/A session for a given day and user.
   * If a session already exists for the dayId, returns the existing session.
   */
  async getOrCreateDailyQaSession(options: GenerateQaOptions): Promise<QaSessionRecord> {
    const { userId, dayId, targetOrgans = ['Cardiovascular', 'Respiratory', 'Neurological'], dayDate, isFixture } = options;

    if (!userId || !dayId) {
      throw new Error('userId and dayId are required to get or create QA session');
    }

    // 1. Check if QA session already exists for this dayId
    const existing = await reportDatabaseService.getQaSessionByDayId(dayId, userId);
    if (existing && existing.questions && existing.questions.length >= 8) {
      return existing;
    }

    // 2. Generate 10 dynamic questions from the canonical GOATEST AI service.
    let questions: QaQuestionItem[] = [];

    try {
      const semanticCategories = ['sleep/recovery', 'cardiovascular sensation', 'respiratory comfort', 'hydration', 'physical exertion', 'stress', 'nutrition timing', 'somatic symptoms', 'environment', 'overall vitality'];
      const previousSessions = await reportDatabaseService.getUserQaSessions(userId);
      const previousWording = previousSessions.flatMap((item) => item.questions.map((question) => question.question)).slice(0, 30);
      const responseText = await requestAiText(`Generate exactly 10 daily health-assessment questions as JSON array. Preserve these semantic categories in order: ${semanticCategories.join(', ')}. Target systems: ${targetOrgans.join(', ')}. Current day: ${dayDate || 'today'}. Do not repeat these previous wordings; preserve their semantic categories while varying wording: ${JSON.stringify(previousWording)}. Return semantically equivalent, non-diagnostic questions. Each item must contain semanticCategory (exactly matching the requested category), questionId, question, options (exactly 4 strings), feedback, organ, topic. Return JSON only.`, { responseMimeType: 'application/json', maxTokens: 4000 });
      const parsed = parseAiJsonResponse<unknown>(responseText);
      const questionCount = Array.isArray(parsed) ? parsed.length : 0;
      console.info('[AI Q/A]', { outputLimit: 4000, questionCount });
      if (!Array.isArray(parsed) || parsed.length !== 10) throw new Error('AI returned an invalid question count.');
      const seen = new Set<string>();
      questions = parsed.map((q: any, idx: number) => {
        if (q.semanticCategory !== semanticCategories[idx]) throw new Error('AI returned an unrelated or incorrectly ordered health concept.');
        if (!q || typeof q.question !== 'string' || !q.question.trim() || !Array.isArray(q.options) || q.options.length !== 4 || q.options.some((option: any) => typeof option !== 'string' || !option.trim())) throw new Error('AI returned malformed questions.');
        const normalized = q.question.trim().toLowerCase();
        if (seen.has(normalized)) throw new Error('AI returned duplicate questions.');
        seen.add(normalized);
        return { questionId: `qa_${dayId}_q${idx + 1}`, semanticCategory: q.semanticCategory, question: q.question.trim(), options: q.options.map((option: string) => option.trim()), selectedAnswer: null, feedback: typeof q.feedback === 'string' ? q.feedback.trim() : '', organ: typeof q.organ === 'string' ? q.organ : targetOrgans[idx % targetOrgans.length] || 'General', topic: typeof q.topic === 'string' ? q.topic : 'Assessment Context', timestamp: new Date().toISOString() };
      });
      console.info('[AI Q/A] 10 questions received; semantic validation: PASS');
    } catch (err) {
      throw err;
    }

    // 3. Never fabricate or silently replace failed AI output.
    if (questions.length < 10) {
      throw new Error('AI did not return 10 valid questions. Please retry.');
      /*
      const primaryOrgan = targetOrgans[0] || 'Cardiovascular';
      const secondaryOrgan = targetOrgans[1] || 'Respiratory';
      const fallbackQuestions: Array<Omit<QaQuestionItem, 'questionId'>> = [
        {
          question: 'How would you rate your total restorative sleep duration and quality over the last 24 hours?',
          options: [
            'Optimal (7-9 hours undisturbed, woke up refreshed)',
            'Good (6-7 hours with minimal waking episodes)',
            'Fair (5-6 hours with restlessness or interrupted sleep)',
            'Poor (<5 hours or frequent disruptions)',
          ],
          feedback: 'Sleep quality directly influences autonomic nervous balance and morning resting baseline markers.',
          organ: primaryOrgan,
          topic: 'Sleep & Recovery',
        },
        {
          question: `During today's routine activities, did you notice any unexpected heart fluttering, rapid pulse, or unusual cardiovascular strain?`,
          options: [
            'None at all; pulse felt steady and comfortable',
            'Mild brief elevation during sudden standing or stairs',
            'Noticeable flutter or prolonged elevated rate during light activity',
            'Significant strain or sensation of heavy heartbeat',
          ],
          feedback: 'Subjective pulse sensation correlates with heart rate variability parameters.',
          organ: primaryOrgan,
          topic: 'Cardiovascular Response',
        },
        {
          question: 'How was your breathing pattern while performing your daily physical tasks or at rest today?',
          options: [
            'Completely effortless and unobstructed nasal breathing',
            'Slight breathlessness only during brisk walking or stairs',
            'Occasional feeling of shallow breath or chest tightness',
            'Frequent shortness of breath or persistent breathing discomfort',
          ],
          feedback: 'Respiration stability is a core indicator of autonomic balance and cardiovascular recovery.',
          organ: secondaryOrgan,
          topic: 'Respiratory Ease',
        },
        {
          question: 'What was your estimated fluid/water consumption throughout the day prior to testing?',
          options: [
            'Optimal (Over 2.5 liters / 8+ glasses of water)',
            'Adequate (1.5 to 2.5 liters across the day)',
            'Low (Under 1.5 liters, felt occasional thirst)',
            'Minimal (<1 liter, high caffeine or prolonged sweating)',
          ],
          feedback: 'Hydration levels directly modulate blood plasma volume and vascular conductance.',
          organ: primaryOrgan,
          topic: 'Hydration',
        },
        {
          question: 'What level of peak physical exertion or exercise did you engage in today?',
          options: [
            'Rest / Low activity (sedentary office or gentle walking)',
            'Moderate aerobic activity (brisk walking, cycling, or light workout)',
            'Intense strenuous training (running, heavy lifting, or sports)',
            'High physical fatigue / prolonged strenuous manual labor',
          ],
          feedback: 'Physical exertion explains expected temporary shifts in baseline recovery markers.',
          organ: primaryOrgan,
          topic: 'Physical Activity',
        },
        {
          question: 'How would you describe your mental strain or emotional stress level over the course of today?',
          options: [
            'Calm and relaxed with minimal psychological pressure',
            'Mild manageable stress during work or routine chores',
            'Moderate elevated stress with muscular tension',
            'Severe acute stress or prolonged intense anxiety',
          ],
          feedback: 'Autonomic nervous balance shifts sympathetic tone during elevated psychological stress.',
          organ: 'Neurological',
          topic: 'Stress & Autonomic Tone',
        },
        {
          question: 'When did you last consume caffeine (coffee/tea/energy drink) or a heavy meal relative to testing?',
          options: [
            'More than 4 hours ago (or none today)',
            '2 to 4 hours before testing',
            '1 to 2 hours before testing',
            'Less than 1 hour before testing',
          ],
          feedback: 'Caffeine and digestion influence resting vascular resistance and pulse wave velocity.',
          organ: primaryOrgan,
          topic: 'Nutrition & Caffeine',
        },
        {
          question: 'Did you experience any localized discomfort, headache, dizziness, or peripheral swelling today?',
          options: [
            'No somatic symptoms reported',
            'Mild headache or eye fatigue from screen time',
            'Occasional lightheadedness upon standing up quickly',
            'Moderate discomfort, chest heaviness, or dizziness',
          ],
          feedback: 'Orthostatic stability reflects microvascular and neurological regulation.',
          organ: 'Neurological',
          topic: 'Somatic Sensation',
        },
        {
          question: 'Were you exposed to extreme environmental temperatures (e.g. high heat, high humidity, or cold)?',
          options: [
            'Comfortable climate-controlled indoor environment',
            'Mild outdoor exposure with comfortable clothing',
            'Noticeable heat/sun exposure with moderate perspiration',
            'Extreme hot or cold environment causing shivering/sweating',
          ],
          feedback: 'Ambient temperature alters cutaneous blood flow and resting peripheral resistance.',
          organ: secondaryOrgan,
          topic: 'Environment',
        },
        {
          question: 'Taking everything into account, how would you rate your overall physiological vitality today?',
          options: [
            'Peak vitality (energized, strong, and ready for full exertion)',
            'Good normal baseline (steady energy, feeling balanced)',
            'Somewhat fatigued (would benefit from extra rest or relaxation)',
            'Exhausted / Depleted (need significant recovery time)',
          ],
          feedback: 'Subjective vitality correlates longitudinal trend trajectories with user perception.',
          organ: primaryOrgan,
          topic: 'Vitality & Readiness',
        },
      ];

      questions = fallbackQuestions.map((q, idx) => ({
        questionId: `qa_${dayId}_q${idx + 1}`,
        ...q,
        selectedAnswer: null,
        timestamp: new Date().toISOString(),
      }));
      */
    }

    const now = new Date().toISOString();
    const qaSessionId = `qa_sess_${dayId}`;

    const newRecord: QaSessionRecord = {
      qaSessionId,
      userId,
      dayId,
      generatedAt: now,
      questions,
      answers: {},
      completionStatus: 'NOT_STARTED',
      isFixture: isFixture || false,
      createdAt: now,
      updatedAt: now,
    };

    await reportDatabaseService.saveQaSessionRecord(newRecord);

    // Link back to DayRecord if Day exists
    const day = await reportDatabaseService.getDayRecord(dayId);
    if (day && day.userId === userId) {
      day.qaSessionReference = qaSessionId;
      day.updatedAt = now;
      await reportDatabaseService.saveDayRecord(day);
    }

    return newRecord;
  },

  /**
   * Records an answer for a specific question in a QA session.
   */
  async recordAnswer(
    qaSessionId: string,
    userId: string,
    questionId: string,
    answer: string | number
  ): Promise<QaSessionRecord> {
    const session = await reportDatabaseService.getQaSessionRecord(qaSessionId);
    if (!session) {
      throw new Error(`QA session ${qaSessionId} not found`);
    }

    if (session.userId !== userId) {
      throw new Error('Unauthorized access to QA session');
    }

    const updatedAnswers = { ...session.answers, [questionId]: answer };
    const updatedQuestions = session.questions.map((q) => {
      if (q.questionId === questionId) {
        return {
          ...q,
          selectedAnswer: answer,
          timestamp: new Date().toISOString(),
        };
      }
      return q;
    });

    const totalQuestions = updatedQuestions.length;
    const answeredCount = Object.keys(updatedAnswers).length;
    const isCompleted = answeredCount >= totalQuestions && totalQuestions >= 8;

    const updatedSession: QaSessionRecord = {
      ...session,
      questions: updatedQuestions,
      answers: updatedAnswers,
      completionStatus: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
      completedAt: isCompleted ? new Date().toISOString() : session.completedAt,
      updatedAt: new Date().toISOString(),
    };

    await reportDatabaseService.saveQaSessionRecord(updatedSession);
    return updatedSession;
  },

  /**
   * Batch submits all 10 answers for a QA session.
   */
  async submitFullQaSession(
    qaSessionId: string,
    userId: string,
    answers: Record<string, string | number>
  ): Promise<QaSessionRecord> {
    const session = await reportDatabaseService.getQaSessionRecord(qaSessionId);
    if (!session) {
      throw new Error(`QA session ${qaSessionId} not found`);
    }

    if (session.userId !== userId) {
      throw new Error('Unauthorized access to QA session');
    }

    const updatedQuestions = session.questions.map((q) => {
      const selected = answers[q.questionId];
      if (selected !== undefined) {
        return {
          ...q,
          selectedAnswer: selected,
          timestamp: new Date().toISOString(),
        };
      }
      return q;
    });

    const answeredCount = Object.keys(answers).length;
    const isCompleted = answeredCount >= session.questions.length;

    const updatedSession: QaSessionRecord = {
      ...session,
      questions: updatedQuestions,
      answers,
      completionStatus: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
      updatedAt: new Date().toISOString(),
    };

    await reportDatabaseService.saveQaSessionRecord(updatedSession);
    return updatedSession;
  },
};
