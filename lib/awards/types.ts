import type {TrainingActivityType} from "@/lib/setra/types";
import type {WeekdayIndex} from "@/lib/setra/week";

export type AwardCategory="consistency"|"training"|"strength"|"endurance"|"hybrid"|"setra"|"special";
export type AwardMetric=
  |"sessions_completed"|"training_day_streak"|"active_week_streak"|"weekly_goal_streak"|"planned_week_streak"|"setra_use_streak"
  |"training_hours"|"run_distance_km"|"bike_distance_km"|"swim_distance_km"|"row_distance_km"|"walk_distance_km"
  |"strength_volume_kg"|"hybrid_weeks"|"first_strength"|"first_endurance"|"first_planned_completion"|"templates_created"
  |"early_sessions"|"late_sessions"|"weekends_trained"|"activity_variety"|"double_days"|"back_at_it"|"first_full_planned_week";

export type AchievementDefinition={
  id:string;category:AwardCategory;title:string;description:string;requirement:string;metric:AwardMetric;threshold:number;
  icon:string;secret?:boolean;shareable?:boolean;unit?:string;
};

export type AwardSessionFact={
  id:string;date:string;modality:"strength"|"endurance";activityType:TrainingActivityType|"strength";durationSeconds?:number;
  distanceMetres?:number;startedLocalTime?:string;plannedSessionId?:string;
};
export type AwardVolumeFact={date:string;kilograms:number};
export type AwardTemplateFact={id:string;createdDate:string;modality:"strength"|"endurance"};
export type AwardPlanOccurrence={
  key:string;date:string;modality:"strength"|"endurance";status:"planned"|"completed"|"skipped"|"cancelled"|"rescheduled";
};
export type StoredAchievement={achievementId:string;earnedAt:string;metadata:Record<string,unknown>};

export type AwardEvaluationInput={
  today:string;timezone:string;weekStartsOn:WeekdayIndex;weeklySessionGoal:number|null;sessions:AwardSessionFact[];volume:AwardVolumeFact[];
  templates:AwardTemplateFact[];usageDays:string[];planOccurrences:AwardPlanOccurrence[];stored:StoredAchievement[];
};

export type AwardProgress={
  definition:AchievementDefinition;earned:boolean;earnedAt?:string;value:number;threshold:number;progress:number;metadata?:Record<string,unknown>;
};
export type StreakSummary={current:number;longest:number};
export type AwardStreaks={trainingDays:StreakSummary;activeWeeks:StreakSummary;weeklyGoal:StreakSummary;plannedWeeks:StreakSummary;setraUse:StreakSummary};
export type AwardEvaluation={awards:AwardProgress[];streaks:AwardStreaks;newlyEarned:StoredAchievement[];metrics:Record<string,number>};

