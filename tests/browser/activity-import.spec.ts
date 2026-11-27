import {expect,test} from "@playwright/test";

const endpoint="**/api/integrations/activity*";
const date="2026-01-15";
const activity={format:"fit",sport:"run",start:"2026-01-15T03:00:00Z",finish:"2026-01-15T04:00:00Z",
  metrics:{elapsedSeconds:3600,activeSeconds:3450,distanceMetres:6000},laps:[{distanceMetres:1000,activeSeconds:575}],notes:[]};
const requested={id:"plan",title:"Easy run",sport:"run",date,status:"planned"};
const manual={id:"completed",title:"Previously logged run",sport:"run",date,status:"completed"};

for(const width of [320,1280])test(`activity review and explicit match at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:760});
  const body:Record<string,unknown>[]=[];
  await page.route(endpoint,async route=>{
    const request=route.request();
    if(request.method()==="GET"){
      const receipt=new URL(request.url()).searchParams.get("receipt");
      return route.fulfill({json:receipt?{receipt:{id:"saved",format:"fit",sync_status:"imported",imported_at:activity.finish,recorded_result:activity}}:{history:[]}});
    }
    if(request.headers()["content-type"].startsWith("multipart/form-data"))
      return route.fulfill({json:{token:"preview",activity,date,today:date}});
    const data=request.postDataJSON();
    if(data.action==="matches")return route.fulfill({json:{plans:[requested],possibleDuplicates:[],manual:[]}});
    body.push(data);
    return route.fulfill({json:{id:"saved",status:"imported"}});
  });
  await page.goto("/test-plan-adjustment?activityImport=1");
  await page.getByLabel("Activity file").setInputFiles({name:"activity.fit",mimeType:"application/octet-stream",buffer:Buffer.from("mock bytes")});
  await expect(page.getByRole("heading",{name:"Review activity"})).toBeVisible();
  await expect(page.getByText("FIT · Run")).toBeVisible();
  await page.getByText("Recorded laps (1)").click();
  await expect(page.getByText("They aren’t matched",{exact:false})).toBeVisible();
  await page.getByLabel("Save as").selectOption("plan");
  const save=page.getByRole("button",{name:"Save completed activity"});
  await expect(save).toBeDisabled();
  await page.getByLabel("Confirm planned session").selectOption("plan");
  await page.getByLabel("I’m allowed",{exact:false}).check();
  expect(body).toHaveLength(0);
  await save.click();
  await expect(page.getByText("Activity saved to Training history.")).toBeVisible();
  expect(body).toHaveLength(1);expect(body[0].plan).toBe("plan");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});

test("manual duplicate prompts reconciliation or cancellation",async({page})=>{
  const saves:Record<string,unknown>[]=[];
  await page.route(endpoint,async route=>{
    const request=route.request();
    if(request.method()==="GET")return route.fulfill({json:{history:[]}});
    if(request.headers()["content-type"].startsWith("multipart/form-data"))return route.fulfill({json:{token:"test",activity,date,today:date}});
    const data=request.postDataJSON();
    if(data.action==="matches")return route.fulfill({json:{plans:[],possibleDuplicates:[manual],manual:[manual]}});
    saves.push(data);return route.fulfill({json:{status:"reconciled"}});
  });
  await page.goto("/test-plan-adjustment?activityImport=1");
  const file={name:"activity.fit",mimeType:"application/octet-stream",buffer:Buffer.from("mock bytes")};
  await page.getByLabel("Activity file").setInputFiles(file);
  await expect(page.getByText("Possible duplicate")).toBeVisible();
  await page.getByRole("button",{name:"Cancel",exact:true}).click();
  expect(saves).toHaveLength(0);
  await page.getByLabel("Activity file").setInputFiles(file);
  await page.getByLabel("Save as").selectOption("manual");
  await page.getByLabel("Choose your existing activity").selectOption("completed");
  await page.getByLabel("I’m allowed",{exact:false}).check();
  await page.getByRole("button",{name:"Attach file results"}).click();
  await expect(page.getByText("Its original results were not changed.",{exact:false})).toBeVisible();
  expect(saves[0].manual).toBe("completed");
});
