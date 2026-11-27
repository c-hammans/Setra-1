import {safeInternalRedirect} from "../security/safe-redirect.ts";

export const pushEligibleTypes = new Set([
  "workout_assigned", "program_assigned", "program_updated", "planned_session_changed", "coach_feedback", "weekly_review",
  "coach_comment", "coach_invite", "coach_relationship_accepted", "friend_request", "workout_shared", "template_shared", "planned_session_reminder",
]);

const safePushCopy: Record<string, [string, string]> = {
  workout_assigned: ["Training assigned", "New training has been added to your plan."],
  program_assigned: ["Program assigned", "A new training program has been added to your plan."],
  program_updated: ["Program updated", "Your training program has been updated."],
  planned_session_changed: ["Training updated", "A planned session has been updated."],
  coach_feedback: ["Coach feedback", "Your coach left feedback on your session."],
  weekly_review: ["Weekly review", "Your weekly review is ready."],
  coach_comment: ["New coaching comment", "You have a new comment in Setra."],
  coach_invite: ["Coaching invitation", "You have a new coaching invitation."],
  coach_relationship_accepted: ["Coaching connected", "A coaching invitation was accepted."],
  friend_request: ["Friend request", "You have a new friend request."],
  workout_shared: ["Training shared", "A friend shared a workout with you."],
  template_shared: ["Template shared", "A friend shared a template with you."],
  planned_session_reminder: ["Upcoming planned session", "You have a planned session coming up."],
};

export const safePushPayload = (notificationType: string, notificationId: string, targetPath: string | null) => {
  const [title, body] = safePushCopy[notificationType] || ["Setra", "You have a new notification."];
  return { title, body, notificationId, url: safeInternalRedirect(targetPath,"/notifications") };
};
