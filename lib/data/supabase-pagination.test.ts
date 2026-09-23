import assert from "node:assert/strict";
import {describe,it} from "node:test";
import {loadSupabasePages} from "./supabase-pagination.ts";

describe("Supabase pagination",()=>{it("loads histories larger than a backend response page without truncation",async()=>{const source=Array.from({length:1251},(_,id)=>({id}));const rows=await loadSupabasePages(async(from,to)=>({data:source.slice(from,to+1),error:null}),500);assert.equal(rows.length,1251);assert.equal(rows.at(-1)?.id,1250)});it("does not silently return partial rows after a later-page error",async()=>{await assert.rejects(()=>loadSupabasePages(async(from)=>from===0?{data:[{id:1}],error:null}:{data:null,error:new Error("later page failed")},1),/later page failed/)})});
