import assert from "node:assert/strict";
import {describe,it} from "node:test";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {addCalendarDays,recurrenceDateKeys} from "./week.ts";

describe("date-only recurrence",()=>{
  it("crosses daylight-saving, month and year boundaries without changing the selected day",()=>{
    assert.deepEqual(recurrenceDateKeys("2026-09-30",7,4),["2026-09-30","2026-10-07","2026-10-14","2026-10-21"]);
    assert.equal(addCalendarDays("2026-12-31",1),"2027-01-01");
    assert.equal(addCalendarDays("2028-02-28",1),"2028-02-29");
  });
  it("keeps date-only recurrences stable in positive, zero and negative UTC offsets",()=>{
    const modulePath=fileURLToPath(new URL("./week.ts",import.meta.url));
    for(const timezone of ["Australia/Melbourne","Pacific/Auckland","UTC","America/Los_Angeles"]){
      const output=execFileSync(process.execPath,["--experimental-strip-types","--input-type=module","--eval",`import {recurrenceDateKeys} from ${JSON.stringify(modulePath)};process.stdout.write(JSON.stringify(recurrenceDateKeys("2026-09-30",14,4)))`],{env:{...process.env,TZ:timezone},encoding:"utf8"});
      assert.deepEqual(JSON.parse(output),["2026-09-30","2026-10-14","2026-10-28","2026-11-11"],timezone);
    }
  });
});
