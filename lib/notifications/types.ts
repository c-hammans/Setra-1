export type NotificationCategory = "training" | "coaching" | "social" | "awards";
export type PushNotificationCategory = Exclude<NotificationCategory, "awards">;
export type SessionReminderOffset = null | 0 | 30 | 60;

export type SetraNotification = {
  id: string;
  category: NotificationCategory;
  type: string;
  title: string;
  body: string;
  targetType?: string | null;
  targetId?: string | null;
  targetPath?: string | null;
  actorName?: string | null;
  createdAt: string;
  updatedAt: string;
  readAt?: string | null;
};

export type NotificationPreferences = {
  inApp: Record<NotificationCategory, boolean>;
  push: Record<PushNotificationCategory, boolean>;
  sessionReminderOffset: SessionReminderOffset;
};

export const defaultNotificationPreferences: NotificationPreferences = {
  inApp: { training: true, coaching: true, social: true, awards: true },
  push: { training: false, coaching: false, social: false },
  sessionReminderOffset: null,
};
