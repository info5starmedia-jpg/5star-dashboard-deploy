import { NextResponse } from "next/server";

export function GET() {
  const baseUrl = process.env.NEXTAUTH_URL ?? "";
  const env = baseUrl.includes("staging.") ? "staging" : "prod";
  const version = process.env.APP_VERSION || "unknown";

  return NextResponse.json({
    ok: true,
    env,
    time: new Date().toISOString(),
    version,
  });
}
