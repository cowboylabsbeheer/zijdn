/**
 * ZIJDN website, Cloudflare Worker
 *
 * - Statische site (public/) wordt geserveerd via Workers Static Assets.
 * - POST /api/contact verstuurt het contactformulier als e-mail via de
 *   send_email binding van Cloudflare Email Routing.
 */
import { EmailMessage } from "cloudflare:email";

const LIMITS = { naam: 120, email: 200, organisatie: 160, soort: 60, datum: 60, bericht: 5000 };
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/contact") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
      }
      return handleContact(request, env, url);
    }

    // Alles wat geen bestaand bestand is: laat de assets-laag het afhandelen (404.html).
    return env.ASSETS.fetch(request);
  },
};

async function handleContact(request, env, url) {
  const wantsJson = (request.headers.get("accept") || "").includes("application/json");

  const reply = (ok, message = "", status = 200) => {
    if (wantsJson) return Response.json({ ok, message }, { status });
    // Zonder JavaScript: terug naar de site met een melding.
    return Response.redirect(new URL(`/?${ok ? "verzonden" : "fout"}=1#contact`, url), 303);
  };

  // Alleen formulieren van de eigen site accepteren.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== url.host) {
    return reply(false, "Dit formulier kan alleen vanaf de website verstuurd worden.", 403);
  }

  let data;
  try {
    const type = request.headers.get("content-type") || "";
    data = type.includes("application/json")
      ? await request.json()
      : Object.fromEntries(await request.formData());
  } catch {
    return reply(false, "Het formulier kon niet gelezen worden.", 400);
  }

  // Spamfilters: honeypot-veld en te snel ingevuld (bots). Doe alsof het gelukt is.
  if (data.website) return reply(true);
  const started = Number(data.t);
  if (started && Date.now() - started < 2500) return reply(true);

  const f = {};
  for (const [key, max] of Object.entries(LIMITS)) {
    f[key] = String(data[key] ?? "").trim().slice(0, max);
  }

  if (!f.naam || !f.bericht) return reply(false, "Vul je naam en een bericht in.", 422);
  if (!EMAIL_RE.test(f.email)) return reply(false, "Vul een geldig e-mailadres in.", 422);

  const subject = `Nieuw bericht via zijdn.nl van ${oneLine(f.naam)}${f.soort ? ` (${oneLine(f.soort)})` : ""}`;
  const text = [
    `Naam:          ${oneLine(f.naam)}`,
    `E-mail:        ${f.email}`,
    f.organisatie ? `Organisatie:   ${f.organisatie}` : null,
    f.soort ? `Gaat over:     ${f.soort}` : null,
    f.datum ? `Datum:         ${f.datum}` : null,
    "",
    "Bericht:",
    f.bericht,
    "",
    "--",
    "Verstuurd via het contactformulier op zijdn.nl. Je kunt direct op deze mail antwoorden.",
  ].filter((line) => line !== null).join("\r\n");

  const raw = buildMime({
    from: env.MAIL_FROM,
    fromName: "ZIJDN website",
    to: env.MAIL_TO,
    replyTo: f.email,
    replyName: f.naam,
    subject,
    text,
  });

  try {
    await env.MAIL.send(new EmailMessage(env.MAIL_FROM, env.MAIL_TO, raw));
  } catch (err) {
    console.error({ message: "Contactformulier: versturen mislukt", error: String(err) });
    return reply(false, "Versturen lukte niet.", 502);
  }

  console.info({ message: "Contactformulier verstuurd", soort: f.soort || "-" });
  return reply(true);
}

/* ---------- helpers ---------- */

function oneLine(s) {
  return s.replace(/[\r\n\t]+/g, " ").trim();
}

function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

// RFC 2047 encoded-word, zodat namen met é, ë enz. goed aankomen.
function encodeWord(s) {
  return `=?UTF-8?B?${b64(oneLine(s))}?=`;
}

function buildMime({ from, fromName, to, replyTo, replyName, subject, text }) {
  const domain = from.split("@")[1];
  const headers = [
    `From: ${encodeWord(fromName)} <${from}>`,
    `To: <${to}>`,
    `Reply-To: ${encodeWord(replyName)} <${replyTo}>`,
    `Subject: ${encodeWord(subject)}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];
  const body = b64(text).replace(/.{1,76}/g, "$&\r\n");
  return headers.join("\r\n") + "\r\n\r\n" + body;
}
