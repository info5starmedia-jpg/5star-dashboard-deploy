// AYCD Inbox source — pulls captured codes via the AYCD Inbox API.
//
// AYCD Inbox exposes captured mail/codes behind a Bearer-token API, so we don't
// have to integrate IMAP for it. The exact response shape is confirmed against
// your account at wiring time; this adapter reads defensively (accepts a few
// common envelope shapes) and normalization happens in parse.mjs.

/**
 * @param {{token:string, baseUrl:string, mailPath:string}} aycd
 * @param {{lookbackDays?:number}} opts
 * @returns {Promise<Array<{kind:'aycd', source:'aycd', capturedAt:string, item:object}>>}
 */
export async function fetchFromAycd(aycd, opts = {}) {
  if (!aycd?.token) return [];

  const base = (aycd.baseUrl || "https://api.useinbox.com").replace(/\/+$/, "");
  const url = `${base}${aycd.mailPath || "/v1/mail"}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${aycd.token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AYCD Inbox ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json().catch(() => null);
  const items = Array.isArray(data)
    ? data
    : data?.items || data?.mail || data?.data || data?.results || [];

  return items.map((item) => ({
    kind: "aycd",
    source: "aycd",
    capturedAt: item.receivedAt || item.date || item.createdAt || new Date().toISOString(),
    item,
  }));
}
