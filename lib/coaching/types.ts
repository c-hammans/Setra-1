export type CoachingRelationshipStatus = "pending" | "active" | "declined" | "ended";
export type CoachingViewerRole = "coach" | "client";

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

export type CoachClientSummary={relationshipId:string;clientUserId:string;username:string;displayName:string;avatarUrl?:string|null;weekStart:string;plannedSessions:number;completedSessions:number;nextSessionTitle?:string|null;nextSessionDate?:string|null;permissionsReady:boolean};
export type CoachCompletedDetail={durationSeconds?:number|null;distanceMetres?:number|null;averagePaceSecondsPerKm?:number|null;averageSpeedKph?:number|null;averageHeartRate?:number|null;elevationGainMetres?:number|null;exercises?:{name:string;sets:{weight?:number|null;loadText?:string|null;reps?:string|null;rpe?:number|null}[]}[]};
export type CoachSessionFeedback={id:string;coachName:string;text:string;createdAt:string;updatedAt:string};
export type CoachClientWeekItem={id:string;date:string;modality:"strength"|"endurance";status:"planned"|"completed"|"partial"|"skipped"|"cancelled"|"rescheduled";title:string;summary:string;assignedBy?:string|null;assignmentId?:string|null;dayPosition?:number;editable?:boolean;feedback?:CoachSessionFeedback|null;completedDetail?:CoachCompletedDetail|null};
export type CoachClientWeek={relationshipId:string;clientUserId:string;clientName:string;weekStart:string;weekEnd:string;items:CoachClientWeekItem[]};
export type CoachFeedbackNotification={notificationId:string;feedbackId:string;coachName:string;sessionTitle:string;sessionDate:string;modality:"strength"|"endurance";completedClientId:string;createdAt:string;readAt?:string|null};
export type CoachProgrammingDraft={id:string;modality:"strength"|"endurance";templateId:string;date:string;instruction:string};
