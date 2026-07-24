const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function normalizeSecret(secret) {
  return String(secret ?? "")
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/=+$/g, "");
}

export function decodeBase32(secret) {
  const normalized = normalizeSecret(secret);
  if (!normalized || !/^[A-Z2-7]+$/.test(normalized)) {
    throw new Error("密钥必须是 Base32 字符（A-Z、2-7）");
  }
  if (normalized.length < 8) {
    throw new Error("密钥长度太短");
  }

  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (const character of normalized) {
    buffer = (buffer << 5) | BASE32_ALPHABET.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

export function isValidSecret(secret) {
  try {
    decodeBase32(secret);
    return true;
  } catch {
    return false;
  }
}

function counterBytes(counter) {
  const bytes = new ArrayBuffer(8);
  const view = new DataView(bytes);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  view.setUint32(0, high);
  view.setUint32(4, low);
  return bytes;
}

export function remainingSeconds(timestamp = Date.now(), period = 30) {
  const elapsed = Math.floor(timestamp / 1000) % period;
  return period - elapsed;
}

export async function generateTotp(secret, timestamp = Date.now(), digits = 6, period = 30) {
  const keyBytes = decodeBase32(secret);
  const counter = Math.floor(timestamp / 1000 / period);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes(counter)));
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  const code = String(binary % (10 ** digits)).padStart(digits, "0");
  return { code, secondsRemaining: remainingSeconds(timestamp, period), counter };
}
