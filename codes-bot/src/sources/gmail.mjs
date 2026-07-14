// Gmail source — reads each inbox over IMAP using an App Password.
//
// One account at a time, kept fully separate (no forwarding). Returns raw
// inputs for the parser. Network failures for one account are surfaced to the
// caller, which isolates them so the other accounts still run.

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

/**
 * @param {{user:string, appPassword:string, host:string, port:number}} account
 * @param {{lookbackDays?:number, senders?:string[]}} opts
 *   senders: substrings to match against the From address (default: seated.com)
 * @returns {Promise<Array<{kind:string, source:string, capturedAt:string, subject:string, plaintextBody:string}>>}
 */
export async function fetchFromGmail(account, opts = {}) {
  const lookbackDays = opts.lookbackDays || 30;
  const senders = (opts.senders && opts.senders.length ? opts.senders : ["seated.com"]).map((s) =>
    s.toLowerCase()
  );

  const client = new ImapFlow({
    host: account.host || "imap.gmail.com",
    port: account.port || 993,
    secure: true,
    auth: { user: account.user, pass: account.appPassword },
    logger: false,
  });

  const out = [];
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date(Date.now() - lookbackDays * 86400000);
      for await (const msg of client.fetch({ since }, { source: true })) {
        const parsed = await simpleParser(msg.source);
        const from = (parsed.from?.value?.[0]?.address || "").toLowerCase();
        if (senders.length && !senders.some((s) => from.includes(s))) continue;
        out.push({
          kind: "seated",
          source: `gmail:${account.user}`,
          capturedAt: (parsed.date || new Date()).toISOString(),
          subject: parsed.subject || "",
          plaintextBody: parsed.text || "",
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return out;
}
