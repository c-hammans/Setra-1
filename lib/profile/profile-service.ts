import type {SupabaseClient} from "@supabase/supabase-js";
import {createClient} from "@/lib/supabase/client";

export type ProfileSettings={
  displayName:string;
  appColour:string;
  showWorkoutTimingPopup:boolean;
  showPbPopup:boolean;
};

const defaults:ProfileSettings={displayName:"",appColour:"#409ECE",showWorkoutTimingPopup:true,showPbPopup:true};

export class ProfileService{
  private supabase:SupabaseClient;
  constructor(private userId:string){this.supabase=createClient()}

  async load():Promise<ProfileSettings>{
    const {data,error}=await this.supabase.from("profiles").select("display_name,app_colour,show_workout_timing_popup,show_pb_popup").eq("id",this.userId).single();
    if(error){
      if(error.code==="42703"||error.code==="PGRST204"){
        const fallback=await this.supabase.from("profiles").select("display_name,app_colour").eq("id",this.userId).single();
        if(fallback.error)throw fallback.error;
        return {...defaults,displayName:fallback.data.display_name||"",appColour:fallback.data.app_colour||defaults.appColour};
      }
      throw error;
    }
    return {displayName:data.display_name||"",appColour:data.app_colour||defaults.appColour,showWorkoutTimingPopup:data.show_workout_timing_popup!==false,showPbPopup:data.show_pb_popup!==false};
  }

  async save(settings:ProfileSettings){
    const displayName=settings.displayName.trim();
    const {error}=await this.supabase.from("profiles").update({display_name:displayName||null,app_colour:settings.appColour,show_workout_timing_popup:settings.showWorkoutTimingPopup,show_pb_popup:settings.showPbPopup}).eq("id",this.userId);
    if(error)throw error;
    const {data:{user}}=await this.supabase.auth.getUser();
    const {error:authError}=await this.supabase.auth.updateUser({data:{...(user?.user_metadata||{}),display_name:displayName}});
    if(authError)throw authError;
  }
}
