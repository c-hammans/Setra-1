import type {SupabaseClient} from "@supabase/supabase-js";
import {createClient} from "@/lib/supabase/client";

export type FeedbackCategory="bug"|"idea"|"general";

export class FeedbackService{
  private supabase:SupabaseClient;
  constructor(private userId:string){this.supabase=createClient()}

  async submit(category:FeedbackCategory,message:string){
    const cleanMessage=message.trim();
    if(cleanMessage.length<5)throw new Error("Please add a little more detail before sending.");
    const {error}=await this.supabase.from("beta_feedback").insert({
      user_id:this.userId,
      category,
      message:cleanMessage,
      source:"today_page",
    });
    if(error){
      if(error.code==="42P01"||error.code==="PGRST205")throw new Error("Feedback is not available yet. Please try again shortly.");
      throw error;
    }
  }
}
