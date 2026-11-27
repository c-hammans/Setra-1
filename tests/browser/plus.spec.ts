import {expect,test} from "@playwright/test";

for(const width of [320,1280])test(`locked Plus features show relevant plans at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:760});
  await page.goto("/test-plan-adjustment?plusHub&plan=free");
  const feature=page.getByRole("button",{name:/Advanced analytics/});
  await feature.click();
  const dialog=page.getByRole("dialog",{name:"Advanced analytics"});
  await expect(dialog.getByRole("heading",{name:"Premium",exact:true})).toBeVisible();
  await expect(dialog.getByRole("heading",{name:"Adaptive",exact:true})).toBeVisible();
  await expect(dialog.getByRole("link",{name:"Compare plans"})).toHaveAttribute("href","#plans");
  const bounds=(await dialog.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button",{name:/Ask Setra/}).click();
  const adaptive=page.getByRole("dialog",{name:"Ask Setra"});
  await expect(adaptive.getByRole("heading",{name:"Adaptive",exact:true})).toBeVisible();
  await expect(adaptive.getByRole("heading",{name:"Premium",exact:true})).toHaveCount(0);
});

test("accessible tools open their destination, while upcoming tools stay marked",async({page})=>{
  await page.goto("/test-plan-adjustment?plusHub&plan=adaptive");
  await expect(page.getByRole("link",{name:/Advanced analytics/})).toHaveAttribute("href","/?tab=history&view=progress#advanced-analytics");
  await expect(page.getByRole("link",{name:/Ask Setra/})).toHaveAttribute("href","/?tab=history&view=progress#ask-setra");
  await page.getByRole("button",{name:"Show upcoming features"}).click();
  await page.getByRole("button",{name:/Image and file workout import/}).click();
  await expect(page.getByRole("dialog")).toContainText("Changing plans won’t unlock this feature yet.");
});
