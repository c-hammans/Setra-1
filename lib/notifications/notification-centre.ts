import type { NotificationCategory, SetraNotification } from "./types.ts";

export const notificationCategoryLabel: Record<NotificationCategory, string> = {
  training: "Training",
  coaching: "Coaching",
  social: "Friends & sharing",
  awards: "Awards & milestones",
};

export const notificationCategoryIcon: Record<NotificationCategory, string> = {
  training: "▤",
  coaching: "◇",
  social: "◎",
  awards: "◆",
};

export const unreadNotifications = (items: SetraNotification[]) =>
  items.filter((item) => !item.readAt).length;

export const notificationTarget = (item: SetraNotification) =>
  item.targetPath && item.targetPath.startsWith("/") ? item.targetPath : null;

export const notificationTime = (value: string, now = new Date()) => {
  const date = new Date(value);
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} d ago`;
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(date);
};
