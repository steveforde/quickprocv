// ai.js
import express from 'express';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

dotenv.config();

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/generate', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
    });

    const result = completion.choices[0].message.content.trim();
    res.json({ result });
  } catch (err) {
    console.error('[AI Error]', err);
    res.status(500).json({ error: 'AI request failed' });
  }
});

export default router;
