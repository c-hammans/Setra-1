export type WeeklyReviewSection = { summary: string; items: string[] };

export type WeeklyReviewContent = {
  weekAtAGlance: string[];
  whatWentWell: string[];
  worthNoting: string[];
  lookingAhead: string[];
  dataConfidence: {
    level: "high" | "medium" | "limited";
    summary: string;
    gaps: string[];
  };
};

export type WeeklyReviewMetricPeriod = {
  weekStart: string;
  planned: number;
  completed: number;
  skipped: number;
  rescheduled: number;
  adherencePercent: number | null;
  totalSessions: number;
  durationMinutes: number | null;
  strengthSessions: number;
  enduranceSessions: number;
  strengthSets: number;
  strengthVolumeKg: number;
  enduranceDistanceKm: number;
  activityMix: Record<string, number>;
  sportMetrics: Record<string,{sessions:number;distanceKm:number;durationMinutes:number|null;averagePaceSecondsPerKm:number|null;averageSpeedKph:number|null;elevationMetres:number|null;averageHeartRate:number|null}>;
};

export type WeeklyReviewContext = {
  schemaVersion: "weekly-review-context-v1";
  week: { start: string; end: string; timezone: string; weekStartsOn: number };
  current: WeeklyReviewMetricPeriod;
  previous: WeeklyReviewMetricPeriod;
  priorFourWeekAverage: Omit<WeeklyReviewMetricPeriod, "weekStart"> | null;
  checkIns: Array<{ rpe: number | null; feel: string | null; comment: string | null }>;
  goals: Array<{ title: string; type: string; targetDate: string | null; primary: boolean; currentValue: number | null; targetValue: number | null; unit: string | null }>;
  activeProgram: { name: string; focus: string | null; currentWeek: number; durationWeeks: number } | null;
  personalBests: Array<{ label: string; result: string }>;
  dataGaps: string[];
};

export type StoredWeeklyReview = {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: "generating" | "ready" | "failed";
  sourceHash: string;
  content: WeeklyReviewContent | null;
  generatedAt: string | null;
  modelProvider: string | null;
  modelName: string | null;
  errorMessage: string | null;
};
