// webhook.js - FIXED VERSION

import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import express from 'express';
import Stripe from 'stripe';
import supabase from './supabaseClient.js'; 
import sendEmail from './email.js';
import generateHtmlTemplate from './emailTemplates/baseHtml.js';

const app = express();
const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Critical Environment Variable Check
if (!process.env.STRIPE_SECRET_KEY || 
    !webhookSecret || 
    !process.env.SUPABASE_URL || 
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.STRIPE_PRICE_ID_1_YEAR || 
    !process.env.STRIPE_PRICE_ID_2_YEAR) {
    console.error("❌ CRITICAL: Missing one or more essential environment variables for webhook.js. Check Stripe keys, webhook secret, Supabase URL/Service Key, and Price IDs.");
    process.exit(1);
}

// Helper function to activate Pro status
async function activateProUser(email, priceId) {
    console.log(`[WEBHOOK.JS] Activating Pro for: ${email} with price ID: ${priceId}`);
    
    // Determine subscription length based on price ID
    let expiryDate;
    const now = new Date();
    
    if (priceId === process.env.STRIPE_PRICE_ID_1_YEAR) {
        // 1 year subscription
        expiryDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
        console.log('[WEBHOOK.JS] 1-year subscription detected');
    } else if (priceId === process.env.STRIPE_PRICE_ID_2_YEAR) {
        // 2 year subscription  
        expiryDate = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
        console.log('[WEBHOOK.JS] 2-year subscription detected');
    } else {
        // Default to 1 year if price ID not recognized
        expiryDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
        console.log('[WEBHOOK.JS] Unknown price ID, defaulting to 1-year subscription');
    }
    
    console.log(`[WEBHOOK.JS] Setting expiry date to: ${expiryDate.toISOString()}`);
    
    try {
        // Update user Pro status in database
        const { data, error } = await supabase
            .from('users')
            .update({ 
                is_pro: true, 
                pro_expiry: expiryDate.toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('email', email);
            
        if (error) {
            console.error('[WEBHOOK.JS] Database update error:', error);
            throw error;
        }
        
        console.log(`✅ [WEBHOOK.JS] Pro status activated for ${email} until ${expiryDate.toISOString()}`);
        
        // Send confirmation email
        try {
            const emailHtml = generateHtmlTemplate({
                userName: email.split('@')[0],
                subscriptionType: priceId === process.env.STRIPE_PRICE_ID_2_YEAR ? '2-Year Pro' : '1-Year Pro',
                expiryDate: expiryDate.toLocaleDateString(),
                loginUrl: 'http://localhost:5500/main.html'
            });
            
            await sendEmail(
                email,
                'Welcome to QuickProCV Pro! 🎉',
                emailHtml
            );
            
            console.log(`✅ [WEBHOOK.JS] Confirmation email sent to ${email}`);
        } catch (emailError) {
            console.error('[WEBHOOK.JS] Email sending error:', emailError);
            // Don't fail the whole process if email fails
        }
        
        return true;
    } catch (error) {
        console.error('[WEBHOOK.JS] Error activating Pro status:', error);
        return false;
    }
}

// Middleware for raw body (required for Stripe webhook signature verification)
app.use('/webhook', express.raw({ type: 'application/json' }));

// Webhook endpoint
app.post('/webhook', async (req, res) => {
    console.log('--- [WEBHOOK.JS] /webhook route HIT ---');
    
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripeInstance.webhooks.constructEvent(req.body, sig, webhookSecret);
        console.log(`✅ [WEBHOOK.JS] Stripe signature verified. Event ID: ${event.id} Type: ${event.type}`);
    } catch (err) {
        console.error(`❌ [WEBHOOK.JS] Webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log('[WEBHOOK.JS] Processing checkout.session.completed');
        console.log(`[WEBHOOK.JS] Customer email: ${session.customer_details?.email}`);
        console.log(`[WEBHOOK.JS] Session ID: ${session.id}`);
        
        if (session.customer_details?.email) {
            // Get the price ID from line items
            try {
                const lineItems = await stripeInstance.checkout.sessions.listLineItems(session.id);
                const priceId = lineItems.data[0]?.price?.id;
                
                console.log(`[WEBHOOK.JS] Price ID from session: ${priceId}`);
                
                const success = await activateProUser(session.customer_details.email, priceId);
                
                if (success) {
                    console.log(`✅ [WEBHOOK.JS] Successfully processed checkout for ${session.customer_details.email}`);
                } else {
                    console.error(`❌ [WEBHOOK.JS] Failed to process checkout for ${session.customer_details.email}`);
                }
            } catch (error) {
                console.error('[WEBHOOK.JS] Error processing checkout session:', error);
            }
        } else {
            console.error('[WEBHOOK.JS] No customer email found in session');
        }
        
    } else if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        console.log('[WEBHOOK.JS] Processing payment_intent.succeeded');
        console.log(`[WEBHOOK.JS] Payment Intent ID: ${paymentIntent.id}`);
        
        // Try to get customer email from payment intent
        if (paymentIntent.receipt_email) {
            console.log(`[WEBHOOK.JS] Found receipt email: ${paymentIntent.receipt_email}`);
            
            // For payment_intent, we might not have the price ID directly
            // You could store it in metadata when creating the payment intent
            const priceId = paymentIntent.metadata?.price_id || process.env.STRIPE_PRICE_ID_1_YEAR;
            
            const success = await activateProUser(paymentIntent.receipt_email, priceId);
            
            if (success) {
                console.log(`✅ [WEBHOOK.JS] Successfully processed payment intent for ${paymentIntent.receipt_email}`);
            } else {
                console.error(`❌ [WEBHOOK.JS] Failed to process payment intent for ${paymentIntent.receipt_email}`);
            }
        } else {
            console.log('[WEBHOOK.JS] No receipt email found in payment intent');
        }
        
    } else if (event.type === 'charge.updated') {
        console.log('[WEBHOOK.JS] Received charge.updated - monitoring for payment completion');
        const charge = event.data.object;
        
        if (charge.status === 'succeeded' && charge.receipt_email) {
            console.log(`[WEBHOOK.JS] Charge succeeded for: ${charge.receipt_email}`);
            
            // Backup activation method using charge data
            const priceId = charge.metadata?.price_id || process.env.STRIPE_PRICE_ID_1_YEAR;
            const success = await activateProUser(charge.receipt_email, priceId);
            
            if (success) {
                console.log(`✅ [WEBHOOK.JS] Successfully processed charge for ${charge.receipt_email}`);
            }
        }
        
    } else {
        console.log(`[WEBHOOK.JS] Received unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
});

const PORT = process.env.WEBHOOK_PORT || 3003;
app.listen(PORT, () => {
    console.log(`✅ Stripe webhook server (webhook.js) running at http://localhost:${PORT}`);
});