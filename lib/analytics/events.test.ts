import test from "node:test";
import assert from "node:assert/strict";
import {trackMilestoneOnce,trackWeeklyReturnOnce} from "./events.ts";

test("weekly return is emitted at most once per account and configured week",async()=>{
  const storage=new Map<string,string>();
  const events:string[]=[];
  const originalWindow=globalThis.window;
  const originalFetch=globalThis.fetch;
  Object.defineProperty(globalThis,"window",{configurable:true,value:{
    localStorage:{get length(){return storage.size},key:(index:number)=>Array.from(storage.keys())[index]??null,getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)},
    dispatchEvent:(event:CustomEvent)=>{events.push(event.detail.event);return true},
    addEventListener:()=>{},setTimeout,
  }});
  Object.defineProperty(globalThis,"fetch",{configurable:true,value:async()=>new Response(JSON.stringify({stored:true}),{status:200})});
  try{
    assert.equal(trackWeeklyReturnOnce("user-a","2026-09-14"),true);
    assert.equal(trackWeeklyReturnOnce("user-a","2026-09-14"),false);
    assert.equal(trackWeeklyReturnOnce("user-b","2026-09-14"),true);
    assert.equal(trackWeeklyReturnOnce("user-a","2026-09-21"),true);
    await new Promise(resolve=>setTimeout(resolve,10));
    assert.deepEqual(events,["weekly_return","weekly_return","weekly_return"]);
  }finally{
    Object.defineProperty(globalThis,"window",{configurable:true,value:originalWindow});
    Object.defineProperty(globalThis,"fetch",{configurable:true,value:originalFetch});
  }
});

test("first-account milestones are marked delivered only after acknowledgement",async()=>{
  const storage=new Map<string,string>();let requests=0;let shouldSucceed=false;
  const originalWindow=globalThis.window;const originalFetch=globalThis.fetch;
  Object.defineProperty(globalThis,"window",{configurable:true,value:{
    localStorage:{get length(){return storage.size},key:(index:number)=>Array.from(storage.keys())[index]??null,getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)},
    dispatchEvent:()=>true,addEventListener:()=>{},setTimeout,
  }});
  Object.defineProperty(globalThis,"fetch",{configurable:true,value:async()=>{requests+=1;return new Response("",{status:shouldSucceed?200:503})}});
  try{
    assert.equal(trackMilestoneOnce("user-a","first_session_planned",{modality:"strength",source:"schedule"}),true);
    await new Promise(resolve=>setTimeout(resolve,3600));
    assert.equal(storage.get("setra-analytics-milestone:user-a:first_session_planned"),undefined);
    shouldSucceed=true;
    assert.equal(trackMilestoneOnce("user-a","first_session_planned",{modality:"strength",source:"schedule"}),true);
    await new Promise(resolve=>setTimeout(resolve,20));
    assert.equal(storage.get("setra-analytics-milestone:user-a:first_session_planned"),"delivered");
    assert.equal(trackMilestoneOnce("user-a","first_session_planned",{modality:"strength",source:"schedule"}),false);
    assert.ok(requests>=4);
  }finally{Object.defineProperty(globalThis,"window",{configurable:true,value:originalWindow});Object.defineProperty(globalThis,"fetch",{configurable:true,value:originalFetch})}
});
