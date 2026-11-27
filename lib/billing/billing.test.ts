import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import {billingOffers,createPriceMap,priceEnv,testSecret} from "./catalogue.ts";
import {stripeEventCustomer,stripeSnapshot,verifiedStripeEvent} from "./stripe-state.ts";

const keys=Object.fromEntries(billingOffers.map((offer,i)=>[priceEnv(offer),"price_Test"+i]));
const map=createPriceMap(keys)!;
const stripe=new Stripe("sk_test_Example",{maxNetworkRetries:0});

function subscription(product:typeof billingOffers[number],extra:Partial<Stripe.Subscription>={}){
  const id=keys[priceEnv(product)];
  return {id:"sub_Example",status:"active",created:1,livemode:false,pause_collection:null,cancel_at:null,cancel_at_period_end:false,
    latest_invoice:{status:"paid",livemode:false},items:{has_more:false,data:[{quantity:1,current_period_end:2_000_000_000,price:{
      id,type:"recurring",currency:"aud",livemode:false,active:true,billing_scheme:"per_unit",unit_amount:product.cents,
      recurring:{interval:product.cadence,interval_count:1,usage_type:"licensed"}
    }}]},...extra} as Stripe.Subscription;
}

test("test mode requires a full unique allowlist and rejects live or missing keys",()=>{
  assert.equal(testSecret(undefined),false);assert.equal(testSecret("sk_live_Real"),false);
  assert.equal(testSecret("sk_test_Fixture"),true);assert.equal(createPriceMap({}),null);
  assert.equal(createPriceMap({...keys,[priceEnv(billingOffers[1])]:keys[priceEnv(billingOffers[0])]}),null);
  assert.equal(map.size,7);
});

test("monthly and annual individual plan transitions preserve scope",()=>{
  for(const offer of billingOffers.filter(item=>item.kind==="individual")){
    const state=stripeSnapshot([subscription(offer)],"individual",map)!;
    assert.equal(state.product,offer.product);assert.equal(state.cadence,offer.cadence);assert.equal(state.status,"active");
    assert.equal(stripeSnapshot([subscription(offer)],"coaching",map)?.status,"unmapped");
  }
  const coach=billingOffers[4];
  assert.equal(stripeSnapshot([subscription(coach)],"coaching",map)?.seats,5);
  assert.equal(stripeSnapshot([subscription(coach)],"individual",map)?.status,"unmapped");
});

test("unpaid, paused, cancel-at-end and canceled Stripe states are represented",()=>{
  const offer=billingOffers[0];
  const periodEnd=stripeSnapshot([subscription(offer,{cancel_at_period_end:true})],"individual",map)!;
  assert.ok(periodEnd.cancelAtEnd&&periodEnd.until);assert.equal(periodEnd.status,"active");
  assert.equal(stripeSnapshot([subscription(offer,{status:"past_due"})],"individual",map)?.status,"past_due");
  assert.equal(stripeSnapshot([subscription(offer,{latest_invoice:{status:"open",livemode:false} as Stripe.Invoice})],"individual",map)?.status,"pending_payment");
  assert.equal(stripeSnapshot([subscription(offer,{status:"canceled"})],"individual",map)?.status,"canceled");
  assert.equal(stripeSnapshot([subscription(offer,{pause_collection:{behavior:"void",resumes_at:null}})],"individual",map)?.status,"paused");
});

test("authoritative state uses the current open subscription and blocks duplicates",()=>{
  const older=subscription(billingOffers[0],{status:"canceled",id:"sub_Old",created:1});
  const replacement=subscription(billingOffers[3],{id:"sub_New",created:2});
  const latest=stripeSnapshot([older,replacement],"individual",map)!;
  assert.equal(latest.product,"adaptive");assert.equal(latest.subscriptionId,"sub_New");
  assert.equal(stripeSnapshot([{...older,status:"active"},replacement],"individual",map)?.status,"conflict");
  assert.equal(stripeSnapshot([{...replacement,livemode:true}],"individual",map)?.status,"unmapped");
});

test("Stripe signature validation rejects tampering, invalid signatures and live events",()=>{
  const fixture={id:"evt_Test",type:"invoice.paid",created:Math.floor(Date.now()/1000),livemode:false,data:{object:{customer:"cus_Test"}}};
  const secret="whsec_FixtureOnly",payload=JSON.stringify(fixture);
  const header=stripe.webhooks.generateTestHeaderString({payload,secret});
  assert.equal(stripeEventCustomer(verifiedStripeEvent(stripe,payload,header,secret)),"cus_Test");
  assert.throws(()=>verifiedStripeEvent(stripe,payload,header,"whsec_Wrong"));
  assert.throws(()=>verifiedStripeEvent(stripe,payload.replace("cus_Test","cus_Other"),header,secret));
  const live=JSON.stringify({...fixture,livemode:true});
  assert.throws(()=>verifiedStripeEvent(stripe,live,stripe.webhooks.generateTestHeaderString({payload:live,secret}),secret),/Live/);
});
