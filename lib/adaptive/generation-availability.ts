import "server-only";
import { NextResponse } from "next/server";

export const adaptiveGenerationEnabled = () => process.env.SETRA_ADAPTIVE_GENERATION_ENABLED === "true";

export const adaptiveGenerationDisabledResponse = () => NextResponse.json(
  { error: "Adaptive generation is unavailable during this beta.", disabled: true },
  { status: 503 },
);
