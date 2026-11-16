import {contrastColour,mixHex} from "@/lib/setra/appearance";
import type {ShareCardData,ShareMetric,ShareRenderOptions} from "@/lib/share/share-types";

const sizes={square:[1080,1080],story:[1080,1920],sticker:[1536,480]} as const;
const family="Arial, Helvetica, sans-serif";
const loadImage=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error("Image unavailable"));image.src=src});
const setCanvasFont=(context:CanvasRenderingContext2D,size:number,weight=900)=>{context.font=`${weight} ${size}px ${family}`};
const fitText=(context:CanvasRenderingContext2D,text:string,maxWidth:number,start:number,min:number,weight=900)=>{let size=start;while(size>min){setCanvasFont(context,size,weight);if(context.measureText(text).width<=maxWidth)break;size-=2}return size};
const roundedRect=(context:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number)=>{context.beginPath();context.roundRect(x,y,w,h,r)};
const drawCover=(context:CanvasRenderingContext2D,image:HTMLImageElement,width:number,height:number,xFocus:number,yFocus:number)=>{const scale=Math.max(width/image.width,height/image.height);const w=image.width*scale,h=image.height*scale;context.drawImage(image,(width-w)*(xFocus/100),(height-h)*(yFocus/100),w,h)};
const displayDate=(date?:string,weekday=false)=>date?new Intl.DateTimeFormat("en-AU",weekday?{weekday:"long"}:{day:"numeric",month:"short",year:"numeric"}).format(new Date(`${date}T12:00:00`)):"";
const sessionEyebrow=(data:ShareCardData)=>{const weekday=displayDate(data.date,true);return weekday&&weekday.toLowerCase()!==data.title.trim().toLowerCase()?weekday:data.sport==="strength"?"Strength session":data.label};

async function drawMark(context:CanvasRenderingContext2D,colour:string,x:number,y:number,size:number){
  const svg=await fetch("/setra-mark-v4.svg").then(response=>response.text());
  const tinted=svg.replace(/#000/g,colour);
  const url=URL.createObjectURL(new Blob([tinted],{type:"image/svg+xml"}));
  try{const image=await loadImage(url);context.drawImage(image,x,y,size,size)}finally{URL.revokeObjectURL(url)}
}

function drawFitted(context:CanvasRenderingContext2D,text:string,x:number,y:number,maxWidth:number,start:number,min:number,weight=900){
  setCanvasFont(context,fitText(context,text,maxWidth,start,min,weight),weight);context.fillText(text,x,y,maxWidth);
}

function drawWrapped(context:CanvasRenderingContext2D,text:string,x:number,y:number,maxWidth:number,size:number,lineHeight:number,maxLines=2,weight=900){
  setCanvasFont(context,size,weight);const words=text.split(/\s+/);const lines:string[]=[];let line="";
  for(const word of words){const candidate=line?`${line} ${word}`:word;if(context.measureText(candidate).width<=maxWidth||!line)line=candidate;else{lines.push(line);line=word;if(lines.length===maxLines-1)break}}
  if(line&&lines.length<maxLines)lines.push(line);
  if(lines.join(" ")!==text&&lines.length)lines[lines.length-1]=`${lines[lines.length-1].replace(/\s+\S*$/,"")}…`;
  lines.forEach((value,index)=>context.fillText(value,x,y+index*lineHeight,maxWidth));
}

function drawMetric(context:CanvasRenderingContext2D,metric:ShareMetric,x:number,y:number,width:number,valueSize:number,labelSize:number,ink:string){
  context.fillStyle=ink;drawFitted(context,metric.value,x,y,width,valueSize,Math.max(24,labelSize+8));
  setCanvasFont(context,labelSize,800);context.letterSpacing=`${Math.max(2,Math.round(labelSize*.12))}px`;context.fillText(metric.label.toUpperCase(),x,y+labelSize+18,width);context.letterSpacing="0px";
}

async function drawBackground(context:CanvasRenderingContext2D,width:number,height:number,options:ShareRenderOptions){
  context.clearRect(0,0,width,height);
  if(options.background==="photo"&&options.photoUrl){const photo=await loadImage(options.photoUrl);drawCover(context,photo,width,height,options.photoX,options.photoY)}
  if(options.background==="solid"){context.fillStyle=options.accent;context.fillRect(0,0,width,height)}
  if(options.background==="gradient"){const gradient=context.createLinearGradient(0,0,width,height);gradient.addColorStop(0,mixHex(options.accent,"#FFFFFF",.78));gradient.addColorStop(1,mixHex(options.accent,"#0F172A",.62));context.fillStyle=gradient;context.fillRect(0,0,width,height)}
  if(options.background==="photo"){const shade=context.createLinearGradient(0,0,0,height);shade.addColorStop(0,"rgba(15,23,42,.12)");shade.addColorStop(1,"rgba(15,23,42,.68)");context.fillStyle=shade;context.fillRect(0,0,width,height)}
}

async function drawBrand(context:CanvasRenderingContext2D,data:ShareCardData,options:ShareRenderOptions,ink:string,accent:string,x:number,y:number,width:number,compact=false){
  const mark=compact?76:70;await drawMark(context,accent,x,y,mark);context.fillStyle=ink;setCanvasFont(context,compact?48:46);context.fillText("setra",x+mark+12,y+(compact?55:51));
  context.textAlign="right";setCanvasFont(context,compact?22:23,850);context.letterSpacing=compact?"4px":"5px";context.fillText(data.label.toUpperCase(),x+width,y+(compact?48:45),width*.52);context.letterSpacing="0px";context.textAlign="left";
}

function drawFrame(context:CanvasRenderingContext2D,options:ShareRenderOptions,x:number,y:number,width:number,height:number,radius:number){
  roundedRect(context,x,y,width,height,radius);context.strokeStyle=options.background==="transparent"?mixHex(options.accent,"#FFFFFF",.52):"rgba(255,255,255,.58)";context.lineWidth=3;context.stroke();
}

async function drawCompact(context:CanvasRenderingContext2D,data:ShareCardData,options:ShareRenderOptions,width:number,height:number,ink:string,accent:string){
  const pad=44;drawFrame(context,options,12,12,width-24,height-24,70);await drawBrand(context,data,options,ink,accent,pad,44,width-pad*2,true);
  context.strokeStyle=accent;context.lineWidth=5;context.beginPath();context.moveTo(238,58);context.lineTo(238,height-58);context.stroke();
  if(data.kind==="pb"){
    const badgeBackground=options.background==="transparent"?options.accent:options.textTone==="light"?"rgba(255,255,255,.16)":"rgba(15,23,42,.1)";
    const badgeText=options.background==="transparent"?contrastColour(options.accent):ink;
    context.fillStyle=badgeBackground;roundedRect(context,274,54,190,48,24);context.fill();context.fillStyle=badgeText;setCanvasFont(context,22,900);context.textAlign="center";context.fillText("NEW PB",369,86);context.textAlign="left";
    context.fillStyle=ink;drawFitted(context,data.title,274,176,650,58,34);drawFitted(context,`${data.result}${data.secondary?` ${data.secondary}`:""}`,274,300,870,100,54);
    if(data.improvement){context.fillStyle=accent;drawFitted(context,data.improvement,1190,300,300,72,42);context.fillStyle=ink}
    return;
  }
  if(data.kind==="award"){context.fillStyle=accent;setCanvasFont(context,23,900);context.fillText("AWARD EARNED",274,100);context.fillStyle=ink;drawFitted(context,data.result,274,220,1180,92,48);drawFitted(context,data.title,274,315,1180,44,28,800);return}
  const primary=data.sport==="strength"?data.metrics.slice(0,2):[{label:data.title,value:data.result}],secondary=data.sport==="strength"?data.metrics.slice(2,4):data.metrics.slice(0,2);
  context.fillStyle=accent;setCanvasFont(context,21,900);context.letterSpacing="3px";context.fillText(sessionEyebrow(data).toUpperCase(),274,88);context.letterSpacing="0px";context.fillStyle=ink;drawFitted(context,data.title,274,145,640,47,29);
  const metricStart=274,primaryWidth=data.sport==="strength"?245:520;primary.forEach((metric,index)=>drawMetric(context,metric,metricStart+index*(primaryWidth+24),282,primaryWidth,84,22,ink));
  const secondaryX=990,secondaryWidth=230;secondary.forEach((metric,index)=>drawMetric(context,metric,secondaryX+index*(secondaryWidth+18),260,secondaryWidth,38,18,ink));
}

async function drawFull(context:CanvasRenderingContext2D,data:ShareCardData,options:ShareRenderOptions,width:number,height:number,ink:string,accent:string){
  const story=options.format==="story",pad=story?76:62,top=story?126:58,contentTop=story?450:245;
  drawFrame(context,options,pad/2,top/2,width-pad,height-top,story?58:42);await drawBrand(context,data,options,ink,accent,pad,top,width-pad*2);
  context.fillStyle=ink;
  if(data.kind==="pb"){
    context.fillStyle=accent;setCanvasFont(context,story?30:26,900);context.letterSpacing="5px";context.fillText("NEW PB",pad,contentTop-70);context.letterSpacing="0px";context.fillStyle=ink;
    drawWrapped(context,data.title,pad,contentTop,width-pad*2,story?72:64,story?82:72,2);
    const resultY=contentTop+(story?255:225);drawFitted(context,`${data.result}${data.secondary?` ${data.secondary}`:""}`,pad,resultY,width-pad*2,story?150:132,72);
    if(data.improvement){context.fillStyle=accent;drawFitted(context,data.improvement,pad,resultY+(story?112:95),width-pad*2,story?58:50,34);context.fillStyle=ink}
  }else if(data.kind==="award"){
    context.fillStyle=accent;setCanvasFont(context,story?30:26,900);context.fillText("AWARD EARNED",pad,contentTop-60);context.fillStyle=ink;drawWrapped(context,data.result,pad,contentTop+70,width-pad*2,story?110:92,story?118:100,2);drawFitted(context,data.title,pad,contentTop+(story?350:300),width-pad*2,48,28,800);
  }else if(data.sport==="strength"){
    context.fillStyle=accent;setCanvasFont(context,story?27:23,900);context.letterSpacing="4px";context.fillText(sessionEyebrow(data).toUpperCase(),pad,contentTop-70);context.letterSpacing="0px";context.fillStyle=ink;
    drawWrapped(context,data.title,pad,contentTop,width-pad*2,story?76:66,story?86:74,2);
    const heroes=data.metrics.slice(0,2),heroY=contentTop+(story?390:315),heroWidth=(width-pad*2-48)/2;heroes.forEach((metric,index)=>{drawMetric(context,metric,pad+index*(heroWidth+48),heroY,heroWidth,story?145:122,28,ink);if(index===0){context.strokeStyle=accent;context.lineWidth=5;context.beginPath();context.moveTo(width/2,heroY-(story?130:110));context.lineTo(width/2,heroY+38);context.stroke()}});
    const secondary=data.metrics.slice(2,4),secondaryY=story?1300:820;context.strokeStyle=accent;context.lineWidth=4;context.beginPath();context.moveTo(pad,secondaryY-85);context.lineTo(width-pad,secondaryY-85);context.stroke();const secondaryWidth=(width-pad*2-40)/Math.max(1,secondary.length);secondary.forEach((metric,index)=>drawMetric(context,metric,pad+index*(secondaryWidth+40),secondaryY,secondaryWidth,story?52:44,20,ink));
  }else{
    setCanvasFont(context,story?32:28,850);context.fillText(data.title,pad,contentTop-65,width-pad*2);drawFitted(context,data.result,pad,contentTop+125,width-pad*2,story?158:136,76);
    const metricsY=story?1260:780,metrics=data.metrics.slice(0,3),metricWidth=(width-pad*2)/Math.max(1,metrics.length);metrics.forEach((metric,index)=>drawMetric(context,metric,pad+index*metricWidth,metricsY,metricWidth-24,story?52:43,19,ink));
  }
  if(data.date){context.fillStyle=ink;setCanvasFont(context,22,750);context.letterSpacing="3px";context.fillText(displayDate(data.date).toUpperCase(),pad,height-(story?130:72));context.letterSpacing="0px"}
}

export async function renderShareImage(data:ShareCardData,options:ShareRenderOptions){
  await document.fonts?.ready;const [width,height]=sizes[options.format];const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const context=canvas.getContext("2d");if(!context)throw new Error("Image unavailable");
  await drawBackground(context,width,height,options);const ink=options.textTone==="light"?"#FFFFFF":"#0F172A";const accent=options.background==="transparent"?options.accent:ink;context.fillStyle=ink;context.textBaseline="alphabetic";context.textAlign="left";
  if(options.format==="sticker")await drawCompact(context,data,options,width,height,ink,accent);else await drawFull(context,data,options,width,height,ink,accent);
  return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Image unavailable")),"image/png"));
}
