import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

export async function GET(){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Please sign in again."},{status:401});
  const queries=[
    {key:"profile",table:"profiles",select:"*",owner:"id"},
    {key:"custom_exercises",table:"exercises",select:"*",owner:"owner_id"},
    {key:"strength_templates",table:"workout_templates",select:"*,template_exercises(*),template_supersets(*),template_warmup_items(*)",owner:"user_id"},
    {key:"strength_schedule",table:"scheduled_workouts",select:"*",owner:"user_id"},
    {key:"strength_workouts",table:"workouts",select:"*,workout_exercises(*,workout_sets(*)),workout_warmup_items(*)",owner:"user_id"},
    {key:"training_sessions",table:"training_sessions",select:"*,training_session_blocks(*)",owner:"user_id"},
    {key:"endurance_templates",table:"endurance_templates",select:"*,endurance_template_blocks(*)",owner:"user_id"},
    {key:"awards",table:"user_achievements",select:"*",owner:"user_id"},
    {key:"usage_days",table:"user_usage_days",select:"*",owner:"user_id"},
    {key:"training_plan_occurrences",table:"training_plan_occurrences",select:"*",owner:"user_id"},
    {key:"feedback",table:"beta_feedback",select:"*",owner:"user_id"},
    {key:"premium_waitlist",table:"premium_waitlist",select:"*",owner:"user_id"},
    {key:"account_deletion_requests",table:"account_deletion_requests",select:"*",owner:"user_id"},
  ] as const;
  const entries=await Promise.all(queries.map(async query=>{const {data,error}=await supabase.from(query.table).select(query.select).eq(query.owner,user.id);if(error)throw error;return[query.key,data] as const}));
  const body=JSON.stringify({exportedAt:new Date().toISOString(),accountId:user.id,data:Object.fromEntries(entries)},null,2);
  return new NextResponse(body,{headers:{"content-type":"application/json; charset=utf-8","content-disposition":`attachment; filename="setra-data-${new Date().toISOString().slice(0,10)}.json"`,"cache-control":"no-store"}});
}
