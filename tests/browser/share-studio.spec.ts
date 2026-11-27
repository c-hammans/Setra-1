import {readFile} from "node:fs/promises";
import {expect,test,type Page} from "@playwright/test";

const drawPhoto=(page:Page,colour:string)=>page.evaluate((fill)=>{
  const canvas=document.createElement("canvas");canvas.width=100;canvas.height=40;
  const context=canvas.getContext("2d")!;context.fillStyle=fill;context.fillRect(0,0,100,40);
  return canvas.toDataURL("image/png").split(",")[1];
},colour);

async function saveAndInspect(page:Page){
  const prepare=page.getByRole("button",{name:"Download PNG",exact:true});
  if(await prepare.isVisible())await prepare.click();
  const download=page.getByRole("link",{name:"Download file"});
  await expect(download).toHaveAttribute("href",/^blob:/);
  const downloadPromise=page.waitForEvent("download");
  await download.click();
  const file=await downloadPromise;
  const src="data:image/png;base64,"+(await readFile((await file.path())!)).toString("base64");
  return page.evaluate(async source=>{
    const image=new Image();image.src=source;await image.decode();
    const canvas=document.createElement("canvas");canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext("2d")!;
    context.drawImage(image,0,0);return {width:image.width,height:image.height,pixel:Array.from(context.getImageData(0,0,1,1).data),centreAlpha:context.getImageData(Math.floor(image.width/2),10+Math.floor(image.height/2),1,1).data[3]};
  },src);
}

for(const width of [320,390,768,1280])test(`share tiles stay inside their modal and export clean PNGs at ${width}px`,async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,"canShare",{value:()=>false}));
  await page.setViewportSize({width,height:820});
  await page.goto("/test-plan-adjustment?shareStudio");
  await page.getByRole("button",{name:"Open share card"}).click();
  const dialog=page.getByRole("dialog",{name:"Make it yours"});
  await expect(dialog).toBeVisible();
  const preview=dialog.locator(".share-preview");
  const visibleBounds=async()=>expect(await preview.evaluate(element=>{
    const rect=element.getBoundingClientRect();
    return rect.left>=0&&rect.right<=window.innerWidth&&rect.height>0&&element.clientWidth>=element.scrollWidth-1;
  })).toBe(true);
  for(const tile of ["Long Wednesday Strength Session","Single Arm Dumbbell Overhead Press"]){
    await dialog.getByRole("button",{name:tile,exact:true}).click();
    for(const format of ["Full","Compact"]){
      await dialog.getByRole("button",{name:format,exact:true}).click();
      await visibleBounds();
      if(width===320){
        const result=await saveAndInspect(page);
        expect(result).toMatchObject(format==="Full"?{width:1080,height:1080,pixel:[0,0,0,0]}:{width:1536,height:480,pixel:[0,0,0,0]});
      }
    }
  }
  await dialog.getByRole("button",{name:"Photo",exact:true}).click();
  const picker=dialog.locator("input[type=file]");
  await picker.setInputFiles([]);
  await visibleBounds();
  await expect(dialog.getByText("Choose an image to place it inside the tile.")).toBeVisible();
  const colour=await drawPhoto(page,"#e45015");
  for(const name of ["selected.png","replacement.png"]){
    await picker.setInputFiles({name,mimeType:"image/png",buffer:Buffer.from(colour,"base64")});
    await expect(dialog.getByRole("img",{name:"Selected share background"})).toBeVisible();
    await visibleBounds();
  }
  const photoExport=await saveAndInspect(page);
  expect(photoExport.pixel[3]).toBe(0);
  expect(photoExport.centreAlpha).toBe(255);
  if(width===320)for(const mode of ["Solid","Gradient"]){
    await dialog.getByRole("button",{name:mode,exact:true}).click();
    expect((await saveAndInspect(page)).pixel[3]).toBe(255);
  }
  await dialog.getByRole("button",{name:"Close share card"}).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button",{name:"Open share card"}).click();
  await expect(dialog.getByRole("button",{name:"Transparent",exact:true})).toHaveAttribute("aria-pressed","true");
});

test("expired native share gesture can use the prepared image without rendering a second time",async({page})=>{
  await page.addInitScript(()=>{
    let attempts=0;let renders=0;
    const original=HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob=function(...args){renders++;return original.apply(this,args)};
    Object.defineProperty(navigator,"canShare",{value:()=>true});
    Object.defineProperty(navigator,"share",{value:async()=>{
      document.body.dataset.shareAttempts=String(++attempts);
      document.body.dataset.renderAttempts=String(renders);
      if(attempts===1)throw new DOMException("Expired activation","NotAllowedError");
    }});
  });
  await page.goto("/test-plan-adjustment?shareStudio");
  await page.getByRole("button",{name:"Open share card"}).click();
  await page.getByRole("button",{name:"Share",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("Your image is ready");
  await page.getByRole("button",{name:"Open share sheet"}).click();
  await expect(page.locator("body")).toHaveAttribute("data-share-attempts","2");
  await expect(page.locator("body")).toHaveAttribute("data-render-attempts","1");
});

test("Download PNG does not open native sharing on a share-capable browser",async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,"canShare",{value:()=>true});
    Object.defineProperty(navigator,"share",{value:()=>{document.body.dataset.unexpectedShare="true"}});
  });
  await page.goto("/test-plan-adjustment?shareStudio");
  await page.getByRole("button",{name:"Open share card"}).click();
  await saveAndInspect(page);
  await expect(page.locator("body")).not.toHaveAttribute("data-unexpected-share","true");
});
