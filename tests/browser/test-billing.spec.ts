import {expect,test} from "@playwright/test";
import type {BillingPublicState} from "../../lib/billing/catalogue";

const data:BillingPublicState={configured:true,required:true,plan:"free",manualPlan:"free",subscriptions:{},seats:{limit:0,active:0,pending:0},clients:[]};
for(const width of [320,1280])test(`test-only billing selects annual offer at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:800});
  const actions:unknown[]=[];
  await page.route("**/api/billing",async route=>{
    if(route.request().method()==="GET")return route.fulfill({json:data});
    actions.push(route.request().postDataJSON());
    return route.fulfill({json:{ok:true}});
  });
  await page.goto("/test-billing?billingPanel=individual&billing=return");
  await expect(page.getByText("STRIPE TEST MODE", {exact:false})).toBeVisible();
  await expect(page.getByText("returning from Checkout doesn’t unlock features",{exact:false})).toBeVisible();
  await expect(page.getByText("AUD 8.99",{exact:false})).toBeVisible();
  await page.getByRole("radio",{name:"Annual"}).check();
  await expect(page.getByText("AUD 79.99",{exact:false})).toBeVisible();
  expect(actions).toHaveLength(0);
  await page.getByRole("button",{name:"Test checkout: Premium"}).click();
  await expect.poll(()=>actions).toEqual([{action:"checkout",kind:"individual",offer:"premium_year"}]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});

test("over-capacity coaching surfaces resolution without changing funds or individual access",async({page})=>{
  const state:BillingPublicState={...data,plan:"adaptive",manualPlan:"adaptive",
    subscriptions:{coaching:{hasCustomer:true,funded:true,status:"active",product:"coach_starter",cadence:"month"}},
    seats:{limit:5,active:8,pending:0},clients:[{id:"client",name:"Existing client",funded:true}]};
  await page.route("**/api/billing",route=>route.fulfill({json:state}));
  await page.goto("/test-billing?billingPanel=coach");
  await expect(page.getByText("8 / 5 active seats")).toBeVisible();
  await expect(page.getByText("Client relationships and training have been kept.",{exact:false})).toBeVisible();
  await expect(page.getByRole("button",{name:"Manage subscription and invoices"})).toBeVisible();
});

test("missing Stripe configuration leaves existing beta access and hides checkout",async({page})=>{
  await page.route("**/api/billing",route=>route.fulfill({json:{...data,configured:false,manualPlan:"premium",plan:"premium"}}));
  const response = page.waitForResponse(result => new URL(result.url()).pathname === "/api/billing" && result.ok());
  await page.goto("/test-billing?billingPanel=individual");
  await response;
  await expect(page.getByRole("heading",{name:"Individual subscriptions"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:/Test checkout:/})).toHaveCount(0);
});
