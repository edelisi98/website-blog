import test from "node:test";
import assert from "node:assert/strict";
import { verifyWebflowWebhook } from "../lib/webhook-signature.js";

const hex = (bytes) =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

test("accepts a current valid Webflow HMAC and rejects tampering", async () => {
  const secret = "test-secret";
  const timestamp = "1784040000000";
  const body = '{"triggerType":"collection_item_published"}';
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = hex(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}:${body}`)
    )
  );

  assert.equal(
    await verifyWebflowWebhook({
      body,
      timestamp,
      signature,
      secret,
      now: Number(timestamp) + 1000,
    }),
    true
  );
  assert.equal(
    await verifyWebflowWebhook({
      body: `${body}tampered`,
      timestamp,
      signature,
      secret,
      now: Number(timestamp) + 1000,
    }),
    false
  );
});

test("rejects replayed webhook requests", async () => {
  assert.equal(
    await verifyWebflowWebhook({
      body: "{}",
      timestamp: "1000",
      signature: "0".repeat(64),
      secret: "secret",
      now: 302_000,
    }),
    false
  );
});

test("accepts any configured site webhook signing key", async () => {
  const timestamp = "1784040000000";
  const body = '{"triggerType":"collection_item_deleted"}';
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("second-webhook-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = hex(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}:${body}`)
    )
  );

  assert.equal(
    await verifyWebflowWebhook({
      body,
      timestamp,
      signature,
      secrets: "first-webhook-secret,second-webhook-secret\nthird-webhook-secret",
      now: Number(timestamp) + 1000,
    }),
    true
  );
});
