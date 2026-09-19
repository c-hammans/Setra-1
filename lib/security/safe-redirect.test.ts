import assert from "node:assert/strict";
import test from "node:test";
import {safeInternalRedirect} from "./safe-redirect.ts";

test("accepts same-origin paths",()=>{
  assert.equal(safeInternalRedirect("/profile"),"/profile");
  assert.equal(safeInternalRedirect("/?tab=history"),"/?tab=history");
});

test("rejects protocol-relative, encoded and backslash redirects",()=>{
  for(const value of ["//evil.example","/%2f%2fevil.example","/\\evil.example","https://evil.example",null])assert.equal(safeInternalRedirect(value),"/");
});
