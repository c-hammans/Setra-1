"use client";

import { useEffect } from "react";
import { registerSetraServiceWorker } from "@/lib/notifications/push-client";

export function PushServiceWorker() {
  useEffect(() => { void registerSetraServiceWorker().catch(() => null); }, []);
  return null;
}
