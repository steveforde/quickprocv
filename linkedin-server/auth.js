import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import supabase from './supabaseClient.js';

dotenv.config({ path: './linkedin-server/.env' });

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;

  console.log('📩 Registering:', email);

  // 1. Create Supabase user and auto-confirm
  const { data: userData, error: signupError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (signupError) {
    console.error('❌ Signup error:', signupError.message);
    return res.status(400).json({ error: signupError.message });
  }

  const userId = userData.user.id;
  console.log('✅ Supabase user created:', userId);

  // 2. Insert into your metadata table (e.g. users)
  const { error: insertError } = await supabase
    .from('users')
    .insert([
      {
        id: userId,
        email,
        full_name: '',
        is_pro: false
      }
    ]);

  if (insertError) {
    console.error('❌ Metadata insert error:', insertError.message);
    return res.status(500).json({ error: 'User created, but metadata insert failed: ' + insertError.message });
  }

  res.json({ message: 'User registered successfully', id: userId });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('Login error:', error.message);
    return res.status(400).json({ error: error.message });
  }

  if (!data.session) {
    return res.status(401).json({ error: 'Invalid login credentials.' });
  }

  res.json({ message: 'Login successful', data });
});

const PORT = process.env.AUTH_PORT || 3002;
app.listen(PORT, () => {
  console.log(`✅ Auth API running at http://localhost:${PORT}`);
});