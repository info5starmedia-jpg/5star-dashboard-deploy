/**
 * lib/email.ts
 * Sends invoice PDF emails via Resend REST API.
 * No new npm dependencies — uses native fetch.
 *
 * Required env vars:
 *   RESEND_API_KEY  — from https://resend.com (free tier: 100 emails/day)
 *   FROM_EMAIL      — verified sender address
 */

export async function sendInvoiceEmail(opts: {
  to: string;
  invoiceId: string;
  pdfBuffer: Buffer;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping invoice email");
    return { ok: true };
  }

  const from =
    (process.env.FROM_EMAIL || "").trim() || "invoices@5starmediaprod.com";
  const shortId = opts.invoiceId.slice(-8).toUpperCase();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: `Your Invoice — #${shortId}`,
        html: [
          '<div style="font-family:sans-serif;max-width:600px;margin:0 auto">',
          `<h2 style="margin-bottom:8px">Invoice #${shortId}</h2>`,
          "<p>Thank you for your business. Please find your invoice attached as a PDF.</p>",
          '<hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>',
          '<p style="font-size:12px;color:#999">Sent by 5Star Media. Reply to this email with any questions.</p>',
          "</div>",
        ].join(""),
        attachments: [
          {
            filename: `invoice-${shortId}.pdf`,
            content: opts.pdfBuffer.toString("base64"),
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[email] Resend error:", res.status, body);
      return { ok: false, error: `Resend ${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email] sendInvoiceEmail failed:", msg);
    return { ok: false, error: msg };
  }
}
