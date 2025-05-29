// webhook.js
import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
// Make sure these paths are correct relative to where webhook.js is located
import supabase from './linkedin-server/supabaseClient.js'; 
import sendEmail from './linkedin-server/email.js';
import generateHtmlTemplate from './linkedin-server/emailTemplates/baseHtml.js'; // Assumes 2-param version

dotenv.config({ path: './linkedin-server/.env' }); // Ensure .env is loaded

const app = express();
const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!process.env.STRIPE_SECRET_KEY || !webhookSecret || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ CRITICAL: Missing one or more essential environment variables for webhook.js (Stripe Secret, Webhook Secret, Supabase URL/Service Key).");
    process.exit(1);
}

// Middleware to log incoming requests - helpful for debugging if webhook is hit
app.use((req, res, next) => {
  console.log(`[WEBHOOK.JS] Request received: ${req.method} ${req.originalUrl}`);
  next();
});

// Stripe webhook handler - MUST BE BEFORE express.json()
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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log(`[WEBHOOK.JS] Processing checkout.session.completed. Session ID: ${session.id}`);

    const userEmailFromStripe = session.customer_details ? session.customer_details.email : session.customer_email;
    const purchaseType = session.metadata ? session.metadata.purchaseType : null;
    // IMPORTANT: client_reference_id should be your Supabase User ID (auth.users.id)
    // It must be passed when creating the Stripe Checkout Session
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
        try {
            const { data: currentUserData, error: fetchUserError } = await supabase
                .from('users') // Your public.users table
                .select('ai_monthly_limit, email, full_name') 
                .eq('id', userIdFromStripe) // Query by Supabase User ID
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
            return res.status(500).json({ error: 'Internal server error during token top-up processing.' });
        }
    } else {
        // --- Handle Original Pro Subscription Purchase (Assume if not a token top-up) ---
        // This part relies more on email if userIdFromStripe wasn't passed from Pro checkout session
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
        let updateKey = {}; // Will be { id: userIdFromStripe } or { email: userEmailFromStripe.toLowerCase().trim() }
        let targetEmailForNotification = userEmailFromStripe;

        try {
            // Try to fetch profile to get full_name and confirm existing record by ID or Email
            let profileToUpdate;
            if (userIdFromStripe) {
                updateKey = { id: userIdFromStripe };
                const { data: profileDataById, error: fetchByIdError } = await supabase.from('users').select('full_name, email').eq('id', userIdFromStripe).single();
                if (fetchByIdError && fetchByIdError.code !== 'PGRST116') throw fetchByIdError;
                profileToUpdate = profileDataById;
                if (profileDataById && !targetEmailForNotification) targetEmailForNotification = profileDataById.email; // Get email if only ID was from Stripe
            } else if (userEmailFromStripe) { // Fallback to email if ID wasn't provided
                updateKey = { email: userEmailFromStripe.toLowerCase().trim() };
                const { data: profileDataByEmail, error: fetchByEmailError } = await supabase.from('users').select('full_name, id').eq('email', userEmailFromStripe.toLowerCase().trim()).single();
                if (fetchByEmailError && fetchByEmailError.code !== 'PGRST116') throw fetchByEmailError;
                profileToUpdate = profileDataByEmail;
            }

            if (profileToUpdate && profileToUpdate.full_name) {
                fullName = profileToUpdate.full_name.trim();
            } else {
                fullName = targetEmailForNotification ? targetEmailForNotification.split('@')[0] : '';
            }
            console.log(`[WEBHOOK.JS - Pro Sub] Fetched profile for update. FullName resolved to: "${fullName}". Updating by:`, updateKey);


            const { error: updateProError } = await supabase
                .from('users')
                .update({
                    is_pro: true,
                    pro_expiry: expiryISOString,
                    ai_monthly_limit: 100, 
                    ai_monthly_usage_count: 0,
                    ai_usage_cycle_reset_date: initialAiUsageResetDateISOString
                })
                .match(updateKey); // Use .match(updateKey) which can be {id: ...} or {email: ...}

            if (updateProError) {
                console.error(`❌ [WEBHOOK.JS] Supabase update error for ${identifierForPro} (setting Pro):`, updateProError.message);
                return res.status(500).json({ error: 'Database update failed for Pro subscription.' }); 
            }

            console.log(`✨ [WEBHOOK.JS] User ${identifierForPro} marked as Pro with AI limit of 100 and usage reset.`);
            
            if (targetEmailForNotification) {
                const proSubject = '🎉 Welcome to QuickProCV Pro!';
                const proMessageContent = `Thanks for upgrading to Pro! You now have full access to all features, including 100 AI generations per month, for the next 2 years. Log in to explore your new benefits!`;
                const proHtmlBody = generateHtmlTemplate(`Welcome to Pro, ${fullName || 'QuickProCV User'}!`, proMessageContent);
                
                await sendEmail(targetEmailForNotification, proSubject, proMessageContent, proHtmlBody);
                console.log(`📧 Pro subscription confirmation email sent to: ${targetEmailForNotification}`);
            } else {
                 console.warn(`[WEBHOOK.JS - Pro Sub] No target email for notification for user: ${identifierForPro}`);
            }
        } catch (processingError) { 
            console.error(`❌ [WEBHOOK.JS] Error processing Pro subscription for ${identifierForPro}:`, processingError.message, processingError.stack);
            return res.status(500).json({ error: 'Internal server error during Pro subscription processing.' });
        }
    }
  } else {
    console.log(`[WEBHOOK.JS] Received unhandled event type: ${event.type}`);
  }

  res.status(200).json({ received: true }); 
});


const PORT = process.env.WEBHOOK_PORT || 3003;
app.listen(PORT, () => {
  console.log(`✅ Stripe webhook server (webhook.js) running at http://localhost:${PORT}`);
});