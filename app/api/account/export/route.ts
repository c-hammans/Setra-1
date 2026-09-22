import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {paginateExportRows,type ExportRow} from "@/lib/data/export-pagination";

const tables=[
  {key:"profile",table:"profiles",owner:"id"},{key:"custom_exercises",table:"exercises",owner:"owner_id"},
  {key:"strength_templates",table:"workout_templates",owner:"user_id"},{key:"strength_template_exercises",table:"template_exercises",owner:"user_id"},{key:"strength_template_supersets",table:"template_supersets",owner:"user_id"},{key:"strength_template_warmups",table:"template_warmup_items",owner:"user_id"},
  {key:"strength_schedule",table:"scheduled_workouts",owner:"user_id"},{key:"strength_workouts",table:"workouts",owner:"user_id"},{key:"strength_workout_exercises",table:"workout_exercises",owner:"user_id"},{key:"strength_workout_sets",table:"workout_sets",owner:"user_id"},{key:"strength_workout_warmups",table:"workout_warmup_items",owner:"user_id"},
  {key:"training_sessions",table:"training_sessions",owner:"user_id"},{key:"training_session_blocks",table:"training_session_blocks",owner:"user_id"},{key:"endurance_templates",table:"endurance_templates",owner:"user_id"},{key:"endurance_template_blocks",table:"endurance_template_blocks",owner:"user_id"},
  {key:"awards",table:"user_achievements",owner:"user_id"},{key:"usage_days",table:"user_usage_days",owner:"user_id"},{key:"training_plan_occurrences",table:"training_plan_occurrences",owner:"user_id"},{key:"feedback",table:"beta_feedback",owner:"user_id"},{key:"premium_waitlist",table:"premium_waitlist",owner:"user_id"},{key:"account_deletion_requests",table:"account_deletion_requests",owner:"user_id"},
] as const;

export async function GET(){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Please sign in again."},{status:401});
  const startedAt=new Date().toISOString();const encoder=new TextEncoder();
  const stream=new ReadableStream<Uint8Array>({async start(controller){
    const write=(value:string)=>controller.enqueue(encoder.encode(value));const errors:{section:string;message:string}[]=[];
    write(JSON.stringify({format:"setra-cloud-export-v2",accountId:user.id,exportStartedAt:startedAt,scope:"Cloud-synced Setra data only. Changes still waiting on this device are not included.",consistency:"Rows are read in stable ID order. Changes made during the export window may appear in either their before or after state."}).slice(0,-1)+',"data":{');
    for(let tableIndex=0;tableIndex<tables.length;tableIndex++){
      const item=tables[tableIndex];if(tableIndex)write(",");write(`${JSON.stringify(item.key)}:[`);let first=true;
      try{const fetchPage=async(afterId:string|number|undefined,limit:number)=>{let query=supabase.from(item.table).select("*").order("id",{ascending:true}).limit(limit);query=query.eq(item.owner,user.id);if(afterId!==undefined)query=query.gt("id",afterId);const {data,error}=await query;if(error)throw error;return (data||[]) as ExportRow[]};for await(const row of paginateExportRows(fetchPage)){if(!first)write(",");write(JSON.stringify(row));first=false}}catch(error){errors.push({section:item.key,message:error instanceof Error?error.message:"Export section failed"})}
      write("]");
    }
    write(`},"exportFinishedAt":${JSON.stringify(new Date().toISOString())},"complete":${errors.length===0},"errors":${JSON.stringify(errors)}}`);controller.close();
  }});
  return new NextResponse(stream,{headers:{"content-type":"application/json; charset=utf-8","content-disposition":`attachment; filename="setra-data-${startedAt.slice(0,10)}.json"`,"cache-control":"no-store","x-setra-export-scope":"cloud-only"}});
}
