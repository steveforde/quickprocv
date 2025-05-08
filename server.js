import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import Stripe from 'stripe';
import bodyParser from 'body-parser';

dotenv.config({ path: './linkedin-server/.env' });

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Stripe webhook endpoint (if needed — duplicate from webhook.js, can remove if using webhook.js separately)
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('✅ Payment received:', session);
    // Optional: delegate to webhook.js for DB update
  }

  res.status(200).json({ received: true });
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('QuickProCV API is live');
});

// Optional — you may remove this if using checkout.js separately
app.post('/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price: 'price_1RMV5SQRh7jNBCuP5iKOZuuF', // Make sure this is the correct live Price ID
          quantity: 1,
        },
      ],
      success_url: 'http://localhost:5500/success.html',
      cancel_url: 'http://localhost:5500/cancel.html',
      customer_email: 'testuser@example.com',
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Stripe session creation failed:', err);
    res.status(500).json({ error: 'Session creation failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
