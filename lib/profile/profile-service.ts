import type {SupabaseClient} from "@supabase/supabase-js";
import {createClient} from "@/lib/supabase/client";
import type {AppearanceMode} from "@/lib/setra/appearance";

export type ProfileSettings={
  displayName:string;
  fullName:string;
  dateOfBirth:string;
  preferredUnit:"kg"|"lb";
  trainingGoal:string;
  experienceLevel:"beginner"|"intermediate"|"advanced"|"";
  appColour:string;
  appearanceMode:AppearanceMode;
  showWorkoutTimingPopup:boolean;
  showPbPopup:boolean;
};

const defaults:ProfileSettings={displayName:"",fullName:"",dateOfBirth:"",preferredUnit:"kg",trainingGoal:"",experienceLevel:"",appColour:"#409ECE",appearanceMode:"system",showWorkoutTimingPopup:true,showPbPopup:true};

export class ProfileService{
  private supabase:SupabaseClient;
  constructor(private userId:string){this.supabase=createClient()}

  async load():Promise<ProfileSettings>{
    const {data,error}=await this.supabase.from("profiles").select("display_name,full_name,date_of_birth,preferred_unit,training_goal,experience_level,app_colour,appearance_mode,show_workout_timing_popup,show_pb_popup").eq("id",this.userId).single();
    if(error){
      if(error.code==="42703"||error.code==="PGRST204"){
        const fallback=await this.supabase.from("profiles").select("display_name,app_colour").eq("id",this.userId).single();
        if(fallback.error)throw fallback.error;
        return {...defaults,displayName:fallback.data.display_name||"",appColour:fallback.data.app_colour||defaults.appColour};
      }
      throw error;
    }
    return {displayName:data.display_name||"",fullName:data.full_name||"",dateOfBirth:data.date_of_birth||"",preferredUnit:data.preferred_unit==="lb"?"lb":"kg",trainingGoal:data.training_goal||"",experienceLevel:["beginner","intermediate","advanced"].includes(data.experience_level)?data.experience_level:"",appColour:data.app_colour||defaults.appColour,appearanceMode:["light","dark","system"].includes(data.appearance_mode)?data.appearance_mode:"system",showWorkoutTimingPopup:data.show_workout_timing_popup!==false,showPbPopup:data.show_pb_popup!==false};
  }

  async save(settings:ProfileSettings){
    const displayName=settings.displayName.trim();
    const {error}=await this.supabase.from("profiles").update({display_name:displayName||null,full_name:settings.fullName.trim()||null,date_of_birth:settings.dateOfBirth||null,preferred_unit:settings.preferredUnit,training_goal:settings.trainingGoal.trim()||null,experience_level:settings.experienceLevel||null,app_colour:settings.appColour,appearance_mode:settings.appearanceMode,show_workout_timing_popup:settings.showWorkoutTimingPopup,show_pb_popup:settings.showPbPopup}).eq("id",this.userId);
    if(error)throw error;
    const {data:{user}}=await this.supabase.auth.getUser();
    const {error:authError}=await this.supabase.auth.updateUser({data:{...(user?.user_metadata||{}),display_name:displayName,full_name:settings.fullName.trim()}});
    if(authError)throw authError;
  }
}
