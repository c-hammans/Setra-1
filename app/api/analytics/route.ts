import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {sanitizeAnalyticsEvent} from "@/lib/analytics/sanitize";

export async function POST(request:NextRequest){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({stored:false},{status:401});
  try{
    const value=sanitizeAnalyticsEvent(await request.json());
    const {error}=await supabase.from("product_analytics_events").insert({user_id:user.id,client_event_id:value.clientEventId,event_name:value.event,properties:value.properties,occurred_at:value.occurredAt});
    if(error){if(error.code==="23505")return NextResponse.json({stored:true,duplicate:true});throw error}
    return NextResponse.json({stored:true});
  }catch(error){return NextResponse.json({stored:false,error:error instanceof Error?error.message:"Invalid analytics event."},{status:400})}
}
