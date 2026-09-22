import assert from "node:assert/strict";
import {describe,it} from "node:test";
import {withTimeout} from "./with-timeout.ts";
describe("withTimeout",()=>{it("returns completed work",async()=>assert.equal(await withTimeout(Promise.resolve("ok"),20),"ok"));it("rejects bounded work",async()=>{await assert.rejects(withTimeout(new Promise(()=>{}),5),/too long/)})});
