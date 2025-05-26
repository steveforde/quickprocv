// auth.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import supabaseGlobalInstance from './supabaseClient.js';
import sendEmail from './email.js';
import generateHtmlTemplate from './emailTemplates/generateHtmlTemplate.js';

dotenv.config({ path: './linkedin-server/.env' });

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/register', async (req, res) => {
  const { email, password, full_name } = req.body;
  console.log('📩 [AUTH.JS /api/register] Attempting to register:', email);
  try {
    const { data: userData, error: signupError } = await supabaseGlobalInstance.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (signupError) {
      console.error(`❌ [AUTH.JS /api/register] Supabase auth.admin.createUser error for ${email}:`, signupError.message);
      return res.status(400).json({ error: signupError.message });
    }

    const userId = userData.user.id;
    console.log(`✅ [AUTH.JS /api/register] Supabase auth user created for ${email}. UID: ${userId}`);

    const { error: insertError } = await supabaseGlobalInstance
      .from('users')
      .insert([{ 
        id: userId, 
        email: email.toLowerCase().trim(), 
        full_name: full_name || '', 
        is_pro: false 
      }]);

    if (insertError) {
      console.error(`❌ [AUTH.JS /api/register] Error inserting user profile for ${email} (UID: ${userId}):`, insertError.message);
      return res.status(500).json({ error: 'User authentication created, but profile data insert failed: ' + insertError.message });
    }

    const welcomeMessage = `Thanks for joining QuickProCV! You can now start creating professional CVs and cover letters with AI assistance.`;
    await sendEmail(email, '🎉 Welcome!', '', generateHtmlTemplate(`Welcome, ${full_name}`, welcomeMessage), full_name);

    console.log(`✅ [AUTH.JS /api/register] User profile created and welcome email sent to ${email}.`);
    res.json({ message: 'User registered successfully. Please login.', id: userId });

  } catch (err) {
    console.error(`❌ [AUTH.JS /api/register] Unexpected error during registration for ${email}:`, err);
    res.status(500).json({ error: 'An unexpected error occurred during registration.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  console.log(`[AUTH.JS /api/login] Attempting login for: ${email}`);
  try {
    const { data, error } = await supabaseGlobalInstance.auth.signInWithPassword({ 
      email: email.trim(),
      password 
    });

    if (error) {
      console.warn(`[AUTH.JS /api/login] Supabase signInWithPassword error for ${email}:`, error.message);
      return res.status(400).json({ error: error.message });
    }
    if (!data.session) {
      console.warn(`[AUTH.JS /api/login] No session returned for ${email} (login failed).`);
      return res.status(401).json({ error: 'Invalid login credentials or action required.' });
    }

    const { data: profileData, error: profileError } = await supabaseGlobalInstance
      .from('users')
      .select('full_name')
      .eq('email', email.toLowerCase().trim())
      .single();

    const fullName = profileData?.full_name || '';
    const loginMessage = `You have successfully logged into your QuickProCV account.`;
    await sendEmail(email, '🔓 Login Notification', '', generateHtmlTemplate(`Welcome back, ${fullName}`, loginMessage), fullName);

    console.log(`[AUTH.JS /api/login] Login successful and email sent for ${email}.`);
    res.json({ message: 'Login successful', data });

  } catch (err) {
    console.error(`❌ [AUTH.JS /api/login] Unexpected error during login for ${email}:`, err);
    res.status(500).json({ error: 'An unexpected error occurred during login.' });
  }
});

app.post('/api/check-pro', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    console.warn('[AUTH.JS /api/check-pro] Email is missing in request body.');
    return res.status(400).json({ error: 'Email is required.', isPro: false });
  }

  const normalizedEmail = email.trim().toLowerCase();
  console.log(`[AUTH.JS /api/check-pro (NEW CLIENT w .single())] Checking for: "${normalizedEmail}"`);

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[AUTH.JS /api/check-pro] CRITICAL: Supabase URL or Service Key is missing from env.');
    return res.status(500).json({ error: 'Server configuration error.', isPro: false });
  }

  const supabaseInstanceForRequest = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    const { data, error } = await supabaseInstanceForRequest
      .from('users')
      .select('is_pro, pro_expiry')
      .eq('email', normalizedEmail)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.warn(`[AUTH.JS /api/check-pro] User "${normalizedEmail}" not found.`);
        return res.status(200).json({ isPro: false, pro_expiry: null });
      }
      console.error(`[AUTH.JS /api/check-pro] Supabase .single() error for "${normalizedEmail}":`, error.message);
      return res.status(500).json({ error: 'Issue fetching status.', isPro: false });
    }

    const isProStatus = data.is_pro === true;
    console.log(`[AUTH.JS /api/check-pro] User "${normalizedEmail}" found. DB 'is_pro': ${data.is_pro}. DB 'pro_expiry': ${data.pro_expiry}. Parsed as: ${isProStatus}`);

    res.json({ 
      isPro: isProStatus,
      pro_expiry: data.pro_expiry 
    });

  } catch (catchAllError) {
    console.error(`[AUTH.JS /api/check-pro] Unexpected outer catch error for "${normalizedEmail}": ${catchAllError.message}`);
    res.status(500).json({ error: 'Internal server error during Pro status check.', isPro: false });
  }
});

const PORT = process.env.AUTH_PORT || 3002;
app.listen(PORT, () => {
  console.log(`✅ Auth API (auth.js) running at http://localhost:${PORT}`);
});
