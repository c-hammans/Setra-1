import assert from "node:assert/strict";
import test from "node:test";
import {canonicalLoadInput,displayToKilograms,formatLoad,kilogramsToDisplay} from "./units.ts";

test("kilograms remain unchanged in canonical kg mode",()=>{
  assert.equal(displayToKilograms(72.5,"kg"),72.5);
  assert.equal(formatLoad(72.5,"kg"),"72.5 kg");
});

test("pounds round-trip without cumulative conversion drift",()=>{
  const original=80;
  const pounds=kilogramsToDisplay(original,"lb");
  assert.ok(Math.abs(displayToKilograms(pounds,"lb")-original)<0.001);
  let canonical=String(original);
  for(let index=0;index<20;index+=1)canonical=canonicalLoadInput(String(kilogramsToDisplay(Number(canonical),"lb")),"lb");
  assert.ok(Math.abs(Number(canonical)-original)<0.001);
});

test("historic kilograms are displayed, not reinterpreted, when pounds are selected",()=>{
  assert.equal(formatLoad(100,"lb"),"220.5 lb");
});
