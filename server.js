// server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import Stripe from 'stripe';
import bodyParser from 'body-parser'; // Make sure bodyParser is installed: npm install body-parser
import sendEmail from './linkedin-server/email.js'; // ✅ Email module
import { createClient } from '@supabase/supabase-js'; // <--- ADDED IMPORT

dotenv.config({ path: './linkedin-server/.env' }); // Ensure correct path to .env file

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// <--- ADDED SUPABASE INITIALIZATION LINES
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use SERVICE_ROLE_KEY for backend database writes

// IMPORTANT: Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correctly set in your .env
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('CRITICAL ERROR: Supabase URL or Service Role Key is missing in .env file.');
  process.exit(1); // Exit the process if critical env vars are missing
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
// --- END ADDED SUPABASE INITIALIZATION ---

app.use(cors()); // CORS should generally be before body parsers for most routes

// IMPORTANT: This route needs the raw request body for Stripe signature verification.
// body-parser.raw() should be applied directly to this route, BEFORE any global express.json()
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // req.body is a Buffer here, which is what Stripe expects for verification
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Webhook verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Convert the raw body (Buffer) to a JSON object AFTER verification
  // This is needed to access event.data.object properly
  const eventJson = JSON.parse(req.body.toString());

  if (event.type === 'checkout.session.completed') {
    // Access session data from the parsed JSON object
    const session = eventJson.data.object;
    const email = session.customer_details ? session.customer_details.email : null;

    if (!email) {
        console.error('❌ Webhook received, but no customer email found in session.');
        return res.status(400).send('No customer email found.');
    }

    console.log('✅ Payment complete for:', email);

    // Calculate expiry date: 2 years from now
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 2);

    console.log(`[Stripe Webhook] Calculated expiryDate: ${expiryDate.toISOString()}`);
    console.log(`[Stripe Webhook] Attempting to update user: ${email} with is_pro: true and pro_expiry: ${expiryDate.toISOString()}`);

    try {
        // --- SUPABASE UPDATE LOGIC ---
        const { data, error } = await supabase
            .from('users') // Your Supabase table name
            .update({
                is_pro: true,
                pro_expiry: expiryDate.toISOString() // Store as ISO string for timestamptz
            })
            .eq('email', email.toLowerCase().trim()); // Match by email

        if (error) {
            console.error(`❌ [Stripe Webhook] Supabase update error for ${email}:`, error.message, error.details);
            // It's good practice to send a non-200 status back to Stripe if database update fails
            // Stripe will then retry sending the webhook event.
            return res.status(500).send('Database update failed.');
        } else {
            console.log(`✨ [Stripe Webhook] User ${email} marked as Pro with expiry ${expiryDate.toISOString()} - Supabase update successful.`);
        }
        // --- END SUPABASE UPDATE LOGIC ---

      // Send confirmation email
      await sendEmail(
        email,
        'QuickProCV Pro Access (2 Years)',
        'Thanks for purchasing Pro! You now have access for 2 years.',
        `<p>Hi there,</p><p>Thanks for upgrading to <strong>Pro</strong>! 🎉<br>You now have full access to <a href="https://quickprocv.com">QuickProCV</a> for 2 years.</p>`
      );
      console.log('📧 Email sent to:', email);
    } catch (err) {
      console.error('❌ Email or Supabase update error:', err.message); // Updated error log
    }
  } else {
      console.log(`ℹ️ [Stripe Webhook] Unhandled event type ${event.type}`);
  }


  // Always respond with a 200 to Stripe to acknowledge receipt of the event
  res.status(200).json({ received: true });
});

// Apply express.json() AFTER the webhook endpoint, as the webhook needs the raw body.
// This will parse JSON for all *other* routes.
app.use(express.json());

app.get('/', (req, res) => {
  res.send('QuickProCV API is live');
});

app.post('/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price: 'price_1RMV5SQRh7jNBCuP5iKOZuuF', // 🔁 Replace with your real Stripe Price ID
          quantity: 1,
        },
      ],
      // Corrected success_url to pass email back to frontend
      success_url: `http://localhost:5500/main.html?payment_success=true&email=${encodeURIComponent(req.body.email)}`,
      cancel_url: 'http://localhost:5500/main.html?payment_cancelled=true',
      customer_email: req.body.email, // Pass customer email to Stripe session
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Stripe session failed:', err);
    res.status(500).json({ error: 'Stripe session failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});