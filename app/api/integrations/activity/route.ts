import {createHash} from "node:crypto";
import {NextResponse} from "next/server";
import {buildCompletedActivityPayload,canonicalAdmission,dateAt,fileLimit,formats,matchActivities,sports,uploadPolicy,validActivityDate,type FileFormat,type MatchRow,type NormalizedActivity} from "@/lib/integrations/activity";
import {parseActivity} from "@/lib/integrations/activity-parsers";
import {readActivityPreview,signActivityPreview} from "@/lib/integrations/preview-token";
import {addCalendarDays} from "@/lib/setra/week";
import type {TrainingActivityType} from "@/lib/setra/types";
import {createAdminClient} from "@/lib/supabase/admin";
import {createClient} from "@/lib/supabase/server";

export const runtime="nodejs";
const fail=(error:string,status=400)=>NextResponse.json({error},{status});
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const externalId=(activity:NormalizedActivity)=>"start:"+Math.floor(Date.parse(activity.start)/1000);
const zoneFrom=(value:unknown)=>{
  const timezone=typeof value==="string"&&value.length<=80?value:"UTC";
  try{new Intl.DateTimeFormat("en",{timeZone:timezone});return timezone}catch{return "UTC"}
};

export async function GET(request:Request){
  const auth=await createClient(),{data:{user}}=await auth.auth.getUser();
  if(!user)return fail("Sign in to see your imports.",401);
  const url=new URL(request.url),clientId=url.searchParams.get("session"),receiptId=url.searchParams.get("receipt");
  if(clientId&&clientId.length>160||receiptId&&!idPattern.test(receiptId))return fail("Invalid activity reference.");
  if(clientId){
    const session=await auth.from("training_sessions").select("id").eq("user_id",user.id).eq("client_id",clientId).maybeSingle();
    if(session.error)return fail("The activity could not be loaded.",500);
    if(!session.data)return NextResponse.json({receipt:null});
    const result=await auth.from("activity_import_receipts").select("id,format,sync_status,imported_at,recorded_result").eq("user_id",user.id).eq("session_id",session.data.id).limit(1).maybeSingle();
    if(result.error)return fail("Import details are unavailable.",500);
    return NextResponse.json({receipt:result.data});
  }
  if(receiptId){
    const result=await auth.from("activity_import_receipts").select("id,format,sync_status,imported_at,recorded_result").eq("user_id",user.id).eq("id",receiptId).maybeSingle();
    if(result.error)return fail("Import details are unavailable.",500);
    return result.data?NextResponse.json({receipt:result.data}):fail("Import not found.",404);
  }
  const result=await auth.from("activity_import_receipts").select("id,format,sync_status,imported_at,session_id").eq("user_id",user.id).order("imported_at",{ascending:false}).limit(24);
  if(result.error)return fail("Import history is not available. Check that the import database migration has been applied.",503);
  return NextResponse.json({history:result.data});
}

async function candidates(auth:Awaited<ReturnType<typeof createClient>>,userId:string,activity:NormalizedActivity,date:string,sport:TrainingActivityType){
  const result=await auth.from("training_sessions").select("id,client_id,title,activity_type,status,session_date,planned_duration_minutes,planned_distance_metres,duration_seconds,distance_metres,started_at,planned_session_id,skipped")
    .eq("user_id",userId).eq("modality","endurance").eq("activity_type",sport)
    .in("status",["planned","completed","in_progress"]).gte("session_date",addCalendarDays(date,-2)).lte("session_date",addCalendarDays(date,2))
    .order("session_date").limit(150);
  if(result.error)throw result.error;
  const fulfilled=new Set((result.data??[]).filter(row=>row.status==="completed"||row.status==="in_progress").map(row=>row.planned_session_id));
  const rows:MatchRow[]=(result.data??[]).filter(row=>row.status==="completed"||(row.status==="planned"&&!row.skipped&&!fulfilled.has(row.id))).map(row=>({
    id:row.id,title:row.title,sport:row.activity_type,date:row.session_date,status:row.status as MatchRow["status"],
    duration:row.status==="planned"?row.planned_duration_minutes==null?undefined:Number(row.planned_duration_minutes)*60:row.duration_seconds??undefined,
    distance:Number(row.status==="completed"?row.distance_metres:row.planned_distance_metres)||undefined,
    start:row.started_at??undefined,linked:Boolean(row.planned_session_id)
  })).filter(row=>row.date>=addCalendarDays(date,-1)&&row.date<=addCalendarDays(date,1));
  const matched=matchActivities(rows,activity,date,sport);
  return {...matched,manual:rows.filter(row=>row.status==="completed").slice(0,16)};
}

export async function POST(request:Request){
  const auth=await createClient(),{data:{user}}=await auth.auth.getUser();
  if(!user)return fail("Sign in to import an activity.",401);
  const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)return fail("Activity import has not been configured on the server.",503);
  try{
    const length=Number(request.headers.get("content-length")??0);
    if(request.headers.get("content-type")?.startsWith("multipart/form-data")){
      if(length>fileLimit+65536)return fail("Choose a FIT, TCX or GPX file under 3 MB.",413);
      const data=await request.formData(),file=data.get("file");
      if(!(file instanceof File)||data.getAll("file").length!==1)return fail("Choose one completed activity file.");
      const format=file.name.toLowerCase().split(".").at(-1) as FileFormat;
      if(!formats.includes(format))return fail("Choose a FIT, TCX or GPX file.");
      if(file.size>fileLimit)return fail("Choose a FIT, TCX or GPX file under 3 MB.",413);
      const zone=zoneFrom(data.get("timezone")),bytes=await file.arrayBuffer();
      let activity:NormalizedActivity;
      try{activity=parseActivity(bytes,format)}catch(error){return fail(error instanceof Error&&error.message.length<250?error.message:"This activity file could not be read.",422)}
      const fingerprint=createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
      const prior=await auth.from("activity_import_receipts").select("id").eq("user_id",user.id).eq("provider","activity_file")
        .or(`fingerprint.eq.${fingerprint},external_activity_id.eq.${externalId(activity)}`).limit(1).maybeSingle();
      if(prior.error)return fail("Import history is unavailable. Check that the database migration is applied.",503);
      if(prior.data)return NextResponse.json({duplicateId:prior.data.id});
      const token=signActivityPreview({userId:user.id,fingerprint,activity,zone},key);
      return NextResponse.json({activity,token,date:dateAt(activity.start,zone),today:dateAt(new Date().toISOString(),zone)});
    }
    if(length>450000)return fail("This import review is too large.",413);
    const body=await request.json().catch(()=>null);
    if(!body||typeof body!=="object")return fail("Invalid import request.");
    const preview=readActivityPreview(body.token,user.id,key);
    if(!preview)return fail("This preview expired. Choose the original file again.",409);
    const {activity,fingerprint,zone}=preview;
    const date=typeof body.date==="string"?body.date:"",sport=body.sport as TrainingActivityType;
    const recordedDate=dateAt(activity.start,zone),today=dateAt(new Date().toISOString(),zone);
    if(!sports.includes(sport)||!validActivityDate(date)||date>today||date<addCalendarDays(recordedDate,-1)||date>addCalendarDays(recordedDate,1))
      return fail("Choose a supported sport and a date within one day of the recorded activity, no later than today.");
    if(body.action==="matches")return NextResponse.json(await candidates(auth,user.id,activity,date,sport));
    if(body.action!=="save"||body.authorizedFile!==true)return fail("Confirm that you’re allowed to import this file.");
    if(body.plan!=null&&(typeof body.plan!=="string"||!idPattern.test(body.plan))||
        body.manual!=null&&(typeof body.manual!=="string"||!idPattern.test(body.manual))||body.plan&&body.manual)
      return fail("Choose one valid session or import without a link.");
    const provider="activity_file",external=externalId(activity);
    if(!canonicalAdmission({channel:"user_file",provider,externalId:external,permissions:uploadPolicy}))return fail("This source cannot be added to your training record.",403);
    const payload=buildCompletedActivityPayload(activity,sport,date,today);
    const admin=createAdminClient();
    const result=await admin.rpc("import_reviewed_activity",{p_user:user.id,p_fingerprint:fingerprint,p_external_id:external,
      p_result:{...activity,sport,date},p_payload:payload,p_plan:body.plan??null,p_manual:body.manual??null,p_allow_separate:body.allowSeparate===true});
    if(result.error){
      if(result.error.code==="P0409")return fail(result.error.message,409);
      if(result.error.code==="P0400")return fail("Review the imported activity details.");
      return fail("Setra couldn’t save this activity. Your existing activities were not changed.",503);
    }
    return NextResponse.json(result.data);
  }catch{return fail("Setra couldn’t process that import. Check the file and try again.",422)}
}
