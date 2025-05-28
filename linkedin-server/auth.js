// auth.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import supabaseGlobalInstance from './supabaseClient.js';
import sendEmail from './email.js'; 
import generateHtmlTemplate from './emailTemplates/baseHtml.js'; // Ensure this uses the 2-parameter version

dotenv.config({ path: './linkedin-server/.env' });

const app = express();
app.use(cors());
app.use(express.json());

// --- User Registration Endpoint ---
app.post('/api/register', async (req, res) => {
  const { email, password, full_name } = req.body; 
  console.log(`📩 [AUTH /register] Attempting to register. Email: ${email}, Full Name: ${full_name}`);

  if (!email || !password || !full_name) {
    console.warn(`[AUTH /register] Missing email, password, or full_name for registration.`);
    return res.status(400).json({ error: 'Email, password, and full name are required.' });
  }

  try {
    console.log(`[AUTH /register] Step 1: Creating Supabase Auth user for ${email}...`);
    const { data: userData, error: signupError } = await supabaseGlobalInstance.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, 
    });

    if (signupError) {
      console.error(`❌ [AUTH /register] Supabase createUser error for ${email}:`, signupError.message);
      if (signupError.message.toLowerCase().includes('user already registered')) {
        return res.status(400).json({ error: 'A user with this email address has already been registered.' });
      }
      if (signupError.message.toLowerCase().includes('password should be at least 6 characters')) {
        return res.status(400).json({ error: 'Password is too short (minimum 6 characters enforced by Supabase for auth user).' });
      }
      return res.status(400).json({ error: `Supabase auth error: ${signupError.message}` });
    }

    if (!userData || !userData.user || !userData.user.id) {
        console.error(`❌ [AUTH /register] Supabase user data or user ID missing after createUser for ${email}. userData:`, JSON.stringify(userData, null, 2));
        throw new Error('User creation in Supabase Auth did not return expected user data.');
    }
    const userId = userData.user.id;
    console.log(`✅ [AUTH /register] Supabase auth user created successfully. User ID: ${userId}, Email: ${email}`);

    const normalizedEmail = email.toLowerCase().trim();
    const profileToInsert = { 
        id: userId,
        email: normalizedEmail,
        full_name: full_name ? full_name.trim() : '', 
        is_pro: false 
    };
    console.log(`[AUTH /register] Step 2: Attempting to insert profile into public.users for User ID ${userId}:`, JSON.stringify(profileToInsert, null, 2));

    const { error: insertError } = await supabaseGlobalInstance
      .from('users')
      .insert([profileToInsert])
      .select(); 

    if (insertError) { 
      console.error(`❌ [AUTH /register] Error inserting user profile into public.users for ${email} (ID: ${userId}):`, JSON.stringify(insertError, null, 2));
      try {
        await supabaseGlobalInstance.auth.admin.deleteUser(userId);
        console.warn(`[AUTH /register] Cleaned up orphaned auth user ${userId} due to profile insert failure.`);
      } catch (deleteError) {
        console.error(`[AUTH /register] CRITICAL: Failed to clean up orphaned auth user ${userId} after profile insert failure:`, deleteError.message);
      }
      return res.status(500).json({ error: 'User authentication created, but saving profile data failed: ' + insertError.message });
    }

    console.log(`✅ [AUTH /register] User profile created in public.users for ${email} (ID: ${userId}).`);
    
    const welcomeMessage = `Thanks for joining QuickProCV! You can now start creating professional CVs and cover letters with AI assistance.\n\nLog in to begin building your job-winning documents today: http://localhost:5500/login.html`; 
    const welcomeGreeting = `Welcome, ${profileToInsert.full_name || 'New User'}!`;

    console.log(`[AUTH /register] Step 3: Preparing to send welcome email to ${email}. Greeting: "${welcomeGreeting}"`);
    console.log(`[DEBUG /register] Value of full_name used for welcome email greeting: "${profileToInsert.full_name || ''}"`);
    
    const htmlEmailBody = generateHtmlTemplate(welcomeGreeting, welcomeMessage); // Uses 2-param template
    
    await sendEmail(
      email,
      "Welcome to QuickProCV - Get Started!", 
      welcomeMessage, 
      htmlEmailBody
    );
    console.log(`✅ [AUTH /register] Welcome email successfully sent to ${email}.`);

    res.status(201).json({ message: 'User registered successfully. Please login.', userId: userId });

  } catch (err) {
    console.error(`❌ [AUTH /register] Unexpected error in /api/register for ${email}:`, err.message, err.stack);
    res.status(500).json({ error: 'An unexpected error occurred during registration. Please try again later.' });
  }
});

// --- User Login Endpoint ---
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const trimmedEmailForLogin = email.trim().toLowerCase(); 
  console.log(`[LOGIN] Attempting login for: ${trimmedEmailForLogin}`);

  try {
    const { data: authData, error: signInError } = await supabaseGlobalInstance.auth.signInWithPassword({
      email: trimmedEmailForLogin,
      password
    });

    if (signInError) {
      console.warn(`[LOGIN] Supabase signInWithPassword error for ${trimmedEmailForLogin}:`, signInError.message);
      return res.status(400).json({ error: signInError.message });
    }
    if (!authData || !authData.session || !authData.user) { 
      console.warn(`[LOGIN] No session or user object returned for ${trimmedEmailForLogin} (login failed).`);
      return res.status(401).json({ error: 'Invalid login credentials or further action required.' });
    }

    const authUserId = authData.user.id; 
    const userEmailFromAuth = authData.user.email; 

    let fullName = ''; 
    try {
        console.log(`[LOGIN DEBUG] Starting profile fetch from 'users' table for authUserId: "${authUserId}"`);
        
        const { data: profile, error: profileError } = await supabaseGlobalInstance
            .from('users')
            .select('full_name, email') 
            .eq('id', authUserId)       
            .maybeSingle(); 

        console.log(`[LOGIN DEBUG] Raw profile data from DB (queried by ID ${authUserId}):`, JSON.stringify(profile, null, 2));
        console.log(`[LOGIN DEBUG] Raw profileError from DB (queried by ID ${authUserId}):`, JSON.stringify(profileError, null, 2));
        
        if (profileError) { 
            console.warn(`[LOGIN] Error during profile fetch for authUserId ${authUserId}:`, profileError.message);
        }
        
        if (profile && profile.full_name && profile.full_name.trim() !== '') {
            fullName = profile.full_name.trim();
            console.log(`[LOGIN] full_name "${fullName}" found in DB for authUserId ${authUserId}.`);
        } else {
            fullName = userEmailFromAuth.split('@')[0]; 
            if (profile) { 
                console.warn(`[LOGIN] full_name was empty in DB profile for authUserId ${authUserId} (email: ${userEmailFromAuth}), using email part: "${fullName}"`);
            } else { 
                console.warn(`[LOGIN] No profile found in 'public.users' for authUserId ${authUserId} (email: ${userEmailFromAuth}), using email part: "${fullName}"`);
            }
        }
    } catch (e) {
        console.error(`[LOGIN] Exception while fetching profile for user ${userEmailFromAuth} (ID: ${authUserId}):`, e.message, e.stack);
        fullName = userEmailFromAuth.split('@')[0]; 
    }
    
    console.log(`[LOGIN DEBUG] Final fullName value for email template: "${fullName}"`); 
    
    const loginMessage = `You have successfully logged into your QuickProCV account.`;
    const greetingNameForTemplate = fullName || 'User'; // Fallback for template
    const htmlLoginBody = generateHtmlTemplate(`Welcome back, ${greetingNameForTemplate}!`, loginMessage); // Uses 2-param template
    await sendEmail(
        userEmailFromAuth, 
        '🔓 Login Notification - QuickProCV', 
        loginMessage, 
        htmlLoginBody 
    );

    console.log(`[LOGIN] Login successful and email sent for ${userEmailFromAuth}.`);
    res.json({ message: 'Login successful', data: authData }); 

  } catch (err) { 
    console.error(`[LOGIN] Unexpected outer error for ${trimmedEmailForLogin}:`, err.message, err.stack);
    res.status(500).json({ error: 'An unexpected error occurred during login.' });
  }
});

// --- Check Pro Status Endpoint ---
app.post('/api/check-pro', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    console.warn('[AUTH.JS /api/check-pro] Email is missing in request body.');
    return res.status(400).json({ error: 'Email is required.', isPro: false });
  }

  const normalizedEmail = email.trim().toLowerCase();
  console.log(`[AUTH.JS /api/check-pro] Checking Pro for: "${normalizedEmail}"`);

  try {
    const { data, error } = await supabaseGlobalInstance
      .from('users')
      .select('is_pro, pro_expiry')
      .eq('email', normalizedEmail) // This still queries by email, which might be an issue if email isn't found but user ID would be.
                                   // However, frontend checkProStatus sends email. If this becomes an issue,
                                   // checkProStatus would need to send auth token, and this route would use getAuthenticatedUser.
      .single(); 

    if (error) {
      if (error.code === 'PGRST116') { 
        console.warn(`[AUTH.JS /api/check-pro] User "${normalizedEmail}" not found in public.users.`);
        return res.status(200).json({ isPro: false, pro_expiry: null }); 
      }
      console.error(`[AUTH.JS /api/check-pro] Supabase .single() error for "${normalizedEmail}":`, error.message);
      return res.status(500).json({ error: 'Issue fetching Pro status from database.', isPro: false });
    }
    
    const isProStatus = data.is_pro === true;
    console.log(`[AUTH.JS /api/check-pro] User "${normalizedEmail}" found. DB 'is_pro': ${data.is_pro}. DB 'pro_expiry': ${data.pro_expiry}. Parsed as: ${isProStatus}`);
    
    res.json({ 
      isPro: isProStatus,
      pro_expiry: data.pro_expiry 
    });

  } catch (catchAllError) {
    console.error(`[AUTH.JS /api/check-pro] Unexpected outer catch error for "${normalizedEmail}": ${catchAllError.message}`, catchAllError.stack);
    res.status(500).json({ error: 'Internal server error during Pro status check.', isPro: false });
  }
});

const PORT = process.env.AUTH_PORT || 3002;
app.listen(PORT, () => {
  console.log(`✅ Auth API (auth.js) running at http://localhost:${PORT}`);
});