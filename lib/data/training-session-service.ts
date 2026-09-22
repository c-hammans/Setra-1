import type {SupabaseClient} from "@supabase/supabase-js";
import {createClient} from "@/lib/supabase/client";
import type {EnduranceSession,EnduranceTemplate,TrainingActivityType,TrainingBlockType,TrainingCategory,TrainingCompletionType,TrainingEnvironment,TrainingSessionBlock,TrainingTargetMetric} from "@/lib/setra/types";
import {localDateKey} from "@/lib/setra/week";
import {runOrderedWrite} from "@/lib/data/write-coordinator";
import {normalizeWriteError} from "@/lib/data/write-errors";
import {isVersionedOperation,legacyRevision,rpcVersion,type WriteOperation} from "@/lib/data/write-protocol";

// Supabase rows are mapped here so the UI remains independent of database column names.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow=Record<string,any>;

const seconds=(minutes?:number)=>minutes==null?null:Math.round(minutes*60);
const metres=(kilometres?:number)=>kilometres==null?null:kilometres*1000;
const isoFor=(date:string,time?:string)=>time?new Date(`${date}T${time}:00`).toISOString():null;
const mapBlocks=(rows:AnyRow[]=[]):TrainingSessionBlock[]=>(rows||[]).sort((a,b)=>Number(a.position)-Number(b.position)).map((block):TrainingSessionBlock=>({id:String(block.client_id||block.id),type:block.block_type as TrainingBlockType,title:String(block.title||""),instructions:String(block.instructions||""),repetitions:block.repetitions==null?undefined:Number(block.repetitions),durationSeconds:block.planned_duration_seconds==null?undefined:Number(block.planned_duration_seconds),distanceMetres:block.planned_distance_metres==null?undefined:Number(block.planned_distance_metres),recoveryDurationSeconds:block.recovery_duration_seconds==null?undefined:Number(block.recovery_duration_seconds),recoveryDistanceMetres:block.recovery_distance_metres==null?undefined:Number(block.recovery_distance_metres),intensityTarget:String(block.intensity_target||"")||undefined,completionType:(block.completion_type||"open") as TrainingCompletionType,targetMetric:block.target_metric as TrainingTargetMetric||undefined,targetMinValue:block.target_min_value==null?undefined:Number(block.target_min_value),targetMaxValue:block.target_max_value==null?undefined:Number(block.target_max_value),targetUnit:String(block.target_unit||"")||undefined,stroke:String(block.stroke||"")||undefined,providerMetadata:block.provider_metadata&&typeof block.provider_metadata==="object"?block.provider_metadata:{},parentId:String(block.parent_client_id||"")||undefined}));

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
    return {id:String(row.client_id||row.id),activityType:row.activity_type as TrainingActivityType,status:row.status,title:String(row.title),date:String(row.session_date),plannedStartTime:row.planned_start_time?String(row.planned_start_time).slice(0,5):undefined,plannedDurationMinutes:row.planned_duration_minutes==null?undefined:Number(row.planned_duration_minutes),plannedDistanceKm:row.planned_distance_metres==null?undefined:Number(row.planned_distance_metres)/1000,targetRpe:row.target_rpe==null?undefined:Number(row.target_rpe),environment:row.environment as TrainingEnvironment||undefined,category:row.training_category as TrainingCategory||undefined,plannedSessionId:row.planned_session_id?clientIdsByDatabaseId.get(String(row.planned_session_id)):undefined,startedAt:time(row.started_at),endedAt:time(row.ended_at),durationMinutes:row.duration_seconds==null?undefined:Number(row.duration_seconds)/60,distanceKm:row.distance_metres==null?undefined:Number(row.distance_metres)/1000,averagePaceSecondsPerKm:row.average_pace_seconds_per_km==null?undefined:Number(row.average_pace_seconds_per_km),averageSpeedKph:row.average_speed_kph==null?undefined:Number(row.average_speed_kph),averageSplitSecondsPer500m:row.average_split_seconds_per_500m==null?undefined:Number(row.average_split_seconds_per_500m),rpe:row.completed_rpe==null?undefined:Number(row.completed_rpe),averageHeartRate:row.average_heart_rate==null?undefined:Number(row.average_heart_rate),elevationGainMetres:row.elevation_gain_metres==null?undefined:Number(row.elevation_gain_metres),notes:String(row.notes||""),blocks,source:String(row.source||"manual"),externalProvider:String(row.external_provider||"")||undefined,externalActivityId:String(row.external_activity_id||"")||undefined,completedAt:row.completed_at?String(row.completed_at):undefined,templateId:linkedTemplate?.client_id?String(linkedTemplate.client_id):undefined,skipped:Boolean(row.skipped),minimalEntryConfirmed:Boolean(row.minimal_entry_confirmed)};
  }

  async loadEnduranceTemplates():Promise<EnduranceTemplate[]>{
    const {data,error}=await this.supabase.from("endurance_templates").select("*,endurance_template_blocks(*)").eq("user_id",this.userId).order("updated_at",{ascending:false});
    if(error)throw error;
    return ((data||[]) as AnyRow[]).map(row=>({id:String(row.client_id||row.id),activityType:row.activity_type as TrainingActivityType,title:String(row.title),plannedDurationMinutes:row.planned_duration_minutes==null?undefined:Number(row.planned_duration_minutes),plannedDistanceKm:row.planned_distance_metres==null?undefined:Number(row.planned_distance_metres)/1000,targetRpe:row.target_rpe==null?undefined:Number(row.target_rpe),environment:row.environment as TrainingEnvironment||undefined,category:row.training_category as TrainingCategory||undefined,notes:String(row.notes||""),blocks:mapBlocks(row.endurance_template_blocks as AnyRow[]||[])}));
  }

  async save(session:EnduranceSession,operation:WriteOperation|number=Date.now()*1000){
    const payload={...session,localToday:localDateKey(),plannedDistanceMetres:metres(session.plannedDistanceKm),startedAt:isoFor(session.date,session.startedAt),endedAt:isoFor(session.date,session.endedAt),durationSeconds:seconds(session.durationMinutes),distanceMetres:metres(session.distanceKm),completedAt:session.status==="completed"?(session.completedAt||new Date().toISOString()):undefined};
    return runOrderedWrite(`endurance-session:${session.id}`,async()=>{if(isVersionedOperation(operation)){const {data,error}=await this.supabase.rpc("save_endurance_session_v2",{p_session:payload,p_operation_id:operation.operationId,p_expected_version:operation.expectedVersion});if(error)throw normalizeWriteError(error);return rpcVersion(data)}const {error}=await this.supabase.rpc("save_endurance_session_revisioned",{p_session:payload,p_revision:legacyRevision(operation)});if(error)throw normalizeWriteError(error);return 0});
  }

  async saveTemplate(template:EnduranceTemplate,operation:WriteOperation|number=Date.now()*1000){
    return runOrderedWrite(`endurance-template:${template.id}`,async()=>{const payload={...template,plannedDistanceMetres:metres(template.plannedDistanceKm)};if(isVersionedOperation(operation)){const {data,error}=await this.supabase.rpc("save_endurance_template_v2",{p_template:payload,p_operation_id:operation.operationId,p_expected_version:operation.expectedVersion});if(error)throw normalizeWriteError(error);return rpcVersion(data)}const {error}=await this.supabase.rpc("save_endurance_template_revisioned",{p_template:payload,p_revision:legacyRevision(operation)});if(error)throw normalizeWriteError(error);return 0});
  }

  async deleteTemplate(clientId:string,operation:WriteOperation|number=Date.now()*1000){return runOrderedWrite(`endurance-template:${clientId}`,async()=>{if(isVersionedOperation(operation)){const {data,error}=await this.supabase.rpc("delete_client_entity_v2",{p_entity_key:`endurance-template:${clientId}`,p_operation_id:operation.operationId,p_expected_version:operation.expectedVersion,p_delete_kind:"endurance-template",p_client_id:clientId});if(error)throw normalizeWriteError(error);return rpcVersion(data)}const {error}=await this.supabase.rpc("delete_endurance_template_revisioned",{p_client_id:clientId,p_revision:legacyRevision(operation)});if(error)throw normalizeWriteError(error);return 0})}

  async delete(clientId:string,operation:WriteOperation|number=Date.now()*1000){return runOrderedWrite(`endurance-session:${clientId}`,async()=>{if(isVersionedOperation(operation)){const {data,error}=await this.supabase.rpc("delete_client_entity_v2",{p_entity_key:`endurance-session:${clientId}`,p_operation_id:operation.operationId,p_expected_version:operation.expectedVersion,p_delete_kind:"endurance-session",p_client_id:clientId,p_today:localDateKey()});if(error)throw normalizeWriteError(error);return rpcVersion(data)}const {error}=await this.supabase.rpc("delete_endurance_session_revisioned",{p_client_id:clientId,p_revision:legacyRevision(operation),p_today:localDateKey()});if(error)throw normalizeWriteError(error);return 0})}
}
