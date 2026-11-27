import type {SupabaseClient} from "@supabase/supabase-js";
import {normalizePlan,normalizeRoles,type AccessState} from "./access";

export async function readEffectiveAccess(client:SupabaseClient):Promise<AccessState|null>{
  const effective=await client.rpc("my_effective_access");
  if(effective.error){
    if(["PGRST202","42883"].includes(effective.error.code))return null;
    throw effective.error;
  }
  return {plan:normalizePlan(effective.data?.plan),roles:normalizeRoles(effective.data?.roles)};
}
