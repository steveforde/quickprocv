import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import Stripe from 'stripe';
import bodyParser from 'body-parser';
import sendEmail from './linkedin-server/email.js'; // ✅ Email module

dotenv.config({ path: './linkedin-server/.env' });

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

app.use(cors());
app.use(express.json());

// Stripe webhook endpoint (raw body required!)
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Webhook verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_email;

    console.log('✅ Payment complete for:', email);

    try {
      await sendEmail(
        email,
        'QuickProCV Pro Access (2 Years)',
        'Thanks for purchasing Pro! You now have access for 2 years.',
        `<p>Hi there,</p><p>Thanks for upgrading to <strong>Pro</strong>! 🎉<br>You now have full access to <a href="https://quickprocv.com">QuickProCV</a> for 2 years.</p>`
      );
      console.log('📧 Email sent to:', email);
    } catch (err) {
      console.error('❌ Email error:', err.message);
    }
  }

  res.status(200).json({ received: true });
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
          price: 'price_1RMV5SQRh7jNBCuP5iKOZuuF', // 🔁 Replace with your real Price ID
          quantity: 1,
        },
      ],
      success_url: 'http://localhost:5500/success.html',
      cancel_url: 'http://localhost:5500/cancel.html',
      customer_email: req.body.email,
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
