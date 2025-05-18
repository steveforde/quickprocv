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


app.post('/create-checkout-session', async (req, res) => {
  try {
    const { email } = req.body; // ✅ Extract from the frontend POST

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email provided.' });
    }

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
      success_url: `http://localhost:3001/success.html?email=${encodeURIComponent(email)}`,
      cancel_url: `http://localhost:3001/main.html`,
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


