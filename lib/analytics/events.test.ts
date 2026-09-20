import test from "node:test";
import assert from "node:assert/strict";
import {trackWeeklyReturnOnce} from "./events.ts";

test("weekly return is emitted at most once per account and configured week",()=>{
  const storage=new Map<string,string>();
  const events:string[]=[];
  const originalWindow=globalThis.window;
  Object.defineProperty(globalThis,"window",{configurable:true,value:{
    localStorage:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)},
    dispatchEvent:(event:CustomEvent)=>{events.push(event.detail.event);return true},
  }});
  try{
    assert.equal(trackWeeklyReturnOnce("user-a","2026-09-14"),true);
    assert.equal(trackWeeklyReturnOnce("user-a","2026-09-14"),false);
    assert.equal(trackWeeklyReturnOnce("user-b","2026-09-14"),true);
    assert.equal(trackWeeklyReturnOnce("user-a","2026-09-21"),true);
    assert.deepEqual(events,["weekly_return","weekly_return","weekly_return"]);
  }finally{
    Object.defineProperty(globalThis,"window",{configurable:true,value:originalWindow});
  }
});
