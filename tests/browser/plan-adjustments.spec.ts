import {expect,test} from "@playwright/test";
import type {PlanOption,PlanProposal} from "../../lib/adaptive/plan-adjustments";

const option:PlanOption={id:"squat",session:{id:"lift",title:"Lower Body",modality:"strength",date:"2026-11-30",state:"planned",stamp:"original",blocked:false,fields:[]},
  field:{key:"exercise:0:load",label:"Squat load",value:80,unit:"kg"},proposed:82.5,min:80.25,max:82.5,step:.25};
const interval:PlanOption={...option,id:"interval",session:{...option.session,id:"run",title:"Intervals",modality:"endurance"},
  field:{key:"block:0:repetitions",label:"Repeats",value:5},proposed:4,min:4,max:4,step:1};

for(const width of [320,1280])test(`preview, edit, select, approve and undo at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:760});
  let proposal:PlanProposal={id:"preview",status:"proposed",reason:"Recorded training supports a small change",evidence:["Squat: three comparable sessions"],options:[option,interval],accepted:[],createdAt:"2026-11-27"};
  const actions:string[]=[];
  await page.route("**/api/adaptive/plan-adjustments",async route=>{
    if(route.request().method()==="GET")return route.fulfill({json:{proposals:[proposal],first:"2026-11-28",last:"2026-12-25"}});
    if(route.request().method()==="PATCH"){
      const body=route.request().postDataJSON();actions.push(body.action);
      if(body.action==="apply"){
        expect(body.changes).toEqual([{optionId:"squat",value:81.25}]);
        proposal={...proposal,status:"applied",accepted:[{option,value:81.25}]};
      }else proposal={...proposal,status:"reverted"};
    }
    return route.fulfill({json:{proposal}});
  });
  await page.goto("/test-plan-adjustment");
  await page.getByRole("button",{name:"Propose change"}).click();
  const dialog=page.getByRole("dialog");
  await expect(dialog).toContainText("Squat: three comparable sessions");
  await expect(dialog).toContainText("80 kg");
  await expect(dialog).toContainText("82.5 kg");
  expect(actions).toEqual([]);
  const bounds=await dialog.boundingBox();expect(bounds!.x).toBeGreaterThan(0);expect(bounds!.x+bounds!.width).toBeLessThan(width);
  await dialog.getByRole("checkbox").nth(1).uncheck();
  await dialog.getByRole("button",{name:"Edit values"}).click();
  await dialog.getByRole("spinbutton",{name:"Proposed Squat load"}).fill("81.25");
  await dialog.getByRole("button",{name:"Accept change",exact:true}).click();
  await expect(dialog).toContainText("81.25 kg");
  await dialog.getByRole("button",{name:"Undo adjustment"}).click();
  await expect(dialog).toContainText("Undone");
  await expect(page.getByLabel("Plan refresh calls")).toHaveText("2");
  expect(actions).toEqual(["apply","undo"]);
});

test("Premium has no proposal actions",async({page})=>{
  await page.goto("/test-plan-adjustment?plan=premium");
  await expect(page.getByRole("button",{name:"Propose change"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Plan adjustment history"})).toHaveCount(0);
});
