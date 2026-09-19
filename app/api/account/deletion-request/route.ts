import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

export async function POST(){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Please sign in again."},{status:401});
  const {error}=await supabase.from("account_deletion_requests").upsert({user_id:user.id,status:"requested",requested_at:new Date().toISOString()},{onConflict:"user_id"});
  if(error)return NextResponse.json({error:"Your request could not be recorded. Please try again."},{status:500});
  return NextResponse.json({ok:true});
}
