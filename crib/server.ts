import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3003);

  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: Date.now() });
  });

  // AI Chat Route
  app.post('/api/crib/ai/chat', async (req, res) => {
    const { message, context, history } = req.body || {};

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    try {
      const ai = getAiClient();
      if (!ai) {
        // Deterministic fallback if API key is not configured
        const fallbackReply = `[CRIB STANDALONE] Directives: ${(context?.deterministicDirectives || [
          'REST',
          'BREATHE SLOWLY',
        ]).join(', ')}. Keep monitoring vital signs.`;
        res.json({
          reply: fallbackReply,
          priority: context?.mode === 'SSB' ? 'urgent' : 'normal',
          timestamp: Date.now(),
          isFallback: true,
        });
        return;
      }

      const mode = context?.mode || 'SDCU';
      let roleInstruction = '';
      if (mode === 'SSB') {
        roleInstruction = `You are CRIB AI Emergency Responder in SSB mode. You are guiding a bystander/stranger who is attending to an unconscious or distressed person. Give clear, urgent, step-by-step first-aid and safety instructions (check breathing, keep still, recovery position if vomiting, call for emergency medical help). Keep answers short, calm, direct, and actionable (maximum 3-4 sentences).`;
      } else if (mode === 'DIAG') {
        roleInstruction = `You are CRIB AI Diagnostic Copilot in DIAG mode. You are assisting a user or helper actively assessing an individual's acute condition (${context?.conditionResult?.label || 'clinical event'}). Provide focused, calm medical-first-responder guidance based only on the provided vitals and selected actions. Keep answers under 3-4 sentences.`;
      } else {
        roleInstruction = `You are CRIB AI Personal Emergency Assistant in SDCU mode. You are speaking directly to the user being monitored. Guide them calmly to stay seated, rest, breathe slowly, and take safe immediate precautions. Keep answers under 3 sentences.`;
      }

      const systemInstruction = `${roleInstruction}
CRITICAL RULES:
- Only reference the real vitals provided in CURRENT VITALS. Do not hallucinate or guess any unmeasured parameters.
- If vitals are missing or sensors are on standby, advise caution and monitoring.
- Always prioritize: 1. IMMEDIATE SAFETY, 2. POSITION/REST, 3. BREATHING, 4. CALLING HELP, 5. CONTINUOUS MONITORING.
- Be concise, direct, authoritative, and compassionate.`;

      // Build context summary
      const contextText = `
MODE: ${context?.mode || 'UNKNOWN'}
CURRENT VITALS: ${JSON.stringify(context?.currentVitals || {})}
B-FIT SCORE: ${context?.bfitScore ?? 'N/A'}
PRIMARY CONDITION: ${context?.conditionResult?.label || 'EVALUATING'} (${context?.conditionResult?.probability || 0}%)
ACTION / PROMPT: ${JSON.stringify(context?.currentActionOrQuestion || {})}
DETERMINISTIC DIRECTIVES: ${(context?.deterministicDirectives || []).join(', ')}
`;

      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

      // Add conversation history if available
      if (Array.isArray(history)) {
        for (const h of history.slice(-4)) {
          contents.push({
            role: h.role === 'ai' ? 'model' : 'user',
            parts: [{ text: h.message }],
          });
        }
      }

      // Add current query with context
      contents.push({
        role: 'user',
        parts: [
          {
            text: `CURRENT EMERGENCY CONTEXT:\n${contextText}\n\nUSER QUERY: ${message}`,
          },
        ],
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.2,
          maxOutputTokens: 250,
        },
      });

      const replyText = response.text || `Directives: ${(context?.deterministicDirectives || ['STAY CALM']).join(', ')}`;

      res.json({
        reply: replyText.trim(),
        priority: mode === 'SSB' ? 'urgent' : 'normal',
        timestamp: Date.now(),
      });
    } catch (err: any) {
      console.error('Gemini chat error:', err);
      // Clean fallback so UI never breaks
      const fallbackReply = `Directives: ${(context?.deterministicDirectives || [
        'REST',
        'BREATHE SLOWLY',
      ]).join(', ')}. Continue monitoring vital status.`;
      res.json({
        reply: fallbackReply,
        priority: 'normal',
        timestamp: Date.now(),
        isFallback: true,
      });
    }
  });

  // AI Guidance Directives Generation Route
  app.post('/api/crib/ai/guidance', async (req, res) => {
    const { context } = req.body || {};

    try {
      const ai = getAiClient();
      if (!ai) {
        res.json({
          directives: context?.deterministicDirectives || ['REST', 'BREATHE SLOWLY', 'MONITOR CONDITION'],
          priority: context?.mode === 'SSB' ? 'critical' : 'warning',
          timestamp: Date.now(),
          isFallback: true,
        });
        return;
      }

      const mode = context?.mode || 'SDCU';
      const prompt = `Based on the following emergency context:
MODE: ${mode}
VITALS: ${JSON.stringify(context?.currentVitals || {})}
CONDITION: ${context?.conditionResult?.label || 'EVALUATING'}
ACTION: ${JSON.stringify(context?.currentActionOrQuestion || {})}
FALLBACK DIRECTIVES: ${(context?.deterministicDirectives || []).join(', ')}

Output exactly 3 to 5 short, urgent, UPPERCASE actionable directives (2-4 words each) ordered by:
1. IMMEDIATE SAFETY
2. POSITION / MOVEMENT
3. BREATHING
4. CHECK RESPONSIVENESS / CALL FOR HELP
5. CONTINUOUS MONITORING

Output one directive per line, nothing else.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          temperature: 0.1,
          maxOutputTokens: 100,
        },
      });

      const rawText = response.text || '';
      const lines = rawText
        .split('\n')
        .map((l) => l.replace(/^[-*0-9.)\s]+/, '').trim().toUpperCase())
        .filter((l) => l.length > 2 && l.length < 35);

      const directives = lines.length > 0 ? lines.slice(0, 5) : (context?.deterministicDirectives || ['REST', 'BREATHE SLOWLY']);

      res.json({
        directives,
        priority: mode === 'SSB' ? 'critical' : 'warning',
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('Gemini guidance error:', err);
      res.json({
        directives: context?.deterministicDirectives || ['REST', 'BREATHE SLOWLY', 'MONITOR CONDITION'],
        priority: 'warning',
        timestamp: Date.now(),
        isFallback: true,
      });
    }
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { port: 24682 },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CRIB Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start CRIB server:', err);
});
