import "server-only";
import Stripe from "stripe";
import {createPriceMap,testSecret,type BillingKind} from "./catalogue";
import {terminalStatus} from "./catalogue";
import {validStripePrice} from "./stripe-state";

export function stripeTestConfig(){
  const key=process.env.STRIPE_SECRET_KEY,webhook=process.env.STRIPE_WEBHOOK_SECRET;
  const prices=createPriceMap(process.env);
  const portals={individual:process.env.STRIPE_PORTAL_INDIVIDUAL,coaching:process.env.STRIPE_PORTAL_COACHING};
  let origin="";
  try {
    const url=new URL(process.env.SETRA_BILLING_ORIGIN??"");
    if(url.protocol==="https:"||url.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(url.hostname))origin=url.origin;
  } catch { /* Billing is optional. */ }
  if(!testSecret(key)||!webhook||!/^whsec_[A-Za-z0-9]+$/.test(webhook)||!prices||!origin
    ||!portals.individual?.match(/^bpc_[A-Za-z0-9]+$/)||!portals.coaching?.match(/^bpc_[A-Za-z0-9]+$/)||portals.coaching===portals.individual)return null;
  return {stripe:new Stripe(key!,{timeout:9000,maxNetworkRetries:1}),webhook,prices,origin,portals:portals as Record<BillingKind,string>};
}
export type StripeTestConfig=NonNullable<ReturnType<typeof stripeTestConfig>>;

export async function listCustomerSubscriptions(stripe:Stripe,customer:string){
  const result=await stripe.subscriptions.list({customer,status:"all",limit:100,expand:["data.latest_invoice"]});
  if(result.has_more||result.data.some(item=>item.livemode))throw new Error("Unexpected Stripe subscription history");
  return result.data;
}
export const hasOpenSubscription=(subscriptions:Stripe.Subscription[])=>subscriptions.some(item=>!terminalStatus(item.status));

export async function checkPortal(config:StripeTestConfig,kind:BillingKind){
  const portal=await config.stripe.billingPortal.configurations.retrieve(config.portals[kind],{
    expand:["features.subscription_update.products"]
  });
  const features=portal.features, updates=features.subscription_update;
  const expected=[...config.prices].filter(([,offer])=>offer.kind===kind);
  const allowed=(updates.products??[]).flatMap(item=>item.prices.map(price=>[price,item.product] as const));
  if(portal.livemode||!portal.active||!features.invoice_history.enabled||!features.payment_method_update.enabled
    ||!features.subscription_cancel.enabled||features.subscription_cancel.mode!=="at_period_end"
    ||!updates.enabled||updates.default_allowed_updates.length!==1||updates.default_allowed_updates[0]!=="price"
    ||allowed.length!==expected.length||new Set(allowed.map(([id])=>id)).size!==expected.length
    ||allowed.some(([id])=>config.prices.get(id)?.kind!==kind))throw new Error("Unexpected portal configuration");
  await Promise.all(expected.map(async ([id,offer])=>{
    const price=await config.stripe.prices.retrieve(id);
    if(!validStripePrice(price,offer)||!price.active||price.product!==allowed.find(([priceId])=>priceId===id)?.[1])
      throw new Error("Unexpected Stripe price");
  }));
}
