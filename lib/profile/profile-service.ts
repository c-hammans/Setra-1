import type {SupabaseClient} from "@supabase/supabase-js";
import {createClient} from "@/lib/supabase/client";
import type {AppearanceMode,TextScale} from "@/lib/setra/appearance";
import type {TrainingPreference} from "@/lib/setra/types";
import {weekStartKey,type WeekdayIndex} from "@/lib/setra/week";

export type ProfileSettings={
  displayName:string;
  fullName:string;
  dateOfBirth:string;
  preferredUnit:"kg"|"lb";
  trainingGoal:string;
  experienceLevel:"beginner"|"intermediate"|"advanced"|"";
  trainingPreference:TrainingPreference;
  appColour:string;
  appearanceMode:AppearanceMode;
  textScale:TextScale;
  showWorkoutTimingPopup:boolean;
  showPbPopup:boolean;
  weekStartsOn:WeekdayIndex;
  lastWeeklyPreviewWeekStart:string|null;
  weeklySessionGoal:number|null;
  awardsTimezone:string;
};

const defaults:ProfileSettings={displayName:"",fullName:"",dateOfBirth:"",preferredUnit:"kg",trainingGoal:"",experienceLevel:"",trainingPreference:"strength",appColour:"#409ECE",appearanceMode:"system",textScale:1,showWorkoutTimingPopup:true,showPbPopup:true,weekStartsOn:1,lastWeeklyPreviewWeekStart:null,weeklySessionGoal:null,awardsTimezone:""};

export class ProfileService{
  private supabase:SupabaseClient;
  constructor(private userId:string){this.supabase=createClient()}

  async load():Promise<ProfileSettings>{
    const {data,error}=await this.supabase.from("profiles").select("display_name,full_name,date_of_birth,preferred_unit,training_goal,experience_level,training_preference,app_colour,appearance_mode,text_scale,show_workout_timing_popup,show_pb_popup,week_starts_on,last_weekly_preview_week_start,weekly_session_goal,timezone").eq("id",this.userId).single();
    if(error){
      if(error.code==="42703"||error.code==="PGRST204"){
        const fallback=await this.supabase.from("profiles").select("display_name,app_colour").eq("id",this.userId).single();
        if(fallback.error)throw fallback.error;
        return {...defaults,displayName:fallback.data.display_name||"",appColour:fallback.data.app_colour||defaults.appColour};
      }
      throw error;
    }
    return {displayName:data.display_name||"",fullName:data.full_name||"",dateOfBirth:data.date_of_birth||"",preferredUnit:data.preferred_unit==="lb"?"lb":"kg",trainingGoal:data.training_goal||"",experienceLevel:["beginner","intermediate","advanced"].includes(data.experience_level)?data.experience_level:"",trainingPreference:["strength","endurance","hybrid"].includes(data.training_preference)?data.training_preference as TrainingPreference:"strength",appColour:data.app_colour||defaults.appColour,appearanceMode:["light","dark","system"].includes(data.appearance_mode)?data.appearance_mode:"system",textScale:[1,1.1,1.2,1.3].includes(Number(data.text_scale))?Number(data.text_scale) as TextScale:1,showWorkoutTimingPopup:data.show_workout_timing_popup!==false,showPbPopup:data.show_pb_popup!==false,weekStartsOn:Number.isInteger(data.week_starts_on)&&data.week_starts_on>=0&&data.week_starts_on<=6?data.week_starts_on as WeekdayIndex:1,lastWeeklyPreviewWeekStart:data.last_weekly_preview_week_start||null,weeklySessionGoal:data.weekly_session_goal==null?null:Number(data.weekly_session_goal),awardsTimezone:data.timezone||""};
  }

  async save(settings:ProfileSettings){
    const displayName=settings.displayName.trim();
    const weekChanged=(await this.load()).weekStartsOn!==settings.weekStartsOn;
    const {error}=await this.supabase.from("profiles").update({display_name:displayName||null,full_name:settings.fullName.trim()||null,date_of_birth:settings.dateOfBirth||null,preferred_unit:settings.preferredUnit,training_goal:settings.trainingGoal.trim()||null,experience_level:settings.experienceLevel||null,training_preference:settings.trainingPreference,app_colour:settings.appColour,appearance_mode:settings.appearanceMode,text_scale:settings.textScale,show_workout_timing_popup:settings.showWorkoutTimingPopup,show_pb_popup:settings.showPbPopup,week_starts_on:settings.weekStartsOn,last_weekly_preview_week_start:weekChanged?weekStartKey(new Date(),settings.weekStartsOn):settings.lastWeeklyPreviewWeekStart,weekly_session_goal:settings.weeklySessionGoal,timezone:settings.awardsTimezone||Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"}).eq("id",this.userId);
    if(error)throw error;
    const {data:{user}}=await this.supabase.auth.getUser();
    const {error:authError}=await this.supabase.auth.updateUser({data:{...(user?.user_metadata||{}),display_name:displayName,full_name:settings.fullName.trim()}});
    if(authError)throw authError;
  }
}
