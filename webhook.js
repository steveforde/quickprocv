// webhook.js
import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

app.post('/webhook', bodyParser.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle checkout session
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('✅ Payment received:', session);
    // TODO: Save to Supabase or mark user as Pro
  }

  res.status(200).json({ received: true });
});

export default app;

