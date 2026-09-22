import assert from "node:assert/strict";
import test from "node:test";
import {isVersionedOperation,legacyRevision} from "./write-protocol.ts";

test("only explicit v2 operations use server-version conflict semantics",()=>{
  const legacy={operationId:"legacy-op",revision:123,expectedVersion:0};
  const current={...legacy,operationId:"current-op",protocolVersion:2 as const};
  assert.equal(isVersionedOperation(legacy),false);assert.equal(legacyRevision(legacy),123);assert.equal(isVersionedOperation(current),true);
});
