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

const normalizeSecrets = (secret, secrets) => {
  const values = [secret];
  if (Array.isArray(secrets)) values.push(...secrets);
  else values.push(...String(secrets || "").split(/[\n,]/));
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
};

export async function verifyWebflowWebhook({
  body,
  timestamp,
  signature,
  secret,
  secrets,
  now = Date.now(),
}) {
  const requestTime = Number(timestamp);
  const signingKeys = normalizeSecrets(secret, secrets);
  if (!signingKeys.length || !Number.isFinite(requestTime)) return false;
  if (Math.abs(now - requestTime) > 300_000) return false;

  const received = asBytes(signature);
  let matched = false;
  for (const signingKey of signingKeys) {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(signingKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const expected = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}:${body}`))
    );
    matched = constantTimeEqual(expected, received) || matched;
  }
  return matched;
}
