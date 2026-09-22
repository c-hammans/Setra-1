export type SetraAnalyticsEvent=
  |"onboarding_completed"
  |"first_session_planned"
  |"first_session_completed"
  |"template_reused"
  |"import_started"
  |"import_reviewed"
  |"import_saved"
  |"import_failed"
  |"workout_abandoned"
  |"save_failed"
  |"draft_recovered"
  |"weekly_return"
  |"training_mode_used"
  |"weekly_review_used";

export type SafeAnalyticsProperties={
  modality?:"strength"|"endurance"|"hybrid";
  source?:"manual"|"template"|"import"|"schedule";
  outcome?:"success"|"failed"|"recovered";
  count?:number;
};

export interface AnalyticsAdapter{track(event:SetraAnalyticsEvent,properties?:SafeAnalyticsProperties):void}

/**
 * Privacy-safe first-party collection. Only the typed properties below are sent;
 * workout notes, profile details and exercise data never enter analytics.
 */
class BrowserEventAnalytics implements AnalyticsAdapter{
  track(event:SetraAnalyticsEvent,properties:SafeAnalyticsProperties={}){if(typeof window!=="undefined"){const detail={event,properties,clientEventId:crypto.randomUUID(),occurredAt:new Date().toISOString()};window.dispatchEvent(new CustomEvent("setra:analytics",{detail}));void fetch("/api/analytics",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(detail),keepalive:true}).catch(()=>{})}}
}

export const analytics:AnalyticsAdapter=new BrowserEventAnalytics();

export function trackWeeklyReturnOnce(userId:string,weekStart:string){
  if(typeof window==="undefined"||!userId||!weekStart)return false;
  const key=`setra-analytics-weekly-return:${userId}`;
  try{
    if(window.localStorage.getItem(key)===weekStart)return false;
    window.localStorage.setItem(key,weekStart);
  }catch{return false}
  analytics.track("weekly_return");
  return true;
}
