import {createClient} from "@/lib/supabase/client";
import type {AthleteSessionCheckin,SessionFeel} from "@/lib/setra/types";

export type AthleteCheckinModality="strength"|"endurance";

export class AthleteCheckinService{
  private client=createClient();
  async save(modality:AthleteCheckinModality,completedClientId:string,checkin:AthleteSessionCheckin){
    const {error}=await this.client.rpc("save_athlete_session_checkin",{p_modality:modality,p_completed_client_id:completedClientId,p_session_rpe:checkin.rpe??null,p_session_feel:checkin.feel??null,p_athlete_comment:checkin.comment?.trim()||""});
    if(error)throw error;
    return {...checkin,comment:checkin.comment?.trim()||undefined,updatedAt:new Date().toISOString()} satisfies AthleteSessionCheckin;
  }
}

export const sessionFeelLabel=(feel:SessionFeel)=>({easier:"Easier than expected",expected:"As expected",harder:"Harder than expected"})[feel];
