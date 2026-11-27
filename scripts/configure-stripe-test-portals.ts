import {createHash} from "node:crypto";
import Stripe from "stripe";
import {createPriceMap,testSecret,type BillingKind} from "../lib/billing/catalogue.ts";
import {validStripePrice} from "../lib/billing/stripe-state.ts";

async function setup(){
  const key=process.env.STRIPE_SECRET_KEY,map=createPriceMap(process.env);
  if(!testSecret(key)||!map)throw new Error("Add a Stripe test key and all seven unique test Price IDs to .env.local first.");
  const stripe=new Stripe(key!,{timeout:15000,maxNetworkRetries:1});
  const entries=await Promise.all([...map].map(async ([id,offer])=>{
    const price=await stripe.prices.retrieve(id);
    if(!price.active||!validStripePrice(price,offer)||typeof price.product!=="string")throw new Error(`${offer.id} doesn’t match the configured test Price.`);
    return {offer,id,product:price.product};
  }));
  for(const kind of ["individual","coaching"] as BillingKind[]){
    const groups=new Map<string,string[]>();
    for(const item of entries.filter(entry=>entry.offer.kind===kind)){
      if(!groups.has(item.product))groups.set(item.product,[]);
      groups.get(item.product)!.push(item.id);
    }
    const products=[...groups].map(([product,prices])=>({product,prices}));
    const digest=createHash("sha256").update(JSON.stringify(products)).digest("hex");
    const portal=await stripe.billingPortal.configurations.create({
      name:`Setra ${kind} test portal`,business_profile:{headline:"Setra test billing"},
      features:{invoice_history:{enabled:true},payment_method_update:{enabled:true},
        subscription_cancel:{enabled:true,mode:"at_period_end"},
        subscription_update:{enabled:true,default_allowed_updates:["price"],products,proration_behavior:"always_invoice"}}
    },{idempotencyKey:`setra-test-portal-v1:${kind}:${digest}`});
    if(portal.livemode)throw new Error("A non-test object was returned.");
    console.log(`STRIPE_PORTAL_${kind.toUpperCase()}=${portal.id}`);
  }
}
void setup().catch(error=>{console.error(error instanceof Stripe.errors.StripeError?"Stripe rejected portal setup. Verify the test API key, prices and sandbox permissions.":(error as Error).message);process.exitCode=1});
