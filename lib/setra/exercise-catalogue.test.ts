import assert from "node:assert/strict";
import test from "node:test";
import {expandedExerciseCatalogue,mergeExerciseCatalogues} from "./exercise-catalogue.ts";

test("bodyweight squat variants have accurate equipment metadata",()=>{
  for(const id of ["air-squat","chair-squat","half-air-squat"]){
    assert.equal(expandedExerciseCatalogue.find(item=>item.id===id)?.equipment,"Bodyweight");
  }
});

test("canonical merge preserves the first reviewed record and legitimate variants",()=>{
  const merged=mergeExerciseCatalogues(
    [{id:"air-squat",name:"Air Squat",group:"Quads",equipment:"Bodyweight"}],
    [{id:"legacy-air",name:"Air Squat",group:"Quads",equipment:"Barbell"},{id:"pause-air-squat",name:"Pause Air Squat",group:"Quads",equipment:"Bodyweight"}],
  );
  assert.deepEqual(merged.map(item=>item.id),["air-squat","pause-air-squat"]);
});
