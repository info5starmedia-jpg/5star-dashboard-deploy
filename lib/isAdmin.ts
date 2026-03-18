function normalize(email: string) {
  return email.trim().toLowerCase();
}

function envClean(key: string): string {
  return (process.env[key] || "").replace(/^["']|["']$/g, "").trim();
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const owner = normalize(envClean("OWNER_EMAIL"));
  const allow = envClean("ADMIN_EMAIL_ALLOWLIST")
    .split(",")
    .map((s) => normalize(s))
    .filter(Boolean);

  const e = normalize(email);
  if (owner && e === owner) return true;
  return allow.includes(e);
}
