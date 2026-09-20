import test from "node:test";
import assert from "node:assert/strict";
import {acknowledgeRevision,hasNewerRevision,nextRevision,normalizePendingChanges,type PendingChangeBase} from "./pending-queue.ts";

test("acknowledging an old operation keeps the newer edit for the same entity",()=>{
  const first:PendingChangeBase={key:"workout:a",operationId:"op-a",revision:100,updatedAt:"2026-09-19T00:00:00.000Z"};
  const second:PendingChangeBase={key:"workout:a",operationId:"op-b",revision:101,updatedAt:"2026-09-19T00:00:01.000Z"};
  assert.deepEqual(acknowledgeRevision([first,second],first.key,first.operationId),[second]);
  assert.equal(hasNewerRevision([first,second],first.key,first.revision),true);
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
