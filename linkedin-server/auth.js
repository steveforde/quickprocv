/// linkedin-server/auth.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import supabase from './supabaseClient.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    console.error('Register error:', error);
    return res.status(400).json({ error: error.message });
  }

  res.json({ message: 'User registered', data });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('Login error:', error.message);
    return res.status(400).json({ error: error.message });
  }

  // Check if session is missing (e.g. email not confirmed, invalid user)
  if (!data.session) {
    return res.status(401).json({ error: 'Invalid login credentials.' });
  }

  res.json({ message: 'Login successful', data });
});


const PORT = process.env.AUTH_PORT || 3002;
app.listen(PORT, () => {
  console.log(`✅ Auth API running at http://localhost:${PORT}`);
});
