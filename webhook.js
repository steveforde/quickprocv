import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import supabase from './linkedin-server/supabaseClient.js';

dotenv.config({ path: './linkedin-server/.env' });

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ Raw body parser for Stripe signature verification
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ✅ Handle checkout session complete
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_email;

    if (!email) {
      console.error('❌ No customer_email in session');
      return res.status(400).send('Missing customer email');
    }

    console.log('💰 Payment completed for:', email);

    const { error } = await supabase
      .from('users')
      .update({ is_pro: true })
      .eq('email', email.toLowerCase().trim()); // Ensure match

    if (error) {
      console.error('❌ Supabase update failed:', error.message);
      return res.status(500).send('Supabase update failed');
    }

    console.log('✅ User upgraded to Pro:', email);
    return res.status(200).send('Webhook processed');
  }

  // Default: unhandled event
  res.status(200).send('Webhook received');
});

const PORT = process.env.WEBHOOK_PORT || 3003;
app.listen(PORT, () => {
  console.log(`✅ Stripe webhook server running at http://localhost:${PORT}`);
});


