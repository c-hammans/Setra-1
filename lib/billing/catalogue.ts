import {PLAN_CATALOGUE} from "../premium/access.ts";

export type BillingKind="individual"|"coaching";
export type BillingCadence="month"|"year";
export const billingOffers=[
  {id:"premium_month",product:"premium",name:PLAN_CATALOGUE.premium.displayName,kind:"individual",cadence:"month",cents:899},
  {id:"premium_year",product:"premium",name:PLAN_CATALOGUE.premium.displayName,kind:"individual",cadence:"year",cents:7999},
  {id:"adaptive_month",product:"adaptive",name:PLAN_CATALOGUE.adaptive.displayName,kind:"individual",cadence:"month",cents:1999},
  {id:"adaptive_year",product:"adaptive",name:PLAN_CATALOGUE.adaptive.displayName,kind:"individual",cadence:"year",cents:17999},
  {id:"coach_starter_month",product:"coach_starter",name:"Coach Starter",kind:"coaching",cadence:"month",cents:2999,seats:5},
  {id:"coach_month",product:"coach",name:"Coach",kind:"coaching",cadence:"month",cents:5999,seats:20},
  {id:"coach_pro_month",product:"coach_pro",name:"Coach Pro",kind:"coaching",cadence:"month",cents:9999,seats:50},
] as const;
export type BillingOffer=(typeof billingOffers)[number];
export const priceEnv=(offer:BillingOffer)=>"STRIPE_PRICE_"+offer.id.toUpperCase();
export const isBillingKind=(value:unknown):value is BillingKind=>value==="individual"||value==="coaching";

export type ProviderSnapshot={
  subscriptionId?:string;product?:BillingOffer["product"];priceId?:string;cadence?:BillingCadence;
  status:string;until?:string;cancelAtEnd?:boolean;seats?:number;checkoutToken?:string;
};
export type BillingPublicState={
  configured:boolean;required:boolean;plan:string;manualPlan:string;
  subscriptions:Partial<Record<BillingKind,{hasCustomer:boolean;product?:BillingOffer["product"];status?:string;cadence?:BillingCadence;until?:string;cancelAtEnd?:boolean;funded?:boolean}>>;
  seats:{limit:number|null;active:number;pending:number};
  clients:{id:string;name:string;funded:boolean}[];
};

export const terminalStatus=(value:string)=>value==="canceled"||value==="incomplete_expired";
export const testSecret=(value?:string)=>!!value&&/^(sk_test_|rk_test_)[A-Za-z0-9]+$/.test(value);
export function createPriceMap(keys:Record<string,string|undefined>){
  const result=new Map<string,BillingOffer>();
  for(const offer of billingOffers){
    const price=keys[priceEnv(offer)];
    if(!price||!/^price_[A-Za-z0-9]+$/.test(price)||result.has(price))return null;
    result.set(price,offer);
  }
  return result;
}
