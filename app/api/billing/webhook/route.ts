import {NextResponse} from "next/server";
import type Stripe from "stripe";
import {isBillingKind} from "@/lib/billing/catalogue";
import {listCustomerSubscriptions,stripeTestConfig} from "@/lib/billing/stripe-server";
import {stripeEventCustomer,stripeSnapshot,verifiedStripeEvent} from "@/lib/billing/stripe-state";
import {createAdminClient} from "@/lib/supabase/admin";

export const runtime="nodejs";
export const maxDuration=60;

export async function POST(request:Request){
  const config=stripeTestConfig();
  if(!config)return NextResponse.json({error:"Test billing not configured"},{status:503});
  const signature=request.headers.get("stripe-signature");
  if(!signature||Number(request.headers.get("content-length")??0)>1_000_000)return NextResponse.json({error:"Invalid webhook"},{status:400});
  let event:Stripe.Event;
  try{
    const raw=await request.text();
    if(raw.length>1_000_000)throw new Error("Webhook too large");
    event=verifiedStripeEvent(config.stripe,raw,signature,config.webhook);
  }catch{return NextResponse.json({error:"Invalid webhook signature"},{status:400})}
  const customer=stripeEventCustomer(event);
  if(!customer)return NextResponse.json({ignored:true});
  let lease:{account:string;token:string}|null=null;
  try{
    const admin=createAdminClient();
    const row=await admin.from("billing_accounts").select("id,kind").eq("provider","stripe_test").eq("customer_id",customer).maybeSingle();
    if(row.error)throw row.error;
    if(!row.data||!isBillingKind(row.data.kind))return NextResponse.json({ignored:true});
    const claimed=await admin.rpc("claim_billing_event",{p_account:row.data.id,p_event:event.id});
    if(claimed.error)throw claimed.error;
    if(claimed.data.duplicate)return NextResponse.json({duplicate:true});
    if(claimed.data.busy)return NextResponse.json({error:"Billing sync in progress"},{status:503});
    lease={account:row.data.id,token:claimed.data.token};
    const current=await listCustomerSubscriptions(config.stripe,customer);
    if(!current.length&&event.type.startsWith("customer.subscription.")&&event.type!=="customer.subscription.deleted")throw new Error("Subscription is not yet available");
    const snapshot=stripeSnapshot(current,row.data.kind,config.prices)??(event.type==="customer.subscription.deleted"?{status:"canceled"}:null);
    const done=await admin.rpc("commit_billing_event",{p_account:lease.account,p_token:lease.token,p_event:event.id,p_type:event.type,
      p_event_at:new Date(event.created*1000).toISOString(),p_snapshot:snapshot});
    if(done.error)throw done.error;
    return NextResponse.json({received:true});
  }catch{
    if(lease)try{
      await createAdminClient().from("billing_accounts").update({sync_token:null,sync_until:null}).eq("id",lease.account).eq("sync_token",lease.token);
    }catch{/* The lease expires if the store is unreachable. */}
    return NextResponse.json({error:"Billing reconciliation could not be completed"},{status:503});
  }
}
