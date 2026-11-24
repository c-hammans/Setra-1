import { NextResponse } from "next/server";
import * as webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { safePushPayload } from "@/lib/notifications/push-delivery";

export const runtime = "nodejs";
export const maxDuration = 60;

type Delivery = {
  job_id: string; endpoint: string; p256dh: string; auth_secret: string;
  notification_id: string; notification_type: string; target_path: string | null;
};

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return NextResponse.json({ error: "Push delivery is not configured." }, { status: 503 });
  webpush.setVapidDetails(subject, publicKey, privateKey);
  const admin = createAdminClient();
  await admin.rpc("materialize_due_session_reminders");
  const { data, error } = await admin.rpc("claim_push_delivery_jobs", { p_limit: 100 });
  if (error) return NextResponse.json({ error: "Push jobs could not be loaded." }, { status: 500 });
  let delivered = 0; let failed = 0;
  await Promise.all(((data || []) as Delivery[]).map(async delivery => {
    try {
      await webpush.sendNotification({ endpoint: delivery.endpoint, keys: { p256dh: delivery.p256dh, auth: delivery.auth_secret } }, JSON.stringify(safePushPayload(delivery.notification_type, delivery.notification_id, delivery.target_path)), { TTL: 3600, urgency: "normal" });
      await admin.rpc("finish_push_delivery_job", { p_job_id: delivery.job_id, p_delivered: true, p_permanent_failure: false, p_error: null }); delivered += 1;
    } catch (caught) {
      const pushError = caught as { statusCode?: number; message?: string };
      const permanent = pushError.statusCode === 404 || pushError.statusCode === 410;
      await admin.rpc("finish_push_delivery_job", { p_job_id: delivery.job_id, p_delivered: false, p_permanent_failure: permanent, p_error: String(pushError.message || "Push delivery failed").slice(0, 500) }); failed += 1;
    }
  }));
  return NextResponse.json({ claimed: (data || []).length, delivered, failed });
}
