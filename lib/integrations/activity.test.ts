import assert from "node:assert/strict";
import test from "node:test";
import {Encoder,Profile,type Encodable,type FileIdMesg,type LapMesg,type SessionMesg} from "@garmin/fitsdk";
import {buildCompletedActivityPayload,canonicalAdmission,dateAt,fileLimit,matchActivities,uploadPolicy,validActivityDate} from "./activity.ts";
import {buildTrainingAnalytics} from "../analytics/training-analytics.ts";
import {evaluateAwards} from "../awards/evaluator.ts";
import {parseActivity} from "./activity-parsers.ts";
import {readActivityPreview,signActivityPreview} from "./preview-token.ts";

const start=new Date("2026-01-15T13:35:00Z"),finish=new Date("2026-01-15T14:15:00Z");
function recordFit(sport:string, extra:Record<string,number|undefined>={},type="activity"){
  const encoder=new Encoder();
  encoder.writeMesg({mesgNum:Profile.MesgNum.FILE_ID,type,timeCreated:start} as Encodable<FileIdMesg>);
  encoder.writeMesg({mesgNum:Profile.MesgNum.LAP,startTime:start,timestamp:finish,totalElapsedTime:2400,totalTimerTime:2300,totalDistance:1200,...extra} as Encodable<LapMesg>);
  encoder.writeMesg({mesgNum:Profile.MesgNum.SESSION,startTime:start,timestamp:finish,sport,totalElapsedTime:2400,totalTimerTime:2300,totalDistance:1200,...extra} as Encodable<SessionMesg>);
  return new Uint8Array(encoder.close());
}
const xml=(value:string)=>new TextEncoder().encode(value).buffer;

test("official SDK FIT run, cycling and swimming preserve real timers and laps",()=>{
  for(const [format,want] of [["running","run"],["cycling","bike"],["swimming","swim"]] as const){
    const extra=format==="swimming"?{poolLength:25,numActiveLengths:48,avgHeartRate:125}:{avgPower:180,avgCadence:88,avgHeartRate:145,totalAscent:121};
    const activity=parseActivity(recordFit(format,extra).buffer,"fit");
    assert.equal(activity.sport,want);
    assert.equal(activity.metrics.activeSeconds,2300);
    assert.equal(activity.metrics.elapsedSeconds,2400);
    assert.equal(activity.finish,finish.toISOString());
    assert.equal(activity.laps[0].distanceMetres,1200);
    assert.equal(activity.metrics.powerWatts,format==="swimming"?undefined:180);
    if(format==="swimming")assert.equal(activity.metrics.poolLengthMetres,25);
    assert.doesNotMatch(JSON.stringify(activity),/latitude|longitude|positionLat|positionLong/);
  }
});

test("FIT corruption, workout files and unsupported sports are rejected",()=>{
  const bytes=recordFit("running");bytes[bytes.length-1]^=1;
  assert.throws(()=>parseActivity(bytes.buffer,"fit"),/checksum/);
  assert.throws(()=>parseActivity(recordFit("running",{},"workout").buffer,"fit"),/completed activity/);
  assert.throws(()=>parseActivity(recordFit("golf").buffer,"fit"),/sport/);
  assert.throws(()=>parseActivity(new ArrayBuffer(fileLimit+1),"fit"),/3 MB/);
});

test("TCX preserves time and distance when available and does not invent totals or averages",()=>{
  const tcx=`<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Biking">
    <Id>2026-01-15T04:00:00Z</Id><Lap StartTime="2026-01-15T04:00:00Z"><TotalTimeSeconds>100</TotalTimeSeconds><DistanceMeters>1000</DistanceMeters><AverageHeartRateBpm><Value>135</Value></AverageHeartRateBpm></Lap>
    <Lap StartTime="2026-01-15T04:01:40Z"><TotalTimeSeconds>120</TotalTimeSeconds></Lap></Activity></Activities></TrainingCenterDatabase>`;
  const activity=parseActivity(xml(tcx),"tcx");
  assert.equal(activity.sport,"bike");assert.equal(activity.metrics.activeSeconds,220);
  assert.equal(activity.metrics.distanceMetres,undefined);assert.equal(activity.metrics.heartRate,undefined);assert.equal(activity.metrics.elapsedSeconds,undefined);
  assert.equal(activity.laps[0].heartRate,135);
  assert.throws(()=>parseActivity(xml("<!DOCTYPE x [<!ENTITY a 'text'>]><x>&a;</x>"),"tcx"),/DTD/);
});

test("timestamped GPX excludes gaps between segments and keeps GPS out of normalized results",()=>{
  const data=`<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><type>Running</type>
    <trkseg><trkpt lat="0" lon="0"><time>2026-01-15T04:00:00Z</time></trkpt><trkpt lat="0" lon="0.001"><time>2026-01-15T04:01:00Z</time></trkpt></trkseg>
    <trkseg><trkpt lat="1" lon="1"><time>2026-01-15T04:02:00Z</time></trkpt><trkpt lat="1" lon="1.001"><time>2026-01-15T04:03:00Z</time></trkpt></trkseg>
    </trk></gpx>`;
  const activity=parseActivity(xml(data),"gpx");
  assert.equal(activity.metrics.distanceMetres,222);assert.equal(activity.metrics.activeSeconds,undefined);
  assert.equal(activity.metrics.elapsedSeconds,180);assert.deepEqual(activity.laps,[]);
  assert.throws(()=>parseActivity(xml(data.replaceAll("time>","invalid>")),"gpx"),/timestamp/);
  assert.throws(()=>parseActivity(xml(data.slice(0,-8)),"gpx"),/malformed/);
});

test("local dates and ambiguous matches are handled independently of source UTC",()=>{
  assert.equal(dateAt(start.toISOString(),"Australia/Melbourne"),"2026-01-16");
  assert.equal(dateAt(start.toISOString(),"America/Los_Angeles"),"2026-01-15");
  assert.equal(validActivityDate("2026-02-30"),false);
  const activity=parseActivity(recordFit("running").buffer,"fit");
  const matched=matchActivities([
    {id:"a",date:"2026-01-16",title:"Run",sport:"run",status:"planned",duration:2300,distance:1200},
    {id:"b",date:"2026-01-16",title:"Run 2",sport:"run",status:"planned"},
    {id:"c",date:"2026-01-16",title:"Already logged",sport:"run",status:"completed",duration:2300,distance:1200},
    {id:"d",date:"2026-01-16",title:"Ride",sport:"bike",status:"planned"},
  ],activity,"2026-01-16","run");
  assert.deepEqual(matched.plans.map(row=>row.id),["a","b"]);
  assert.deepEqual(matched.possibleDuplicates.map(row=>row.id),["c"]);
});

test("previews are signed and account-bound; restricted data cannot enter any aggregate",()=>{
  const activity=parseActivity(recordFit("running").buffer,"fit"),externalId="device-1";
  const token=signActivityPreview({userId:"owner",fingerprint:"hash",activity,zone:"UTC"},"server-key");
  assert.equal(readActivityPreview(token,"owner","server-key")?.activity.sport,"run");
  assert.equal(readActivityPreview(token,"other","server-key"),null);
  assert.equal(readActivityPreview(token+"a","owner","server-key"),null);
  assert.equal(canonicalAdmission({provider:"activity_file",channel:"user_file",externalId,permissions:uploadPolicy}),true);
  assert.equal(canonicalAdmission({provider:"activity_file",channel:"user_file",externalId,permissions:{...uploadPolicy,ai:false}}),false);
  for(const provider of ["strava","garmin","apple","android","coros","polar","suunto","wahoo"])
    assert.equal(canonicalAdmission({provider,channel:"connector",externalId,permissions:uploadPolicy}),false);
});

test("the canonical import summary supplies existing analytics and award metrics",()=>{
  const activity=parseActivity(recordFit("running").buffer,"fit"),date="2026-01-16";
  const payload=buildCompletedActivityPayload(activity,"run",date,date);
  assert.equal(payload.distanceMetres,1200);
  assert.equal(payload.durationSeconds,2300);
  assert.equal(payload.averageHeartRate,undefined);
  const analytics=buildTrainingAnalytics({workouts:[],exercises:[],range:"4w",today:date,weekStartsOn:1,
    enduranceSessions:[{id:"file",activityType:payload.activityType,date,status:"completed",title:payload.title,notes:"",blocks:[],distanceKm:payload.distanceMetres!/1000,
      durationMinutes:payload.durationSeconds!/60,averagePaceSecondsPerKm:payload.averagePaceSecondsPerKm}]});
  assert.equal(analytics.enduranceSessions,1);assert.equal(analytics.enduranceDistanceKm,1.2);
  const awards=evaluateAwards({today:date,timezone:"Australia/Melbourne",weekStartsOn:1,weeklySessionGoal:null,
    sessions:[{id:"file",date,modality:"endurance",activityType:payload.activityType,durationSeconds:payload.durationSeconds,distanceMetres:payload.distanceMetres}],
    volume:[],templates:[],usageDays:[],planOccurrences:[],stored:[]});
  assert.equal(awards.awards.find(item=>item.definition.id==="first_endurance")?.earned,true);
});
