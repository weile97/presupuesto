// PIN de los sobres: los hash se quedan en el servidor y nunca se envían a la app.
// Además de en los datos, se guardan aparte por id de sobre para que "Deshacer" un borrado no pierda el PIN.
import crypto from 'node:crypto';

const PREFIX = 's1:'; // mismo formato que ya tienen los sobres guardados: los PIN actuales siguen valiendo

export const hashPin = (catId, pin) =>
  PREFIX + crypto.createHash('sha256').update(`${catId}:${String(pin).trim()}`).digest('hex');

// Versión sin secretos, la única que sale hacia la app
export const stripPins = (data) => ({
  ...data,
  categories: (data?.categories || []).map(({ pin: _pin, pinHash: _hash, ...cat }) => cat)
});

// Hash válido de un sobre guardado (convierte formatos antiguos: PIN en claro o base64)
function storedHash(cat) {
  if (!cat) return null;
  if (typeof cat.pinHash === 'string' && cat.pinHash.startsWith(PREFIX)) return cat.pinHash;
  if (cat.pin) return hashPin(cat.id, cat.pin);
  if (cat.pinHash) {
    try { return hashPin(cat.id, Buffer.from(cat.pinHash, 'base64').toString()); } catch { return null; }
  }
  return null;
}

// Vuelve a poner los hash en los sobres que llegan de la app. Lo que envíe la app sobre PIN se ignora.
export function applyPins(incoming = [], previous = [], pinMap = {}) {
  const prevById = new Map(previous.map((c) => [c.id, c]));
  const map = { ...pinMap };
  let changed = false;
  for (const cat of previous) {
    const hash = storedHash(cat);
    if (hash && !map[cat.id]) { map[cat.id] = hash; changed = true; }
  }
  const categories = incoming.map(({ pin: _pin, pinHash: _hash, ...cat }) => {
    if (!cat.hasPin) return cat;
    const hash = map[cat.id] || storedHash(prevById.get(cat.id));
    return hash ? { ...cat, pinHash: hash } : cat;
  });
  return { categories, map, changed };
}
