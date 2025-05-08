// checkout.js
import express from 'express';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import cors from 'cors';

dotenv.config({ path: './linkedin-server/.env' });

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

// 🔁 Replace this later with dynamic email from logged-in user
const DUMMY_EMAIL = 'testuser@example.com';

app.post('/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price: 'price_1RMV5SQRh7jNBCuP5iKOZuuF', // ✅ Your actual Stripe Price ID
          quantity: 1,
        },
      ],
      success_url: 'http://localhost:5500/success.html',
      cancel_url: 'http://localhost:5500/cancel.html',
      customer_email: DUMMY_EMAIL, // ✅ This gets sent to the webhook
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Session creation failed:', err.message);
    res.status(500).json({ error: 'Stripe session creation failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Checkout server running at http://localhost:${PORT}`);
});


