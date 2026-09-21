import test from "node:test";
import assert from "node:assert/strict";
import {normalizeWriteError,userWriteErrorMessage} from "./write-errors.ts";

test("classifies a plain PostgREST stale-write object",()=>{
  const error=normalizeWriteError({message:"STALE_WRITE: already stored",code:"P0001",details:null,hint:null});
  assert.equal(error.kind,"stale");
});

test("plain conflicts are retained with an understandable message",()=>{
  const value={message:"WRITE_CONFLICT: a newer edit exists",code:"P0001"};
  assert.equal(normalizeWriteError(value).kind,"conflict");
  assert.match(userWriteErrorMessage(value),/another device/i);
});
