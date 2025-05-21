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


app.post('/create-checkout-session', async (req, res) => {
  try {
    const { email } = req.body; // ✅ Extract from the frontend POST

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email provided.' });
    }

    console.log(`[Checkout Server] Creating session for email: ${email}`); // Added log

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price: 'price_1RMV5SQRh7jNBCuP5iKOZuuF', // ✅ Your actual Stripe Price ID
          quantity: 1,
        },
      ],
      customer_email: email,
      // 👇 CORRECTED URLs HERE 👇
      success_url: `${FRONTEND_APP_URL}/main.html?payment_success=true&email=${encodeURIComponent(email)}`,
      cancel_url: `${FRONTEND_APP_URL}/main.html?payment_cancelled=true`,
      // 👆 CORRECTED URLs HERE 👆
    });

    console.log(`[Checkout Server] Session created. Redirect URL: ${session.url}`); // Added log
    res.json({ url: session.url });

  } catch (err) {
    console.error('❌ [Checkout Server] Session creation failed:', err.message);
    console.error(err); // Log the full error for more details
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

// IMPORTANT: This middleware is for raw body for webhook verification
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
            // You might have passed metadata like userId or userEmail when creating the session
            // const userId = session.metadata ? session.metadata.userId : null;

            if (customerEmail) { // Or if (userId)
                console.log(`✅ [Stripe Webhook] Checkout session completed for email: ${customerEmail}`);

                // Calculate expiry date: 2 years from now
                const expiryDate = new Date();
                expiryDate.setFullYear(expiryDate.getFullYear() + 2);

                // ⭐ INSERT THESE NEW CONSOLE.LOGS HERE ⭐
                console.log(`[Stripe Webhook] Calculated expiryDate: ${expiryDate.toISOString()}`);
                console.log(`[Stripe Webhook] Attempting to update user: ${customerEmail} with is_pro: true and pro_expiry: ${expiryDate.toISOString()}`);


                try {
                    const { data, error } = await supabase
                        .from('users')
                        .update({
                            is_pro: true,
                            pro_expiry: expiryDate.toISOString() // Store as ISO string for timestamptz
                        })
                        .eq('email', customerEmail.toLowerCase().trim());

                    if (error) {
                        console.error(`❌ [Stripe Webhook] Supabase update error for ${customerEmail}:`, error.message, error.details); // <-- Check error.details too
                    } else {
                        console.log(`✨ [Stripe Webhook] User ${customerEmail} marked as Pro with expiry ${expiryDate.toISOString()} - Supabase update successful.`); // <-- IMPROVED LOG
                    }
                } catch (supabaseErr) {
                    console.error('❌ [Stripe Webhook] Error in Supabase update try-catch block:', supabaseErr.message);
                }
            } else {
                console.warn('⚠️ [Stripe Webhook] Checkout session completed but no customer email found in session.');
            }
            break;
        // You might want to handle other event types as needed, e.g., 'invoice.payment_succeeded' for subscriptions
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
});