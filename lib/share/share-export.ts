import {mixHex} from "@/lib/setra/appearance";
import type {ShareCardData,ShareRenderOptions} from "@/lib/share/share-types";

const sizes={square:[1080,1080],story:[1080,1920],sticker:[1536,480]} as const;
const loadImage=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error("Image unavailable"));image.src=src});
const fitText=(context:CanvasRenderingContext2D,text:string,maxWidth:number,start:number,min:number)=>{let size=start;while(size>min){context.font=`900 ${size}px Inter, Arial, sans-serif`;if(context.measureText(text).width<=maxWidth)break;size-=2}return size};
const roundedRect=(context:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number)=>{context.beginPath();context.roundRect(x,y,w,h,r)};
const drawCover=(context:CanvasRenderingContext2D,image:HTMLImageElement,width:number,height:number,xFocus:number,yFocus:number)=>{const scale=Math.max(width/image.width,height/image.height);const w=image.width*scale,h=image.height*scale;const x=(width-w)*(xFocus/100),y=(height-h)*(yFocus/100);context.drawImage(image,x,y,w,h)};
async function drawMark(context:CanvasRenderingContext2D,colour:string,x:number,y:number,size:number){
  const svg=await fetch("/setra-mark-v4.svg").then(response=>response.text());
  const tinted=svg.replace(/#000/g,colour);
  const url=URL.createObjectURL(new Blob([tinted],{type:"image/svg+xml"}));
  try{const image=await loadImage(url);context.drawImage(image,x,y,size,size)}finally{URL.revokeObjectURL(url)}
}

export async function renderShareImage(data:ShareCardData,options:ShareRenderOptions){
  await document.fonts?.ready;
  const [width,height]=sizes[options.format];const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
  const context=canvas.getContext("2d");if(!context)throw new Error("Image unavailable");
  context.clearRect(0,0,width,height);
  if(options.background==="photo"&&options.photoUrl){const photo=await loadImage(options.photoUrl);drawCover(context,photo,width,height,options.photoX,options.photoY)}
  if(options.background==="solid"){context.fillStyle=options.accent;context.fillRect(0,0,width,height)}
  if(options.background==="gradient"){const gradient=context.createLinearGradient(0,0,width,height);gradient.addColorStop(0,mixHex(options.accent,"#FFFFFF",.78));gradient.addColorStop(1,mixHex(options.accent,"#0F172A",.62));context.fillStyle=gradient;context.fillRect(0,0,width,height)}
  if(options.background==="photo"){const shade=context.createLinearGradient(0,0,0,height);shade.addColorStop(0,"rgba(15,23,42,.16)");shade.addColorStop(1,"rgba(15,23,42,.62)");context.fillStyle=shade;context.fillRect(0,0,width,height)}
  const ink=options.textTone==="light"?"#FFFFFF":"#0F172A";const accent=options.background==="transparent"?options.accent:ink;
  context.fillStyle=ink;context.textBaseline="alphabetic";context.textAlign="left";
  if(options.format==="sticker"){
    const stickerResult=data.kind==="workout"&&data.sport==="strength"?data.metrics[0]?.value||data.result:data.result;
    const stickerMetrics=data.kind==="workout"&&data.sport==="strength"?data.metrics.slice(1,3):data.metrics.slice(0,2);
    const pad=44;roundedRect(context,12,12,width-24,height-24,72);context.strokeStyle=options.background==="transparent"?mixHex(options.accent,"#FFFFFF",.62):"rgba(255,255,255,.62)";context.lineWidth=4;context.stroke();
    await drawMark(context,accent,pad,54,92);context.font="900 54px Inter, Arial, sans-serif";context.fillText("setra",150,120);
    context.font="850 26px Inter, Arial, sans-serif";context.letterSpacing="5px";context.fillText(data.label.toUpperCase(),pad,190);context.letterSpacing="0px";
    context.font=`900 ${fitText(context,stickerResult,700,112,64)}px Inter, Arial, sans-serif`;context.fillText(stickerResult,pad,310,720);
    context.font="800 36px Inter, Arial, sans-serif";context.fillText(data.title,790,145,680);
    stickerMetrics.forEach((metric,index)=>{const y=235+index*82;context.font="900 34px Inter, Arial, sans-serif";context.fillText(metric.value,790,y,300);context.font="750 20px Inter, Arial, sans-serif";context.fillText(metric.label.toUpperCase(),1110,y,330)});
  }else{
    const story=options.format==="story",pad=story?76:58,top=story?126:58,contentTop=story?470:270;
    roundedRect(context,pad/2,top/2,width-pad,height-top,story?58:42);context.strokeStyle=options.background==="transparent"?mixHex(options.accent,"#FFFFFF",.6):"rgba(255,255,255,.58)";context.lineWidth=3;context.stroke();
    await drawMark(context,accent,pad,top,70);context.font="900 49px Inter, Arial, sans-serif";context.fillText("setra",pad+82,top+54);
    context.textAlign="right";context.font="850 24px Inter, Arial, sans-serif";context.letterSpacing="6px";context.fillText(data.label.toUpperCase(),width-pad,top+45);context.letterSpacing="0px";context.textAlign="left";
    context.font="800 38px Inter, Arial, sans-serif";context.fillText(data.title,pad,contentTop, width-pad*2);
    const heroSize=fitText(context,data.result,width-pad*2,story?156:132,72);context.font=`900 ${heroSize}px Inter, Arial, sans-serif`;context.fillText(data.result,pad,contentTop+(story?190:155),width-pad*2);
    if(data.secondary){context.font="850 44px Inter, Arial, sans-serif";context.fillText(data.secondary,pad,contentTop+(story?255:215))}
    if(data.improvement){context.fillStyle=mixHex(options.accent,options.textTone==="light"?"#FFFFFF":"#0F172A",.72);context.font="900 48px Inter, Arial, sans-serif";context.fillText(data.improvement,pad,contentTop+(story?330:282));context.fillStyle=ink}
    if(data.previous){context.font="750 25px Inter, Arial, sans-serif";context.letterSpacing="2px";context.fillText(data.previous.toUpperCase(),pad,contentTop+(story?382:325));context.letterSpacing="0px"}
    const metricsY=story?1255:755,metricWidth=(width-pad*2)/Math.max(1,data.metrics.length);
    data.metrics.slice(0,3).forEach((metric,index)=>{const x=pad+index*metricWidth;context.font="900 42px Inter, Arial, sans-serif";context.fillText(metric.value,x,metricsY,metricWidth-24);context.font="750 20px Inter, Arial, sans-serif";context.letterSpacing="3px";context.fillText(metric.label.toUpperCase(),x,metricsY+38,metricWidth-24);context.letterSpacing="0px"});
    if(data.date){context.font="750 22px Inter, Arial, sans-serif";context.letterSpacing="3px";context.fillText(new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"short",year:"numeric"}).format(new Date(`${data.date}T12:00:00`)).toUpperCase(),pad,height-(story?130:72));context.letterSpacing="0px"}
  }
  return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Image unavailable")),"image/png"));
}
