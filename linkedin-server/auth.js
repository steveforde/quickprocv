// auth.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import supabaseGlobalInstance from './supabaseClient.js';
import sendEmail from './email.js'; // ✅ At the top if not already
import generateHtmlTemplate from './emailTemplates/baseHtml.js';

dotenv.config({ path: './linkedin-server/.env' });

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/register', async (req, res) => {
  const { email, password, full_name } = req.body;
  console.log('📩 [AUTH /register] Registering:', email);

  try {
    const { data: userData, error: signupError } = await supabaseGlobalInstance.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (signupError) {
      console.error(`❌ [AUTH /register] Supabase createUser error:`, signupError.message);
      return res.status(400).json({ error: signupError.message });
    }

    const userId = userData.user.id;
    console.log(`✅ [AUTH /register] Supabase user created: ${userId}`);

    const normalizedEmail = email.toLowerCase().trim(); // 🔑

await supabaseGlobalInstance
  .from('users')
  .insert([{ 
    id: userId,
    email: normalizedEmail, // ✅ Use normalized email
    full_name: full_name || '',
    is_pro: false
  }]);


    if (insertError) {
      console.error(`❌ [AUTH /register] Error inserting user profile:`, insertError.message);
      return res.status(500).json({ error: 'User created, but DB insert failed: ' + insertError.message });
    }

    // ✅ Send Welcome Email
    const welcomeMessage = `Thanks for joining QuickProCV! You can now start creating professional CVs and cover letters with AI assistance.`;
    console.log("📨 Sending welcome email...");// 👇 ADD THIS DEBUG LOG 👇
    console.log(`[DEBUG /register] Value of full_name received in request body: "${full_name}"`); 

    await sendEmail(
      email,
      '🎉 Welcome to QuickProCV!',
      '',
      generateHtmlTemplate(`Welcome, ${full_name || 'there'}!`, welcomeMessage),
      full_name
    );
    console.log(`✅ Welcome email sent to ${email}`);

    res.json({ message: 'User registered successfully.', id: userId });

  } catch (err) {
    console.error(`❌ [AUTH /register] Unexpected error:`, err);
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
});

// In auth.js
// Replace your entire app.post('/api/login', ...) route with this:

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  console.log(`[AUTH.JS /api/login] Attempting login for: ${email}`);
  try {
    const { data, error: signInError } = await supabaseGlobalInstance.auth.signInWithPassword({ 
      email: email.trim(),
      password 
    });

    if (signInError) {
      console.warn(`[AUTH.JS /api/login] Supabase signInWithPassword error for ${email}:`, signInError.message);
      return res.status(400).json({ error: signInError.message });
    }
    if (!data.session) {
      console.warn(`[AUTH.JS /api/login] No session returned for ${email} (login failed, possibly MFA or other issue).`);
      return res.status(401).json({ error: 'Invalid login credentials or further action required.' });
    }

    // --- CORRECTLY FETCH full_name FROM YOUR 'users' TABLE ---
    let fullName = ''; // Default to empty string
    try {
        const normalizedEmail = email.toLowerCase().trim();
        const { data: profileData, error: profileError } = await supabaseGlobalInstance
            .from('users')
            .select('full_name')
            .eq('email', normalizedEmail) // Use the normalized email for lookup
            .single();

            console.log(`[DEBUG /login] Raw profileData from DB for ${normalizedEmail}:`, JSON.stringify(profileData, null, 2));
             console.log(`[DEBUG /login] Raw profileError from DB for ${normalizedEmail}:`, JSON.stringify(profileError, null, 2));
        // ... (the rest of the logic to set fullName) ...

        if (profileError && profileError.code !== 'PGRST116') { // PGRST116 means no rows found, which is not a fatal error here
            console.warn(`[AUTH.JS /api/login] Error fetching profile for ${normalizedEmail}:`, profileError.message);
            // Decide if you want to proceed without full_name or return an error
        }
        
        if (profileData && profileData.full_name) {
            fullName = profileData.full_name;
        } else {
            // Fallback to first part of email if full_name is not in profile or profile not found
            fullName = email.split('@')[0]; 
            console.log(`[AUTH.JS /api/login] full_name not found in DB for ${email}, using email part: "${fullName}"`);
        }
    } catch (e) {
        console.error(`[AUTH.JS /api/login] Exception while fetching profile for ${email}:`, e.message);
        fullName = email.split('@')[0]; // Fallback in case of unexpected error
    }
    
    // --- DEBUG LOG FOR fullName ---
    console.log(`[DEBUG /login] Value of fullName for email template: "${fullName}"`); 
    
    const loginMessage = `You have successfully logged into your QuickProCV account.`;
    // Using a consistent fallback for the template greeting
    await sendEmail(
        email, 
        '🔓 Login Notification - QuickProCV', // Slightly more specific subject
        loginMessage, // Pass plain text message
        generateHtmlTemplate(`Welcome back, ${fullName || 'User'}!`, loginMessage), 
        fullName // Pass fullName for potential use by sendEmail internals or template logic
    );

    console.log(`[AUTH.JS /api/login] Login successful and email sent for ${email}.`);
    res.json({ message: 'Login successful', data }); // data from signInWithPassword contains session and user

  } catch (err) {
    console.error(`❌ [AUTH.JS /api/login] Unexpected outer error during login for ${email}:`, err);
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
