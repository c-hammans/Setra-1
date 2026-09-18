import {createClient} from "@supabase/supabase-js";
import {supabaseUrl} from "./config";

export function createAdminClient(){
  const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!supabaseUrl||!key)throw new Error("Awards setup is incomplete. Add SUPABASE_SECRET_KEY to the server environment.");
  return createClient(supabaseUrl,key,{auth:{autoRefreshToken:false,persistSession:false}});
}

