const encoder = new TextEncoder();

const asBytes = (hex) => {
  if (!/^[0-9a-f]{64}$/i.test(hex || "")) return null;
  return Uint8Array.from(hex.match(/.{2}/g), (byte) => Number.parseInt(byte, 16));
};

const constantTimeEqual = (left, right) => {
  if (!left || !right || left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left[index] ^ right[index];
  }
  return result === 0;
};

export async function verifyWebflowWebhook({
  body,
  timestamp,
  signature,
  secret,
  now = Date.now(),
}) {
  const requestTime = Number(timestamp);
  if (!secret || !Number.isFinite(requestTime)) return false;
  if (Math.abs(now - requestTime) > 300_000) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}:${body}`))
  );
  return constantTimeEqual(expected, asBytes(signature));
}
