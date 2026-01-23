function normalize(email: string) {
  return email.trim().toLowerCase();
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const owner = normalize(process.env.OWNER_EMAIL || "");
  const allow = (process.env.ADMIN_EMAIL_ALLOWLIST || "")
    .split(",")
    .map((s) => normalize(s))
    .filter(Boolean);

  const e = normalize(email);
  if (owner && e === owner) return true;
  return allow.includes(e);
}
