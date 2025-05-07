import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import Stripe from 'stripe';
import bodyParser from 'body-parser';

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Stripe requires raw body for signature verification
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event type
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('✅ Payment received:', session);
    // Add your DB logic or confirmation logic here
  }

  res.status(200).json({ received: true });
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('QuickProCV webhook is live');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});

