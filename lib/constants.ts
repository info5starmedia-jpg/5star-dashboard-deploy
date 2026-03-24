// Single source of truth for OWNER_EMAIL.
// Reads from the OWNER_EMAIL env var first; falls back to the hardcoded
// address so the app stays functional even without the env var set.
export const OWNER_EMAIL =
  (process.env.OWNER_EMAIL || "").replace(/^["']|["']$/g, "").trim() ||
  "info.5starmedia@gmail.com";
