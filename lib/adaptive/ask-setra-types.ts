import type {WeeklyReviewContext} from "./weekly-review-types";

export type AskSetraIntent="strength"|"endurance"|"week"|"feedback"|"goal"|"program"|"recommendation"|"medical"|"general";
export type AskSetraAnswer={facts:string[];interpretation:string|null;recommendations:string[];dataConfidence:{level:"high"|"medium"|"limited";summary:string;gaps:string[]};suggestedFollowUps:string[];safetyNote:string|null};
export type AskSetraLink={label:string;path:string;targetType:"analytics"|"weekly_review"|"goals"};
export type AskSetraContext={
  schemaVersion:"ask-setra-context-v1";
  asOf:string;
  timezone:string;
  selection:{intents:AskSetraIntent[];medicalConcern:boolean;lookbackDays:number};
  weekly:WeeklyReviewContext;
  upcomingSessions:Array<{id:string;date:string;title:string;modality:string;activityType:string;status:string}>;
  recentSessions:Array<{id:string;date:string;title:string;modality:string;activityType:string;durationMinutes:number|null;distanceKm:number|null;rpe:number|null}>;
  strengthProgress:Array<{exercise:string;sessions:number;completedSets:number;volumeKg:number;firstMaxLoadKg:number|null;latestMaxLoadKg:number|null;firstDate:string;latestDate:string}>|null;
  enduranceProgress:Array<{activityType:string;sessions:number;distanceKm:number;durationMinutes:number|null;averagePaceSecondsPerKm:number|null;averageSpeedKph:number|null;averageHeartRate:number|null;latestDate:string}>|null;
  athleteFeedback:Array<{date:string;rpe:number|null;feel:string|null;comment:string|null}>|null;
  goals:WeeklyReviewContext["goals"]|null;
  personalBests:Array<{kind:string;label:string;result:string;date:string}>|null;
  activeProgram:WeeklyReviewContext["activeProgram"];
  recentWeeklyReviews:Array<{weekStart:string;weekEnd:string;atAGlance:string[];worthNoting:string[]}>|null;
  conversation:Array<{question:string;answerSummary:string}>;
  availableLinks:AskSetraLink[];
};

export type AskSetraStoredTurn={id:string;threadId:string;question:string;status:"generating"|"ready"|"failed";answer:AskSetraAnswer|null;links:AskSetraLink[];createdAt:string;completedAt:string|null;errorMessage:string|null};
export type AskSetraThread={id:string;title:string;createdAt:string;updatedAt:string};
