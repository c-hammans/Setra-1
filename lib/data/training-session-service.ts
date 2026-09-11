import type {SupabaseClient} from "@supabase/supabase-js";
import {createClient} from "@/lib/supabase/client";
import type {EnduranceSession,EnduranceTemplate,TrainingActivityType,TrainingBlockType,TrainingCategory,TrainingCompletionType,TrainingEnvironment,TrainingSessionBlock,TrainingTargetMetric} from "@/lib/setra/types";

// Supabase rows are mapped here so the UI remains independent of database column names.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow=Record<string,any>;

const seconds=(minutes?:number)=>minutes==null?null:Math.round(minutes*60);
const metres=(kilometres?:number)=>kilometres==null?null:kilometres*1000;
const isoFor=(date:string,time?:string)=>time?new Date(`${date}T${time}:00`).toISOString():null;
const mapBlocks=(rows:AnyRow[]=[]):TrainingSessionBlock[]=>(rows||[]).sort((a,b)=>Number(a.position)-Number(b.position)).map((block):TrainingSessionBlock=>({id:String(block.client_id||block.id),type:block.block_type as TrainingBlockType,title:String(block.title||""),instructions:String(block.instructions||""),repetitions:block.repetitions==null?undefined:Number(block.repetitions),durationSeconds:block.planned_duration_seconds==null?undefined:Number(block.planned_duration_seconds),distanceMetres:block.planned_distance_metres==null?undefined:Number(block.planned_distance_metres),recoveryDurationSeconds:block.recovery_duration_seconds==null?undefined:Number(block.recovery_duration_seconds),recoveryDistanceMetres:block.recovery_distance_metres==null?undefined:Number(block.recovery_distance_metres),intensityTarget:String(block.intensity_target||"")||undefined,completionType:(block.completion_type||"open") as TrainingCompletionType,targetMetric:block.target_metric as TrainingTargetMetric||undefined,targetMinValue:block.target_min_value==null?undefined:Number(block.target_min_value),targetMaxValue:block.target_max_value==null?undefined:Number(block.target_max_value),targetUnit:String(block.target_unit||"")||undefined,stroke:String(block.stroke||"")||undefined,providerMetadata:block.provider_metadata&&typeof block.provider_metadata==="object"?block.provider_metadata:{},parentId:String(block.parent_client_id||"")||undefined}));
const blockRows=(blocks:TrainingSessionBlock[],ownerKey:"session_id"|"template_id",ownerId:string,userId:string)=>blocks.map((block,index)=>({user_id:userId,[ownerKey]:ownerId,client_id:block.id,block_type:block.type,position:index,title:block.title||"",instructions:block.instructions||"",repetitions:block.repetitions??null,planned_duration_seconds:block.durationSeconds??null,planned_distance_metres:block.distanceMetres??null,recovery_duration_seconds:block.recoveryDurationSeconds??null,recovery_distance_metres:block.recoveryDistanceMetres??null,intensity_target:block.intensityTarget||"",completion_type:block.completionType||"open",target_metric:block.targetMetric||null,target_min_value:block.targetMinValue??null,target_max_value:block.targetMaxValue??null,target_unit:block.targetUnit||null,stroke:block.stroke||null,provider_metadata:block.providerMetadata||{},parent_client_id:block.parentId||null}));

export class TrainingSessionService{
  private supabase:SupabaseClient;
  constructor(private userId:string){this.supabase=createClient()}

  async loadEndurance():Promise<EnduranceSession[]>{
    const {data,error}=await this.supabase.from("training_sessions").select("*,training_session_blocks(*),endurance_templates(client_id)").eq("user_id",this.userId).eq("modality","endurance").order("session_date",{ascending:false}).order("created_at",{ascending:false});
    if(error)throw error;
    const rows=(data||[]) as AnyRow[];
    const clientIdsByDatabaseId=new Map(rows.map(row=>[String(row.id),String(row.client_id||row.id)]));
    return rows.map(row=>this.map(row,clientIdsByDatabaseId));
  }

  private map(row:AnyRow,clientIdsByDatabaseId:Map<string,string>):EnduranceSession{
    const blocks=mapBlocks(row.training_session_blocks as AnyRow[]||[]);
    const time=(value:unknown)=>value?new Date(String(value)).toTimeString().slice(0,5):undefined;
    const linkedTemplate=Array.isArray(row.endurance_templates)?row.endurance_templates[0]:row.endurance_templates;
    return {id:String(row.client_id||row.id),activityType:row.activity_type as TrainingActivityType,status:row.status,title:String(row.title),date:String(row.session_date),plannedStartTime:row.planned_start_time?String(row.planned_start_time).slice(0,5):undefined,plannedDurationMinutes:row.planned_duration_minutes==null?undefined:Number(row.planned_duration_minutes),plannedDistanceKm:row.planned_distance_metres==null?undefined:Number(row.planned_distance_metres)/1000,targetRpe:row.target_rpe==null?undefined:Number(row.target_rpe),environment:row.environment as TrainingEnvironment||undefined,category:row.training_category as TrainingCategory||undefined,plannedSessionId:row.planned_session_id?clientIdsByDatabaseId.get(String(row.planned_session_id)):undefined,startedAt:time(row.started_at),endedAt:time(row.ended_at),durationMinutes:row.duration_seconds==null?undefined:Number(row.duration_seconds)/60,distanceKm:row.distance_metres==null?undefined:Number(row.distance_metres)/1000,averagePaceSecondsPerKm:row.average_pace_seconds_per_km==null?undefined:Number(row.average_pace_seconds_per_km),averageSpeedKph:row.average_speed_kph==null?undefined:Number(row.average_speed_kph),averageSplitSecondsPer500m:row.average_split_seconds_per_500m==null?undefined:Number(row.average_split_seconds_per_500m),rpe:row.completed_rpe==null?undefined:Number(row.completed_rpe),averageHeartRate:row.average_heart_rate==null?undefined:Number(row.average_heart_rate),elevationGainMetres:row.elevation_gain_metres==null?undefined:Number(row.elevation_gain_metres),notes:String(row.notes||""),blocks,source:String(row.source||"manual"),externalProvider:String(row.external_provider||"")||undefined,externalActivityId:String(row.external_activity_id||"")||undefined,completedAt:row.completed_at?String(row.completed_at):undefined,templateId:linkedTemplate?.client_id?String(linkedTemplate.client_id):undefined};
  }

  async loadEnduranceTemplates():Promise<EnduranceTemplate[]>{
    const {data,error}=await this.supabase.from("endurance_templates").select("*,endurance_template_blocks(*)").eq("user_id",this.userId).order("updated_at",{ascending:false});
    if(error)throw error;
    return ((data||[]) as AnyRow[]).map(row=>({id:String(row.client_id||row.id),activityType:row.activity_type as TrainingActivityType,title:String(row.title),plannedDurationMinutes:row.planned_duration_minutes==null?undefined:Number(row.planned_duration_minutes),plannedDistanceKm:row.planned_distance_metres==null?undefined:Number(row.planned_distance_metres)/1000,targetRpe:row.target_rpe==null?undefined:Number(row.target_rpe),environment:row.environment as TrainingEnvironment||undefined,category:row.training_category as TrainingCategory||undefined,notes:String(row.notes||""),blocks:mapBlocks(row.endurance_template_blocks as AnyRow[]||[])}));
  }

  async save(session:EnduranceSession){
    const completed=session.status==="completed";
    let plannedSessionDatabaseId:string|null=null;
    if(session.plannedSessionId){const {data:planned,error:plannedError}=await this.supabase.from("training_sessions").select("id").eq("user_id",this.userId).eq("client_id",session.plannedSessionId).maybeSingle();if(plannedError)throw plannedError;plannedSessionDatabaseId=planned?.id||null;}
    let templateDatabaseId:string|null=null;
    if(session.templateId){const {data:template,error:templateError}=await this.supabase.from("endurance_templates").select("id").eq("user_id",this.userId).eq("client_id",session.templateId).maybeSingle();if(templateError)throw templateError;templateDatabaseId=template?.id||null;}
    const {data,error}=await this.supabase.from("training_sessions").upsert({user_id:this.userId,client_id:session.id,modality:"endurance",activity_type:session.activityType,status:session.status,title:session.title.trim(),session_date:session.date,planned_start_time:session.plannedStartTime||null,planned_duration_minutes:session.plannedDurationMinutes??null,planned_distance_metres:metres(session.plannedDistanceKm),target_rpe:session.targetRpe??null,environment:session.environment||null,training_category:session.category||null,planned_session_id:plannedSessionDatabaseId,endurance_template_id:templateDatabaseId,started_at:isoFor(session.date,session.startedAt),ended_at:isoFor(session.date,session.endedAt),duration_seconds:seconds(session.durationMinutes),distance_metres:metres(session.distanceKm),average_pace_seconds_per_km:session.averagePaceSecondsPerKm??null,average_speed_kph:session.averageSpeedKph??null,average_split_seconds_per_500m:session.averageSplitSecondsPer500m??null,completed_rpe:session.rpe??null,average_heart_rate:session.averageHeartRate??null,elevation_gain_metres:session.elevationGainMetres??null,notes:session.notes||"",source:session.source||"manual",external_provider:session.externalProvider||null,external_activity_id:session.externalActivityId||null,completed_at:completed?(session.completedAt||new Date().toISOString()):null},{onConflict:"user_id,client_id"}).select("id").single();
    if(error)throw error;
    const sessionId=data.id as string;
    const {error:deleteError}=await this.supabase.from("training_session_blocks").delete().eq("session_id",sessionId);if(deleteError)throw deleteError;
    if(session.blocks.length){const {error:blockError}=await this.supabase.from("training_session_blocks").insert(blockRows(session.blocks,"session_id",sessionId,this.userId));if(blockError)throw blockError;}
  }

  async saveTemplate(template:EnduranceTemplate){
    const {data,error}=await this.supabase.from("endurance_templates").upsert({user_id:this.userId,client_id:template.id,activity_type:template.activityType,title:template.title.trim(),planned_duration_minutes:template.plannedDurationMinutes??null,planned_distance_metres:metres(template.plannedDistanceKm),target_rpe:template.targetRpe??null,environment:template.environment||null,training_category:template.category||null,notes:template.notes||""},{onConflict:"user_id,client_id"}).select("id").single();
    if(error)throw error;const templateId=String(data.id);
    const {error:deleteError}=await this.supabase.from("endurance_template_blocks").delete().eq("template_id",templateId);if(deleteError)throw deleteError;
    if(template.blocks.length){const {error:blockError}=await this.supabase.from("endurance_template_blocks").insert(blockRows(template.blocks,"template_id",templateId,this.userId));if(blockError)throw blockError;}
  }

  async deleteTemplate(clientId:string){const {error}=await this.supabase.from("endurance_templates").delete().eq("user_id",this.userId).eq("client_id",clientId);if(error)throw error;}

  async delete(clientId:string){
    const {error}=await this.supabase.from("training_sessions").delete().eq("user_id",this.userId).eq("client_id",clientId).eq("modality","endurance");if(error)throw error;
  }
}
