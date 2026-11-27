import type Stripe from "stripe";
import {terminalStatus,type BillingKind,type BillingOffer,type ProviderSnapshot} from "./catalogue.ts";

export function validStripePrice(price:Stripe.Price,offer:BillingOffer){
  return !price.livemode&&price.currency==="aud"&&price.type==="recurring"&&price.billing_scheme==="per_unit"
    &&price.unit_amount===offer.cents&&price.recurring?.interval===offer.cadence&&price.recurring.interval_count===1&&price.recurring.usage_type==="licensed";
}

// Never feed an event's embedded subscription into entitlement decisions.
export function stripeSnapshot(subscriptions:Stripe.Subscription[],kind:BillingKind,priceMap:Map<string,BillingOffer>):ProviderSnapshot|null{
  const open=subscriptions.filter(item=>!terminalStatus(item.status));
  if(open.length>1)return {status:"conflict"};
  const sub=open[0]??[...subscriptions].sort((a,b)=>b.created-a.created)[0];
  if(!sub)return null;
  const item=sub.items.data[0], price=item?.price, offer=price&&priceMap.get(price.id);
  if(sub.livemode||sub.items.has_more||sub.items.data.length!==1||item.quantity!==1||!offer||offer.kind!==kind||!validStripePrice(price,offer))
    return {subscriptionId:sub.id,status:"unmapped"};
  const invoice=sub.latest_invoice;
  if(sub.status==="active"&&typeof invoice==="string")throw new Error("Expanded Stripe invoice is required");
  const status=sub.pause_collection?"paused":sub.status==="active"&&(!invoice||typeof invoice==="string"||invoice.livemode||invoice.status!=="paid")?"pending_payment":sub.status;
  const until=Math.min(item.current_period_end,sub.cancel_at??Infinity);
  return {subscriptionId:sub.id,product:offer.product,priceId:price.id,cadence:offer.cadence,status,
    until:Number.isFinite(until)?new Date(until*1000).toISOString():undefined,
    cancelAtEnd:sub.cancel_at_period_end||sub.cancel_at!=null,
    seats:"seats" in offer?offer.seats:undefined,checkoutToken:sub.metadata?.setra_checkout_token};
}

export const subscriptionEvents=new Set([
  "checkout.session.completed","checkout.session.async_payment_succeeded","checkout.session.async_payment_failed",
  "customer.subscription.created","customer.subscription.updated","customer.subscription.deleted","customer.subscription.paused","customer.subscription.resumed",
  "invoice.paid","invoice.payment_failed","invoice.payment_action_required",
]);
export function verifiedStripeEvent(stripe:Stripe,raw:string,signature:string,secret:string){
  const event=stripe.webhooks.constructEvent(raw,signature,secret);
  if(event.livemode)throw new Error("Live events are not supported");
  return event;
}

export function stripeEventCustomer(event:Stripe.Event){
  if(event.livemode||!subscriptionEvents.has(event.type))return null;
  const obj=event.data.object as {customer?:string|{id:string};mode?:string;livemode?:boolean};
  if(obj.livemode||event.type.startsWith("checkout.")&&obj.mode!=="subscription")return null;
  const id=typeof obj.customer==="string"?obj.customer:obj.customer?.id;
  return id&&/^cus_[A-Za-z0-9]+$/.test(id)?id:null;
}
