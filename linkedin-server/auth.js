// auth.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import supabaseGlobalInstance from './supabaseClient.js';
import supabase from './supabaseClient.js';
import sendEmail from './email.js';
import generateHtmlTemplate from './emailTemplates/baseHtml.js';
import generateProConfirmationHtml from './emailTemplates/proConfirmationHtml.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


dotenv.config({ path: './.env' });

const app = express();
app.use(cors());
app.use(express.json()); // Essential for parsing JSON request bodies

// Middleware to log all requests to auth.js
app.use((req, res, next) => {
  console.log(`[AUTH.JS] Request received: ${req.method} ${req.originalUrl}`);
  if (Object.keys(req.body).length > 0) {
    console.log(`[AUTH.JS] Request body:`, req.body);
  }
  next();
});

// --- User Registration Endpoint ---
app.post('/api/register', async (req, res) => {
  console.log("--- DEBUG: /api/register route in auth.js HIT ---"); 
  const { email, password, full_name } = req.body; 
  console.log(`📩 [AUTH /register] Attempting to register. Email: ${email}, Full Name: ${full_name}`);

  if (!email || !password || !full_name) {
    console.warn(`[AUTH /register] Missing email, password, or full_name for registration.`);
    return res.status(400).json({ error: 'Email, password, and full name are required.' });
  }
  // Basic password policy check (mirroring your client-side more closely for consistency before Supabase)
  if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    console.warn(`[AUTH /register] Password for ${email} does not meet policy (10 chars, UC, LC, num).`);
    return res.status(400).json({ error: 'Password does not meet criteria: Min 10 chars, at least one uppercase, one lowercase, and one number.' });
  }

  try {
    console.log(`[AUTH /register] Step 1: Creating Supabase Auth user for ${email}...`);
    const { data: userData, error: signupError } = await supabaseGlobalInstance.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // User's preference: auto-confirm, custom welcome email only
    });

    if (signupError) {
      console.error(`❌ [AUTH /register] Supabase createUser error for ${email}:`, signupError.message);
      if (signupError.message.toLowerCase().includes('user already registered')) {
        return res.status(400).json({ error: 'A user with this email address has already been registered.' });
      }
      if (signupError.message.toLowerCase().includes('password should be at least 6 characters')) { // Supabase's own minimum
        return res.status(400).json({ error: 'Password is too short (minimum 6 characters enforced by Supabase for auth user). Please use at least 10 characters with complexity.' });
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
    
    const htmlEmailBody = generateHtmlTemplate(welcomeGreeting, welcomeMessage);
    
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
  console.log("--- DEBUG: /api/login route in auth.js HIT ---");
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
    const greetingNameForTemplate = fullName || 'User';
    const htmlLoginBody = generateHtmlTemplate(`Welcome back, ${greetingNameForTemplate}!`, loginMessage);
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
  console.log("--- DEBUG: /api/check-pro route in auth.js HIT (USING GLOBAL CLIENT) ---"); // Updated log
  const { email } = req.body;
  if (!email) {
    console.warn('[AUTH.JS /api/check-pro] Email is missing in request body.');
    return res.status(400).json({ error: 'Email is required.', isPro: false });
  }

  const normalizedEmail = email.trim().toLowerCase();
  console.log(`[AUTH.JS /api/check-pro] Checking Pro for: "${normalizedEmail}"`);

  try {
    // Using supabaseGlobalInstance for consistency, assuming it has service role.
    // If specific options like no persistSession were critical, a new client was fine too.
    const { data, error } = await supabaseGlobalInstance 
      .from('users')
      .select('is_pro, pro_expiry')
      .eq('email', normalizedEmail) 
      .maybeSingle(); // Changed to maybeSingle() for consistency with login, handles 0 rows gracefully

    if (error) {
      // No need to check for PGRST116 specifically if maybeSingle() is used, as data will be null
      console.error(`[AUTH.JS /api/check-pro] Supabase query error for "${normalizedEmail}":`, error.message);
      return res.status(500).json({ error: 'Issue fetching Pro status from database.', isPro: false });
    }

    if (!data) { // User not found in public.users
        console.warn(`[AUTH.JS /api/check-pro] User "${normalizedEmail}" not found in public.users.`);
        return res.status(200).json({ isPro: false, pro_expiry: null }); 
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

// 🆕 CHECKOUT ROUTE - Added to auth.js
app.post('/create-checkout-session', async (req, res) => {
  try {
    // Debug logging
    console.log('🚨 [DEBUG] ===== CHECKOUT REQUEST DEBUG =====');
    console.log('🚨 [DEBUG] Full request body:', JSON.stringify(req.body, null, 2));
    console.log('🚨 [DEBUG] Request headers (Content-Type):', req.headers['content-type']);
    console.log('🚨 [DEBUG] ================================');

    const { email, subscriptionType } = req.body;

    console.log(`🔍 [Checkout] Received request:`, { email, subscriptionType });

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email provided.' });
    }

    // Determine which Stripe Price ID to use
    let priceId;
    let subscriptionName;
    
    if (subscriptionType === '1year') {
      priceId = process.env.STRIPE_PRICE_ID_1_YEAR;
      subscriptionName = '1 Year Pro';
      console.log(`💰 [Checkout] Using 1-YEAR Price ID: ${priceId}`);
    } else if (subscriptionType === '2year') {
      priceId = process.env.STRIPE_PRICE_ID_2_YEAR; // Your existing 2-year price ID
      subscriptionName = '2 Year Pro';
      console.log(`💰 [Checkout] Using 2-YEAR Price ID: ${priceId}`);
    } else {
      console.error(`❌ [Checkout] Invalid subscription type: "${subscriptionType}"`);
      return res.status(400).json({ 
        error: 'Invalid subscription type. Must be "1year" or "2year".' 
      });
    }

    if (!priceId) {
      console.error(`❌ [Checkout] No price ID found for subscription type: ${subscriptionType}`);
      return res.status(500).json({ error: 'Price configuration error.' });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: email,
      success_url: `http://localhost:5500/main.html?email=${encodeURIComponent(email)}&subscription=${subscriptionType}`,
      cancel_url: 'http://localhost:5500/main.html?cancelled=true',
      metadata: {
        email: email,
        subscriptionType: subscriptionType
      }
    });

    console.log(`✅ [Checkout] Session created successfully for ${email}: ${session.id}`);
    res.json({ url: session.url });

  } catch (error) {
    console.error('❌ [Checkout] Error:', error);
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

// Add this route to your auth.js after the existing routes
app.post('/api/force-pro', async (req, res) => {
    const { email, subscriptionType = '1year' } = req.body;
    console.log(`[AUTH.JS] FORCE PRO activation for: ${email}, type: ${subscriptionType}`);
    
    // Calculate dynamic expiry date
    const now = new Date();
    let expiryDate;
    
    if (subscriptionType === '2year') {
        expiryDate = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
        console.log('[AUTH.JS] 2-year subscription - setting expiry to:', expiryDate.toISOString());
    } else {
        // Default to 1 year
        expiryDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
        console.log('[AUTH.JS] 1-year subscription - setting expiry to:', expiryDate.toISOString());
    }
    
    try {
        const { data, error } = await supabase
            .from('users')
            .update({ 
                is_pro: true, 
                pro_expiry: expiryDate.toISOString()
            })
            .eq('email', email);
            
        if (error) throw error;
        
        console.log(`✅ [AUTH.JS] FORCE PRO activated for ${email} until ${expiryDate.toISOString()}`);
        res.json({ 
            success: true, 
            message: 'Pro status activated', 
            expiry: expiryDate.toISOString() 
        });
    } catch (error) {
        console.error('[AUTH.JS] FORCE PRO error:', error);
        res.status(500).json({ error: error.message });
    }
});


const PORT = process.env.AUTH_PORT || 3002;
app.listen(PORT, () => {
  console.log(`✅ Auth API (auth.js) running at http://localhost:${PORT}`);
});