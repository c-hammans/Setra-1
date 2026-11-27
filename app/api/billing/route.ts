import {NextResponse} from "next/server";
import {billingOffers,isBillingKind,type BillingKind} from "@/lib/billing/catalogue";
import {checkPortal,hasOpenSubscription,listCustomerSubscriptions,stripeTestConfig} from "@/lib/billing/stripe-server";
import {validStripePrice} from "@/lib/billing/stripe-state";
import {createAdminClient} from "@/lib/supabase/admin";
import {createClient} from "@/lib/supabase/server";

const fail=(error:string,status=400)=>NextResponse.json({error},{status});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const back=(kind:BillingKind)=>kind==="coaching"?"/coaching":"/premium";
export const maxDuration=60;

export async function GET(){
  const auth=await createClient(),{data:{user}}=await auth.auth.getUser();
  if(!user)return fail("Please sign in to view billing.",401);
  const result=await auth.rpc("my_billing_summary");
  if(result.error){
    if(result.error.code==="PGRST202"||result.error.code==="42883")return NextResponse.json({configured:false,required:false,subscriptions:{},clients:[],seats:{limit:null,active:0,pending:0}});
    return fail("Billing information is unavailable.",503);
  }
  return NextResponse.json({...result.data,configured:Boolean(stripeTestConfig())},{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:Request){
  const auth=await createClient(),{data:{user}}=await auth.auth.getUser();
  if(!user)return fail("Please sign in first.",401);
  if(!request.headers.get("content-type")?.startsWith("application/json"))return fail("This action requires a billing request.",415);
  if(Number(request.headers.get("content-length")??0)>6000)return fail("Invalid billing request.",413);
  const body=await request.json().catch(()=>null);
  if(!body||typeof body!=="object")return fail("Choose a billing action.");
  const origin=request.headers.get("origin");
  if(body.action==="fund"){
    if(origin&&origin!==new URL(request.url).origin&&origin!==stripeTestConfig()?.origin)return fail("Open Setra to manage funding.",403);
    if(typeof body.relationship!=="string"||!uuid.test(body.relationship)||typeof body.enabled!=="boolean")return fail("Choose an active client.");
    const updated=await auth.rpc("set_coach_funded_access",{p_relationship:body.relationship,p_enabled:body.enabled});
    if(updated.error)return fail("Funding requires an active coaching plan within capacity and a client you coach.",409);
    return NextResponse.json({ok:true});
  }
  const config=stripeTestConfig();
  if(!config)return fail("Stripe test billing isn’t configured. Your training access is unchanged.",503);
  if(origin&&origin!==config.origin)return fail("Open the configured Setra website to manage billing.",403);
  const kind=body.kind as BillingKind;
  if(!isBillingKind(kind)||!["checkout","portal"].includes(body.action))return fail("Choose an individual or coaching subscription.");
  try{
    const admin=createAdminClient(),{stripe}=config;
    const offer=billingOffers.find(item=>item.id===body.offer&&item.kind===kind);
    if(body.action==="checkout"){
      if(!offer)return fail("Choose an available Setra plan.");
      const created=await admin.from("billing_accounts").upsert({user_id:user.id,provider:"stripe_test",kind},{onConflict:"user_id,provider,kind",ignoreDuplicates:true});
      if(created.error)throw created.error;
    }
    const row=await admin.from("billing_accounts").select("id,customer_id").eq("user_id",user.id).eq("kind",kind).eq("provider","stripe_test").maybeSingle();
    if(row.error)throw row.error;
    if(!row.data)return fail("You don’t have a billing account for this subscription yet.",409);
    let customer=row.data.customer_id as string|null;
    if(body.action==="portal"){
      if(!customer)return fail("There’s no Stripe billing history for this subscription yet.",409);
      await checkPortal(config,kind);
      const hosted=await stripe.billingPortal.sessions.create({customer,configuration:config.portals[kind],return_url:config.origin+back(kind)+"?billing=return"});
      if(hosted.livemode||!hosted.url)return fail("The test billing portal isn’t available.",503);
      return NextResponse.json({url:hosted.url});
    }
    const priceId=[...config.prices].find(([,entry])=>entry.id===offer!.id)![0];
    const price=await stripe.prices.retrieve(priceId);
    if(!price.active||!validStripePrice(price,offer!))return fail("This test price doesn’t match the Setra catalogue.",503);
    if(!customer){
      const created=await stripe.customers.create({metadata:{setra_billing_account:row.data.id,setra_kind:kind}},{idempotencyKey:"setra-test-customer:"+row.data.id});
      if(created.livemode)throw new Error("Live Stripe object refused");
      const updated=await admin.from("billing_accounts").update({customer_id:created.id}).eq("id",row.data.id).is("customer_id",null).select("customer_id").maybeSingle();
      if(updated.error)throw updated.error;
      if(updated.data)customer=updated.data.customer_id;
      else {
        const saved=await admin.from("billing_accounts").select("customer_id").eq("id",row.data.id).single();
        if(saved.error||saved.data.customer_id!==created.id)throw new Error("Stripe customer ownership changed");
        customer=saved.data.customer_id;
      }
    }
    if(!customer)throw new Error("Customer missing");
    if(hasOpenSubscription(await listCustomerSubscriptions(stripe,customer)))
      return fail("A subscription already exists. Use Manage subscription to change it or fix a payment.",409);
    const reservation=await admin.rpc("reserve_billing_checkout",{p_account:row.data.id,p_price:price.id});
    if(reservation.error){
      if(reservation.error.code==="P0602")return fail(reservation.error.message,409);
      throw reservation.error;
    }
    const hosted=await stripe.checkout.sessions.create({customer,mode:"subscription",allowed_payment_method_types:["card"],managed_payments:{enabled:false},adaptive_pricing:{enabled:false},line_items:[{price:price.id,quantity:1}],
      expires_at:Math.floor(Date.parse(reservation.data.expires)/1000),
      success_url:config.origin+back(kind)+"?billing=return",
      cancel_url:config.origin+back(kind)+"?billing=cancel",
      subscription_data:{metadata:{setra_billing_account:row.data.id,setra_kind:kind,setra_checkout_token:reservation.data.token}}},{idempotencyKey:"setra-test-checkout:"+reservation.data.token});
    if(hosted.livemode||hosted.status!=="open"||!hosted.url)return fail("This checkout is no longer open. Refresh your billing status.",409);
    return NextResponse.json({url:hosted.url});
  }catch{
    return fail("Stripe test billing couldn’t open. Check the test configuration or try again.",503);
  }
}
