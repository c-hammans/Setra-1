import assert from "node:assert/strict";
import test from "node:test";
import {paginateExportRows,type ExportRow} from "./export-pagination.ts";

test("exports a large nested-style collection once in stable id order",async()=>{
  const source=Array.from({length:1_205},(_,index)=>({id:`row-${String(index).padStart(5,"0")}`,parent_id:`parent-${index%17}`}));
  const seen:ExportRow[]=[];let requests=0;
  const fetchPage=async(afterId:string|number|undefined,limit:number)=>{requests++;return source.filter(row=>afterId===undefined||row.id>afterId).slice(0,limit)};
  for await(const row of paginateExportRows(fetchPage,500))seen.push(row);
  assert.equal(requests,3);assert.equal(seen.length,source.length);assert.deepEqual(seen.map(row=>row.id),source.map(row=>row.id));assert.equal(new Set(seen.map(row=>row.id)).size,source.length);
});

test("fails rather than looping when a backend cursor does not advance",async()=>{
  const rows=Array.from({length:2},()=>({id:"same"}));
  await assert.rejects(async()=>{for await(const row of paginateExportRows(async()=>rows,2)){void row}},/did not advance/);
});
