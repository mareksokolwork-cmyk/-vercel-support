// api/signal.js — Vercel Serverless Function
// Принимает POST-запросы от клиента/менеджера и пересылает через Pusher

const crypto = require("crypto");

const APP_ID  = process.env.PUSHER_APP_ID;
const KEY     = process.env.PUSHER_KEY;
const SECRET  = process.env.PUSHER_SECRET;
const CLUSTER = process.env.PUSHER_CLUSTER;

/**
 * Отправить событие через Pusher REST API
 * (без SDK — чтобы не тащить зависимости в serverless)
 */
async function pusherTrigger(channel, event, data) {
  const body = JSON.stringify({
    name: event,
    channel,
    data: JSON.stringify(data),
  });

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyMd5 = crypto.createHash("md5").update(body).digest("hex");

  const params = new URLSearchParams({
    auth_key: KEY,
    auth_timestamp: timestamp,
    auth_version: "1.0",
    body_md5: bodyMd5,
  });
  // Сортируем параметры для подписи
  const sortedParams = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const stringToSign = `POST\n/apps/${APP_ID}/events\n${sortedParams}`;
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(stringToSign)
    .digest("hex");

  const url = `https://api-${CLUSTER}.pusher.com/apps/${APP_ID}/events?${sortedParams}&auth_signature=${signature}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pusher error ${res.status}: ${text}`);
  }
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  let msg;
  try {
    msg = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const { type, sessionId } = msg;

  try {
    // ── Клиент регистрирует сессию → уведомляем менеджеров ──────────────────
    if (type === "register-client") {
      await pusherTrigger("managers", "new-session", { sessionId });
      return res.json({ ok: true });
    }

    // ── Менеджер принимает сессию → говорим клиенту делать offer ────────────
    if (type === "join-session") {
      await pusherTrigger(`session-${sessionId}`, "manager-joined", {});
      return res.json({ ok: true });
    }

    // ── SDP offer (клиент → менеджер) ────────────────────────────────────────
    if (type === "offer") {
      await pusherTrigger("managers", "offer", { sessionId, sdp: msg.sdp });
      return res.json({ ok: true });
    }

    // ── SDP answer (менеджер → клиент) ───────────────────────────────────────
    if (type === "answer") {
      await pusherTrigger(`session-${sessionId}`, "answer", { sdp: msg.sdp });
      return res.json({ ok: true });
    }

    // ── ICE-кандидат (в обе стороны) ─────────────────────────────────────────
    if (type === "ice-candidate") {
      const target = msg.from === "client"
        ? "managers"
        : `session-${sessionId}`;
      await pusherTrigger(target, "ice-candidate", {
        sessionId,
        candidate: msg.candidate,
        from: msg.from,
      });
      return res.json({ ok: true });
    }

    // ── Клиент отключился ─────────────────────────────────────────────────────
    if (type === "client-disconnected") {
      await pusherTrigger("managers", "session-ended", { sessionId });
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: "Unknown type" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
