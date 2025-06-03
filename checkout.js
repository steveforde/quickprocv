// checkout.js
import express from 'express';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import cors from 'cors';

dotenv.config({ path: './linkedin-server/.env' });

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Define your frontend URL.
// Change 'http://localhost:5500' if your main frontend application (main.html and script.js)
// runs on a different address during development or in production.
const FRONTEND_APP_URL = process.env.FRONTEND_URL || 'http://localhost:5500';

app.use(cors());
app.use(express.json());

// 🆕 UPDATED: Handle both 1-year and 2-year subscriptions
app.post('/create-checkout-session', async (req, res) => {
    console.log('🚨 [DEBUG] ===== CHECKOUT REQUEST DEBUG =====');
    console.log('🚨 [DEBUG] Full request body:', JSON.stringify(req.body, null, 2));
    console.log('🚨 [DEBUG] Request headers (Content-Type):', req.headers['content-type']);
    console.log('🚨 [DEBUG] Request method:', req.method);
    console.log('🚨 [DEBUG] Request URL:', req.url);
    console.log('🚨 [DEBUG] ================================');
  try {
    const { email, subscriptionType } = req.body; // ✅ Extract email and subscription type
    console.log(`🔍 [Checkout Server] Received request:`, { email, subscriptionType });
    console.log(`🔍 [DEBUG] subscriptionType value: "${subscriptionType}"`);
    console.log(`🔍 [DEBUG] subscriptionType type: ${typeof subscriptionType}`);
    console.log(`🔍 [DEBUG] email value: "${email}"`);

    console.log(`🔍 [Checkout Server] Received request:`, { email, subscriptionType });

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email provided.' });
    }

    // 🆕 Determine which Stripe Price ID to use based on subscription type
    let priceId;
    let subscriptionName;
    
    if (subscriptionType === '1year') {
  priceId = process.env.STRIPE_PRICE_ID_1_YEAR;
  subscriptionName = '1 Year Pro';
  console.log(`💰 [Checkout Server] Using 1-YEAR Price ID: ${priceId}`);
} else if (subscriptionType === '2year') {
  priceId = process.env.STRIPE_PRICE_ID; // Your existing 2-year price ID
  subscriptionName = '2 Year Pro';
  console.log(`💰 [Checkout Server] Using 2-YEAR Price ID: ${priceId}`);
} else {
  // Handle invalid subscription types
  console.error(`❌ [Checkout Server] Invalid subscription type received: "${subscriptionType}"`);
  console.error(`❌ [Checkout Server] Expected: "1year" or "2year", got: "${subscriptionType}"`);
  return res.status(400).json({ 
    error: 'Invalid subscription type. Must be "1year" or "2year".' 
  });
}

    // 🆕 Validate that the price ID exists
    if (!priceId) {
      console.error(`❌ [Checkout Server] Missing Stripe Price ID for subscription type: ${subscriptionType}`);
      return res.status(500).json({ error: 'Subscription configuration error. Please contact support.' });
    }

    console.log(`[Checkout Server] Creating ${subscriptionName} session for email: ${email}`);
    console.log(`🔑 [Checkout Server] Final Price ID being used: ${priceId}`);
    console.log(`📋 [Checkout Server] Metadata will include: subscriptionType="${subscriptionType}"`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price: priceId, // ✅ Use the selected price ID
          quantity: 1,
        },
      ],
      customer_email: email,
      // 🆕 Add metadata to track subscription type
      metadata: {
        subscriptionType: subscriptionType || '2year',
        customerEmail: email
      },
      success_url: `${FRONTEND_APP_URL}/main.html?payment_success=true&email=${encodeURIComponent(email)}&subscription=${subscriptionType || '2year'}`,
      cancel_url: `${FRONTEND_APP_URL}/main.html?payment_cancelled=true`,
    });

    console.log(`✅ [Checkout Server] ${subscriptionName} session created successfully!`);
    console.log(`🔗 [Checkout Server] Redirect URL: ${session.url}`);
    res.json({ url: session.url });

  } catch (err) {
    console.error('❌ [Checkout Server] Session creation failed:', err.message);
    console.error(err);
    res.status(500).json({ error: 'Stripe session creation failed. Check server logs.' });
  }
});

// Add this to your checkout.js file
import { createClient } from '@supabase/supabase-js'; // Import Supabase client here as well

// Add your Supabase configuration (ensure these are in your .env)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use SERVICE_ROLE_KEY for backend database writes

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Webhook secret for Stripe event verification (GET THIS FROM YOUR STRIPE DASHBOARD -> Developers -> Webhooks)
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// 🆕 UPDATED: Handle different subscription lengths in webhook
app.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
    } catch (err) {
        console.error(`❌ [Stripe Webhook] Webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            const customerEmail = session.customer_details ? session.customer_details.email : null;
            
            // 🆕 Get subscription type from metadata with enhanced debugging
            const subscriptionType = session.metadata ? session.metadata.subscriptionType : '2year';

            if (customerEmail) {
                console.log(`✅ [Stripe Webhook] Checkout session completed for email: ${customerEmail}`);
                console.log(`🔍 [Stripe Webhook] Raw session metadata:`, JSON.stringify(session.metadata, null, 2));
                console.log(`✅ [Stripe Webhook] Parsed subscription type: "${subscriptionType}"`);

                // 🆕 Calculate expiry date based on subscription type with extra validation
                const expiryDate = new Date();
                
                if (subscriptionType === '1year') {
                    expiryDate.setFullYear(expiryDate.getFullYear() + 1); // Add 1 year
                    console.log(`📅 [Stripe Webhook] Setting 1-YEAR expiry: ${expiryDate.toISOString()}`);
                } else {
                    expiryDate.setFullYear(expiryDate.getFullYear() + 2); // Add 2 years (default)
                    console.log(`📅 [Stripe Webhook] Setting 2-YEAR expiry: ${expiryDate.toISOString()}`);
                }
                
                console.log(`🎯 [Stripe Webhook] FINAL: subscriptionType="${subscriptionType}", expiryYears=${subscriptionType === '1year' ? 1 : 2}`);

                console.log(`[Stripe Webhook] Calculated expiryDate: ${expiryDate.toISOString()}`);
                console.log(`[Stripe Webhook] Attempting to update user: ${customerEmail} with is_pro: true and pro_expiry: ${expiryDate.toISOString()}`);

                try {
                    const { data, error } = await supabase
                        .from('users')
                        .update({
                            is_pro: true,
                            pro_expiry: expiryDate.toISOString(), // Store as ISO string for timestamptz
                            subscription_type: subscriptionType // 🆕 Track subscription type
                        })
                        .eq('email', customerEmail.toLowerCase().trim());

                    if (error) {
                        console.error(`❌ [Stripe Webhook] Supabase update error for ${customerEmail}:`, error.message, error.details);
                    } else {
                        console.log(`✨ [Stripe Webhook] User ${customerEmail} marked as Pro with ${subscriptionType} expiry ${expiryDate.toISOString()} - Supabase update successful.`);
                    }
                } catch (supabaseErr) {
                    console.error('❌ [Stripe Webhook] Error in Supabase update try-catch block:', supabaseErr.message);
                }
            } else {
                console.warn('⚠️ [Stripe Webhook] Checkout session completed but no customer email found in session.');
            }
            break;
        default:
            console.log(`ℹ️ [Stripe Webhook] Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Checkout server running at http://localhost:${PORT}`);
  console.log(`ℹ️  Frontend success redirect URL configured for: ${FRONTEND_APP_URL}/main.html`);
  console.log(`ℹ️  Subscription options: 1-year (€16.99) and 2-year plans available`);
});