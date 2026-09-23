export type SetraAnalyticsEvent=
  |"onboarding_completed"|"first_session_planned"|"first_session_completed"|"template_reused"
  |"import_started"|"import_reviewed"|"import_saved"|"import_failed"|"workout_abandoned"
  |"save_failed"|"draft_recovered"|"weekly_return"|"training_mode_used"|"weekly_review_used";

export type SafeAnalyticsProperties={modality?:"strength"|"endurance"|"hybrid";source?:"manual"|"template"|"import"|"schedule";outcome?:"success"|"failed"|"recovered";count?:number};
type AnalyticsEnvelope={event:SetraAnalyticsEvent;properties:SafeAnalyticsProperties;clientEventId:string;occurredAt:string};
export interface AnalyticsAdapter{track(event:SetraAnalyticsEvent,properties?:SafeAnalyticsProperties):Promise<boolean>}

const EVENT_PREFIX="setra-analytics-event:";const delivery=new Map<string,Promise<boolean>>();let onlineInstalled=false;
const safeGet=(key:string)=>{try{return window.localStorage.getItem(key)}catch{return null}};
const safeSet=(key:string,value:string)=>{try{window.localStorage.setItem(key,value);return true}catch{return false}};
const safeRemove=(key:string)=>{try{window.localStorage.removeItem(key)}catch{/* Delivery remains idempotent server-side. */}};
const wait=(milliseconds:number)=>new Promise(resolve=>window.setTimeout(resolve,milliseconds));

async function deliverEnvelope(value:AnalyticsEnvelope,retries=3){
  const existing=delivery.get(value.clientEventId);if(existing)return existing;
  const promise=(async()=>{
    for(let attempt=0;attempt<retries;attempt++){
      try{const response=await fetch("/api/analytics",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(value),keepalive:true});if(response.ok){safeRemove(`${EVENT_PREFIX}${value.clientEventId}`);return true}if(response.status>=400&&response.status<500&&response.status!==408&&response.status!==429)return false}catch{/* Retry transient transport failures. */}
      if(attempt<retries-1)await wait(Math.min(4000,500*2**attempt));
    }
    return false;
  })().finally(()=>delivery.delete(value.clientEventId));delivery.set(value.clientEventId,promise);return promise;
}

function installOnlineFlush(){
  if(onlineInstalled||typeof window==="undefined")return;onlineInstalled=true;
  window.addEventListener("online",()=>{try{for(let index=0;index<window.localStorage.length;index++){const key=window.localStorage.key(index);if(!key?.startsWith(EVENT_PREFIX))continue;const raw=safeGet(key);if(raw)void deliverEnvelope(JSON.parse(raw) as AnalyticsEnvelope)}}catch{/* Analytics never blocks training. */}});
}

/** Privacy-safe first-party collection with a small, durable, idempotent outbox. */
class BrowserEventAnalytics implements AnalyticsAdapter{
  track(event:SetraAnalyticsEvent,properties:SafeAnalyticsProperties={}){
    if(typeof window==="undefined")return Promise.resolve(false);installOnlineFlush();
    const value:AnalyticsEnvelope={event,properties,clientEventId:crypto.randomUUID(),occurredAt:new Date().toISOString()};
    window.dispatchEvent(new CustomEvent("setra:analytics",{detail:value}));safeSet(`${EVENT_PREFIX}${value.clientEventId}`,JSON.stringify(value));return deliverEnvelope(value);
  }
}

export const analytics:AnalyticsAdapter=new BrowserEventAnalytics();

export function trackWeeklyReturnOnce(userId:string,weekStart:string){
  if(typeof window==="undefined"||!userId||!weekStart)return false;
  const deliveredKey=`setra-analytics-weekly-return:${userId}`;const pendingKey=`setra-analytics-weekly-return-pending:${userId}`;
  if(safeGet(deliveredKey)===weekStart)return false;
  try{
    const existing=JSON.parse(safeGet(pendingKey)||"null") as {weekStart:string;event:AnalyticsEnvelope}|null;
    if(existing?.weekStart===weekStart){void deliverEnvelope(existing.event).then(ok=>{if(ok){safeSet(deliveredKey,weekStart);safeRemove(pendingKey)}});return false}
  }catch{safeRemove(pendingKey)}
  const event:AnalyticsEnvelope={event:"weekly_return",properties:{},clientEventId:crypto.randomUUID(),occurredAt:new Date().toISOString()};
  if(!safeSet(pendingKey,JSON.stringify({weekStart,event})))return false;
  window.dispatchEvent(new CustomEvent("setra:analytics",{detail:event}));safeSet(`${EVENT_PREFIX}${event.clientEventId}`,JSON.stringify(event));void deliverEnvelope(event).then(ok=>{if(ok){safeSet(deliveredKey,weekStart);safeRemove(pendingKey)}});return true;
}

/** Account-scoped milestone delivery. The server also enforces one row per milestone event. */
export function trackMilestoneOnce(userId:string,event:"first_session_planned"|"first_session_completed",properties:SafeAnalyticsProperties){
  if(typeof window==="undefined"||!userId)return false;
  const deliveredKey=`setra-analytics-milestone:${userId}:${event}`;
  const pendingKey=`${deliveredKey}:pending`;
  if(safeGet(deliveredKey)==="delivered")return false;
  let envelope:AnalyticsEnvelope|null=null;
  try{envelope=JSON.parse(safeGet(pendingKey)||"null") as AnalyticsEnvelope|null}catch{safeRemove(pendingKey)}
  if(!envelope){envelope={event,properties,clientEventId:crypto.randomUUID(),occurredAt:new Date().toISOString()};if(!safeSet(pendingKey,JSON.stringify(envelope)))return false;window.dispatchEvent(new CustomEvent("setra:analytics",{detail:envelope}));safeSet(`${EVENT_PREFIX}${envelope.clientEventId}`,JSON.stringify(envelope))}
  void deliverEnvelope(envelope).then(ok=>{if(ok){safeSet(deliveredKey,"delivered");safeRemove(pendingKey)}});
  return true;
}
