export type CoachingRelationshipStatus =
  | "pending"
  | "active"
  | "declined"
  | "ended";
export type CoachingViewerRole = "coach" | "client";
export type AthleteGoalType =
  | "strength"
  | "muscle_gain"
  | "general_fitness"
  | "running"
  | "cycling"
  | "swimming"
  | "rowing"
  | "hybrid"
  | "event_race"
  | "custom";
export type AthleteGoalMetric =
  | "none"
  | "strength_load"
  | "event_time"
  | "distance"
  | "duration"
  | "custom";
export type AthleteGoalStatus = "active" | "completed" | "archived";
export type AthleteGoal = {
  id: string;
  clientUserId: string;
  relationshipId?: string | null;
  title: string;
  goalType: AthleteGoalType;
  targetDate?: string | null;
  metricType: AthleteGoalMetric;
  targetValue?: number | null;
  targetUnit: string;
  targetLabel: string;
  targetDistanceMetres?: number | null;
  targetText: string;
  notes: string;
  isPrimary: boolean;
  status: AthleteGoalStatus;
  approvalStatus: "proposed" | "accepted";
  createdByRole: "client" | "coach";
  creatorName: string;
  currentValue?: number | null;
  previousValue?: number | null;
  currentValueDate?: string | null;
  recentDataCount: number;
  goalReached: boolean;
  linkedPrograms: Array<{ id: string; name: string; status: string }>;
  createdAt: string;
  updatedAt: string;
};
export type AthleteGoalDraft = {
  id?: string | null;
  relationshipId?: string | null;
  title: string;
  goalType: AthleteGoalType;
  targetDate?: string | null;
  metricType: AthleteGoalMetric;
  targetValue?: number | null;
  targetUnit: string;
  targetLabel: string;
  targetDistanceMetres?: number | null;
  targetText: string;
  notes: string;
  isPrimary: boolean;
  linkedProgramId?: string | null;
};

export type CoachingPermissions = {
  viewPlannedSessions: boolean;
  viewCompletedSessions: boolean;
  viewHistory: boolean;
  viewPbs: boolean;
  assignTraining: boolean;
  provideFeedback: boolean;
};

export type CoachingProfile = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  relationshipStatus?: CoachingRelationshipStatus | null;
};

export type CoachingRelationship = CoachingPermissions & {
  relationshipId: string;
  coachUserId: string;
  clientUserId: string;
  otherUserId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  viewerRole: CoachingViewerRole;
  status: CoachingRelationshipStatus;
  createdAt: string;
  acceptedAt?: string | null;
  endedAt?: string | null;
};

export type CoachClientSummary = {
  relationshipId: string;
  clientUserId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  weekStart: string;
  plannedSessions: number;
  completedSessions: number;
  nextSessionTitle?: string | null;
  nextSessionDate?: string | null;
  permissionsReady: boolean;
};
export type CoachDashboardClient = CoachClientSummary & {
  latestCompletedTitle?: string | null;
  latestCompletedDate?: string | null;
  latestRpe?: number | null;
  latestSessionFeel?: "easier" | "expected" | "harder" | null;
  latestAthleteComment?: string | null;
  latestFeedbackDate?: string | null;
};
export type CoachAttentionItem = {
  relationshipId: string;
  clientUserId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  occurrenceId?: string | null;
  assignmentId?: string | null;
  sessionTitle: string;
  sessionDate?: string | null;
  status?: string | null;
  reasons: import("./attention-rules").CoachAttentionReason[];
  sessionRpe?: number | null;
  sessionFeel?: "easier" | "expected" | "harder" | null;
  athleteComment?: string | null;
};
export type CoachDashboard = {
  clients: CoachDashboardClient[];
  attention: CoachAttentionItem[];
};
export type CoachRosterWeek = {
  weekStart: string;
  planned: number;
  completed: number;
};
export type CoachRosterClient = {
  relationshipId: string;
  clientUserId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  weekStart: string;
  currentPlanned: number;
  currentCompleted: number;
  periodPlanned: number;
  periodCompleted: number;
  totalTrainingSeconds: number;
  strengthSessions: number;
  enduranceSessions: number;
  latestCompletedTitle?: string | null;
  latestCompletedDate?: string | null;
  latestRpe?: number | null;
  latestSessionFeel?: "easier" | "expected" | "harder" | null;
  activeProgramId?: string | null;
  activeProgramName?: string | null;
  programCurrentWeek?: number | null;
  programDurationWeeks?: number | null;
  primaryGoalId?: string | null;
  primaryGoalTitle?: string | null;
  primaryGoalCurrent?: number | null;
  primaryGoalTarget?: number | null;
  primaryGoalMetric?: AthleteGoalMetric | null;
  primaryGoalUnit?: string | null;
  primaryGoalReached: boolean;
  activeGoalCount: number;
  groupIds: string[];
  groupNames: string[];
  attentionCount: number;
  weeklyTrend: CoachRosterWeek[];
};
export type CoachAthleteFeedback = {
  rpe?: number;
  feel?: "easier" | "expected" | "harder";
  comment?: string;
  updatedAt?: string;
};
export type CoachCompletedDetail = {
  durationSeconds?: number | null;
  distanceMetres?: number | null;
  averagePaceSecondsPerKm?: number | null;
  averageSpeedKph?: number | null;
  averageHeartRate?: number | null;
  elevationGainMetres?: number | null;
  athleteFeedback?: CoachAthleteFeedback;
  exercises?: {
    name: string;
    sets: {
      weight?: number | null;
      loadText?: string | null;
      reps?: string | null;
      rpe?: number | null;
    }[];
  }[];
};
export type CoachSessionFeedback = {
  id: string;
  coachName: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};
export type CoachClientWeekItem = {
  id: string;
  date: string;
  modality: "strength" | "endurance";
  status:
    | "planned"
    | "completed"
    | "partial"
    | "skipped"
    | "cancelled"
    | "rescheduled";
  title: string;
  summary: string;
  assignedBy?: string | null;
  assignmentId?: string | null;
  dayPosition?: number;
  editable?: boolean;
  feedback?: CoachSessionFeedback | null;
  completedDetail?: CoachCompletedDetail | null;
};
export type CoachClientWeek = {
  relationshipId: string;
  clientUserId: string;
  clientName: string;
  weekStart: string;
  weekEnd: string;
  items: CoachClientWeekItem[];
};
export type CoachFeedbackNotification = {
  notificationId: string;
  feedbackId: string;
  coachName: string;
  sessionTitle: string;
  sessionDate: string;
  modality: "strength" | "endurance";
  completedClientId: string;
  createdAt: string;
  readAt?: string | null;
};
export type CoachCommentTarget = "session" | "weekly_review";
export type CoachComment = {
  id: string;
  authorUserId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  authorRole: "coach" | "client";
  body: string;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  relationshipActive: boolean;
};
export type CoachCommentNotification = {
  notificationId: string;
  commentId: string;
  relationshipId: string;
  actorName: string;
  actorRole: "coach" | "client";
  targetType: CoachCommentTarget;
  assignmentId?: string | null;
  weekStart?: string | null;
  targetTitle: string;
  occurrenceId?: string | null;
  createdAt: string;
  readAt?: string | null;
};
export type TrainingWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type TrainingAvailabilityStatus =
  | "available"
  | "preferred"
  | "rest"
  | "unavailable";
export type UnavailableTrainingDate = {
  id: string;
  date: string;
  note: string;
};
export type ClientTrainingAvailability = {
  preferredDays: TrainingWeekday[];
  unavailableDays: TrainingWeekday[];
  restDays: TrainingWeekday[];
  preferredSessionTimes: Partial<Record<TrainingWeekday, string>>;
  notes: string;
  updatedAt?: string | null;
  oneOffDates: UnavailableTrainingDate[];
};
export type CoachProgrammingDraft = {
  id: string;
  modality: "strength" | "endurance";
  templateId: string;
  date: string;
  instruction: string;
};
export type CoachProgramSession = {
  id: string;
  weekNumber: number;
  dayOffset: number;
  position: number;
  modality: "strength" | "endurance";
  templateId: string;
  templateName: string;
  instruction: string;
};
export type CoachProgram = {
  id: string;
  name: string;
  description: string;
  durationWeeks: number;
  focus: string;
  sessions: CoachProgramSession[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};
export type CoachGroupMember = {
  relationshipId: string;
  clientUserId: string;
  displayName: string;
  username: string;
  assignTraining: boolean;
};
export type CoachGroupUpcoming = {
  assignmentId: string;
  relationshipId: string;
  title: string;
  date: string;
  modality: "strength" | "endurance";
};
export type CoachGroup = {
  id: string;
  name: string;
  description: string;
  members: CoachGroupMember[];
  upcoming: CoachGroupUpcoming[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};
export type AthleteCoachingWeekItem = {
  relationshipId: string;
  relationshipStatus: CoachingRelationshipStatus;
  coachName: string;
  occurrenceId: string;
  assignmentId: string;
  clientProgramId?: string | null;
  programName?: string | null;
  programWeekNumber?: number | null;
  programDurationWeeks?: number | null;
  date: string;
  modality: "strength" | "endurance";
  status:
    | "planned"
    | "completed"
    | "partial"
    | "skipped"
    | "cancelled"
    | "rescheduled";
  title: string;
  completedClientId?: string | null;
  coachFeedback?: string | null;
  coachFeedbackUpdatedAt?: string | null;
  sessionRpe?: number | null;
  sessionFeel?: "easier" | "expected" | "harder" | null;
  athleteComment?: string | null;
  weekStart: string;
  weekEnd: string;
};
export type AthleteProgramProgress = {
  id: string;
  relationshipId: string;
  relationshipStatus: CoachingRelationshipStatus;
  coachName: string;
  name: string;
  description: string;
  focus: string;
  durationWeeks: number;
  startDate: string;
  endDate: string;
  status: "active" | "completed" | "ended";
  note: string;
  currentWeek: number;
  totalSessions: number;
  completedSessions: number;
  remainingSessions: number;
};
export type ClientProgramSummary = {
  id: string;
  name: string;
  description: string;
  focus: string;
  durationWeeks: number;
  startDate: string;
  endDate: string;
  status: "active" | "completed" | "ended";
  note: string;
  currentWeek: number;
  totalSessions: number;
  completedSessions: number;
  plannedSessions: number;
};
export type CoachWeeklyReviewSession = {
  id: string;
  date: string;
  modality: "strength" | "endurance";
  status:
    | "planned"
    | "completed"
    | "partial"
    | "skipped"
    | "cancelled"
    | "rescheduled"
    | "missed";
  title: string;
  plannedSummary: string;
  plannedDurationMinutes?: number;
  plannedDistanceMetres?: number;
  plannedSets?: number;
  actualDurationSeconds?: number;
  actualDistanceMetres?: number;
  actualSets?: number;
  actualVolumeKg?: number;
  actualRpe?: number;
  athleteFeel?: "easier" | "expected" | "harder";
  athleteComment?: string;
  activityType: string;
  assignedBy?: string;
  coachFeedback?: string;
  coachFeedbackUpdatedAt?: string;
};
export type CoachWeeklyReviewNote = {
  id: string;
  relationshipId?: string;
  weekStart: string;
  text: string;
  coachName: string;
  createdAt: string;
  updatedAt: string;
};
export type CoachWeeklyReview = {
  relationshipId: string;
  weekStart: string;
  weekEnd: string;
  plannedSessions: number;
  completedSessions: number;
  skippedSessions: number;
  missedSessions: number;
  completionRate: number;
  totalDurationSeconds: number;
  strengthSessions: number;
  enduranceSessions: number;
  strengthSets: number;
  strengthVolumeKg: number;
  sportTotals: Array<{
    activityType: string;
    distanceMetres: number;
    durationSeconds: number;
    sessions: number;
  }>;
  sessions: CoachWeeklyReviewSession[];
  note?: CoachWeeklyReviewNote | null;
};
