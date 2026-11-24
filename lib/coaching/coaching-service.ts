import { createClient } from "@/lib/supabase/client";
import type {
  AthleteCoachingWeekItem,
  AthleteGoal,
  AthleteGoalDraft,
  AthleteProgramProgress,
  ClientProgramSummary,
  ClientTrainingAvailability,
  CoachAttentionItem,
  CoachClientSummary,
  CoachClientWeek,
  CoachComment,
  CoachCommentNotification,
  CoachCommentTarget,
  CoachDashboard,
  CoachDashboardClient,
  CoachFeedbackNotification,
  CoachGroup,
  CoachGroupMember,
  CoachGroupUpcoming,
  CoachProgram,
  CoachProgramSession,
  CoachProgrammingDraft,
  CoachRosterClient,
  CoachRosterWeek,
  CoachWeeklyReview,
  CoachWeeklyReviewNote,
  CoachWeeklyReviewSession,
  CoachingProfile,
  CoachingRelationship,
  TrainingWeekday,
  UnavailableTrainingDate,
} from "./types";
import { COACH_ATTENTION_RULES } from "./attention-rules";
import { buildCoachWeeklyReview } from "./weekly-review";
import { localDateKey } from "@/lib/setra/week";

type CoachingProfileRow = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  relationship_status?: CoachingProfile["relationshipStatus"];
};
type CoachingRelationshipRow = {
  relationship_id: string;
  coach_user_id: string;
  client_user_id: string;
  other_user_id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  viewer_role: CoachingRelationship["viewerRole"];
  status: CoachingRelationship["status"];
  can_view_planned_sessions: boolean;
  can_view_completed_sessions: boolean;
  can_view_history: boolean;
  can_view_pbs: boolean;
  can_assign_training: boolean;
  can_provide_feedback: boolean;
  created_at: string;
  accepted_at?: string | null;
  ended_at?: string | null;
};
type CoachClientSummaryRow = {
  relationship_id: string;
  client_user_id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  week_start: string;
  planned_sessions: number;
  completed_sessions: number;
  next_session_title?: string | null;
  next_session_date?: string | null;
  permissions_ready: boolean;
};
type CoachDashboardRow = CoachClientSummaryRow & {
  latest_completed_title?: string | null;
  latest_completed_date?: string | null;
  latest_rpe?: number | null;
  latest_session_feel?: "easier" | "expected" | "harder" | null;
  latest_athlete_comment?: string | null;
  latest_feedback_date?: string | null;
};
type CoachAttentionRow = {
  relationship_id: string;
  client_user_id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  occurrence_id?: string | null;
  assignment_id?: string | null;
  session_title: string;
  session_date?: string | null;
  status?: string | null;
  reasons: CoachAttentionItem["reasons"];
  session_rpe?: number | null;
  session_feel?: "easier" | "expected" | "harder" | null;
  athlete_comment?: string | null;
};
type CoachFeedbackRow = {
  occurrence_id: string;
  assignment_id: string;
  feedback_id?: string | null;
  feedback?: string | null;
  coach_display_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
type CoachFeedbackNotificationRow = {
  notification_id: string;
  feedback_id: string;
  coach_display_name: string;
  session_title: string;
  session_date: string;
  modality: "strength" | "endurance";
  completed_client_id: string;
  created_at: string;
  read_at?: string | null;
};
type CoachCommentRow = {
  comment_id: string;
  author_user_id: string;
  author_name: string;
  author_avatar_url?: string | null;
  author_role: "coach" | "client";
  body: string;
  created_at: string;
  updated_at: string;
  can_edit: boolean;
  relationship_active: boolean;
};
type CoachCommentNotificationRow = {
  notification_id: string;
  comment_id: string;
  relationship_id: string;
  actor_name: string;
  actor_role: "coach" | "client";
  target_type: CoachCommentTarget;
  assignment_id?: string | null;
  week_start?: string | null;
  target_title: string;
  occurrence_id?: string | null;
  created_at: string;
  read_at?: string | null;
};
type CoachProgrammingRow = {
  occurrence_id: string;
  assignment_id: string;
  day_position: number;
  editable: boolean;
};
type CoachWeekReviewRow = {
  occurrence_id: string;
  planned_date: string;
  modality: "strength" | "endurance";
  status: CoachWeeklyReviewSession["status"];
  title: string;
  planned_summary: string;
  planned_duration_minutes?: number | null;
  planned_distance_metres?: number | null;
  planned_sets?: number | null;
  actual_duration_seconds?: number | null;
  actual_distance_metres?: number | null;
  actual_sets?: number | null;
  actual_volume_kg?: number | null;
  actual_rpe?: number | null;
  activity_type: string;
  assigned_by?: string | null;
  coach_feedback?: string | null;
  coach_feedback_updated_at?: string | null;
};
type CoachWeekReviewNoteRow = {
  note_id: string;
  relationship_id?: string;
  week_start?: string;
  note: string;
  coach_display_name: string;
  created_at: string;
  updated_at: string;
};
type CoachAthleteFeedbackRow = {
  occurrence_id: string;
  session_rpe?: number | null;
  session_feel?: "easier" | "expected" | "harder" | null;
  athlete_comment?: string | null;
  updated_at?: string | null;
};
type CoachProgramRow = {
  program_id: string;
  name: string;
  description: string;
  duration_weeks: number;
  focus: string;
  sessions: CoachProgramSession[];
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
};
type CoachGroupRow = {
  group_id: string;
  name: string;
  description: string;
  members: CoachGroupMember[];
  upcoming: CoachGroupUpcoming[];
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
};
type ClientProgramRow = {
  client_program_id: string;
  name: string;
  description: string;
  focus: string;
  duration_weeks: number;
  start_date: string;
  end_date: string;
  status: ClientProgramSummary["status"];
  note: string;
  current_week: number;
  total_sessions: number;
  completed_sessions: number;
  planned_sessions: number;
};
type AthleteCoachingWeekRow = {
  relationship_id: string;
  relationship_status: AthleteCoachingWeekItem["relationshipStatus"];
  coach_name: string;
  occurrence_id: string;
  assignment_id: string;
  client_program_id?: string | null;
  program_name?: string | null;
  program_week_number?: number | null;
  program_duration_weeks?: number | null;
  planned_date: string;
  modality: AthleteCoachingWeekItem["modality"];
  status: AthleteCoachingWeekItem["status"];
  title: string;
  linked_completion_client_id?: string | null;
  coach_feedback?: string | null;
  coach_feedback_updated_at?: string | null;
  session_rpe?: number | null;
  session_feel?: AthleteCoachingWeekItem["sessionFeel"];
  athlete_comment?: string | null;
  week_start: string;
  week_end: string;
};
type AthleteProgramRow = {
  client_program_id: string;
  relationship_id: string;
  relationship_status: AthleteProgramProgress["relationshipStatus"];
  coach_name: string;
  name: string;
  description: string;
  focus: string;
  duration_weeks: number;
  start_date: string;
  end_date: string;
  status: AthleteProgramProgress["status"];
  note: string;
  current_week: number;
  total_sessions: number;
  completed_sessions: number;
  remaining_sessions: number;
};
type TrainingAvailabilityRow = {
  preferred_days?: number[] | null;
  unavailable_days?: number[] | null;
  rest_days?: number[] | null;
  preferred_session_times?: Record<string, string> | null;
  notes?: string | null;
  updated_at?: string | null;
  one_off_dates?: Array<{
    id: string;
    date: string;
    note?: string | null;
  }> | null;
};
type AthleteGoalRow = {
  goal_id: string;
  client_user_id: string;
  relationship_id?: string | null;
  title: string;
  goal_type: AthleteGoal["goalType"];
  target_date?: string | null;
  metric_type: AthleteGoal["metricType"];
  target_value?: number | null;
  target_unit: string;
  target_label: string;
  target_distance_metres?: number | null;
  target_text: string;
  notes: string;
  is_primary: boolean;
  status: AthleteGoal["status"];
  approval_status: AthleteGoal["approvalStatus"];
  created_by_role: AthleteGoal["createdByRole"];
  creator_name: string;
  current_value?: number | null;
  previous_value?: number | null;
  current_value_date?: string | null;
  recent_data_count?: number | null;
  goal_reached: boolean;
  linked_programs?: AthleteGoal["linkedPrograms"] | null;
  created_at: string;
  updated_at: string;
};
type CoachRosterRow = {
  relationship_id: string;
  client_user_id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  week_start: string;
  current_planned: number;
  current_completed: number;
  period_planned: number;
  period_completed: number;
  total_training_seconds: number;
  strength_sessions: number;
  endurance_sessions: number;
  latest_completed_title?: string | null;
  latest_completed_date?: string | null;
  latest_rpe?: number | null;
  latest_session_feel?: CoachRosterClient["latestSessionFeel"];
  active_program_id?: string | null;
  active_program_name?: string | null;
  program_current_week?: number | null;
  program_duration_weeks?: number | null;
  primary_goal_id?: string | null;
  primary_goal_title?: string | null;
  primary_goal_current?: number | null;
  primary_goal_target?: number | null;
  primary_goal_metric?: CoachRosterClient["primaryGoalMetric"];
  primary_goal_unit?: string | null;
  primary_goal_reached: boolean;
  active_goal_count: number;
  group_ids?: string[] | null;
  group_names?: string[] | null;
  attention_count: number;
  weekly_trend?: Array<{
    weekStart?: string;
    week_start?: string;
    planned: number;
    completed: number;
  }> | null;
};

function availabilityFromRow(
  row?: TrainingAvailabilityRow | null,
): ClientTrainingAvailability {
  return {
    preferredDays: (row?.preferred_days || []) as TrainingWeekday[],
    unavailableDays: (row?.unavailable_days || []) as TrainingWeekday[],
    restDays: (row?.rest_days || []) as TrainingWeekday[],
    preferredSessionTimes: Object.fromEntries(
      Object.entries(row?.preferred_session_times || {}).map(([key, value]) => [
        Number(key) as TrainingWeekday,
        String(value),
      ]),
    ),
    notes: String(row?.notes || ""),
    updatedAt: row?.updated_at || null,
    oneOffDates: (row?.one_off_dates || []).map(
      (item): UnavailableTrainingDate => ({
        id: String(item.id),
        date: String(item.date),
        note: String(item.note || ""),
      }),
    ),
  };
}

function relationshipFromRow(
  row: CoachingRelationshipRow,
): CoachingRelationship {
  return {
    relationshipId: row.relationship_id,
    coachUserId: row.coach_user_id,
    clientUserId: row.client_user_id,
    otherUserId: row.other_user_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    viewerRole: row.viewer_role,
    status: row.status,
    viewPlannedSessions: row.can_view_planned_sessions,
    viewCompletedSessions: row.can_view_completed_sessions,
    viewHistory: row.can_view_history,
    viewPbs: row.can_view_pbs,
    assignTraining: row.can_assign_training,
    provideFeedback: row.can_provide_feedback,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    endedAt: row.ended_at,
  };
}

export class CoachingService {
  private client = createClient();

  async enableCoachRole() {
    const { error } = await this.client.rpc("enable_coach_role");
    if (error) throw error;
  }
  async list() {
    const { data, error } = await this.client.rpc(
      "list_coaching_relationships",
    );
    if (error) throw error;
    return ((data || []) as CoachingRelationshipRow[]).map(relationshipFromRow);
  }
  async search(query: string) {
    const { data, error } = await this.client.rpc("search_coaching_profiles", {
      p_query: query.trim(),
    });
    if (error) throw error;
    return ((data || []) as CoachingProfileRow[]).map((row) => ({
      userId: row.user_id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      relationshipStatus: row.relationship_status,
    }));
  }
  async invite(clientUserId: string) {
    const { error } = await this.client.rpc("send_coach_client_invite", {
      p_client_user_id: clientUserId,
    });
    if (error) throw error;
  }
  async respond(relationshipId: string, accept: boolean) {
    const { error } = await this.client.rpc("respond_coach_client_invite", {
      p_relationship_id: relationshipId,
      p_accept: accept,
    });
    if (error) throw error;
  }
  async cancel(relationshipId: string) {
    const { error } = await this.client.rpc("cancel_coach_client_invite", {
      p_relationship_id: relationshipId,
    });
    if (error) throw error;
  }
  async end(relationshipId: string) {
    const { error } = await this.client.rpc("end_coach_client_relationship", {
      p_relationship_id: relationshipId,
    });
    if (error) throw error;
  }
  async setMvpPermissions(relationshipId: string, enabled: boolean) {
    const { error } = await this.client.rpc("set_coaching_mvp_permissions", {
      p_relationship_id: relationshipId,
      p_enabled: enabled,
    });
    if (error) throw error;
  }
  async clientSummaries(anchor: string) {
    const { data, error } = await this.client.rpc(
      "list_coach_clients_summary",
      { p_anchor: anchor },
    );
    if (error) {
      if (["42883", "PGRST202"].includes(String(error.code || ""))) return [];
      throw error;
    }
    return ((data || []) as CoachClientSummaryRow[]).map(
      (row): CoachClientSummary => ({
        relationshipId: row.relationship_id,
        clientUserId: row.client_user_id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        weekStart: row.week_start,
        plannedSessions: Number(row.planned_sessions) || 0,
        completedSessions: Number(row.completed_sessions) || 0,
        nextSessionTitle: row.next_session_title,
        nextSessionDate: row.next_session_date,
        permissionsReady: Boolean(row.permissions_ready),
      }),
    );
  }
  async dashboard(anchor: string): Promise<CoachDashboard> {
    const [clientsResult, attentionResult, goalAttentionResult] =
      await Promise.all([
        this.client.rpc("list_coach_clients_dashboard", { p_anchor: anchor }),
        this.client.rpc("list_coach_attention_queue", {
          p_anchor: anchor,
          p_high_rpe: COACH_ATTENTION_RULES.highRpe,
          p_inactivity_days: COACH_ATTENTION_RULES.inactivityDays,
        }),
        this.client.rpc("list_coach_goal_attention", { p_anchor: anchor }),
      ]);
    const missing = (value: { code?: string } | null) =>
      ["42883", "PGRST202"].includes(String(value?.code || ""));
    if (clientsResult.error) {
      if (missing(clientsResult.error)) return { clients: [], attention: [] };
      throw clientsResult.error;
    }
    if (attentionResult.error && !missing(attentionResult.error))
      throw attentionResult.error;
    if (goalAttentionResult.error && !missing(goalAttentionResult.error))
      throw goalAttentionResult.error;
    const clients = ((clientsResult.data || []) as CoachDashboardRow[]).map(
      (row): CoachDashboardClient => ({
        relationshipId: row.relationship_id,
        clientUserId: row.client_user_id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        weekStart: row.week_start,
        plannedSessions: Number(row.planned_sessions) || 0,
        completedSessions: Number(row.completed_sessions) || 0,
        nextSessionTitle: row.next_session_title,
        nextSessionDate: row.next_session_date,
        permissionsReady: Boolean(row.permissions_ready),
        latestCompletedTitle: row.latest_completed_title,
        latestCompletedDate: row.latest_completed_date,
        latestRpe: row.latest_rpe == null ? null : Number(row.latest_rpe),
        latestSessionFeel: row.latest_session_feel,
        latestAthleteComment: row.latest_athlete_comment,
        latestFeedbackDate: row.latest_feedback_date,
      }),
    );
    const attention = [
      ...((attentionResult.data || []) as CoachAttentionRow[]),
      ...((goalAttentionResult.data || []) as CoachAttentionRow[]),
    ].map(
      (row): CoachAttentionItem => ({
        relationshipId: row.relationship_id,
        clientUserId: row.client_user_id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        occurrenceId: row.occurrence_id,
        assignmentId: row.assignment_id,
        sessionTitle: row.session_title,
        sessionDate: row.session_date,
        status: row.status,
        reasons: row.reasons || [],
        sessionRpe: row.session_rpe == null ? null : Number(row.session_rpe),
        sessionFeel: row.session_feel,
        athleteComment: row.athlete_comment,
      }),
    );
    return { clients, attention };
  }
  async rosterAnalytics(
    anchor: string,
    weeks: 4 | 12,
  ): Promise<CoachRosterClient[]> {
    const { data, error } = await this.client.rpc(
      "list_coach_roster_analytics",
      { p_anchor: anchor, p_weeks: weeks },
    );
    if (error) {
      if (["42883", "PGRST202"].includes(String(error.code || ""))) return [];
      throw error;
    }
    return ((data || []) as CoachRosterRow[]).map((row) => ({
      relationshipId: row.relationship_id,
      clientUserId: row.client_user_id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      weekStart: row.week_start,
      currentPlanned: Number(row.current_planned) || 0,
      currentCompleted: Number(row.current_completed) || 0,
      periodPlanned: Number(row.period_planned) || 0,
      periodCompleted: Number(row.period_completed) || 0,
      totalTrainingSeconds: Number(row.total_training_seconds) || 0,
      strengthSessions: Number(row.strength_sessions) || 0,
      enduranceSessions: Number(row.endurance_sessions) || 0,
      latestCompletedTitle: row.latest_completed_title,
      latestCompletedDate: row.latest_completed_date,
      latestRpe: row.latest_rpe == null ? null : Number(row.latest_rpe),
      latestSessionFeel: row.latest_session_feel,
      activeProgramId: row.active_program_id,
      activeProgramName: row.active_program_name,
      programCurrentWeek:
        row.program_current_week == null
          ? null
          : Number(row.program_current_week),
      programDurationWeeks:
        row.program_duration_weeks == null
          ? null
          : Number(row.program_duration_weeks),
      primaryGoalId: row.primary_goal_id,
      primaryGoalTitle: row.primary_goal_title,
      primaryGoalCurrent:
        row.primary_goal_current == null
          ? null
          : Number(row.primary_goal_current),
      primaryGoalTarget:
        row.primary_goal_target == null
          ? null
          : Number(row.primary_goal_target),
      primaryGoalMetric: row.primary_goal_metric,
      primaryGoalUnit: row.primary_goal_unit,
      primaryGoalReached: Boolean(row.primary_goal_reached),
      activeGoalCount: Number(row.active_goal_count) || 0,
      groupIds: row.group_ids || [],
      groupNames: row.group_names || [],
      attentionCount: Number(row.attention_count) || 0,
      weeklyTrend: (row.weekly_trend || []).map(
        (week): CoachRosterWeek => ({
          weekStart: String(week.weekStart || week.week_start || ""),
          planned: Number(week.planned) || 0,
          completed: Number(week.completed) || 0,
        }),
      ),
    }));
  }
  async clientWeek(relationshipId: string, anchor: string) {
    const [{ data, error }, feedbackResult, programmingResult, athleteResult] =
      await Promise.all([
        this.client.rpc("get_coach_client_week", {
          p_relationship_id: relationshipId,
          p_anchor: anchor,
        }),
        this.client.rpc("list_coach_client_session_feedback", {
          p_relationship_id: relationshipId,
          p_anchor: anchor,
        }),
        this.client.rpc("list_coach_week_programming", {
          p_relationship_id: relationshipId,
          p_anchor: anchor,
        }),
        this.client.rpc("list_coach_client_athlete_checkins", {
          p_relationship_id: relationshipId,
          p_anchor: anchor,
        }),
      ]);
    if (error) throw error;
    const week = data as CoachClientWeek;
    const missing = (value: { code?: string } | null) =>
      ["42883", "PGRST202"].includes(String(value?.code || ""));
    if (feedbackResult.error && !missing(feedbackResult.error))
      throw feedbackResult.error;
    if (programmingResult.error && !missing(programmingResult.error))
      throw programmingResult.error;
    if (athleteResult.error && !missing(athleteResult.error))
      throw athleteResult.error;
    const feedbackByOccurrence = new Map(
      ((feedbackResult.data || []) as CoachFeedbackRow[]).map((row) => [
        row.occurrence_id,
        row,
      ]),
    );
    const programmingByOccurrence = new Map(
      ((programmingResult.data || []) as CoachProgrammingRow[]).map((row) => [
        row.occurrence_id,
        row,
      ]),
    );
    const athleteByOccurrence = new Map(
      ((athleteResult.data || []) as CoachAthleteFeedbackRow[]).map((row) => [
        row.occurrence_id,
        row,
      ]),
    );
    const items = week.items
      .map((item) => {
        const feedback = feedbackByOccurrence.get(item.id);
        const programming = programmingByOccurrence.get(item.id);
        const athlete = athleteByOccurrence.get(item.id);
        return {
          ...item,
          assignmentId:
            programming?.assignment_id ||
            feedback?.assignment_id ||
            item.assignmentId,
          dayPosition: programming
            ? Number(programming.day_position)
            : undefined,
          editable: programming?.editable ?? false,
          feedback: feedback?.feedback_id
            ? {
                id: String(feedback.feedback_id),
                coachName: String(feedback.coach_display_name || "Coach"),
                text: String(feedback.feedback || ""),
                createdAt: String(feedback.created_at),
                updatedAt: String(feedback.updated_at),
              }
            : null,
          completedDetail: athlete
            ? {
                ...(item.completedDetail || {}),
                athleteFeedback: {
                  rpe:
                    athlete.session_rpe == null
                      ? undefined
                      : Number(athlete.session_rpe),
                  feel: athlete.session_feel || undefined,
                  comment: String(athlete.athlete_comment || "") || undefined,
                  updatedAt: athlete.updated_at || undefined,
                },
              }
            : item.completedDetail,
        };
      })
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.dayPosition ?? Number.MAX_SAFE_INTEGER) -
            (b.dayPosition ?? Number.MAX_SAFE_INTEGER) ||
          a.title.localeCompare(b.title),
      );
    return { ...week, items };
  }
  async assignTemplate(input: {
    relationshipId: string;
    modality: "strength" | "endurance";
    templateId: string;
    date: string;
    instruction: string;
  }) {
    const { data, error } = await this.client.rpc("coach_assign_template", {
      p_relationship_id: input.relationshipId,
      p_modality: input.modality,
      p_source_template_client_id: input.templateId,
      p_assigned_date: input.date,
      p_instruction: input.instruction,
    });
    if (error) throw error;
    return String(data);
  }
  async assignWeek(
    relationshipId: string,
    weekStart: string,
    items: CoachProgrammingDraft[],
  ) {
    const { data, error } = await this.client.rpc("coach_assign_week", {
      p_relationship_id: relationshipId,
      p_week_start: weekStart,
      p_items: items.map((item) => ({
        modality: item.modality,
        templateId: item.templateId,
        date: item.date,
        instruction: item.instruction,
      })),
    });
    if (error) throw error;
    return (data || []) as string[];
  }
  async programs(includeArchived = false): Promise<CoachProgram[]> {
    const { data, error } = await this.client.rpc("list_coach_programs");
    if (error) {
      if (["42883", "PGRST202"].includes(String(error.code || ""))) return [];
      throw error;
    }
    return ((data || []) as CoachProgramRow[])
      .map((row) => ({
        id: row.program_id,
        name: row.name,
        description: row.description || "",
        durationWeeks: Number(row.duration_weeks),
        focus: row.focus || "",
        sessions: (row.sessions || []).map((session) => ({
          ...session,
          weekNumber: Number(session.weekNumber),
          dayOffset: Number(session.dayOffset),
          position: Number(session.position),
        })),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        archivedAt: row.archived_at || undefined,
      }))
      .filter((program) => includeArchived || !program.archivedAt);
  }
  async saveProgram(program: Omit<CoachProgram, "createdAt" | "updatedAt">) {
    const { data, error } = await this.client.rpc("save_coach_program", {
      p_program_id: program.id || null,
      p_name: program.name,
      p_description: program.description,
      p_duration_weeks: program.durationWeeks,
      p_focus: program.focus,
      p_sessions: program.sessions.map((session) => ({
        weekNumber: session.weekNumber,
        dayOffset: session.dayOffset,
        modality: session.modality,
        templateId: session.templateId,
        instruction: session.instruction,
      })),
    });
    if (error) throw error;
    return String(data);
  }
  async deleteProgram(programId: string) {
    const { error } = await this.client.rpc("delete_coach_program", {
      p_program_id: programId,
    });
    if (error) throw error;
  }
  async assignProgram(
    programId: string,
    relationshipId: string,
    startDate: string,
    note: string,
  ) {
    const { data, error } = await this.client.rpc("assign_coach_program", {
      p_program_id: programId,
      p_relationship_id: relationshipId,
      p_start_date: startDate,
      p_note: note,
    });
    if (error) throw error;
    return String(data);
  }
  async clientPrograms(
    relationshipId: string,
    anchor: string,
  ): Promise<ClientProgramSummary[]> {
    const { data, error } = await this.client.rpc(
      "list_coach_client_programs",
      { p_relationship_id: relationshipId, p_anchor: anchor },
    );
    if (error) {
      if (["42883", "PGRST202"].includes(String(error.code || ""))) return [];
      throw error;
    }
    return ((data || []) as ClientProgramRow[]).map((row) => ({
      id: row.client_program_id,
      name: row.name,
      description: row.description || "",
      focus: row.focus || "",
      durationWeeks: Number(row.duration_weeks),
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      note: row.note || "",
      currentWeek: Number(row.current_week),
      totalSessions: Number(row.total_sessions),
      completedSessions: Number(row.completed_sessions),
      plannedSessions: Number(row.planned_sessions),
    }));
  }
  async addProgramSessions(
    clientProgramId: string,
    items: CoachProgrammingDraft[],
  ) {
    const { data, error } = await this.client.rpc(
      "add_coach_program_sessions",
      {
        p_client_program_id: clientProgramId,
        p_items: items.map((item) => ({
          modality: item.modality,
          templateId: item.templateId,
          date: item.date,
          instruction: item.instruction,
        })),
      },
    );
    if (error) throw error;
    return (data || []) as string[];
  }
  async endProgram(clientProgramId: string) {
    const { error } = await this.client.rpc("end_coach_program", {
      p_client_program_id: clientProgramId,
    });
    if (error) throw error;
  }
  async setLibraryArchived(
    itemType: "strength" | "endurance" | "program",
    itemId: string,
    archived: boolean,
  ) {
    const { error } = await this.client.rpc("set_coach_library_archive", {
      p_item_type: itemType,
      p_item_id: itemId,
      p_archived: archived,
    });
    if (error) throw error;
  }
  async assignLibraryItemBulk(
    itemType: "strength" | "endurance" | "program",
    itemId: string,
    relationshipIds: string[],
    date: string,
    note: string,
  ) {
    const { data, error } = await this.client.rpc(
      "assign_coach_library_item_bulk",
      {
        p_item_type: itemType,
        p_item_id: itemId,
        p_relationship_ids: relationshipIds,
        p_date: date,
        p_note: note,
      },
    );
    if (error) throw error;
    return (data || []) as string[];
  }
  async groups(includeArchived = false): Promise<CoachGroup[]> {
    const { data, error } = await this.client.rpc("list_coach_groups", {
      p_include_archived: includeArchived,
      p_today: localDateKey(),
    });
    if (error) {
      if (["42883", "PGRST202"].includes(String(error.code || ""))) return [];
      throw error;
    }
    return ((data || []) as CoachGroupRow[]).map((row) => ({
      id: row.group_id,
      name: row.name,
      description: row.description || "",
      members: row.members || [],
      upcoming: row.upcoming || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      archivedAt: row.archived_at || undefined,
    }));
  }
  async saveGroup(input: {
    id?: string;
    name: string;
    description: string;
    relationshipIds: string[];
  }) {
    const { data, error } = await this.client.rpc("save_coach_group", {
      p_group_id: input.id || null,
      p_name: input.name,
      p_description: input.description,
      p_relationship_ids: input.relationshipIds,
    });
    if (error) throw error;
    return String(data);
  }
  async setGroupArchived(groupId: string, archived: boolean) {
    const { error } = await this.client.rpc("set_coach_group_archived", {
      p_group_id: groupId,
      p_archived: archived,
    });
    if (error) throw error;
  }
  async assignGroupItem(
    groupId: string,
    itemType: "strength" | "endurance" | "program",
    itemId: string,
    date: string,
    note: string,
  ) {
    const { data, error } = await this.client.rpc("assign_coach_group_item", {
      p_group_id: groupId,
      p_item_type: itemType,
      p_item_id: itemId,
      p_date: date,
      p_note: note,
    });
    if (error) throw error;
    return (data || []) as string[];
  }
  async moveAssignment(assignmentId: string, date: string) {
    const { error } = await this.client.rpc("coach_move_assignment", {
      p_assignment_id: assignmentId,
      p_date: date,
    });
    if (error) throw error;
  }
  async removeAssignment(assignmentId: string) {
    const { error } = await this.client.rpc("coach_remove_assignment", {
      p_assignment_id: assignmentId,
    });
    if (error) throw error;
  }
  async replaceAssignment(
    assignmentId: string,
    modality: "strength" | "endurance",
    templateId: string,
  ) {
    const { data, error } = await this.client.rpc("coach_replace_assignment", {
      p_assignment_id: assignmentId,
      p_modality: modality,
      p_source_template_client_id: templateId,
    });
    if (error) throw error;
    return String(data);
  }
  async reorderAssignment(assignmentId: string, direction: -1 | 1) {
    const { error } = await this.client.rpc("coach_reorder_assignment", {
      p_assignment_id: assignmentId,
      p_direction: direction,
    });
    if (error) throw error;
  }
  async weeklyReview(
    relationshipId: string,
    weekStart: string,
    today: string,
  ): Promise<CoachWeeklyReview> {
    const [sessionsResult, noteResult, athleteResult] = await Promise.all([
      this.client.rpc("list_coach_week_review_sessions", {
        p_relationship_id: relationshipId,
        p_anchor: weekStart,
      }),
      this.client.rpc("get_coach_weekly_review_note", {
        p_relationship_id: relationshipId,
        p_week_start: weekStart,
      }),
      this.client.rpc("list_coach_client_athlete_checkins", {
        p_relationship_id: relationshipId,
        p_anchor: weekStart,
      }),
    ]);
    if (sessionsResult.error) throw sessionsResult.error;
    if (noteResult.error) throw noteResult.error;
    const missing = (value: { code?: string } | null) =>
      ["42883", "PGRST202"].includes(String(value?.code || ""));
    if (athleteResult.error && !missing(athleteResult.error))
      throw athleteResult.error;
    const athleteByOccurrence = new Map(
      ((athleteResult.data || []) as CoachAthleteFeedbackRow[]).map((row) => [
        row.occurrence_id,
        row,
      ]),
    );
    const sessions = ((sessionsResult.data || []) as CoachWeekReviewRow[]).map(
      (row): CoachWeeklyReviewSession => {
        const athlete = athleteByOccurrence.get(row.occurrence_id);
        return {
          id: row.occurrence_id,
          date: row.planned_date,
          modality: row.modality,
          status: row.status,
          title: row.title,
          plannedSummary: row.planned_summary || row.modality,
          plannedDurationMinutes:
            row.planned_duration_minutes == null
              ? undefined
              : Number(row.planned_duration_minutes),
          plannedDistanceMetres:
            row.planned_distance_metres == null
              ? undefined
              : Number(row.planned_distance_metres),
          plannedSets:
            row.planned_sets == null ? undefined : Number(row.planned_sets),
          actualDurationSeconds:
            row.actual_duration_seconds == null
              ? undefined
              : Number(row.actual_duration_seconds),
          actualDistanceMetres:
            row.actual_distance_metres == null
              ? undefined
              : Number(row.actual_distance_metres),
          actualSets:
            row.actual_sets == null ? undefined : Number(row.actual_sets),
          actualVolumeKg:
            row.actual_volume_kg == null
              ? undefined
              : Number(row.actual_volume_kg),
          actualRpe:
            athlete?.session_rpe == null
              ? row.actual_rpe == null
                ? undefined
                : Number(row.actual_rpe)
              : Number(athlete.session_rpe),
          athleteFeel: athlete?.session_feel || undefined,
          athleteComment: String(athlete?.athlete_comment || "") || undefined,
          activityType: row.activity_type,
          assignedBy: row.assigned_by || undefined,
          coachFeedback: row.coach_feedback || undefined,
          coachFeedbackUpdatedAt: row.coach_feedback_updated_at || undefined,
        };
      },
    );
    const noteRow = ((noteResult.data || []) as CoachWeekReviewNoteRow[])[0];
    const note = noteRow
      ? {
          id: noteRow.note_id,
          weekStart,
          text: noteRow.note,
          coachName: noteRow.coach_display_name,
          createdAt: noteRow.created_at,
          updatedAt: noteRow.updated_at,
        }
      : null;
    return buildCoachWeeklyReview({
      relationshipId,
      weekStart,
      today,
      sessions,
      note,
    });
  }
  async saveWeeklyReviewNote(
    relationshipId: string,
    weekStart: string,
    note: string,
  ) {
    const { data, error } = await this.client.rpc(
      "save_coach_weekly_review_note",
      {
        p_relationship_id: relationshipId,
        p_week_start: weekStart,
        p_note: note,
      },
    );
    if (error) throw error;
    return data ? String(data) : null;
  }
  async clientWeeklyReviewNotes(): Promise<CoachWeeklyReviewNote[]> {
    const { data, error } = await this.client.rpc(
      "list_client_weekly_review_notes",
    );
    if (error) {
      if (["42883", "PGRST202"].includes(String(error.code || ""))) return [];
      throw error;
    }
    return ((data || []) as CoachWeekReviewNoteRow[]).map((row) => ({
      id: row.note_id,
      relationshipId: row.relationship_id,
      weekStart: String(row.week_start),
      text: row.note,
      coachName: row.coach_display_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
  async athleteCoachingWeek(
    anchor: string,
  ): Promise<AthleteCoachingWeekItem[]> {
    const { data, error } = await this.client.rpc("list_client_coaching_week", {
      p_anchor: anchor,
    });
    if (error) {
      if (["42883", "PGRST202"].includes(String(error.code || ""))) return [];
      throw error;
    }
    return ((data || []) as AthleteCoachingWeekRow[]).map((row) => ({
      relationshipId: row.relationship_id,
      relationshipStatus: row.relationship_status,
      coachName: row.coach_name,
      occurrenceId: row.occurrence_id,
      assignmentId: row.assignment_id,
      clientProgramId: row.client_program_id,
      programName: row.program_name,
      programWeekNumber:
        row.program_week_number == null
          ? null
          : Number(row.program_week_number),
      programDurationWeeks:
        row.program_duration_weeks == null
          ? null
          : Number(row.program_duration_weeks),
      date: row.planned_date,
      modality: row.modality,
      status: row.status,
      title: row.title,
      completedClientId: row.linked_completion_client_id,
      coachFeedback: row.coach_feedback,
      coachFeedbackUpdatedAt: row.coach_feedback_updated_at,
      sessionRpe: row.session_rpe == null ? null : Number(row.session_rpe),
      sessionFeel: row.session_feel,
      athleteComment: row.athlete_comment,
      weekStart: row.week_start,
      weekEnd: row.week_end,
    }));
  }
  async athletePrograms(anchor: string): Promise<AthleteProgramProgress[]> {
    const { data, error } = await this.client.rpc(
      "list_client_program_progress",
      { p_anchor: anchor },
    );
    if (error) {
      if (["42883", "PGRST202"].includes(String(error.code || ""))) return [];
      throw error;
    }
    return ((data || []) as AthleteProgramRow[]).map((row) => ({
      id: row.client_program_id,
      relationshipId: row.relationship_id,
      relationshipStatus: row.relationship_status,
      coachName: row.coach_name,
      name: row.name,
      description: row.description || "",
      focus: row.focus || "",
      durationWeeks: Number(row.duration_weeks),
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      note: row.note || "",
      currentWeek: Number(row.current_week),
      totalSessions: Number(row.total_sessions),
      completedSessions: Number(row.completed_sessions),
      remainingSessions: Number(row.remaining_sessions),
    }));
  }
  async saveSessionFeedback(assignmentId: string, feedback: string) {
    const { data, error } = await this.client.rpc(
      "save_coach_session_feedback",
      { p_assignment_id: assignmentId, p_feedback: feedback },
    );
    if (error) throw error;
    return String(data);
  }
  async deleteSessionFeedback(feedbackId: string) {
    const { error } = await this.client.rpc("delete_coach_session_feedback", {
      p_feedback_id: feedbackId,
    });
    if (error) throw error;
  }
  async feedbackNotifications(): Promise<CoachFeedbackNotification[]> {
    const { data, error } = await this.client.rpc(
      "list_coach_feedback_notifications",
    );
    if (error) {
      if (["42883", "PGRST202"].includes(String(error.code || ""))) return [];
      throw error;
    }
    return ((data || []) as CoachFeedbackNotificationRow[]).map(
      (row): CoachFeedbackNotification => ({
        notificationId: row.notification_id,
        feedbackId: row.feedback_id,
        coachName: row.coach_display_name,
        sessionTitle: row.session_title,
        sessionDate: row.session_date,
        modality: row.modality,
        completedClientId: row.completed_client_id,
        createdAt: row.created_at,
        readAt: row.read_at,
      }),
    );
  }
  async markFeedbackNotificationRead(notificationId: string) {
    const { error } = await this.client
      .from("coach_feedback_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId);
    if (error) throw error;
  }
  async comments(input: {
    relationshipId: string;
    targetType: CoachCommentTarget;
    assignmentId?: string | null;
    weekStart?: string | null;
  }): Promise<CoachComment[]> {
    const { data, error } = await this.client.rpc("list_coach_comments", {
      p_relationship_id: input.relationshipId,
      p_target_type: input.targetType,
      p_assignment_id: input.assignmentId || null,
      p_week_start: input.weekStart || null,
    });
    if (error) {
      if (["42883", "PGRST202"].includes(String(error.code || ""))) return [];
      throw error;
    }
    return ((data || []) as CoachCommentRow[]).map((row) => ({
      id: row.comment_id,
      authorUserId: row.author_user_id,
      authorName: row.author_name,
      authorAvatarUrl: row.author_avatar_url,
      authorRole: row.author_role,
      body: row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      canEdit: Boolean(row.can_edit),
      relationshipActive: Boolean(row.relationship_active),
    }));
  }
  async saveComment(input: {
    relationshipId: string;
    targetType: CoachCommentTarget;
    body: string;
    assignmentId?: string | null;
    weekStart?: string | null;
    commentId?: string | null;
  }) {
    const { data, error } = await this.client.rpc("save_coach_comment", {
      p_relationship_id: input.relationshipId,
      p_target_type: input.targetType,
      p_body: input.body,
      p_assignment_id: input.assignmentId || null,
      p_week_start: input.weekStart || null,
      p_comment_id: input.commentId || null,
    });
    if (error) throw error;
    return String(data);
  }
  async deleteComment(commentId: string) {
    const { error } = await this.client.rpc("delete_coach_comment", {
      p_comment_id: commentId,
    });
    if (error) throw error;
  }
  async commentNotifications(): Promise<CoachCommentNotification[]> {
    const { data, error } = await this.client.rpc(
      "list_coach_comment_notifications",
    );
    if (error) {
      if (["42883", "PGRST202"].includes(String(error.code || ""))) return [];
      throw error;
    }
    return ((data || []) as CoachCommentNotificationRow[]).map((row) => ({
      notificationId: row.notification_id,
      commentId: row.comment_id,
      relationshipId: row.relationship_id,
      actorName: row.actor_name,
      actorRole: row.actor_role,
      targetType: row.target_type,
      assignmentId: row.assignment_id,
      weekStart: row.week_start,
      targetTitle: row.target_title,
      occurrenceId: row.occurrence_id,
      createdAt: row.created_at,
      readAt: row.read_at,
    }));
  }
  async markCommentNotificationRead(notificationId: string) {
    const { error } = await this.client
      .from("coach_comment_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId);
    if (error) throw error;
  }
  async myAvailability(): Promise<ClientTrainingAvailability> {
    const { data, error } = await this.client.rpc(
      "get_my_training_availability",
    );
    if (error) {
      if (["42883", "PGRST202"].includes(String(error.code || "")))
        return availabilityFromRow();
      throw error;
    }
    return availabilityFromRow(((data || []) as TrainingAvailabilityRow[])[0]);
  }
  async saveMyAvailability(value: ClientTrainingAvailability) {
    const { error } = await this.client.rpc("save_my_training_availability", {
      p_preferred_days: value.preferredDays,
      p_unavailable_days: value.unavailableDays,
      p_rest_days: value.restDays,
      p_preferred_session_times: value.preferredSessionTimes,
      p_notes: value.notes,
    });
    if (error) throw error;
  }
  async saveUnavailableDate(date: string, note: string) {
    const { data, error } = await this.client.rpc("save_my_unavailable_date", {
      p_date: date,
      p_note: note,
    });
    if (error) throw error;
    return String(data);
  }
  async deleteUnavailableDate(id: string) {
    const { error } = await this.client.rpc("delete_my_unavailable_date", {
      p_id: id,
    });
    if (error) throw error;
  }
  async clientAvailability(
    relationshipId: string,
    start: string,
    end: string,
  ): Promise<ClientTrainingAvailability> {
    const { data, error } = await this.client.rpc(
      "get_coach_client_availability",
      { p_relationship_id: relationshipId, p_start: start, p_end: end },
    );
    if (error) {
      if (["42883", "PGRST202"].includes(String(error.code || "")))
        return availabilityFromRow();
      throw error;
    }
    return availabilityFromRow(((data || []) as TrainingAvailabilityRow[])[0]);
  }
  async athleteGoals(relationshipId?: string | null): Promise<AthleteGoal[]> {
    const { data, error } = await this.client.rpc("list_athlete_goals", {
      p_relationship_id: relationshipId || null,
    });
    if (error) {
      if (["42883", "PGRST202"].includes(String(error.code || ""))) return [];
      throw error;
    }
    return ((data || []) as AthleteGoalRow[]).map((row) => ({
      id: row.goal_id,
      clientUserId: row.client_user_id,
      relationshipId: row.relationship_id,
      title: row.title,
      goalType: row.goal_type,
      targetDate: row.target_date,
      metricType: row.metric_type,
      targetValue: row.target_value == null ? null : Number(row.target_value),
      targetUnit: row.target_unit,
      targetLabel: row.target_label,
      targetDistanceMetres:
        row.target_distance_metres == null
          ? null
          : Number(row.target_distance_metres),
      targetText: row.target_text,
      notes: row.notes,
      isPrimary: Boolean(row.is_primary),
      status: row.status,
      approvalStatus: row.approval_status,
      createdByRole: row.created_by_role,
      creatorName: row.creator_name,
      currentValue:
        row.current_value == null ? null : Number(row.current_value),
      previousValue:
        row.previous_value == null ? null : Number(row.previous_value),
      currentValueDate: row.current_value_date,
      recentDataCount: Number(row.recent_data_count) || 0,
      goalReached: Boolean(row.goal_reached),
      linkedPrograms: row.linked_programs || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
  async saveAthleteGoal(goal: AthleteGoalDraft) {
    const { data, error } = await this.client.rpc("save_athlete_goal", {
      p_goal_id: goal.id || null,
      p_relationship_id: goal.relationshipId || null,
      p_title: goal.title,
      p_goal_type: goal.goalType,
      p_target_date: goal.targetDate || null,
      p_metric_type: goal.metricType,
      p_target_value: goal.targetValue ?? null,
      p_target_unit: goal.targetUnit,
      p_target_label: goal.targetLabel,
      p_target_distance_metres: goal.targetDistanceMetres ?? null,
      p_target_text: goal.targetText,
      p_notes: goal.notes,
      p_is_primary: goal.isPrimary,
      p_linked_program_id: goal.linkedProgramId || null,
    });
    if (error) throw error;
    const id = String(data);
    if (goal.linkedProgramId)
      await this.linkAthleteGoalProgram(id, goal.linkedProgramId, true);
    return id;
  }
  async setAthleteGoalStatus(goalId: string, status: AthleteGoal["status"]) {
    const { error } = await this.client.rpc("set_athlete_goal_status", {
      p_goal_id: goalId,
      p_status: status,
    });
    if (error) throw error;
  }
  async acceptAthleteGoal(goalId: string, makePrimary: boolean) {
    const { error } = await this.client.rpc("accept_athlete_goal", {
      p_goal_id: goalId,
      p_make_primary: makePrimary,
    });
    if (error) throw error;
  }
  async linkAthleteGoalProgram(
    goalId: string,
    clientProgramId: string,
    link: boolean,
  ) {
    const { error } = await this.client.rpc("link_athlete_goal_program", {
      p_goal_id: goalId,
      p_client_program_id: clientProgramId,
      p_link: link,
    });
    if (error) throw error;
  }
}
