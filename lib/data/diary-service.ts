import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { AppData, AthleteSessionCheckin, Exercise, LoadMode, ScheduledWorkout, Template, TrainingPreference, Workout } from "@/lib/setra/types";
import type {AppearanceMode,TextScale} from "@/lib/setra/appearance";
import type {WeekdayIndex} from "@/lib/setra/week";
import type {PlannedWorkoutProgressPreference} from "@/lib/setra/planned-workout-progress";
import { localImportSummary } from "./local-diary";
import {runOrderedWrite} from "./write-coordinator";
import {normalizeWriteError} from "./write-errors";
import {isVersionedOperation,legacyRevision,rpcVersion,type WriteOperation} from "./write-protocol";
import {workoutWritePayload} from "./workout-write-payload";
import {loadSupabasePages} from "./supabase-pagination";

// Supabase rows remain runtime-validated by the mapping below until generated DB types are added.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow=Record<string,any>;
const durationMinutes=(start?:string|null,end?:string|null)=>{if(!start||!end)return 0;const [sh,sm]=String(start).slice(0,5).split(":").map(Number);const [eh,em]=String(end).slice(0,5).split(":").map(Number);if([sh,sm,eh,em].some(value=>!Number.isFinite(value)))return 0;let minutes=(eh*60+em)-(sh*60+sm);if(minutes<0)minutes+=1440;return Math.max(0,minutes)};
const isMissingCoachingSchema=(error:unknown)=>["42P01","42703","PGRST200","PGRST204","PGRST205"].includes(String((error as {code?:string})?.code||""));
const coachInfo=(raw:AnyRow|AnyRow[]|null|undefined)=>{const assignment=Array.isArray(raw)?raw[0]:raw;const feedbackRaw=assignment?.coach_session_feedback;const feedback=Array.isArray(feedbackRaw)?feedbackRaw[0]:feedbackRaw;const programRaw=assignment?.client_programs;const program=Array.isArray(programRaw)?programRaw[0]:programRaw;return {coachAssignmentId:assignment?.id?String(assignment.id):undefined,assignedByCoach:assignment?.coach_display_name?String(assignment.coach_display_name):undefined,coachInstruction:assignment?.coach_instruction?String(assignment.coach_instruction):undefined,coachDayPosition:assignment?.day_position==null?undefined:Number(assignment.day_position),coachProgramName:program?.name?String(program.name):undefined,coachProgramWeek:assignment?.program_week_number==null?undefined:Number(assignment.program_week_number),coachProgramDurationWeeks:program?.duration_weeks==null?undefined:Number(program.duration_weeks),coachFeedback:feedback?.id?{id:String(feedback.id),coachName:String(feedback.coach_display_name||assignment?.coach_display_name||"Coach"),text:String(feedback.feedback||""),createdAt:String(feedback.created_at),updatedAt:String(feedback.updated_at)}:undefined}};

export class DiaryService {
  private supabase:SupabaseClient;
  constructor(private userId:string){this.supabase=createClient()}

  async loadProfile():Promise<{displayName:string;bodyWeightKg:number|null;preferredUnit:"kg"|"lb";appColour:string;appearanceMode:AppearanceMode;textScale:TextScale;trainingPreference:TrainingPreference;showWorkoutTimingPopup:boolean;showPbPopup:boolean;plannedWorkoutProgress:PlannedWorkoutProgressPreference;weekStartsOn:WeekdayIndex;lastWeeklyPreviewWeekStart:string|null}>{
    const {data,error}=await this.supabase.from("profiles").select("display_name,body_weight_kg,preferred_unit,app_colour,appearance_mode,text_scale,training_preference,show_workout_timing_popup,show_pb_popup,planned_workout_progress,week_starts_on,last_weekly_preview_week_start").eq("id",this.userId).single();
    if(error){
      if(error.code==="42703"||error.code==="PGRST204"){const fallback=await this.supabase.from("profiles").select("display_name,body_weight_kg,preferred_unit,app_colour,appearance_mode,text_scale,training_preference,show_workout_timing_popup,show_pb_popup,week_starts_on,last_weekly_preview_week_start").eq("id",this.userId).single();if(fallback.error)throw fallback.error;const previous=fallback.data;return {displayName:previous.display_name||"",bodyWeightKg:previous.body_weight_kg==null?null:Number(previous.body_weight_kg),preferredUnit:previous.preferred_unit==="lb"?"lb":"kg",appColour:previous.app_colour||"#409ECE",appearanceMode:previous.appearance_mode==="light"||previous.appearance_mode==="dark"?previous.appearance_mode:"system",textScale:[1,1.1,1.2,1.3].includes(Number(previous.text_scale))?Number(previous.text_scale) as TextScale:1,trainingPreference:["strength","endurance","hybrid"].includes(previous.training_preference)?previous.training_preference as TrainingPreference:"strength",showWorkoutTimingPopup:previous.show_workout_timing_popup!==false,showPbPopup:previous.show_pb_popup!==false,plannedWorkoutProgress:"sets",weekStartsOn:Number.isInteger(previous.week_starts_on)&&previous.week_starts_on>=0&&previous.week_starts_on<=6?previous.week_starts_on as WeekdayIndex:1,lastWeeklyPreviewWeekStart:previous.last_weekly_preview_week_start||null}}
      throw error;
    }
    return {displayName:data.display_name||"",bodyWeightKg:data.body_weight_kg==null?null:Number(data.body_weight_kg),preferredUnit:data.preferred_unit==="lb"?"lb":"kg",appColour:data.app_colour||"#409ECE",appearanceMode:data.appearance_mode==="light"||data.appearance_mode==="dark"?data.appearance_mode:"system",textScale:[1,1.1,1.2,1.3].includes(Number(data.text_scale))?Number(data.text_scale) as TextScale:1,trainingPreference:["strength","endurance","hybrid"].includes(data.training_preference)?data.training_preference as TrainingPreference:"strength",showWorkoutTimingPopup:data.show_workout_timing_popup!==false,showPbPopup:data.show_pb_popup!==false,plannedWorkoutProgress:data.planned_workout_progress==="percentage"?"percentage":"sets",weekStartsOn:Number.isInteger(data.week_starts_on)&&data.week_starts_on>=0&&data.week_starts_on<=6?data.week_starts_on as WeekdayIndex:1,lastWeeklyPreviewWeekStart:data.last_weekly_preview_week_start||null};
  }

  async markWeeklyPreviewSeen(weekStart:string){const {error}=await this.supabase.from("profiles").update({last_weekly_preview_week_start:weekStart}).eq("id",this.userId);if(error)throw error}

  async loadWriteVersions():Promise<Record<string,number>>{try{const rows=await loadSupabasePages<AnyRow>((from,to)=>this.supabase.from("client_write_heads").select("entity_key,server_version").eq("user_id",this.userId).order("entity_key").range(from,to));return Object.fromEntries(rows.map(row=>[String(row.entity_key),Number(row.server_version)||0]))}catch(error){const value=error as {code?:string};if(value.code==="42703"||value.code==="PGRST204")return{};throw error}}

  async updateAppColour(appColour:string){
    const {error}=await this.supabase.from("profiles").update({app_colour:appColour}).eq("id",this.userId);if(error)throw error;
  }

  async load():Promise<AppData>{
    const loadRows=(includeCoaching:boolean)=>Promise.all([
      loadSupabasePages<AnyRow>((from,to)=>this.supabase.from("exercises").select("id,name,muscle_group,equipment").order("name").order("id").range(from,to)),
      loadSupabasePages<AnyRow>((from,to)=>this.supabase.from("workout_templates").select(includeCoaching?"*,coach_training_assignments!workout_templates_coach_assignment_fk(id,coach_display_name,coach_instruction,day_position,program_week_number,client_programs!coach_assignment_client_program_fk(name,duration_weeks),coach_session_feedback(id,coach_display_name,feedback,created_at,updated_at)),template_supersets(*),template_exercises(*),template_warmup_items(*)":"*,template_supersets(*),template_exercises(*),template_warmup_items(*)").order("created_at").order("id").range(from,to)),
      loadSupabasePages<AnyRow>((from,to)=>this.supabase.from("scheduled_workouts").select(includeCoaching?"*,workout_templates(client_id,coach_training_assignments!workout_templates_coach_assignment_fk(id,coach_display_name,coach_instruction,day_position,program_week_number,client_programs!coach_assignment_client_program_fk(name,duration_weeks),coach_session_feedback(id,coach_display_name,feedback,created_at,updated_at)))":"*,workout_templates(client_id)").order("scheduled_date").order("id").range(from,to)),
      loadSupabasePages<AnyRow>((from,to)=>this.supabase.from("workouts").select(includeCoaching?"*,workout_templates(client_id,coach_training_assignments!workout_templates_coach_assignment_fk(id,coach_display_name,coach_instruction,day_position,program_week_number,client_programs!coach_assignment_client_program_fk(name,duration_weeks),coach_session_feedback(id,coach_display_name,feedback,created_at,updated_at))),workout_warmup_items(*),workout_exercises(*,workout_sets(*))":"*,workout_templates(client_id),workout_warmup_items(*),workout_exercises(*,workout_sets(*))").eq("status","completed").order("workout_date",{ascending:false}).order("id",{ascending:false}).range(from,to)),
    ]);
    let rows:AnyRow[][];
    try{rows=await loadRows(true)}catch(error){if(!isMissingCoachingSchema(error))throw error;rows=await loadRows(false)}
    const [exerciseRows,templateRows,scheduleRows,workoutRows]=rows;
    let checkinRows:AnyRow[]=[];try{checkinRows=await loadSupabasePages<AnyRow>((from,to)=>this.supabase.from("athlete_session_checkins").select("completed_client_id,session_rpe,session_feel,athlete_comment,updated_at").eq("user_id",this.userId).eq("modality","strength").order("updated_at",{ascending:false}).range(from,to))}catch(error){if(!isMissingCoachingSchema(error))throw error}
    const checkins=new Map(checkinRows.map((row):[string,AthleteSessionCheckin]=>[String(row.completed_client_id),{rpe:row.session_rpe==null?undefined:Number(row.session_rpe),feel:row.session_feel||undefined,comment:String(row.athlete_comment||"")||undefined,updatedAt:row.updated_at?String(row.updated_at):undefined}]));
    const exercises=exerciseRows.map((row:AnyRow):Exercise=>({id:row.id,name:row.name,group:row.muscle_group,equipment:row.equipment}));
    const templates=templateRows.map((row:AnyRow):Template=>{
      const supersets=new Map((row.template_supersets||[]).map((item:AnyRow)=>[item.id,item]));
      const supersetNames=Object.fromEntries((row.template_supersets as AnyRow[]||[]).map((item:AnyRow)=>[String(item.client_group_key),String(item.name||"")]));
      return {id:row.client_id||row.id,name:row.name,focus:row.focus,color:row.colour,icon:row.icon,updatedAt:row.updated_at?String(row.updated_at):undefined,archivedAt:row.archived_at?String(row.archived_at):undefined,...coachInfo(row.coach_training_assignments),supersetNames:supersetNames as Record<string,string>,warmup:(row.template_warmup_items||[]).sort((a:AnyRow,b:AnyRow)=>a.position-b.position).map((item:AnyRow)=>({id:String(item.client_id||item.id),kind:item.item_type==="exercise"?"exercise":"instruction",exerciseId:item.exercise_id?String(item.exercise_id):undefined,title:String(item.title||""),instructions:String(item.instructions||"")})),exercises:(row.template_exercises||[]).sort((a:AnyRow,b:AnyRow)=>a.position-b.position).map((item:AnyRow)=>({exerciseId:item.exercise_id,sets:item.planned_sets,reps:item.rep_target,group:item.superset_id?(supersets.get(item.superset_id) as AnyRow)?.client_group_key:undefined,note:item.notes||"",plannedLoad:item.planned_load_mode?{mode:item.planned_load_mode,value:String(item.planned_load_value??item.planned_load_text??""),sourceUnit:item.planned_load_source_unit||undefined}:undefined}))};
    });
    const scheduled=scheduleRows.map((row:AnyRow):ScheduledWorkout=>{const template=Array.isArray(row.workout_templates)?row.workout_templates[0]:row.workout_templates;return{date:row.scheduled_date,templateId:template?.client_id||row.template_id,skipped:row.skipped,...coachInfo(template?.coach_training_assignments)}}).sort((a,b)=>a.date.localeCompare(b.date)||(a.coachDayPosition??Number.MAX_SAFE_INTEGER)-(b.coachDayPosition??Number.MAX_SAFE_INTEGER));
    try{
      const prescriptions=await loadSupabasePages<AnyRow>((from,to)=>this.supabase.from("training_plan_occurrences")
        .select("source_client_id,planned_date,adaptive_strength_prescription").eq("user_id",this.userId).eq("modality","strength")
        .eq("status","planned").not("adaptive_strength_prescription","is",null).order("id").range(from,to));
      const keyed=new Map(prescriptions.map(row=>[`${row.source_client_id}:${row.planned_date}`,row.adaptive_strength_prescription]));
      for(const item of scheduled)if(!item.coachAssignmentId)item.adaptivePrescription=keyed.get(`${item.templateId}:${item.date}`);
    }catch(error){if(!isMissingCoachingSchema(error))throw error}
    const workouts=workoutRows.map((row:AnyRow)=>this.mapWorkout(row,checkins.get(String(row.client_id||row.id))));
    return {exercises,templates,scheduled,workouts};
  }

  async loadDraft():Promise<Workout|null>{
    const load=async(includeCoaching:boolean)=>this.supabase.from("workouts").select(includeCoaching?"*,workout_templates(client_id,coach_training_assignments!workout_templates_coach_assignment_fk(id,coach_display_name,coach_instruction,day_position,program_week_number,client_programs!coach_assignment_client_program_fk(name,duration_weeks),coach_session_feedback(id,coach_display_name,feedback,created_at,updated_at))),workout_warmup_items(*),workout_exercises(*,workout_sets(*))":"*,workout_templates(client_id),workout_warmup_items(*),workout_exercises(*,workout_sets(*))").eq("status","in_progress").order("updated_at",{ascending:false}).limit(1).maybeSingle();
    let result=await load(true);if(result.error&&isMissingCoachingSchema(result.error))result=await load(false);
    if(result.error)throw result.error;return result.data?this.mapWorkout(result.data as AnyRow):null;
  }

  private mapWorkout(row:AnyRow,athleteCheckin?:AthleteSessionCheckin):Workout{
    const template=(Array.isArray(row.workout_templates)?row.workout_templates[0]:row.workout_templates) as AnyRow|null;
    const exercises=(row.workout_exercises as AnyRow[]||[]).sort((a,b)=>Number(a.position)-Number(b.position));
    const warmup=(row.workout_warmup_items as AnyRow[]||[]).sort((a,b)=>Number(a.position)-Number(b.position)).map(item=>({id:String(item.client_id||item.id),kind:(item.item_type==="exercise"?"exercise":"instruction") as "exercise"|"instruction",exerciseId:item.exercise_id?String(item.exercise_id):undefined,title:String(item.title||""),instructions:String(item.instructions||""),done:Boolean(item.completed)}));
    const startedAt=row.started_at?String(row.started_at).slice(0,5):"";const endedAt=row.ended_at?String(row.ended_at).slice(0,5):undefined;
    return {id:String(row.client_id||row.id),templateId:template?.client_id?String(template.client_id):undefined,name:String(row.name),date:String(row.workout_date),startedAt,endedAt,duration:durationMinutes(startedAt,endedAt),note:String(row.notes||""),updatedAt:row.updated_at?String(row.updated_at):undefined,completedAt:row.completed_at?String(row.completed_at):undefined,athleteCheckin,...coachInfo(template?.coach_training_assignments),warmup,exercises:exercises.map(item=>{const sets=(item.workout_sets as AnyRow[]||[]).sort((a,b)=>Number(a.set_number)-Number(b.set_number)).map(set=>({reps:String(set.reps||""),weight:String(set.load_text??set.weight??""),rpe:String(set.rpe||""),done:Boolean(set.completed),note:String(set.notes||"")}));const loadMode:LoadMode=item.load_mode==="kg"?"kg":sets.length>0&&sets.every(set=>set.weight.toUpperCase()==="BW")?"bw":"band";return {exerciseId:String(item.exercise_id),group:item.superset_key?String(item.superset_key):undefined,note:String(item.notes||""),planNote:String(item.planning_notes||""),repTarget:item.rep_target?String(item.rep_target):undefined,loadMode,plannedLoad:item.planned_load_mode?{mode:item.planned_load_mode,value:String(item.planned_load_value??item.planned_load_text??""),sourceUnit:item.planned_load_source_unit||undefined}:undefined,skipped:Boolean(item.skipped),sets};})};
  }

  async saveTemplate(template:Template,operation:WriteOperation|number=Date.now()*1000){
    return runOrderedWrite(`strength-template:${template.id}`,async()=>{if(isVersionedOperation(operation)){const {data,error}=await this.supabase.rpc("save_strength_template_v2",{p_template:template,p_operation_id:operation.operationId,p_expected_version:operation.expectedVersion});if(error)throw normalizeWriteError(error);return rpcVersion(data)}const {error}=await this.supabase.rpc("save_strength_template_revisioned",{p_template:template,p_revision:legacyRevision(operation)});if(error)throw normalizeWriteError(error);return 0});
  }

  async saveCustomExercise(exercise:Exercise){
    const {error}=await this.supabase.from("exercises").upsert({id:exercise.id,owner_id:this.userId,name:exercise.name,muscle_group:exercise.group,equipment:exercise.equipment},{onConflict:"id"});if(error)throw error;
  }

  async deleteTemplate(clientId:string,operation:WriteOperation|number=Date.now()*1000){return runOrderedWrite(`strength-template:${clientId}`,async()=>{if(isVersionedOperation(operation)){const {data,error}=await this.supabase.rpc("delete_client_entity_v2",{p_entity_key:`strength-template:${clientId}`,p_operation_id:operation.operationId,p_expected_version:operation.expectedVersion,p_delete_kind:"strength-template",p_client_id:clientId});if(error)throw normalizeWriteError(error);return rpcVersion(data)}const {error}=await this.supabase.rpc("delete_strength_template_revisioned",{p_client_id:clientId,p_revision:legacyRevision(operation)});if(error)throw normalizeWriteError(error);return 0})}

  async replaceSchedule(items:ScheduledWorkout[],operation:WriteOperation|number=Date.now()*1000){
    return runOrderedWrite("schedule:current",async()=>{if(isVersionedOperation(operation)){const {data,error}=await this.supabase.rpc("replace_strength_schedule_v2",{p_items:items,p_operation_id:operation.operationId,p_expected_version:operation.expectedVersion});if(error)throw normalizeWriteError(error);return rpcVersion(data)}const {error}=await this.supabase.rpc("replace_strength_schedule_revisioned",{p_items:items,p_revision:legacyRevision(operation)});if(error)throw normalizeWriteError(error);return 0});
  }

  async saveWorkout(workout:Workout,status:"in_progress"|"completed"="completed",operation:WriteOperation|number=Date.now()*1000){
    return runOrderedWrite(`workout:${workout.id}`,async()=>{const payload=workoutWritePayload(workout,status,Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC");if(isVersionedOperation(operation)){const {data,error}=await this.supabase.rpc("save_strength_workout_v2",{p_workout:payload,p_status:status,p_operation_id:operation.operationId,p_expected_version:operation.expectedVersion});if(error)throw normalizeWriteError(error);return rpcVersion(data)}const {error}=await this.supabase.rpc("save_strength_workout_revisioned",{p_workout:payload,p_status:status,p_revision:legacyRevision(operation)});if(error)throw normalizeWriteError(error);return 0});
  }

  async deleteWorkout(clientId:string,operation:WriteOperation|number=Date.now()*1000){return runOrderedWrite(`workout:${clientId}`,async()=>{if(isVersionedOperation(operation)){const {data,error}=await this.supabase.rpc("delete_client_entity_v2",{p_entity_key:`workout:${clientId}`,p_operation_id:operation.operationId,p_expected_version:operation.expectedVersion,p_delete_kind:"workout",p_client_id:clientId});if(error)throw normalizeWriteError(error);return rpcVersion(data)}const {error}=await this.supabase.rpc("delete_strength_workout_revisioned",{p_client_id:clientId,p_revision:legacyRevision(operation)});if(error)throw normalizeWriteError(error);return 0})}

  async importLocal(data:AppData){
    const {data:existing,error:checkError}=await this.supabase.from("data_imports").select("id").eq("user_id",this.userId).eq("source","setra-local-storage-v1").maybeSingle();if(checkError)throw checkError;if(existing)throw new Error("This browser diary has already been imported.");
    const summary=localImportSummary(data);
    for(const template of data.templates)await this.saveTemplate(template);
    await this.replaceSchedule(data.scheduled);
    for(const workout of summary.workouts)await this.saveWorkout(workout,"completed");
    const {error}=await this.supabase.from("data_imports").insert({user_id:this.userId,source:"setra-local-storage-v1",source_version:1,summary:{templates:summary.templates,scheduled:summary.scheduled,workouts:summary.workoutCount,sets:summary.sets,excluded_demo_workouts:data.workouts.length-summary.workoutCount}});if(error)throw error;
    return summary;
  }
}
