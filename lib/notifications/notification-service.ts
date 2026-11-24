import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { defaultNotificationPreferences, type NotificationPreferences, type SetraNotification } from "./types";

type Row = Record<string, unknown>;
const mapNotification = (row: Row): SetraNotification => ({
  id: String(row.notification_id), category: row.category as SetraNotification["category"], type: String(row.notification_type),
  title: String(row.title), body: String(row.body || ""), targetType: row.target_type ? String(row.target_type) : null,
  targetId: row.target_id ? String(row.target_id) : null, targetPath: row.target_path ? String(row.target_path) : null,
  actorName: row.actor_name ? String(row.actor_name) : null, createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  readAt: row.read_at ? String(row.read_at) : null,
});

export class NotificationService {
  private supabase: SupabaseClient;
  constructor() { this.supabase = createClient(); }

  async list(before?: string, limit = 30): Promise<SetraNotification[]> {
    const { data, error } = await this.supabase.rpc("list_app_notifications", { p_before: before || null, p_limit: limit });
    if (error) throw error;
    return ((data || []) as Row[]).map(mapNotification);
  }
  async unreadCount() {
    const { data, error } = await this.supabase.rpc("count_unread_app_notifications");
    if (error) throw error;
    return Number(data || 0);
  }
  async markRead(id: string) { const { error } = await this.supabase.rpc("mark_app_notification_read", { p_notification_id: id }); if (error) throw error; }
  async markAllRead() { const { error } = await this.supabase.rpc("mark_all_app_notifications_read"); if (error) throw error; }
  async dismiss(id: string) { const { error } = await this.supabase.rpc("dismiss_app_notification", { p_notification_id: id }); if (error) throw error; }
  async preferences(): Promise<NotificationPreferences> {
    const { data, error } = await this.supabase.rpc("get_notification_preferences");
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row ? {
      inApp: { training: row.training_enabled !== false, coaching: row.coaching_enabled !== false, social: row.social_enabled !== false, awards: row.awards_enabled !== false },
      push: { training: row.push_training_enabled === true, coaching: row.push_coaching_enabled === true, social: row.push_social_enabled === true },
      sessionReminderOffset: row.session_reminder_offset_minutes == null ? null : Number(row.session_reminder_offset_minutes) as NotificationPreferences["sessionReminderOffset"],
    } : defaultNotificationPreferences;
  }
  async savePreferences(value: NotificationPreferences) {
    const { error } = await this.supabase.rpc("save_notification_preferences", {
      p_training: value.inApp.training, p_coaching: value.inApp.coaching, p_social: value.inApp.social, p_awards: value.inApp.awards,
      p_push_training: value.push.training, p_push_coaching: value.push.coaching, p_push_social: value.push.social,
      p_session_reminder_offset: value.sessionReminderOffset,
    });
    if (error) throw error;
  }
}
