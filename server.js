// server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import Stripe from 'stripe';
import bodyParser from 'body-parser';
import sendEmail from './linkedin-server/email.js'; // Ensure this path is correct
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai'; // <-- ADDED: OpenAI Import

// Load environment variables
dotenv.config({ path: './linkedin-server/.env' });

// --- 🎯 DEBUGGING: Check if environment variables are loaded ---
console.log("--- Environment Variable Check ---");
console.log("Loaded STRIPE_PRICE_ID:", process.env.STRIPE_PRICE_ID);
console.log("Loaded STRIPE_SECRET_KEY:", process.env.STRIPE_SECRET_KEY ? 'Loaded' : '!!! MISSING !!!');
console.log("Loaded STRIPE_WEBHOOK_SECRET:", process.env.STRIPE_WEBHOOK_SECRET ? 'Loaded' : '!!! MISSING !!!');
console.log("Loaded SUPABASE_URL:", process.env.SUPABASE_URL ? 'Loaded' : '!!! MISSING !!!');
console.log("Loaded SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Loaded' : '!!! MISSING !!!');
console.log("Loaded OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? 'Loaded' : '!!! MISSING !!!'); // <-- ADDED: OpenAI Check
console.log("------------------------------------");
// --- 🎯 END DEBUGGING ---

// --- App & Stripe Initialization ---
const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// --- Supabase Initialization ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// --- OpenAI Initialization --- // <-- ADDED: OpenAI Setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}); // <-- ADDED: OpenAI Setup

// Critical Check: Ensure variables are loaded before proceeding
if (!supabaseUrl || !supabaseServiceKey || !process.env.STRIPE_SECRET_KEY || !endpointSecret || !process.env.STRIPE_PRICE_ID || !process.env.OPENAI_API_KEY) { // <-- ADDED: OpenAI Key Check
  console.error('CRITICAL ERROR: One or more required environment variables (Supabase, Stripe Keys, Webhook Secret, Price ID, OpenAI Key) are missing. Check your .env file and path.'); // <-- Updated message
  process.exit(1); // Exit if essential config is missing
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- Middleware ---
app.use(cors()); // Enable CORS

// --- Stripe Webhook Endpoint (Needs Raw Body) ---
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('✅ Webhook signature verified!');
  } catch (err) {
    console.error('❌ Webhook verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details ? session.customer_details.email : null;

    if (!email) {
      console.error('❌ Webhook received, but no customer email found in session.');
      return res.status(400).send('No customer email found.');
    }

    console.log(`✅ Payment complete for: ${email}`);

    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 2);
    const expiryISOString = expiryDate.toISOString();

    console.log(`[Stripe Webhook] Attempting to update user: ${email} with is_pro: true and pro_expiry: ${expiryISOString}`);

    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          is_pro: true,
          pro_expiry: expiryISOString
        })
        .eq('email', email.toLowerCase().trim());

      if (error) {
        console.error(`❌ [Stripe Webhook] Supabase update error for ${email}:`, error.message);
        return res.status(500).send('Database update failed.');
      }

      console.log(`✨ [Stripe Webhook] User ${email} marked as Pro.`);

      await sendEmail(
        email,
        'QuickProCV Pro Access (2 Years)',
        'Thanks for purchasing Pro! You now have access for 2 years.',
        `<p>Hi there,</p><p>Thanks for upgrading to <strong>Pro</strong>! 🎉<br>You now have full access to <a href="https://quickprocv.com">QuickProCV</a> for 2 years.</p>`
      );
      console.log('📧 Email sent to:', email);

    } catch (dbOrEmailError) {
      console.error('❌ Supabase update or Email send error:', dbOrEmailError.message);
    }
  } else {
    console.log(`ℹ️ [Stripe Webhook] Unhandled event type ${event.type}`);
  }

  res.status(200).json({ received: true });
});

// --- Other Middleware (AFTER Webhook) ---
app.use(express.json()); // <-- IMPORTANT: For parsing JSON bodies
app.use(express.urlencoded({ extended: true }));

// --- Other Routes ---
app.get('/', (req, res) => {
  res.send('QuickProCV API is live');
});

app.post('/create-checkout-session', async (req, res) => {
    const { email } = req.body;

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
            success_url: `http://localhost:5500/main.html?payment_success=true&email=${encodeURIComponent(email)}`,
            cancel_url: 'http://localhost:5500/main.html?payment_cancelled=true',
            customer_email: email,
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error('❌ Stripe session creation failed:', err.message);
        res.status(500).json({ error: 'Stripe session creation failed.' });
    }
});

// --- AI Generation Route --- // <-- ADDED: THE NEW AI ROUTE
app.post('/api/ai/generate', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    console.log("❌ [AI Generate] Received request with no prompt.");
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  console.log(`[AI Generate] Received prompt, starting call to OpenAI...`);

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-3.5-turbo', // Or 'gpt-4'
    });

    const generatedText = completion.choices[0]?.message?.content?.trim() || 'No result from AI.';
    console.log("✅ [AI Generate] OpenAI call successful. Sending back result.");
    res.json({ result: generatedText });

  } catch (error) {
    console.error('❌ OpenAI API call failed:', error);
    res.status(500).json({ error: 'Failed to generate content from AI.', details: error.message });
  }
}); // <-- ADDED: END OF NEW AI ROUTE

// --- Server Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`🕒 Current time in Limerick: ${new Date().toLocaleTimeString('en-IE', { timeZone: 'Europe/Dublin' })}`);
});