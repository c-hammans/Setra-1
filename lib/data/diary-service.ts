import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { AppData, Exercise, LoadMode, ScheduledWorkout, Template, TrainingPreference, Workout } from "@/lib/setra/types";
import type {AppearanceMode,TextScale} from "@/lib/setra/appearance";
import { localImportSummary } from "./local-diary";

// Supabase rows remain runtime-validated by the mapping below until generated DB types are added.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow=Record<string,any>;

export class DiaryService {
  private supabase:SupabaseClient;
  constructor(private userId:string){this.supabase=createClient()}

  async loadProfile():Promise<{displayName:string;appColour:string;appearanceMode:AppearanceMode;textScale:TextScale;trainingPreference:TrainingPreference;showWorkoutTimingPopup:boolean;showPbPopup:boolean}>{
    const {data,error}=await this.supabase.from("profiles").select("display_name,app_colour,appearance_mode,text_scale,training_preference,show_workout_timing_popup,show_pb_popup").eq("id",this.userId).single();
    if(error){
      if(error.code==="42703"||error.code==="PGRST204"){const fallback=await this.supabase.from("profiles").select("display_name,app_colour").eq("id",this.userId).single();if(fallback.error)throw fallback.error;return {displayName:fallback.data.display_name||"",appColour:fallback.data.app_colour||"#409ECE",appearanceMode:"system",textScale:1,trainingPreference:"strength",showWorkoutTimingPopup:true,showPbPopup:true}}
      throw error;
    }
    return {displayName:data.display_name||"",appColour:data.app_colour||"#409ECE",appearanceMode:data.appearance_mode==="light"||data.appearance_mode==="dark"?data.appearance_mode:"system",textScale:[1,1.1,1.2,1.3].includes(Number(data.text_scale))?Number(data.text_scale) as TextScale:1,trainingPreference:["strength","endurance","hybrid"].includes(data.training_preference)?data.training_preference as TrainingPreference:"strength",showWorkoutTimingPopup:data.show_workout_timing_popup!==false,showPbPopup:data.show_pb_popup!==false};
  }

  async updateAppColour(appColour:string){
    const {error}=await this.supabase.from("profiles").update({app_colour:appColour}).eq("id",this.userId);if(error)throw error;
  }

  async load():Promise<AppData>{
    const [exerciseResult,templateResult,scheduleResult,workoutResult]=await Promise.all([
      this.supabase.from("exercises").select("id,name,muscle_group,equipment").order("name"),
      this.supabase.from("workout_templates").select("*,template_supersets(*),template_exercises(*),template_warmup_items(*)").order("created_at"),
      this.supabase.from("scheduled_workouts").select("*,workout_templates(client_id)"),
      this.supabase.from("workouts").select("*,workout_templates(client_id),workout_warmup_items(*),workout_exercises(*,workout_sets(*))").eq("status","completed").order("workout_date",{ascending:false}),
    ]);
    const error=exerciseResult.error||templateResult.error||scheduleResult.error||workoutResult.error;if(error)throw error;
    const exercises=(exerciseResult.data||[]).map((row:AnyRow):Exercise=>({id:row.id,name:row.name,group:row.muscle_group,equipment:row.equipment}));
    const templates=(templateResult.data||[]).map((row:AnyRow):Template=>{
      const supersets=new Map((row.template_supersets||[]).map((item:AnyRow)=>[item.id,item]));
      const supersetNames=Object.fromEntries((row.template_supersets as AnyRow[]||[]).map((item:AnyRow)=>[String(item.client_group_key),String(item.name||"")]));
      return {id:row.client_id||row.id,name:row.name,focus:row.focus,color:row.colour,icon:row.icon,supersetNames:supersetNames as Record<string,string>,warmup:(row.template_warmup_items||[]).sort((a:AnyRow,b:AnyRow)=>a.position-b.position).map((item:AnyRow)=>({id:String(item.client_id||item.id),kind:item.item_type==="exercise"?"exercise":"instruction",exerciseId:item.exercise_id?String(item.exercise_id):undefined,title:String(item.title||""),instructions:String(item.instructions||"")})),exercises:(row.template_exercises||[]).sort((a:AnyRow,b:AnyRow)=>a.position-b.position).map((item:AnyRow)=>({exerciseId:item.exercise_id,sets:item.planned_sets,reps:item.rep_target,group:item.superset_id?(supersets.get(item.superset_id) as AnyRow)?.client_group_key:undefined,note:item.notes||""}))};
    });
    const scheduled=(scheduleResult.data||[]).map((row:AnyRow):ScheduledWorkout=>({date:row.scheduled_date,templateId:row.workout_templates?.client_id||row.template_id,skipped:row.skipped}));
    const workouts=(workoutResult.data||[]).map((row:AnyRow)=>this.mapWorkout(row));
    return {exercises,templates,scheduled,workouts};
  }

  async loadDraft():Promise<Workout|null>{
    const {data,error}=await this.supabase.from("workouts").select("*,workout_templates(client_id),workout_warmup_items(*),workout_exercises(*,workout_sets(*))").eq("status","in_progress").order("updated_at",{ascending:false}).limit(1).maybeSingle();
    if(error)throw error;return data?this.mapWorkout(data as AnyRow):null;
  }

  private mapWorkout(row:AnyRow):Workout{
    const template=row.workout_templates as AnyRow|null;
    const exercises=(row.workout_exercises as AnyRow[]||[]).sort((a,b)=>Number(a.position)-Number(b.position));
    const warmup=(row.workout_warmup_items as AnyRow[]||[]).sort((a,b)=>Number(a.position)-Number(b.position)).map(item=>({id:String(item.client_id||item.id),kind:(item.item_type==="exercise"?"exercise":"instruction") as "exercise"|"instruction",exerciseId:item.exercise_id?String(item.exercise_id):undefined,title:String(item.title||""),instructions:String(item.instructions||""),done:Boolean(item.completed)}));
    return {id:String(row.client_id||row.id),templateId:template?.client_id?String(template.client_id):undefined,name:String(row.name),date:String(row.workout_date),startedAt:row.started_at?String(row.started_at).slice(0,5):"",endedAt:row.ended_at?String(row.ended_at).slice(0,5):undefined,duration:0,note:String(row.notes||""),warmup,exercises:exercises.map(item=>{const sets=(item.workout_sets as AnyRow[]||[]).sort((a,b)=>Number(a.set_number)-Number(b.set_number)).map(set=>({reps:String(set.reps||""),weight:String(set.load_text??set.weight??""),rpe:String(set.rpe||""),done:Boolean(set.completed),note:String(set.notes||"")}));const loadMode:LoadMode=item.load_mode==="kg"?"kg":sets.length>0&&sets.every(set=>set.weight.toUpperCase()==="BW")?"bw":"band";return {exerciseId:String(item.exercise_id),group:item.superset_key?String(item.superset_key):undefined,note:String(item.notes||""),planNote:String(item.planning_notes||""),repTarget:item.rep_target?String(item.rep_target):undefined,loadMode,skipped:Boolean(item.skipped),sets};})};
  }

  private async templateUuid(clientId:string){const {data,error}=await this.supabase.from("workout_templates").select("id").eq("user_id",this.userId).eq("client_id",clientId).maybeSingle();if(error)throw error;return data?.id as string|undefined}

  async saveTemplate(template:Template){
    const {data,error}=await this.supabase.from("workout_templates").upsert({user_id:this.userId,client_id:template.id,name:template.name,focus:template.focus,colour:template.color||"#409ECE",icon:template.icon||"◆"},{onConflict:"user_id,client_id"}).select("id").single();if(error)throw error;
    const templateId=data.id as string;
    const {error:deleteWarmupError}=await this.supabase.from("template_warmup_items").delete().eq("template_id",templateId);if(deleteWarmupError)throw deleteWarmupError;
    const {error:deleteExerciseError}=await this.supabase.from("template_exercises").delete().eq("template_id",templateId);if(deleteExerciseError)throw deleteExerciseError;
    const {error:deleteSupersetError}=await this.supabase.from("template_supersets").delete().eq("template_id",templateId);if(deleteSupersetError)throw deleteSupersetError;
    const groups=[...new Set(template.exercises.map(item=>item.group).filter((value):value is string=>Boolean(value)))];
    let groupIds=new Map<string,string>();
    if(groups.length){const {data:groupRows,error:groupError}=await this.supabase.from("template_supersets").insert(groups.map((group,index)=>({user_id:this.userId,template_id:templateId,client_group_key:group,name:template.supersetNames?.[group]||null,position:index}))).select("id,client_group_key");if(groupError)throw groupError;groupIds=new Map((groupRows||[]).map((row:AnyRow)=>[row.client_group_key,row.id]));}
    if(template.warmup?.length){const {error:warmupError}=await this.supabase.from("template_warmup_items").insert(template.warmup.map((item,index)=>({user_id:this.userId,template_id:templateId,client_id:item.id,item_type:item.kind,exercise_id:item.kind==="exercise"?item.exerciseId:null,title:item.title||"",instructions:item.instructions||"",position:index})));if(warmupError)throw warmupError;}
    if(template.exercises.length){const {error:exerciseError}=await this.supabase.from("template_exercises").insert(template.exercises.map((item,index)=>({user_id:this.userId,template_id:templateId,exercise_id:item.exerciseId,superset_id:item.group?groupIds.get(item.group):null,position:index,planned_sets:item.sets,rep_target:item.reps,notes:item.note||""})));if(exerciseError)throw exerciseError;}
  }

  async deleteTemplate(clientId:string){const id=await this.templateUuid(clientId);if(!id)return;const {error}=await this.supabase.from("workout_templates").delete().eq("id",id);if(error)throw error}

  async replaceSchedule(items:ScheduledWorkout[]){
    const {error:deleteError}=await this.supabase.from("scheduled_workouts").delete().eq("user_id",this.userId);if(deleteError)throw deleteError;
    const rows=[];for(const item of items){const id=await this.templateUuid(item.templateId);if(id)rows.push({user_id:this.userId,template_id:id,scheduled_date:item.date,skipped:Boolean(item.skipped)})}
    if(rows.length){const {error}=await this.supabase.from("scheduled_workouts").insert(rows);if(error)throw error}
  }

  async saveWorkout(workout:Workout,status:"in_progress"|"completed"="completed"){
    const templateId=workout.templateId?await this.templateUuid(workout.templateId):undefined;
    const {data,error}=await this.supabase.from("workouts").upsert({user_id:this.userId,client_id:workout.id,template_id:templateId||null,status,name:workout.name,workout_date:workout.date,started_at:workout.startedAt||null,ended_at:workout.endedAt||null,notes:workout.note||"",completed_at:status==="completed"?new Date().toISOString():null},{onConflict:"user_id,client_id"}).select("id").single();if(error)throw error;
    const workoutId=data.id as string;const {error:deleteError}=await this.supabase.from("workout_exercises").delete().eq("workout_id",workoutId);if(deleteError)throw deleteError;
    const {error:deleteWarmupError}=await this.supabase.from("workout_warmup_items").delete().eq("workout_id",workoutId);if(deleteWarmupError)throw deleteWarmupError;
    if(workout.warmup?.length){const {error:warmupError}=await this.supabase.from("workout_warmup_items").insert(workout.warmup.map((item,index)=>({user_id:this.userId,workout_id:workoutId,client_id:item.id,item_type:item.kind,exercise_id:item.kind==="exercise"?item.exerciseId:null,title:item.title||"",instructions:item.instructions||"",position:index,completed:Boolean(item.done)})));if(warmupError)throw warmupError;}
    for(const [position,item] of workout.exercises.entries()){
      const loadMode=item.loadMode||"kg";const {data:exerciseRow,error:exerciseError}=await this.supabase.from("workout_exercises").insert({user_id:this.userId,workout_id:workoutId,exercise_id:item.exerciseId,position,superset_key:item.group||null,superset_name:item.group?workout.supersetNames?.[item.group]||null:null,notes:item.note||"",planning_notes:item.planNote||"",rep_target:item.repTarget||null,load_mode:loadMode==="kg"?"kg":"text",skipped:Boolean(item.skipped)}).select("id").single();if(exerciseError)throw exerciseError;
      if(item.sets.length){const {error:setError}=await this.supabase.from("workout_sets").insert(item.sets.map((set,index)=>({user_id:this.userId,workout_exercise_id:exerciseRow.id,set_number:index+1,weight:loadMode==="kg"?Number(set.weight)||null:null,load_text:loadMode==="band"||loadMode==="text"?set.weight||null:loadMode==="bw"?"BW":null,reps:set.reps||null,rpe:Number(set.rpe)||null,notes:set.note||"",completed:set.done})));if(setError)throw setError;}
    }
  }

  async deleteWorkout(clientId:string){const {error}=await this.supabase.from("workouts").delete().eq("user_id",this.userId).eq("client_id",clientId);if(error)throw error}

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
