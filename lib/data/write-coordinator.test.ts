import test from "node:test";
import assert from "node:assert/strict";
import {runOrderedWrite} from "./write-coordinator.ts";

test("explicit completion waits for an earlier autosave on the same workout",async()=>{
  const events:string[]=[];let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve});
  const autosave=runOrderedWrite("workout:ordered",async()=>{events.push("autosave-start");await gate;events.push("autosave-end")});
  const completion=runOrderedWrite("workout:ordered",async()=>{events.push("complete")});
  await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(events,["autosave-start"]);release();await Promise.all([autosave,completion]);
  assert.deepEqual(events,["autosave-start","autosave-end","complete"]);
});

test("a failed write does not block the next revision",async()=>{
  await assert.rejects(runOrderedWrite("workout:recover",async()=>{throw new Error("temporary")}),/temporary/);
  assert.equal(await runOrderedWrite("workout:recover",async()=>"saved"),"saved");
});
