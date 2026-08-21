"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  user: User | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({ configured:false, loading:false, user:null, signOut:async()=>{} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,setUser]=useState<User|null>(null);
  const [loading,setLoading]=useState(isSupabaseConfigured);

  useEffect(()=>{
    if(!isSupabaseConfigured) return;
    const supabase=createClient();
    supabase.auth.getUser().then(({data})=>{setUser(data.user);setLoading(false)});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{setUser(session?.user??null);setLoading(false)});
    return ()=>subscription.unsubscribe();
  },[]);

  const value=useMemo<AuthContextValue>(()=>({configured:isSupabaseConfigured,loading,user,signOut:async()=>{if(isSupabaseConfigured)await createClient().auth.signOut()}}),[loading,user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
