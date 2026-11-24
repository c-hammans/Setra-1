import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SubscriptionBody = { endpoint?: unknown; expirationTime?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

const authenticatedClient = async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
};

export async function POST(request: Request) {
  const { supabase, user } = await authenticatedClient();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const body = await request.json().catch(() => null) as SubscriptionBody | null;
  if (!body || typeof body.endpoint !== "string" || !body.endpoint.startsWith("https://") || typeof body.keys?.p256dh !== "string" || typeof body.keys.auth !== "string") {
    return NextResponse.json({ error: "That push subscription is invalid." }, { status: 400 });
  }
  const { error } = await supabase.rpc("register_push_subscription", {
    p_endpoint: body.endpoint, p_p256dh: body.keys.p256dh, p_auth: body.keys.auth,
    p_expiration_time: typeof body.expirationTime === "number" ? new Date(body.expirationTime).toISOString() : null,
    p_user_agent: request.headers.get("user-agent") || "",
  });
  if (error) return NextResponse.json({ error: "This device could not be registered." }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await authenticatedClient();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { endpoint?: unknown } | null;
  if (!body || typeof body.endpoint !== "string") return NextResponse.json({ error: "A subscription endpoint is required." }, { status: 400 });
  const { error } = await supabase.rpc("revoke_push_subscription", { p_endpoint: body.endpoint });
  if (error) return NextResponse.json({ error: "This device could not be removed." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
