import test from "node:test";
import assert from "node:assert/strict";
import {availabilityForDate,availabilityStatus,unavailableAssignmentWarnings} from "./availability.ts";
import type {ClientTrainingAvailability} from "./types.ts";

const availability:ClientTrainingAvailability={preferredDays:[1,6],unavailableDays:[3],restDays:[5],preferredSessionTimes:{1:"Before 8am",2:"Max 60 min"},notes:"Gym weekdays",oneOffDates:[{id:"one",date:"2026-11-24",note:"Travel"}]};

test("recurring availability distinguishes preferred, rest and unavailable days",()=>{
  assert.equal(availabilityStatus(availability,1),"preferred");
  assert.equal(availabilityStatus(availability,3),"unavailable");
  assert.equal(availabilityStatus(availability,5),"rest");
  assert.equal(availabilityStatus(availability,2),"available");
});

test("one-off unavailable dates override recurring preferences",()=>{
  assert.deepEqual(availabilityForDate(availability,"2026-11-24"),{day:2,status:"unavailable",time:"Max 60 min",note:"Travel",oneOff:true});
});

test("assignment warnings include only unavailable dates",()=>{
  const warnings=unavailableAssignmentWarnings(availability,["2026-11-23","2026-11-24","2026-11-25"]);
  assert.deepEqual(warnings.map(item=>item.date),["2026-11-24","2026-11-25"]);
});
