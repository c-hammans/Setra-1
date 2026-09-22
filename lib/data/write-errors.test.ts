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

test("normalising an already-normalised transient or authentication error is idempotent",()=>{
  for(const source of [{message:"Service unavailable",status:503},{message:"Unauthorized",status:401}]){
    const first=normalizeWriteError(source);const second=normalizeWriteError(first);
    assert.equal(second,first);
    assert.equal(second.kind,first.kind);
    assert.equal(second.status,source.status);
    assert.equal(userWriteErrorMessage(second),userWriteErrorMessage(first));
  }
});

test("service to retry handler classifications and messages remain stable",()=>{
  const cases:[unknown,string,RegExp][]=[
    [{message:"network fetch failed",status:503},"transient",/retry automatically/i],
    [{message:"Authentication required",status:401},"authentication",/sign in again/i],
    [{message:"VALIDATION: duration is invalid",code:"22023"},"validation",/duration is invalid/i],
    [{message:"duplicate",code:"23505"},"duplicate",/already recorded/i],
    [{message:"WRITE_CONFLICT: changed",code:"P0001"},"conflict",/another device/i],
    [{message:"unexpected"},"permanent",/needs attention/i],
  ];
  for(const [source,kind,message] of cases){const error=normalizeWriteError(source);assert.equal(error.kind,kind);assert.match(userWriteErrorMessage(normalizeWriteError(error)),message)}
});
