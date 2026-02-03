import { getUncachableStripeClient } from '../server/stripeClient';

async function seedProducts() {
  console.log('[Stripe] Seeding OpenBento Pro products...');
  
  const stripe = await getUncachableStripeClient();

  // Check if product already exists
  const existingProducts = await stripe.products.search({ 
    query: "name:'OpenBento Pro'" 
  });

  if (existingProducts.data.length > 0) {
    console.log('[Stripe] OpenBento Pro product already exists');
    const product = existingProducts.data[0];
    
    // List existing prices
    const prices = await stripe.prices.list({ product: product.id, active: true });
    console.log('[Stripe] Existing prices:');
    for (const price of prices.data) {
      console.log(`  - ${price.id}: $${(price.unit_amount || 0) / 100}/${price.recurring?.interval}`);
    }
    return;
  }

  // Create OpenBento Pro product
  const product = await stripe.products.create({
    name: 'OpenBento Pro',
    description: 'Premium features for OpenBento Dashboard - unlimited widgets, custom backgrounds, and priority support.',
    metadata: {
      tier: 'pro',
      features: 'unlimited_widgets,custom_backgrounds,priority_support',
    }
  });

  console.log(`[Stripe] Created product: ${product.id}`);

  // Create Monthly Price - $8/month
  const monthlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 800, // $8.00 in cents
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: {
      billing_period: 'monthly',
    }
  });

  console.log(`[Stripe] Created monthly price: ${monthlyPrice.id} ($8/month)`);

  // Create Yearly Price - $80/year (16% discount)
  const yearlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 8000, // $80.00 in cents
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: {
      billing_period: 'yearly',
      discount: '16%',
    }
  });

  console.log(`[Stripe] Created yearly price: ${yearlyPrice.id} ($80/year)`);

  console.log('\n[Stripe] Seeding complete!');
  console.log('Product ID:', product.id);
  console.log('Monthly Price ID:', monthlyPrice.id);
  console.log('Yearly Price ID:', yearlyPrice.id);
}

seedProducts().catch(console.error);
