// webhook.js
import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
// Make sure these paths are correct relative to where webhook.js is located
import supabase from './linkedin-server/supabaseClient.js'; 
import sendEmail from './linkedin-server/email.js';
import generateHtmlTemplate from './linkedin-server/emailTemplates/baseHtml.js'; // Using this for all emails for now

dotenv.config({ path: './linkedin-server/.env' }); // Ensure .env is loaded

const app = express();
const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Critical Environment Variable Check
if (!process.env.STRIPE_SECRET_KEY || 
    !webhookSecret || 
    !process.env.SUPABASE_URL || 
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.STRIPE_PRICE_ID || // Added check based on your server.js
    !process.env.STRIPE_TOKEN_TOPUP_PRICE_ID) { // Added check based on your server.js
    console.error("❌ CRITICAL: Missing one or more essential environment variables for webhook.js. Check Stripe keys, webhook secret, Supabase URL/Service Key, and Price IDs.");
    process.exit(1);
}

// Middleware to log incoming requests
app.use((req, res, next) => {
  console.log(`[WEBHOOK.JS] Request received: ${req.method} ${req.originalUrl}`);
  next();
});

// Stripe webhook handler - MUST BE DEFINED BEFORE express.json() if other routes use it.
// For a dedicated webhook server, this is fine here.
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log("--- [WEBHOOK.JS] /webhook route HIT ---");
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripeInstance.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log('✅ [WEBHOOK.JS] Stripe signature verified. Event ID:', event.id, 'Type:', event.type);
  } catch (err) {
    console.error('❌ [WEBHOOK.JS] Stripe signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log(`[WEBHOOK.JS] Processing checkout.session.completed. Session ID: ${session.id}`);

    const userEmailFromStripe = session.customer_details ? session.customer_details.email : session.customer_email;
    const purchaseType = session.metadata ? session.metadata.purchaseType : null;
    const userIdFromStripe = session.client_reference_id || (session.metadata ? session.metadata.userId : null);

    if (!userIdFromStripe && !userEmailFromStripe) {
        console.error('❌ [WEBHOOK.JS] Critical: No user identifier (ID from client_reference_id/metadata or email) found in Stripe session.');
        return res.status(400).json({ error: 'User identification missing in session.' });
    }
    console.log(`[WEBHOOK.JS] Identified User - Email: ${userEmailFromStripe}, Stripe UserID: ${userIdFromStripe}, PurchaseType: ${purchaseType}`);

    if (purchaseType === 'ai_tokens_50_topup') {
        // --- Handle AI Token Top-up Purchase ---
        if (!userIdFromStripe) { 
            console.error('❌ [WEBHOOK.JS] User ID (userIdFromStripe) is strictly required for token top-up but was missing.');
            return res.status(400).json({ error: 'User ID missing for token top-up processing.' });
        }
        console.log(`[WEBHOOK.JS] Identified as 'ai_tokens_50_topup' for User ID: ${userIdFromStripe}`);
        try { // try for token top-up logic
            const { data: currentUserData, error: fetchUserError } = await supabase
                .from('users') 
                .select('ai_monthly_limit, email, full_name') 
                .eq('id', userIdFromStripe) 
                .single();

            if (fetchUserError || !currentUserData) {
                console.error(`❌ [WEBHOOK.JS] Error fetching user ${userIdFromStripe} from public.users for token top-up:`, fetchUserError?.message);
                return res.status(500).json({ error: 'Could not retrieve user data for token top-up.' }); 
            }
            console.log(`[WEBHOOK.JS] User ${userIdFromStripe} data fetched for token top-up:`, JSON.stringify(currentUserData, null, 2));

            const currentLimit = Number(currentUserData.ai_monthly_limit) || 0;
            const newLimit = currentLimit + 50;

            const { error: updateUserError } = await supabase 
                .from('users')
                .update({ ai_monthly_limit: newLimit })
                .eq('id', userIdFromStripe);

            if (updateUserError) {
                console.error(`❌ [WEBHOOK.JS] Supabase update error for ${userIdFromStripe} (adding tokens):`, updateUserError.message);
                return res.status(500).json({ error: 'Database update failed for token top-up.' }); 
            }
            console.log(`✨ [WEBHOOK.JS] User ${userIdFromStripe} had 50 AI tokens added. Old limit: ${currentLimit}, New monthly limit for this cycle: ${newLimit}.`);
            
            const emailForNotification = userEmailFromStripe || currentUserData.email;
            const fullName = currentUserData.full_name || '';

            if(emailForNotification) {
                 const tokenSubject = '✅ 50 Additional AI Generations Added!';
                 const tokenMessageContent = `You've successfully added 50 additional AI generations to your QuickProCV account. Your AI generation limit for the current monthly cycle has been increased to ${newLimit}.`;
                 const tokenHtmlBody = generateHtmlTemplate(`Hi ${fullName || 'QuickProCV User'}!`, tokenMessageContent);
                 await sendEmail(emailForNotification, tokenSubject, tokenMessageContent, tokenHtmlBody);
                 console.log(`📧 Token purchase confirmation email sent to: ${emailForNotification}`);
            } else {
                console.warn(`[WEBHOOK.JS] No email available to send token purchase confirmation for user ${userIdFromStripe}.`);
            }
        } catch (processingError) { 
            console.error('❌ [WEBHOOK.JS] Error processing token top-up for User ID', userIdFromStripe, processingError.message, processingError.stack);
            // Return 500 only if headers not already sent by a previous error
            if (!res.headersSent) {
                 return res.status(500).json({ error: 'Internal server error during token top-up processing.' });
            }
        }
        // End of 'ai_tokens_50_topup' block
    } else { 
        // --- Handle Original Pro Subscription Purchase (Assume if not a token top-up) ---
        const identifierForPro = userIdFromStripe || userEmailFromStripe;
        if (!identifierForPro) {
             console.error('❌ [WEBHOOK.JS] Cannot identify user for Pro subscription (missing ID and Email).');
             return res.status(400).json({ error: 'User identification for Pro subscription failed.' });
        }
        console.log(`[WEBHOOK.JS] Processing Pro subscription for User: ${identifierForPro}`);
        
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 2);
        const expiryISOString = expiryDate.toISOString();

        const initialAiUsageResetDate = new Date();
        initialAiUsageResetDate.setDate(initialAiUsageResetDate.getDate() + 30);
        const initialAiUsageResetDateISOString = initialAiUsageResetDate.toISOString();
        
        let fullName = '';
        let updateKey = {}; 
        let targetEmailForNotification = userEmailFromStripe;

        try { // This try block covers the entire Pro subscription logic
            let profileToUpdate;
            if (userIdFromStripe) {
                updateKey = { id: userIdFromStripe };
                const { data: profileDataById, error: fetchByIdError } = await supabase.from('users').select('full_name, email').eq('id', userIdFromStripe).single();
                if (fetchByIdError && fetchByIdError.code !== 'PGRST116') { // PGRST116 means no rows found, not necessarily an error for .single() if that's okay
                    console.error(`[WEBHOOK.JS - Pro Sub] Error fetching profile by ID ${userIdFromStripe}:`, fetchByIdError.message);
                    throw fetchByIdError; 
                }
                profileToUpdate = profileDataById;
                if (profileDataById && !targetEmailForNotification) targetEmailForNotification = profileDataById.email;
            } else if (userEmailFromStripe) { 
                const normalizedEmailForPro = userEmailFromStripe.toLowerCase().trim();
                updateKey = { email: normalizedEmailForPro };
                const { data: profileDataByEmail, error: fetchByEmailError } = await supabase.from('users').select('full_name, id').eq('email', normalizedEmailForPro).single();
                 if (fetchByEmailError && fetchByEmailError.code !== 'PGRST116') {
                    console.error(`[WEBHOOK.JS - Pro Sub] Error fetching profile by email ${normalizedEmailForPro}:`, fetchByEmailError.message);
                    throw fetchByEmailError;
                }
                profileToUpdate = profileDataByEmail;
            }

            if (profileToUpdate && profileToUpdate.full_name) {
                fullName = profileToUpdate.full_name.trim();
            } else {
                fullName = targetEmailForNotification ? targetEmailForNotification.split('@')[0] : 'QuickProCV User';
            }
            console.log(`[WEBHOOK.JS - Pro Sub] Fetched profile for update. FullName resolved to: "${fullName}". Updating by:`, JSON.stringify(updateKey));

            if (Object.keys(updateKey).length === 0) { 
                console.error(`❌ [WEBHOOK.JS - Pro Sub] Cannot determine update key for user: ${identifierForPro}. User might not exist in 'users' table.`);
                return res.status(404).json({ error: "User profile not found to apply Pro subscription." });
            }

            const { error: updateProError } = await supabase
                .from('users')
                .update({
                    is_pro: true,
                    pro_expiry: expiryISOString,
                    ai_monthly_limit: 100, 
                    ai_monthly_usage_count: 0,
                    ai_usage_cycle_reset_date: initialAiUsageResetDateISOString
                })
                .match(updateKey); 

            if (updateProError) {
                console.error(`❌ [WEBHOOK.JS] Supabase update error for ${identifierForPro} (setting Pro):`, updateProError.message);
                return res.status(500).json({ error: 'Database update failed for Pro subscription.' }); 
            }

            console.log(`✨ [WEBHOOK.JS] User ${identifierForPro} marked as Pro with AI limit of 100 and usage reset.`);
            
            if (targetEmailForNotification) {
                const proSubject = '🎉 Welcome to QuickProCV Pro!';
                const proMessageContent = `Thanks for upgrading to Pro! You now have full access to all features, including 100 AI generations per month, for the next 2 years. Log in to explore your new benefits!`;
                const proHtmlBody = generateHtmlTemplate(`Welcome to Pro, ${fullName}!`, proMessageContent);
                
                await sendEmail(targetEmailForNotification, proSubject, proMessageContent, proHtmlBody);
                console.log(`📧 Pro subscription confirmation email sent to: ${targetEmailForNotification}`);
            } else {
                 console.warn(`[WEBHOOK.JS - Pro Sub] No target email for notification for user: ${identifierForPro}`);
            }
        } catch (processingError) { // This catch is for the try block handling Pro subscription logic
            console.error(`❌ [WEBHOOK.JS] Error processing Pro subscription for ${identifierForPro}:`, processingError.message, processingError.stack);
            if (!res.headersSent) {
                return res.status(500).json({ error: 'Internal server error during Pro subscription processing.' });
            }
        }
      // End of the 'else' block for Pro Subscription
    }
  // This is the end of the 'if (event.type === 'checkout.session.completed')' block
  } else { // This 'else' handles event types that are NOT 'checkout.session.completed'
    console.log(`[WEBHOOK.JS] Received unhandled event type: ${event.type}`);
  }

  // Send a 200 OK response to Stripe if an error response hasn't already been sent
  if (!res.headersSent) {
    res.status(200).json({ received: true }); 
  }
});

// If you have other routes or express.json() middleware, ensure it's placed correctly.
// For a dedicated webhook server, having express.raw for the webhook and then express.json()
// for other potential routes (if any) is fine. If /webhook is the ONLY route,
// you don't strictly need express.json() or express.urlencoded() after it.
// app.use(express.json()); // Example: if you had other JSON routes
// app.use(express.urlencoded({ extended: true })); // Example: if you had other form-urlencoded routes

const PORT = process.env.WEBHOOK_PORT || 3003;
app.listen(PORT, () => {
  console.log(`✅ Stripe webhook server (webhook.js) running at http://localhost:${PORT}`);
});