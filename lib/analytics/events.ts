export type SetraAnalyticsEvent=
  |"onboarding_completed"
  |"first_session_planned"
  |"first_session_completed"
  |"template_reused"
  |"import_started"
  |"import_reviewed"
  |"import_saved"
  |"workout_abandoned"
  |"save_failed"
  |"draft_recovered"
  |"weekly_return"
  |"training_mode_used";

export type SafeAnalyticsProperties={
  modality?:"strength"|"endurance"|"hybrid";
  source?:"manual"|"template"|"import"|"schedule";
  outcome?:"success"|"failed"|"recovered";
  count?:number;
};

export interface AnalyticsAdapter{track(event:SetraAnalyticsEvent,properties?:SafeAnalyticsProperties):void}

/**
 * Privacy-safe default: no external service and no durable browser identifier.
 * A future consented provider can subscribe to this event or replace the adapter.
 */
class BrowserEventAnalytics implements AnalyticsAdapter{
  track(event:SetraAnalyticsEvent,properties:SafeAnalyticsProperties={}){if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("setra:analytics",{detail:{event,properties}}))}
}

export const analytics:AnalyticsAdapter=new BrowserEventAnalytics();
