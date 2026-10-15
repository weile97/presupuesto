// PIN de los sobres: se guarda solo un hash SHA-256 (con el id del sobre como sal), nunca el PIN.
// Formato: "s1:<hex>". Los sobres antiguos guardaban el PIN en claro (pin) o en base64 (pinHash).
const PREFIX = "s1:";

export async function hashPin(catId, pin) {
  const bytes = new TextEncoder().encode(`${catId}:${String(pin).trim()}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return PREFIX + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const isSecureHash = (cat) => typeof cat?.pinHash === "string" && cat.pinHash.startsWith(PREFIX);

// PIN en claro de un sobre antiguo (para migrarlo), o null
export function legacyPin(cat) {
  if (!cat?.hasPin || isSecureHash(cat)) return null;
  if (cat.pin) return String(cat.pin).trim();
  try { return cat.pinHash ? atob(cat.pinHash) : null; } catch { return null; }
}

export async function pinMatches(cat, entered) {
  if (!entered) return false;
  if (isSecureHash(cat)) return (await hashPin(cat.id, entered)) === cat.pinHash;
  return legacyPin(cat) === String(entered).trim();
}

// Convierte los sobres antiguos al hash seguro y elimina el PIN en claro. null si no hay nada que migrar.
export async function migrateCategoryPins(categories = []) {
  if (!categories.some((c) => legacyPin(c) !== null || (c.pin && isSecureHash(c)))) return null;
  return Promise.all(categories.map(async (c) => {
    const plain = legacyPin(c);
    if (plain !== null) {
      const { pin: _pin, ...rest } = c;
      return { ...rest, pinHash: await hashPin(c.id, plain) };
    }
    if (c.pin) { const { pin: _pin, ...rest } = c; return rest; }
    return c;
  }));
}
