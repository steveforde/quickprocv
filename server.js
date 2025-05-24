// server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import Stripe from 'stripe';
import bodyParser from 'body-parser';
import sendEmail from './linkedin-server/email.js';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai'; // ✅ Corrected OpenAI import for ESM

dotenv.config({ path: './linkedin-server/.env' });

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('CRITICAL ERROR: Supabase URL or Service Role Key is missing in .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

app.use(cors());


app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Webhook verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const eventJson = JSON.parse(req.body.toString());

  if (event.type === 'checkout.session.completed') {
    const session = eventJson.data.object;
    const email = session.customer_details ? session.customer_details.email : null;

    if (!email) {
      console.error('❌ Webhook received, but no customer email found in session.');
      return res.status(400).send('No customer email found.');
    }

    console.log('✅ Payment complete for:', email);

    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 2);

    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          is_pro: true,
          pro_expiry: expiryDate.toISOString()
        })
        .eq('email', email.toLowerCase().trim());

      if (error) {
        console.error(`❌ [Stripe Webhook] Supabase update error for ${email}:`, error.message);
        return res.status(500).send('Database update failed.');
      }

      await sendEmail(
        email,
        'QuickProCV Pro Access (2 Years)',
        'Thanks for purchasing Pro! You now have access for 2 years.',
        `<p>Hi there,</p><p>Thanks for upgrading to <strong>Pro</strong>! 🎉<br>You now have full access to <a href="https://quickprocv.com">QuickProCV</a> for 2 years.</p>`
      );
      console.log('📧 Email sent to:', email);
    } catch (err) {
      console.error('❌ Email or Supabase update error:', err.message);
    }
  } else {
    console.log(`ℹ️ [Stripe Webhook] Unhandled event type ${event.type}`);
  }

  res.status(200).json({ received: true });
});

app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/ai/generate', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required and must be a string.' });
  }

  try {
    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }]
    });

    const result = chatResponse.choices[0]?.message?.content?.trim() || '';
    res.json({ result });
  } catch (err) {
    console.error('❌ AI generation failed:', err.message);
    res.status(500).json({ error: 'AI generation failed.' });
  }
});

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
          price: 'price_1RMV5SQRh7jNBCuP5iKOZuuF',
          quantity: 1,
        },
      ],
      success_url: `http://localhost:5500/main.html?payment_success=true&email=${encodeURIComponent(req.body.email)}`,
      cancel_url: 'http://localhost:5500/main.html?payment_cancelled=true',
      customer_email: req.body.email,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Stripe session failed:', err);
    res.status(500).json({ error: 'Stripe session failed' });
  }
});

app.post('/api/save-letter', async (req, res) => {
  const { user_email, job_title, company, job_description, content } = req.body;

  if (!user_email || !content) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const { error } = await supabase.from('cover_letters').insert([
      {
        user_email: user_email.toLowerCase().trim(),
        job_title,
        company,
        job_description,
        content,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error('❌ Supabase insert error:', error.message);
      return res.status(500).json({ error: 'Failed to save letter.' });
    }

    console.log(`✅ Cover letter saved for ${user_email}`);
    res.status(200).json({ message: 'Letter saved successfully.' });
  } catch (err) {
    console.error('❌ Save letter error:', err.message);
    res.status(500).json({ error: 'Unexpected server error.' });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
