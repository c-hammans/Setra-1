import type {AskSetraContext} from "./ask-setra-types";
import type {WeeklyReviewContext} from "./weekly-review-types";

export const RECOMMENDATION_TYPES=["progress","maintain","reduce","schedule","goal","recovery_consideration"] as const;
export type RecommendationType=(typeof RECOMMENDATION_TYPES)[number];
export type RecommendationConfidence="high"|"medium";
export type RecommendationStatus="active"|"dismissed"|"outdated";
export type RecommendationTrigger="weekly_review"|"training_change"|"manual";

export type RecommendationCandidate={
  key:string;
  type:RecommendationType;
  evidence:string[];
  direction:string;
  confidence:RecommendationConfidence;
  relatedSessionId:string|null;
  relatedGoalId:string|null;
};

export type RecommendationSource={
  today:string;
  weekly:WeeklyReviewContext;
  askContext:AskSetraContext;
  goalRows:Array<Record<string,unknown>>;
};

export type RecommendationDraft={
  candidateKey:string;
  type:RecommendationType;
  title:string;
  recommendation:string;
  confidence:RecommendationConfidence;
};

export type StoredRecommendation={
  id:string;
  type:RecommendationType;
  title:string;
  recommendation:string;
  evidence:string[];
  confidence:RecommendationConfidence;
  status:RecommendationStatus;
  relatedSessionId:string|null;
  relatedGoalId:string|null;
  createdAt:string;
};
