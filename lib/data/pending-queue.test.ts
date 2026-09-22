import test from "node:test";
import assert from "node:assert/strict";
import {acknowledgeRevision,compactPendingChanges,hasNewerRevision,mergeUniqueOperations,nextRevision,normalizePendingChanges,selectDurablePendingLeaves,type PendingChangeBase} from "./pending-queue.ts";

test("acknowledging an old operation keeps the newer edit for the same entity",()=>{
  const first:PendingChangeBase={key:"workout:a",operationId:"op-a",revision:100,updatedAt:"2026-09-19T00:00:00.000Z"};
  const second:PendingChangeBase={key:"workout:a",operationId:"op-b",revision:101,updatedAt:"2026-09-19T00:00:01.000Z"};
  assert.deepEqual(acknowledgeRevision([first,second],first.key,first.operationId),[second]);
  assert.equal(hasNewerRevision([first,second],first.key,first.revision),true);
});

test("compacts repeated saves but keeps the newest intent",()=>{
  const first={key:"strength-template:a",kind:"save_strength_template",operationId:"one",revision:1,updatedAt:"2026-09-19T00:00:00Z",payload:{template:{name:"Old"}}};
  const second={...first,operationId:"two",revision:2,payload:{template:{name:"New"}}};
  assert.deepEqual(compactPendingChanges([first,second]),[second]);
});

test("a queued completion cannot be replaced by a later draft autosave",()=>{
  const completed={key:"workout:a",kind:"save_workout",operationId:"done",revision:1,updatedAt:"2026-09-19T00:00:00Z",payload:{status:"completed"}};
  const draft={...completed,operationId:"draft",revision:2,payload:{status:"in_progress"}};
  assert.deepEqual(compactPendingChanges([completed,draft]),[completed]);
});

test("revisions remain monotonic during rapid edits",()=>{
  const first:PendingChangeBase={key:"workout:a",operationId:"op-a",revision:9001,updatedAt:"2026-09-19T00:00:00.000Z"};
  assert.equal(nextRevision([first],first.key,9),9002);
});

test("legacy queued changes receive stable operation and revision metadata",()=>{
  const normalized=normalizePendingChanges([{key:"schedule:current",updatedAt:"2026-09-19T00:00:00.000Z"}]);
  assert.match(normalized[0].operationId,/^legacy-schedule:current-/);
  assert.ok(normalized[0].revision>0);
});

test("sequential operations retain only the explicit durable leaf",()=>{
  const root={key:"workout:a",kind:"save_workout",operationId:"root",revision:1,updatedAt:"2026-09-19T00:00:00Z",protocolVersion:2,payload:{status:"in_progress"}};
  const leaf={...root,operationId:"leaf",revision:2,updatedAt:"2026-09-19T00:01:00Z",supersedesOperationId:"root"};
  assert.deepEqual(selectDurablePendingLeaves([root,leaf]).map(item=>item.operationId),["leaf"]);
});

test("independent cross-tab operations are both retained for conflict recovery",()=>{
  const left={key:"workout:a",kind:"save_workout",operationId:"left",revision:100,updatedAt:"2026-09-19T00:00:00Z",protocolVersion:2,payload:{status:"in_progress",name:"Left"}};
  const right={...left,operationId:"right",updatedAt:"2026-09-19T00:00:00Z",payload:{status:"in_progress",name:"Right"}};
  assert.deepEqual(selectDurablePendingLeaves([left,right]).map(item=>item.operationId),["left","right"]);
});

test("rolling migration keeps unrelated legacy operations without duplicating migrated records",()=>{
  const one={operationId:"legacy-one",key:"workout:one"};
  const two={operationId:"legacy-two",key:"workout:two"};
  const current={operationId:"current-three",key:"workout:three"};
  assert.deepEqual(mergeUniqueOperations([one,two],[two,current]),[two,current,one]);
});
