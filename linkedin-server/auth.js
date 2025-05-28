// linkedin-server/auth.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import supabaseGlobalInstance from './supabaseClient.js';
import sendEmail from './email.js';
import generateHtmlTemplate from './emailTemplates/baseHtml.js';

dotenv.config({ path: './linkedin-server/.env' });

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/register', async (req, res) => {
  const { email, password, full_name } = req.body;
  console.log(`📩 [AUTH /register] Registering: ${email}`);

  try {
    const { data: userData, error: signupError } =
      await supabaseGlobalInstance.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (signupError) {
      console.error(`❌ [AUTH /register] Signup error:`, signupError.message);
      return res.status(400).json({ error: signupError.message });
    }

    const userId = userData?.user?.id;
    if (!userId) throw new Error('No user ID returned');

    console.log(`✅ [AUTH /register] Supabase user created: ${userId}`);

    const normalizedEmail = email.toLowerCase().trim();
    const profileToInsert = {
      id: userId,
      email: normalizedEmail,
      full_name: full_name || '',
      is_pro: false,
    };

    const { error: insertError } = await supabaseGlobalInstance
      .from('users')
      .insert([profileToInsert]);

    if (insertError) {
      console.error(`❌ [AUTH /register] Insert error:`, insertError.message);
      return res.status(500).json({ error: insertError.message });
    }

    const message = `Thanks for joining QuickProCV! You can now start creating professional CVs and cover letters with AI assistance.`;
    const greeting = `Welcome, ${full_name || 'New User'}!`;

    await sendEmail(
      email,
      'Welcome to QuickProCV - Get Started!',
      message,
      generateHtmlTemplate(greeting, message)
    );

    res.json({ message: 'User registered successfully', userId });
  } catch (err) {
    console.error(`❌ [AUTH /register] Unexpected error:`, err.message);
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const trimmedEmail = email.trim().toLowerCase();
  console.log(`[LOGIN] Attempting login for: ${trimmedEmail}`);

  try {
    const { data, error: loginError } =
      await supabaseGlobalInstance.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

    if (loginError || !data?.user) {
      const reason = loginError?.message || 'Invalid login';
      console.warn(`[LOGIN] Failed for ${trimmedEmail}: ${reason}`);
      return res.status(401).json({ error: reason });
    }

    const authUserId = data.user.id;
    const userEmailFromAuth = data.user.email;

    console.log(`[LOGIN DEBUG] Starting profile fetch from 'users' table for authUserId: "${authUserId}"`);

    const { data: profileData, error: profileError } = await supabaseGlobalInstance
      .from('users')
      .select('full_name')
      .eq('id', authUserId)
      .maybeSingle();

    console.log(`[LOGIN DEBUG] Raw profile data from DB (queried by ID ${authUserId}):`, profileData);
    console.log(`[LOGIN DEBUG] Raw profileError from DB (queried by ID ${authUserId}):`, profileError);

    let fullName = '';
    if (profileData && profileData.full_name?.trim()) {
      fullName = profileData.full_name.trim();
    } else {
      fullName = userEmailFromAuth.split('@')[0];
      console.warn(`[LOGIN] No profile found in 'public.users' for authUserId ${authUserId} (email: ${userEmailFromAuth}), using email part: "${fullName}"`);
    }

    console.log(`[LOGIN DEBUG] Final fullName value for email template: "${fullName}"`);

    const loginMessage = 'You have successfully logged into your QuickProCV account.';
    await sendEmail(
      userEmailFromAuth,
      '🔓 Login Notification - QuickProCV',
      loginMessage,
      generateHtmlTemplate(`Welcome back, ${fullName}!`, loginMessage)
    );

    console.log(`[LOGIN] Login successful and email sent for ${userEmailFromAuth}.`);
    res.json({ message: 'Login successful', data });
  } catch (err) {
    console.error(`[LOGIN] Unexpected error for ${trimmedEmail}:`, err.message);
    res.status(500).json({ error: 'An unexpected error occurred during login.' });
  }
});

app.post('/api/check-pro', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required', isPro: false });
  }

  const normalizedEmail = email.trim().toLowerCase();
  console.log(`[AUTH.JS /api/check-pro] Checking Pro for: "${normalizedEmail}"`);

  try {
    const { data, error } = await supabaseGlobalInstance
      .from('users')
      .select('is_pro, pro_expiry')
      .eq('email', normalizedEmail)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(200).json({ isPro: false, pro_expiry: null });
      }
      return res.status(500).json({ error: 'DB check failed', isPro: false });
    }

    res.json({ isPro: data.is_pro === true, pro_expiry: data.pro_expiry });
  } catch (err) {
    res.status(500).json({ error: 'Server error', isPro: false });
  }
});

const PORT = process.env.AUTH_PORT || 3002;
app.listen(PORT, () => {
  console.log(`✅ Auth API (auth.js) running at http://localhost:${PORT}`);
});
