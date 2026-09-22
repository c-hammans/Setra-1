import {expect,test} from "@playwright/test";

test.beforeEach(async({page})=>{await page.goto("/test-use-previous");await page.evaluate(()=>window.localStorage.clear());await page.reload();await page.getByRole("button",{name:"Reset"}).click()});

test("copies previous weight and reps together into blank fields and survives reload",async({page})=>{
  await page.getByRole("button",{name:/Use previous set/}).click();
  await expect(page.getByLabel("Visible result")).toHaveText("60 × 5 · RPE 7 · not done");
  await expect(page.getByLabel("Unrelated set")).toHaveText("10 × 3 · done");
  await page.waitForFunction(()=>JSON.parse(window.localStorage.getItem("setra-use-previous-browser-test")||"{}").exercises?.[0]?.sets?.[0]?.weight==="60");
  await page.reload();
  await expect(page.getByLabel("Visible result")).toHaveText("60 × 5 · RPE 7 · not done");
});

test("atomically replaces populated values without changing completion or another set",async({page})=>{
  await page.getByLabel("Current weight").fill("20");await page.getByLabel("Current reps").fill("2");
  await page.getByRole("button",{name:/Use previous set/}).click();
  await expect(page.getByLabel("Visible result")).toHaveText("60 × 5 · RPE 7 · not done");
  await expect(page.getByLabel("Unrelated set")).toHaveText("10 × 3 · done");
});

test("shared dialog contains forward and reverse keyboard focus and restores its trigger",async({page})=>{
  const trigger=page.getByRole("button",{name:"Open test dialog"});await trigger.focus();await trigger.click();
  const close=page.getByRole("button",{name:"Close dialog"});const secondary=page.getByRole("button",{name:"Secondary action"});
  await expect(close).toBeFocused();await page.keyboard.press("Shift+Tab");await expect(secondary).toBeFocused();await page.keyboard.press("Tab");await expect(close).toBeFocused();await close.click();await expect(trigger).toBeFocused();
});
