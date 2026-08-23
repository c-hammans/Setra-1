import { createClient } from "@/lib/supabase/client";
import type { SubscriptionState } from "./access";
import { FREE_SUBSCRIPTION } from "./access";

export class PremiumService{
  private supabase=createClient();
  constructor(private userId:string){}

  async loadSubscription():Promise<SubscriptionState>{
    const {data,error}=await this.supabase.from("profiles").select("subscription_tier").eq("id",this.userId).single();
    if(error){
      if(error.code==="42703"||error.code==="PGRST204")return FREE_SUBSCRIPTION;
      throw error;
    }
    return {tier:data.subscription_tier==="premium"?"premium":"free",status:"active"};
  }

  async hasJoinedWaitlist(){
    const {data,error}=await this.supabase.from("premium_waitlist").select("id").eq("user_id",this.userId).maybeSingle();
    if(error){if(error.code==="42P01"||error.code==="PGRST205")return false;throw error}return Boolean(data);
  }

  async joinWaitlist(email:string,source="premium-page"){
    const normalized=email.trim().toLowerCase();
    const {error}=await this.supabase.from("premium_waitlist").insert({user_id:this.userId,email:normalized,source});
    if(error&&error.code!=="23505")throw error;
  }
}
