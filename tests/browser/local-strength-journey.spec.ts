import {expect,test} from "@playwright/test";
import type {AppData} from "../../lib/setra/types";

test.skip(process.env.SETRA_E2E_LOCAL_ONLY!=="1","Run only against a preview with no Supabase configuration");
test.setTimeout(90_000);

for(const width of [320,390,768,1280])test(`planned strength session survives edits, reload and finishing at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:820});
  await page.addInitScript(()=>{
    if(localStorage.getItem("form-strength-diary"))return;
    const now=new Date(),pad=(n:number)=>String(n).padStart(2,"0");
    const today=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    const diary:AppData={
      exercises:["Straight Arm Lat Pulldown","Cable Row","Dumbbell Front Raise"].map((name,index)=>({name,id:`audit-exercise-${index}`,group:"Upper body",equipment:"Cable"})),
      templates:[{id:"audit-template",name:"Audit Strength",focus:"Upper body",exercises:[0,1,2].map(index=>({exerciseId:`audit-exercise-${index}`,sets:2,reps:"8"}))}],
      scheduled:[{date:today,templateId:"audit-template"}],workouts:[]
    };
    localStorage.setItem("form-strength-diary",JSON.stringify(diary));
  });
  await page.goto("/");
  await page.getByRole("button",{name:"Weekly Preview",exact:true}).click();
  const preview=page.getByRole("dialog",{name:"Your week"});
  await expect(preview.getByText("Audit Strength",{exact:true})).toBeVisible();
  await preview.getByRole("button",{name:/Close/}).click();
  await page.getByRole("button",{name:/Start workout/}).click();
  const live=page.locator(".workout-screen");
  const exercises=live.locator(".live-exercise");
  await expect(exercises).toHaveCount(3);
  await expect(exercises.first().getByRole("heading",{name:"Straight Arm Lat Pulldown"})).toBeVisible();
  await exercises.first().getByLabel("Set 1 weight in kilograms").fill("25");
  await exercises.first().getByLabel("Set 1 reps").fill("9");
  await exercises.first().getByLabel("Set 1 RPE").fill("7");
  await exercises.first().getByRole("button",{name:"Complete set 1"}).click();
  await exercises.first().getByRole("button",{name:"Edit Straight Arm Lat Pulldown"}).click();
  await page.getByRole("button",{name:"Edit order"}).click();
  const ordering=page.getByRole("dialog",{name:"Edit order"});
  await ordering.getByRole("button",{name:"Reorder Straight Arm Lat Pulldown"}).press("ArrowDown");
  await ordering.getByRole("button",{name:"Done",exact:true}).click();
  await expect(exercises.nth(1).getByRole("heading",{name:"Straight Arm Lat Pulldown"})).toBeVisible();
  await expect(exercises.nth(1).getByLabel("Set 1 weight in kilograms")).toHaveValue("25");
  await expect(exercises.nth(1).getByLabel("Set 1 reps")).toHaveValue("9");
  await expect(exercises.nth(1).getByLabel("Set 1 RPE")).toHaveValue("7");
  await expect(exercises.nth(1).getByRole("button",{name:"Mark set 1 incomplete"})).toHaveAttribute("aria-pressed","true");
  await exercises.first().getByLabel("Set 1 weight in kilograms").fill("30");
  await exercises.first().getByRole("button",{name:"Edit Cable Row"}).click();
  await page.getByRole("button",{name:/Delete exercise/}).click();
  const deletion=page.getByRole("alertdialog",{name:"Delete this exercise?"});
  await expect(deletion).toBeVisible();
  await deletion.getByRole("button",{name:"Delete exercise",exact:true}).click();
  await expect(exercises).toHaveCount(2);
  await page.reload();
  const resume=page.getByRole("button",{name:/Resume/}).first();
  await expect(live.or(resume)).toBeVisible();
  if(await resume.isVisible())await resume.click();
  await expect(exercises.first().getByLabel("Set 1 weight in kilograms")).toHaveValue("25");
  await live.getByRole("button",{name:"Finish",exact:true}).click();
  const finish=page.getByRole("dialog",{name:"Confirm session"});
  await expect(finish).toBeVisible();
  const fields=finish.locator("input[type=time]");
  await expect(fields).toHaveCount(2);
  expect(await fields.evaluateAll(inputs=>{
    const [a,b]=inputs.map(input=>input.getBoundingClientRect());
    const dialog=inputs[0].closest("section")!.getBoundingClientRect();
    return Math.abs(a.width-b.width)<1&&[a,b].every(rect=>rect.left>=dialog.left&&rect.right<=dialog.right&&rect.height>=40);
  })).toBe(true);
  await fields.first().fill("07:20");
  await fields.last().fill("08:00");
  await finish.getByRole("button",{name:/Finish partial workout/}).click();
  await expect.poll(()=>page.evaluate(()=>{
    const diary=JSON.parse(localStorage.getItem("form-strength-diary")!) as AppData;
    return {count:diary.workouts.length,time:diary.workouts[0]?.endedAt,storedExercises:diary.workouts[0]?.exercises.length,templateExercises:diary.templates[0]?.exercises.length};
  })).toEqual({count:1,time:"08:00",storedExercises:2,templateExercises:3});
});
