import {Decoder,Stream,type LapMesg,type SessionMesg} from "@garmin/fitsdk";
import {SaxesParser} from "saxes";
import {fileLimit,type ActivityLap,type ActivityMetrics,type FileFormat,type NormalizedActivity} from "./activity.ts";
import type {TrainingActivityType} from "../setra/types.ts";

const iso=(value:unknown)=>{
  if(typeof value==="string"&&!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value))return undefined;
  const time=value instanceof Date?value:typeof value==="string"?new Date(value):null;
  return time&&Number.isFinite(+time)?time.toISOString():undefined;
};
const metric=(value:unknown,max:number,min=0)=>{
  if(typeof value!=="number"&&(typeof value!=="string"||!/^-?\d+(?:\.\d+)?$/.test(value.trim())))return undefined;
  const number=Number(value);return Number.isFinite(number)&&number>=min&&number<=max?number:undefined;
};
const sum=(values:(number|undefined)[])=>values.length&&values.every(n=>n!==undefined)?values.reduce<number>((total,n)=>total+(n??0),0):undefined;
const seconds=(start:string,finish:string)=>Math.round((Date.parse(finish)-Date.parse(start))/1000);
const after=(start:string,seconds:number)=>new Date(Date.parse(start)+seconds*1000).toISOString();
const weighted=(laps:ActivityLap[],key:"heartRate"|"powerWatts"|"cadence")=>{
  const total=sum(laps.map(lap=>lap.activeSeconds));
  return total&&laps.every(lap=>lap[key]!=null)?laps.reduce((acc,lap)=>acc+lap.activeSeconds!*lap[key]!,0)/total:undefined;
};
function normalizedSport(raw:unknown):TrainingActivityType|null{
  switch(String(raw??"").trim().replace(/([a-z])([A-Z])/g,"$1_$2").toLowerCase().replace(/[- ]/g,"_")){
    case "running":case "run":case "trail_running":return "run";
    case "biking":case "cycling":case "bike":case "ride":case "virtualride":return "bike";
    case "swimming":case "swim":case "lap_swimming":case "open_water":return "swim";
    case "rowing":case "row":return "row";
    case "walking":case "hiking":case "walk":case "hike":return "walk_hike";
    case "elliptical":return "elliptical";
    case "cardio_training":case "cross_training":return "cross_training";
    default:return null;
  }
}
const fitMetrics=(row:Partial<SessionMesg & LapMesg>):ActivityMetrics=>({
  elapsedSeconds:metric(row.totalElapsedTime,604800,1),activeSeconds:metric(row.totalTimerTime,604800,1),
  distanceMetres:metric(row.totalDistance,2_000_000),speedMps:metric(row.enhancedAvgSpeed??row.avgSpeed,100,0.01),
  ascentMetres:metric(row.totalAscent,50000),heartRate:metric(row.avgHeartRate,260,20),
  powerWatts:metric(row.avgPower,2500),cadence:metric(row.avgCadence,350),
  swimLengths:metric(row.numActiveLengths,10000),poolLengthMetres:metric(row.poolLength,200,5),
});
function fit(bytes:ArrayBuffer):NormalizedActivity{
  const decoder=new Decoder(Stream.fromArrayBuffer(bytes));
  if(!decoder.isFIT()||!decoder.checkIntegrity())throw new Error("This FIT file is incomplete or failed its checksum.");
  const {messages,errors}=decoder.read({mergeHeartRates:false,decodeMemoGlobs:false});
  if(errors.length)throw new Error("This FIT activity could not be read safely.");
  if(messages.fileIdMesgs?.some(item=>item.type!=null&&item.type!=="activity")||messages.sessionMesgs?.length!==1)
    throw new Error("Choose a single completed activity FIT file. Workout, course and multisport files aren’t supported.");
  const row=messages.sessionMesgs[0],start=iso(row.startTime);
  if(!start)throw new Error("The activity has no reliable start time.");
  const sport=normalizedSport(row.sport==="fitnessEquipment"||row.sport==="training"?row.subSport:row.sport);
  if(!sport)throw new Error("This FIT activity sport isn’t supported.");
  const metrics=fitMetrics(row),stamp=iso(row.timestamp);
  const finish=metrics.elapsedSeconds?after(start,metrics.elapsedSeconds):stamp&&stamp>start?stamp:undefined;
  const laps=(messages.lapMesgs??[]).filter(lap=>{const time=iso(lap.startTime);return time&&time>=start&&(!finish||time<finish)}).slice(0,500).map(lap=>({...fitMetrics(lap),start:iso(lap.startTime)}));
  return {format:"fit",sport,start,finish,metrics,laps,notes:(messages.lapMesgs?.length??0)>500?["Only the first 500 laps are included."]:[]};
}

type Xml={name:string;namespace:string;attrs:Record<string,string>;value:string;children:Xml[]};
const one=(node:Xml,name:string)=>node.children.find(item=>item.name===name);
const all=(node:Xml,name:string)=>node.children.filter(item=>item.name===name);
const data=(node:Xml|undefined,name:string)=>node&&one(node,name)?.value.trim();
function xml(bytes:ArrayBuffer):Xml{
  const parser=new SaxesParser({xmlns:true});const stack:Xml[]=[];let root:Xml|undefined;let count=0;
  parser.on("doctype",()=>{throw new Error("DTD declarations are not allowed in activity files.")});
  parser.on("opentag",tag=>{
    if(++count>180000||stack.length>=40)throw new Error("This activity file is too complex to import.");
    const node:Xml={name:tag.local,namespace:tag.uri,attrs:Object.fromEntries(Object.values(tag.attributes).map(attr=>[attr.name,attr.value])),value:"",children:[]};
    if(stack.length)stack.at(-1)!.children.push(node);else root=node;stack.push(node);
  });
  parser.on("closetag",()=>{stack.pop()});
  parser.on("text",value=>{const item=stack.at(-1);if(item)item.value=(item.value+value).slice(0,512)});
  parser.on("error",()=>{throw new Error("This activity XML file is malformed.")});
  parser.write(new TextDecoder("utf-8",{fatal:true}).decode(bytes)).close();
  if(!root)throw new Error("No activity XML was found.");
  return root;
}
function tcx(root:Xml):NormalizedActivity{
  if(root.name!=="TrainingCenterDatabase"||root.namespace!=="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2")throw new Error("This isn’t a supported TCX activity file.");
  const activities=one(root,"Activities"),activityList=activities?all(activities,"Activity"):[];
  if(activityList.length!==1)throw new Error("Choose a TCX with one completed activity.");
  const activity=activityList[0],original=all(activity,"Lap");
  if(!original.length)throw new Error("This TCX contains no recorded laps.");
  const start=iso(original[0].attrs.StartTime)??iso(data(activity,"Id"));
  if(!start)throw new Error("The activity has no reliable start time.");
  const allLaps:ActivityLap[]=original.map(lap=>{
    const extensions=one(lap,"Extensions");
    const lx=extensions?.children.find(item=>item.name==="LX");
    const active=metric(data(lap,"TotalTimeSeconds"),604800,1);
    const distance=metric(data(lap,"DistanceMeters"),2_000_000);
    return {start:iso(lap.attrs.StartTime),activeSeconds:active,distanceMetres:distance,
      heartRate:metric(data(one(lap,"AverageHeartRateBpm"),"Value"),260,20),
      powerWatts:metric(data(lx,"AvgWatts"),2500),speedMps:metric(data(lx,"AvgSpeed"),100,0.01),
      cadence:metric(data(lx,"AvgRunCadence")??data(lap,"Cadence"),350)};
  });
  const times=original.flatMap(lap=>all(lap,"Track").flatMap(track=>all(track,"Trackpoint").map(point=>iso(data(point,"Time"))))).filter((s):s is string=>Boolean(s&&s>start)).sort();
  const finish=times.at(-1);
  const metrics:ActivityMetrics={activeSeconds:sum(allLaps.map(lap=>lap.activeSeconds)),elapsedSeconds:finish?seconds(start,finish):undefined,
    distanceMetres:sum(allLaps.map(lap=>lap.distanceMetres)),heartRate:weighted(allLaps,"heartRate"),powerWatts:weighted(allLaps,"powerWatts"),cadence:weighted(allLaps,"cadence")};
  return {format:"tcx",sport:normalizedSport(activity.attrs.Sport),start,finish,metrics,laps:allLaps.slice(0,500),notes:allLaps.length>500?["Only the first 500 laps are included."]:[]};
}
function gpx(root:Xml):NormalizedActivity{
  if(root.name!=="gpx"||!["http://www.topografix.com/GPX/1/1","http://www.topografix.com/GPX/1/0"].includes(root.namespace))throw new Error("This isn’t a supported GPX track.");
  const tracks=all(root,"trk");
  if(tracks.length!==1)throw new Error("Choose a GPX with one recorded track. Routes and waypoints aren’t supported.");
  const track=tracks[0],segments=all(track,"trkseg");
  let distance=0, measured=false, incomplete=false;
  const stamps:string[]=[];
  for(const seg of segments){
    let previous:{lat:number;lon:number}|null=null;
    for(const point of all(seg,"trkpt")){
      const time=iso(data(point,"time"));if(time)stamps.push(time);
      const lat=metric(point.attrs.lat,90,-90),lon=metric(point.attrs.lon,180,-180);
      if(lat==null||lon==null){incomplete=true;previous=null;continue}
      if(previous){
        const rad=Math.PI/180,delta=Math.sin((lat-previous.lat)*rad/2)**2+Math.cos(lat*rad)*Math.cos(previous.lat*rad)*Math.sin((lon-previous.lon)*rad/2)**2;
        distance+=12742000*Math.asin(Math.sqrt(Math.max(0,Math.min(1,delta))));measured=true;
      }
      previous={lat,lon};
    }
  }
  const start=stamps[0],finish=stamps.at(-1);
  if(!start||!finish||finish<=start||stamps.some((stamp,i)=>i>0&&stamp<stamps[i-1]))throw new Error("This GPX needs an ordered, timestamped track.");
  return {format:"gpx",sport:normalizedSport(data(track,"type")),start,finish,metrics:{elapsedSeconds:seconds(start,finish),distanceMetres:measured&&!incomplete?Math.round(distance):undefined},laps:[],
    notes:["GPX track distance is estimated from points within each track segment. Moving time, elevation gain and sensor averages are not inferred."]};
}
export function parseActivity(bytes:ArrayBuffer,format:FileFormat):NormalizedActivity{
  if(bytes.byteLength<14||bytes.byteLength>fileLimit)throw new Error("Choose an activity file between 14 bytes and 3 MB.");
  const activity=format==="fit"?fit(bytes):format==="tcx"?tcx(xml(bytes)):gpx(xml(bytes));
  if(Date.parse(activity.start)<Date.UTC(1989,11,31)||Date.parse(activity.start)>Date.now()+300000)throw new Error("The activity has an invalid or future start time.");
  const metrics=activity.metrics;
  for(const [key,max] of [["distanceMetres",2_000_000],["activeSeconds",604800]] as const){
    const value=metrics[key];if(value!=null&&(value<0||value>max))throw new Error("Recorded totals are outside the supported range.");
  }
  if(metrics.elapsedSeconds!=null&&(metrics.elapsedSeconds<1||metrics.elapsedSeconds>604800))throw new Error("The activity duration is outside the supported range.");
  if(metrics.activeSeconds&&metrics.elapsedSeconds&&metrics.activeSeconds>metrics.elapsedSeconds+5)metrics.elapsedSeconds=undefined;
  if(!activity.finish&&metrics.elapsedSeconds)activity.finish=after(activity.start,metrics.elapsedSeconds);
  if(activity.finish&&Date.parse(activity.finish)>Date.now()+300000)throw new Error("The activity hasn’t finished yet.");
  if(!metrics.activeSeconds&&!metrics.elapsedSeconds&&!metrics.distanceMetres)throw new Error("No usable duration or distance was recorded.");
  return activity;
}
