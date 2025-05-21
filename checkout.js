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


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Checkout server running at http://localhost:${PORT}`);
  console.log(`ℹ️  Frontend success redirect URL configured for: ${FRONTEND_APP_URL}/main.html`);
});