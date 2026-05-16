import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@14';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, stripe-signature",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!stripeSecretKey || !stripeWebhookSecret || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      throw new Error('Missing stripe-signature header');
    }

    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);

    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(supabase, invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(supabase, invoice);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(supabase, subscription);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

async function handlePaymentSucceeded(supabase: any, invoice: any) {
  const subscriptionId = invoice.subscription;

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, successful_payments_count, plan_id, plans(required_successful_payments)')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!subscription) {
    console.error('Subscription not found');
    return;
  }

  await supabase
    .from('payments')
    .insert({
      subscription_id: subscription.id,
      stripe_payment_id: invoice.payment_intent,
      amount: invoice.amount_paid,
      status: 'succeeded',
      attempt_number: 1,
      paid_at: new Date().toISOString(),
    });

  const newCount = subscription.successful_payments_count + 1;
  const isEligible = newCount >= subscription.plans.required_successful_payments;

  await supabase
    .from('subscriptions')
    .update({
      successful_payments_count: newCount,
      is_eligible: isEligible,
      failed_payment_attempts: 0,
      status: 'active',
      frozen_at: null,
    })
    .eq('id', subscription.id);
}

async function handlePaymentFailed(supabase: any, invoice: any) {
  const subscriptionId = invoice.subscription;
  const attemptNumber = invoice.attempt_count || 1;

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, failed_payment_attempts')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!subscription) {
    console.error('Subscription not found');
    return;
  }

  await supabase
    .from('payments')
    .insert({
      subscription_id: subscription.id,
      stripe_payment_id: invoice.payment_intent,
      amount: invoice.amount_due,
      status: 'failed',
      attempt_number: attemptNumber,
      failure_reason: invoice.last_finalization_error?.message || 'Payment failed',
    });

  const newFailedAttempts = subscription.failed_payment_attempts + 1;

  if (newFailedAttempts >= 3) {
    await supabase
      .from('subscriptions')
      .update({
        failed_payment_attempts: newFailedAttempts,
        status: 'frozen',
        frozen_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);
  } else {
    await supabase
      .from('subscriptions')
      .update({
        failed_payment_attempts: newFailedAttempts,
      })
      .eq('id', subscription.id);
  }
}

async function handleSubscriptionCanceled(supabase: any, subscription: any) {
  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);
}
