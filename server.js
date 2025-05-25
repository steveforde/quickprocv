// server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import Stripe from 'stripe';
import bodyParser from 'body-parser';
import sendEmail from './linkedin-server/email.js'; // Ensure this path is correct
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai'; 

// Load environment variables
dotenv.config({ path: './linkedin-server/.env' });

// --- 🎯 DEBUGGING: Check if environment variables are loaded ---
console.log("--- Environment Variable Check ---");
console.log("Loaded STRIPE_PRICE_ID:", process.env.STRIPE_PRICE_ID);
console.log("Loaded STRIPE_TOKEN_TOPUP_PRICE_ID:", process.env.STRIPE_TOKEN_TOPUP_PRICE_ID ? 'Loaded' : '!!! MISSING !!!'); 
console.log("Loaded STRIPE_SECRET_KEY:", process.env.STRIPE_SECRET_KEY ? 'Loaded' : '!!! MISSING !!!');
console.log("Loaded STRIPE_WEBHOOK_SECRET:", process.env.STRIPE_WEBHOOK_SECRET ? 'Loaded' : '!!! MISSING !!!');
console.log("Loaded SUPABASE_URL:", process.env.SUPABASE_URL ? 'Loaded' : '!!! MISSING !!!');
console.log("Loaded SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Loaded' : '!!! MISSING !!!');
console.log("Loaded OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? 'Loaded' : '!!! MISSING !!!'); 
console.log("------------------------------------");
// --- 🎯 END DEBUGGING ---

// --- App & Stripe Initialization ---
const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// --- Supabase Initialization ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// --- OpenAI Initialization --- 
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}); 

// Critical Check: Ensure variables are loaded before proceeding
if (!supabaseUrl || !supabaseServiceKey || 
    !process.env.STRIPE_SECRET_KEY || !endpointSecret || 
    !process.env.STRIPE_PRICE_ID || !process.env.OPENAI_API_KEY || 
    !process.env.STRIPE_TOKEN_TOPUP_PRICE_ID) { 
  console.error('CRITICAL ERROR: One or more required environment variables (Supabase, Stripe Keys, Webhook Secret, Price IDs, OpenAI Key) are missing. Check your .env file and path.'); 
  process.exit(1); 
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- Helper function to get Authenticated User ---
async function getAuthenticatedUser(req) {
    const authHeader = req.headers.authorization;
    console.log('[getAuthenticatedUser] Incoming Authorization header:', authHeader); 

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('[getAuthenticatedUser] No Bearer token found in Authorization header.');
        return { userId: null, userEmail: null, error: 'Authentication token not provided or malformed.' };
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        console.warn('[getAuthenticatedUser] Token not found after "Bearer " prefix.');
        return { userId: null, userEmail: null, error: 'Authentication token malformed.' };
    }

    console.log('[getAuthenticatedUser] Token found, attempting to get user from Supabase...'); 
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
        console.warn('[getAuthenticatedUser] Supabase error getting user from token:', error.message);
        return { userId: null, userEmail: null, error: `Token validation error: ${error.message}` };
    }
    if (!user) {
        console.warn('[getAuthenticatedUser] Token processed by Supabase but no user returned (token might be invalid, expired, or user deleted).');
        return { userId: null, userEmail: null, error: 'Invalid or expired token, or user not found.' };
    }

    console.log('[getAuthenticatedUser] User successfully authenticated from token:', user.id, user.email);
    return { userId: user.id, userEmail: user.email, error: null };
}

// --- Middleware ---
app.use(cors()); // Enable CORS

// --- Stripe Webhook Endpoint (Needs Raw Body) ---
// IMPORTANT: This route MUST be defined BEFORE app.use(express.json()) 
// because Stripe needs the raw request body for signature verification.
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('✅ [Stripe Webhook] Signature verified!');
  } catch (err) {
    console.error('❌ [Stripe Webhook] Verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log(`[Stripe Webhook] Checkout session completed. ID: ${session.id}`);

    const userIdFromClientRef = session.client_reference_id;
    const userEmailFromSession = session.customer_details ? session.customer_details.email : null;
    const purchaseType = session.metadata ? session.metadata.purchaseType : null;
    const userIdFromMetadata = session.metadata ? session.metadata.userId : null; // Get userId from metadata too

    const effectiveUserId = userIdFromClientRef || userIdFromMetadata;

    if (!effectiveUserId && !userEmailFromSession) { 
        console.error('❌ [Stripe Webhook] No user identifier (ID or email) found in session details or metadata.');
        return res.status(400).json({ error: 'User identification missing in session for webhook processing.' });
    }
    
    if (purchaseType === 'ai_tokens_50_topup') {
        // --- Handle AI Token Top-up Purchase ---
        if (!effectiveUserId) { 
            console.error('❌ [Stripe Webhook] User ID (effectiveUserId) is missing for token top-up. Cannot update limits.');
            return res.status(400).json({ error: 'User ID missing for token top-up processing.' });
        }
        console.log(`[Stripe Webhook] Processing 'ai_tokens_50_topup' for user ID: ${effectiveUserId}`);
        try {
            const { data: currentUserData, error: fetchUserError } = await supabase
                .from('users')
                .select('ai_monthly_limit, email') // Also select email if needed for notification and not relying on session
                .eq('id', effectiveUserId)
                .single();

            if (fetchUserError || !currentUserData) {
                console.error(`❌ [Stripe Webhook] Error fetching user ${effectiveUserId} for token top-up:`, fetchUserError?.message);
                return res.status(500).json({ error: 'Could not retrieve user data for token top-up.' }); 
            }

            const currentLimit = Number(currentUserData.ai_monthly_limit) || 0;
            const newLimit = currentLimit + 50;

            const { error: updateUserError } = await supabase 
                .from('users')
                .update({ ai_monthly_limit: newLimit })
                .eq('id', effectiveUserId);

            if (updateUserError) {
                console.error(`❌ [Stripe Webhook] Supabase update error for ${effectiveUserId} (adding tokens):`, updateUserError.message);
                return res.status(500).json({ error: 'Database update failed for token top-up.' }); 
            }
            console.log(`✨ [Stripe Webhook] User ${effectiveUserId} had 50 AI tokens added. New monthly limit for this cycle: ${newLimit}.`);
            
            const emailForNotification = userEmailFromSession || currentUserData.email;

            if(emailForNotification) {
                 await sendEmail(
                    emailForNotification,
                    'QuickProCV - 50 Additional AI Generations Added!',
                    'Your purchase of 50 additional AI generations was successful.',
                    `<p>Hi there,</p><p>You've successfully added <strong>50 additional AI generations</strong> to your QuickProCV account for the current monthly cycle.</p>`
                 );
                 console.log(`📧 Token purchase confirmation email sent to: ${emailForNotification}`);
            } else {
                console.warn(`[Stripe Webhook] No email available to send token purchase confirmation for user ${effectiveUserId}.`);
            }

        } catch (dbProcessingError) { 
            console.error('❌ [Stripe Webhook] Error processing token top-up for user ID', effectiveUserId, dbProcessingError.message);
            return res.status(500).json({ error: 'Internal server error during token top-up processing.' });
        }

    } else {
        // --- Handle Original Pro Subscription Purchase ---
        // For new pro subscriptions, we primarily rely on email as per original logic.
        if (!userEmailFromSession) { 
            console.error('❌ [Stripe Webhook] No customer email found in session for Pro subscription.');
            return res.status(400).json({ error: 'No customer email found for Pro subscription.' });
        }
        console.log(`[Stripe Webhook] Processing Pro subscription for email: ${userEmailFromSession}`);
        
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 2);
        const expiryISOString = expiryDate.toISOString();

        const initialAiUsageResetDate = new Date();
        initialAiUsageResetDate.setDate(initialAiUsageResetDate.getDate() + 30);
        const initialAiUsageResetDateISOString = initialAiUsageResetDate.toISOString();

        try {
            const { error: updateProError } = await supabase
                .from('users')
                .update({
                    is_pro: true,
                    pro_expiry: expiryISOString,
                    ai_monthly_limit: 50,
                    ai_monthly_usage_count: 0,
                    ai_usage_cycle_reset_date: initialAiUsageResetDateISOString
                })
                .eq('email', userEmailFromSession.toLowerCase().trim()); 

            if (updateProError) {
                console.error(`❌ [Stripe Webhook] Supabase update error for ${userEmailFromSession} (setting Pro and AI limits):`, updateProError.message);
                return res.status(500).json({ error: 'Database update failed for Pro subscription.' }); 
            }

            console.log(`✨ [Stripe Webhook] User ${userEmailFromSession} marked as Pro with AI limit of 50 and usage reset.`);
            await sendEmail(
                userEmailFromSession,
                'QuickProCV Pro Access (2 Years)',
                'Thanks for purchasing Pro! You now have access for 2 years.',
                `<p>Hi there,</p><p>Thanks for upgrading to <strong>Pro</strong>! 🎉<br>You now have full access to <a href="https://quickprocv.com">QuickProCV</a> for 2 years.</p>`
            );
            console.log('📧 Pro subscription confirmation email sent to:', userEmailFromSession);

        } catch (dbOrEmailProcessingError) { 
            console.error('❌ Supabase update or Email send error for Pro subscription:', dbOrEmailProcessingError.message);
            return res.status(500).json({ error: 'Internal server error during Pro subscription processing.' });
        }
    }

  } else {
    console.log(`ℹ️ [Stripe Webhook] Unhandled event type ${event.type}`);
  }

  res.status(200).json({ received: true });
});

// --- Other Middleware (Put these AFTER the Stripe Webhook) ---
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// --- Other Routes ---
app.get('/', (req, res) => {
  res.send('QuickProCV API is live');
});

app.post('/create-checkout-session', async (req, res) => {
    const { email } = req.body; // Assuming for now this doesn't strictly need auth to initiate

    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
        console.error('❌ ERROR: STRIPE_PRICE_ID is not available within /create-checkout-session!');
        return res.status(500).json({ error: 'Server configuration error.' });
    }

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:5500'}/main.html?payment_success=true&email=${encodeURIComponent(email)}`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5500'}/main.html?payment_cancelled=true`,
            customer_email: email,
            // For a new subscription, Stripe creates a customer. If user is already logged in,
            // you might want to pass existing Stripe customer ID if you store it.
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error('❌ Stripe session creation failed:', err.message);
        res.status(500).json({ error: 'Stripe session creation failed.' });
    }
});

// --- AI Generation Route --- 
app.post('/api/ai/generate', async (req, res) => {
  console.log('[API /api/ai/generate] Request received.'); 

  const { userId, userEmail, error: authError } = await getAuthenticatedUser(req);

  if (authError || !userId) {
      console.warn(`[API /api/ai/generate] USER NOT AUTHENTICATED. AuthError: ${authError}, UserID: ${userId}`);
      return res.status(401).json({ error: `User not authenticated. Please log in. Details: ${authError}` });
  } else {
      console.log(`[API /api/ai/generate] Request validated for user: ${userEmail} (ID: ${userId})`);
  }

  const { prompt } = req.body;
  if (!prompt) {
    console.log("❌ [API /api/ai/generate] Received request with no prompt for user:", userId);
    return res.status(400).json({ error: 'Prompt is required.' });
  }
  
  try {
    const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('ai_monthly_usage_count, ai_monthly_limit, ai_usage_cycle_reset_date')
        .eq('id', userId)
        .single();

    if (fetchError || !userData) {
        console.error(`[LimitCheck] Error fetching usage data for user ${userId}:`, fetchError?.message);
        return res.status(500).json({ error: 'Could not retrieve your usage data.' });
    }

    let { ai_monthly_usage_count, ai_monthly_limit, ai_usage_cycle_reset_date } = userData;
    const currentDate = new Date();
    let needsDbUpdate = false; 

    ai_monthly_limit = Number(ai_monthly_limit) || 0;
    ai_monthly_usage_count = Number(ai_monthly_usage_count) || 0;

    if (!ai_usage_cycle_reset_date || currentDate >= new Date(ai_usage_cycle_reset_date)) {
        console.log(`[LimitCheck] Resetting usage count for user ${userId}. Old reset date: ${ai_usage_cycle_reset_date}`);
        ai_monthly_usage_count = 0;
        const nextResetDate = new Date(currentDate);
        nextResetDate.setDate(currentDate.getDate() + 30); 
        ai_usage_cycle_reset_date = nextResetDate.toISOString();
        needsDbUpdate = true;
        console.log(`[LimitCheck] New reset date for user ${userId}: ${ai_usage_cycle_reset_date}`);
    }

    if (ai_monthly_usage_count >= ai_monthly_limit) {
        console.log(`[LimitCheck] User ${userId} has reached their monthly limit of ${ai_monthly_limit} calls (Usage: ${ai_monthly_usage_count}).`);
        return res.status(429).json({ error: `You have reached your monthly limit of ${ai_monthly_limit} AI generations.` });
    }

    console.log(`[LimitCheck] User ${userId} usage: ${ai_monthly_usage_count}/${ai_monthly_limit}. Proceeding with AI call.`);
    console.log(`[AI Generate] Received prompt for user ${userId}, starting call to OpenAI...`);

    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-3.5-turbo', 
    });

    const generatedText = completion.choices[0]?.message?.content?.trim() || 'No result from AI.';
    console.log("✅ [AI Generate] OpenAI call successful for user:", userId);

    ai_monthly_usage_count++;
    needsDbUpdate = true; 
    console.log(`[LimitCheck] User ${userId} usage count incremented to: ${ai_monthly_usage_count}`);
    
    if (needsDbUpdate) {
        const { error: updateError } = await supabase
            .from('users')
            .update({ 
                ai_monthly_usage_count: ai_monthly_usage_count, 
                ai_usage_cycle_reset_date: ai_usage_cycle_reset_date 
            })
            .eq('id', userId);

        if (updateError) {
            console.error(`[LimitCheck] Error updating usage data for user ${userId} after AI call:`, updateError.message);
        } else {
            console.log(`[LimitCheck] Usage data updated for user ${userId}.`);
        }
    }
    
    res.json({ result: generatedText });

  } catch (error) { 
    console.error(`❌ Error in /api/ai/generate for user ${userId}:`, error);
    const clientErrorMessage = error.status === 429 ? error.message : 'Failed to generate content due to a server error.';
    const statusCode = error.status || 500;
    res.status(statusCode).json({ error: clientErrorMessage, details: (error.status ? undefined : error.message) });
  }
});

// --- Create Stripe Checkout Session for Token Top-up ---
app.post('/api/create-token-purchase-session', async (req, res) => {
    console.log('[API /create-token-purchase-session] Request received.');

    const { userId, userEmail, error: authError } = await getAuthenticatedUser(req); 
    
    if (authError || !userId) {
        console.warn(`[TokenPurchaseSession] USER NOT AUTHENTICATED. AuthError: ${authError}, UserID: ${userId}`);
        return res.status(401).json({ error: `User not authenticated. Please log in. Details: ${authError}` });
    }
    console.log(`[TokenPurchaseSession] Authenticated user ${userEmail} (ID: ${userId}) initiating token purchase.`);

    const tokenTopUpPriceId = process.env.STRIPE_TOKEN_TOPUP_PRICE_ID;

    if (!tokenTopUpPriceId) {
        console.error('❌ CRITICAL: STRIPE_TOKEN_TOPUP_PRICE_ID is not configured in environment variables!');
        return res.status(500).json({ error: 'Server payment configuration error.' });
    }

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment', 
            line_items: [{
                price: tokenTopUpPriceId,
                quantity: 1,
            }],
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:5500'}/main.html?tokens_purchased_session_id={CHECKOUT_SESSION_ID}`, 
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5500'}/main.html?tokens_purchase_cancelled=true`,
            customer_email: userEmail, 
            client_reference_id: userId, 
            metadata: {                 
                purchaseType: 'ai_tokens_50_topup',
                userId: userId 
            }
        });
        console.log(`[TokenPurchaseSession] Stripe session created for user ${userId}. URL: ${session.url}`);
        res.json({ url: session.url });

    } catch (err) {
        console.error('❌ Stripe session creation for token top-up failed:', err.message);
        res.status(500).json({ error: 'Stripe session creation failed for token top-up.' });
    }
});

// IN SERVER.JS - ADD THIS TEMPORARY TEST ROUTE

app.post('/test-webhook-topup/:userIdToTest/:userEmailToTest', async (req, res) => {
    const { userIdToTest, userEmailToTest } = req.params;
    console.log(`\n--- [SIMULATING STRIPE WEBHOOK for AI Token Top-up] ---`);
    console.log(`[TEST WEBHOOK] Simulating for userId: ${userIdToTest}, email: ${userEmailToTest}`);

    // This is the core logic from your webhook's 'ai_tokens_50_topup' block
    // We use effectiveUserId and userEmailFromSession as they are named in your webhook
    const effectiveUserId = userIdToTest;
    const userEmailFromSession = userEmailToTest;

    if (!effectiveUserId) { 
        console.error('❌ [TEST WEBHOOK] User ID is missing for token top-up simulation.');
        return res.status(400).json({ error: 'User ID missing for token top-up simulation.' });
    }
    console.log(`[TEST WEBHOOK] Processing 'ai_tokens_50_topup' for user ID: ${effectiveUserId}`);
    try {
        const { data: currentUserData, error: fetchUserError } = await supabase
            .from('users')
            .select('ai_monthly_limit, email') // Also selected email for notification consistency
            .eq('id', effectiveUserId)
            .single();

        if (fetchUserError || !currentUserData) {
            console.error(`❌ [TEST WEBHOOK] Error fetching user ${effectiveUserId} for token top-up:`, fetchUserError?.message);
            return res.status(500).json({ error: 'Could not retrieve user data for token top-up.' }); 
        }

        const currentLimit = Number(currentUserData.ai_monthly_limit) || 0;
        const newLimit = currentLimit + 50;
        console.log(`[TEST WEBHOOK] Current limit for ${effectiveUserId} is ${currentLimit}. New limit will be ${newLimit}.`);


        const { error: updateUserError } = await supabase 
            .from('users')
            .update({ ai_monthly_limit: newLimit })
            .eq('id', effectiveUserId);

        if (updateUserError) {
            console.error(`❌ [TEST WEBHOOK] Supabase update error for ${effectiveUserId} (adding tokens):`, updateUserError.message);
            return res.status(500).json({ error: 'Database update failed for token top-up.' }); 
        }
        console.log(`✨ [TEST WEBHOOK] User ${effectiveUserId} would have 50 AI tokens added. New monthly limit for this cycle: ${newLimit}.`);
        
        const emailForNotification = userEmailFromSession || currentUserData.email;

        if(emailForNotification) {
            // In a real scenario, you'd call sendEmail. For this test, we'll just log.
             console.log(`📧 SIMULATING Token purchase confirmation email to: ${emailForNotification}`);
            //  await sendEmail(
            //     emailForNotification,
            //     'QuickProCV - 50 Additional AI Generations Added (TEST)',
            //     'Your purchase of 50 additional AI generations was successful.',
            //     `<p>Hi there,</p><p>You've successfully added <strong>50 additional AI generations</strong> to your QuickProCV account for the current monthly cycle.</p>`
            //  );
        } else {
            console.warn(`[TEST WEBHOOK] No email available to send token purchase confirmation for user ${effectiveUserId}.`);
        }
        res.status(200).json({ message: 'Test webhook for top-up processed successfully.', userId: effectiveUserId, oldLimit: currentLimit, newLimit: newLimit });

    } catch (dbProcessingError) { 
        console.error('❌ [TEST WEBHOOK] Error processing token top-up for user ID', effectiveUserId, dbProcessingError.message);
        return res.status(500).json({ error: 'Internal server error during token top-up test processing.' });
    }
});



// --- Server Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`🕒 Current time in Limerick: ${new Date().toLocaleTimeString('en-IE', { timeZone: 'Europe/Dublin' })}`);
});