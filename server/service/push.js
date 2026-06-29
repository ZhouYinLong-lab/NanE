/**
 * Web Push notification service — send push events to subscribed browsers.
 */
const webpush = require("web-push");
const { query } = require("../db");

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@nane.local";

let configured = false;

function init() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
}

function isConfigured() {
  return configured;
}

function getPublicKey() {
  return VAPID_PUBLIC_KEY;
}

/**
 * Send a push notification to all subscribed devices of a user.
 * Best-effort — failures are silently ignored.
 */
async function sendToUser(userId, payload) {
  if (!configured || !userId) return;
  try {
    const { rows } = await query(
      "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1",
      [userId]
    );
    const body = JSON.stringify({
      title: payload.title || "NanE 南易",
      body: payload.body || "",
      icon: "/assets/brand/web-logo.png",
      badge: "/assets/brand/nane-logo.png",
      data: payload.data || {}
    });
    for (const sub of rows) {
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body
      ).catch(() => {}); // Individual failures don't stop others
    }
  } catch (_) {
    // Best-effort
  }
}

/**
 * Broadcast to multiple users (e.g., all users in a building).
 */
async function sendToUsers(userIds, payload) {
  for (const id of userIds) {
    await sendToUser(id, payload);
  }
}

// Initialize on require
init();

module.exports = { init, isConfigured, getPublicKey, sendToUser, sendToUsers };
