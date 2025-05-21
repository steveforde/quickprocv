// auth.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// Import createClient directly for the /api/check-pro route test
import { createClient } from '@supabase/supabase-js';
// You still import the global client if other routes (/api/register, /api/login) use it
import supabaseGlobalInstance from './supabaseClient.js'; // Assuming /register and /login use this

// Ensure this path is correct relative to where `node auth.js` is executed
// e.g., if auth.js is in 'linkedin-server' and .env is also in 'linkedin-server', path should be './.env'
// if auth.js is in root and .env is in 'linkedin-server', path should be './linkedin-server/.env'
dotenv.config({ path: './linkedin-server/.env' });

const app = express();
app.use(cors());
app.use(express.json());

// --- /api/register Endpoint (uses global Supabase client) ---
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  console.log('📩 [AUTH.JS /api/register] Attempting to register:', email);
  try {
    const { data: userData, error: signupError } = await supabaseGlobalInstance.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirms email, consider disabling for production to send confirmation link
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
        email: email.toLowerCase().trim(), // Store normalized email
        full_name: '', // Or derive from email, or get from a form field
        is_pro: false 
      }]);

    if (insertError) {
      console.error(`❌ [AUTH.JS /api/register] Error inserting user profile for ${email} (UID: ${userId}):`, insertError.message);
      return res.status(500).json({ error: 'User authentication created, but profile data insert failed: ' + insertError.message });
    }
    console.log(`✅ [AUTH.JS /api/register] User profile created in public.users for ${email}.`);
    res.json({ message: 'User registered successfully. Please login.', id: userId });

  } catch (err) {
    console.error(`❌ [AUTH.JS /api/register] Unexpected error during registration for ${email}:`, err);
    res.status(500).json({ error: 'An unexpected error occurred during registration.' });
  }
});

// --- /api/login Endpoint (uses global Supabase client) ---
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  console.log(`[AUTH.JS /api/login] Attempting login for: ${email}`);
  try {
    const { data, error } = await supabaseGlobalInstance.auth.signInWithPassword({ 
      email: email.trim(), // Send trimmed email
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
    console.log(`[AUTH.JS /api/login] Login successful for ${email}.`);
    res.json({ message: 'Login successful', data });

  } catch (err) {
    console.error(`❌ [AUTH.JS /api/login] Unexpected error during login for ${email}:`, err);
    res.status(500).json({ error: 'An unexpected error occurred during login.' });
  }
});

// --- /api/check-pro Endpoint (Creates NEW Supabase client instance per request, uses .single()) ---
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
      // ✅ MODIFICATION HERE: Select 'is_pro' AND 'pro_expiry'
      .select('is_pro, pro_expiry')
      .eq('email', normalizedEmail)
      .single();

    if (error) {
      // If .single() doesn't find a row, it returns an error with code 'PGRST116'
      // We can treat this as user not found for simplicity of pro check
      if (error.code === 'PGRST116') {
        console.warn(`[AUTH.JS /api/check-pro] User "${normalizedEmail}" not found.`);
        return res.status(200).json({ isPro: false, pro_expiry: null }); // Return false and null expiry
      }
      console.error(`[AUTH.JS /api/check-pro] Supabase .single() error for "${normalizedEmail}":`, error.message);
      return res.status(500).json({ error: 'Issue fetching status.', isPro: false });
    }
    
    const isProStatus = data.is_pro === true;
    console.log(`[AUTH.JS /api/check-pro] User "${normalizedEmail}" found. DB 'is_pro': ${data.is_pro}. DB 'pro_expiry': ${data.pro_expiry}. Parsed as: ${isProStatus}`);
    
    // ✅ MODIFICATION HERE: Include pro_expiry in the response
    res.json({ 
      isPro: isProStatus,
      pro_expiry: data.pro_expiry // Pass the pro_expiry value to the frontend
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