import type {SafeAnalyticsProperties,SetraAnalyticsEvent} from "./events";
const events=new Set<SetraAnalyticsEvent>(["onboarding_completed","first_session_planned","first_session_completed","template_reused","import_started","import_reviewed","import_saved","import_failed","workout_abandoned","save_failed","draft_recovered","weekly_return","training_mode_used","weekly_review_used"]);
export function sanitizeAnalyticsEvent(input:unknown){
  if(!input||typeof input!=="object")throw new Error("Invalid analytics event.");const raw=input as Record<string,unknown>;
  if(typeof raw.event!=="string"||!events.has(raw.event as SetraAnalyticsEvent))throw new Error("Unsupported analytics event.");
  if(typeof raw.clientEventId!=="string"||!/^[0-9a-f-]{36}$/i.test(raw.clientEventId))throw new Error("Invalid event identity.");
  const source=raw.properties&&typeof raw.properties==="object"?raw.properties as Record<string,unknown>:{};const properties:SafeAnalyticsProperties={};
  if(source.modality==="strength"||source.modality==="endurance"||source.modality==="hybrid")properties.modality=source.modality;
  if(source.source==="manual"||source.source==="template"||source.source==="import"||source.source==="schedule")properties.source=source.source;
  if(source.outcome==="success"||source.outcome==="failed"||source.outcome==="recovered")properties.outcome=source.outcome;
  if(typeof source.count==="number"&&Number.isSafeInteger(source.count)&&source.count>=0&&source.count<=1000000)properties.count=source.count;
  return{event:raw.event as SetraAnalyticsEvent,clientEventId:raw.clientEventId,occurredAt:typeof raw.occurredAt==="string"?raw.occurredAt:new Date().toISOString(),properties};
}
