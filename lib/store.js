// Utilidades de servidor compartidas por las funciones de api/ (no es un endpoint).
import { describeChanges } from '../src/shared.js';

export const DATA_KEY = 'app_finanzas_data';
export const REV_KEY = 'app_finanzas_rev';
export const BACKUPS_KEY = 'app_finanzas_backups';
export const SUBS_KEY = 'app_finanzas_push_subs';
export const PUSH_ERROR_KEY = 'app_finanzas_push_last_error';
const MAX_BACKUPS = 50;

// Guardado atómico con control de versión (compare-and-set).
// - Si baseRev no coincide con la versión actual => conflicto, no se escribe nada.
// - Antes de sobrescribir guarda una copia del estado anterior (últimas MAX_BACKUPS).
// ARGV[1] = baseRev ('*' = sin control de versión), ARGV[2] = datos JSON
const SAVE_SCRIPT = `
local cur = redis.call('GET', KEYS[2]) or '0'
if ARGV[1] ~= '*' and ARGV[1] ~= cur then return {0, cur} end
local prev = redis.call('GET', KEYS[1])
if prev then
  redis.call('LPUSH', KEYS[3], prev)
  redis.call('LTRIM', KEYS[3], 0, ${MAX_BACKUPS - 1})
end
local nxt = tostring((tonumber(cur) or 0) + 1)
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], nxt)
return {1, nxt}
`;

export const sanitize = (data) => ({
  sources: Array.isArray(data?.sources) ? data.sources : [],
  categories: Array.isArray(data?.categories) ? data.categories : [],
  transactions: Array.isArray(data?.transactions) ? data.transactions : [],
  recurrents: Array.isArray(data?.recurrents) ? data.recurrents : [],
  lastActiveMonth: data?.lastActiveMonth || null,
  payrollCycle: data?.payrollCycle || null,
  lastEditedBy: data?.lastEditedBy || null,
  lastEditedName: data?.lastEditedName || null,
  lastEditedAt: data?.lastEditedAt || null
});

let redisClient = null;
export async function getRedis() {
  if (redisClient) return redisClient;
  const { Redis } = await import('@upstash/redis');
  redisClient = new Redis({
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  });
  return redisClient;
}

export async function readData(redis) {
  const [data, rev] = await redis.mget(DATA_KEY, REV_KEY);
  return { data: sanitize(data), rawExists: !!data, rev: String(rev ?? '0') };
}

// Devuelve { ok, rev }. ok=false => conflicto de versión.
export async function saveData(redis, data, baseRev) {
  const result = await redis.eval(SAVE_SCRIPT, [DATA_KEY, REV_KEY, BACKUPS_KEY], [String(baseRev), JSON.stringify(data)]);
  return { ok: Number(result?.[0]) === 1, rev: String(result?.[1] ?? '0') };
}

let webpushLib = null;
async function getWebPush() {
  if (webpushLib) return webpushLib;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.error('Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY: notificaciones push desactivadas.');
    return null;
  }
  try {
    const mod = await import('web-push');
    const webpush = mod.default || mod;
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:hola@example.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    webpushLib = webpush;
    return webpushLib;
  } catch (err) {
    console.error("No se pudo cargar 'web-push':", err);
    return null;
  }
}

// Envía { title, body } a todos los dispositivos suscritos (excepto excludeDeviceId).
// Nunca lanza: un fallo de notificaciones no debe afectar al guardado.
export async function notifySubscribers(redis, { title, body }, excludeDeviceId, onlyDeviceId) {
  try {
    const webpush = await getWebPush();
    if (!webpush) {
      await redis.set(PUSH_ERROR_KEY, { at: Date.now(), status: null, body: 'web-push no disponible o faltan claves VAPID' }).catch(() => {});
      return;
    }

    const existing = await redis.get(SUBS_KEY);
    const list = Array.isArray(existing) ? existing : [];
    if (list.length === 0) return;

    const payload = JSON.stringify({ title, body, ts: Date.now() });
    const staleEndpoints = [];

    await Promise.all(
      list.map(async (item) => {
        if (!item?.subscription?.endpoint || item.deviceId === excludeDeviceId) return;
        if (onlyDeviceId && item.deviceId !== onlyDeviceId) return;
        try {
          await webpush.sendNotification(item.subscription, payload, { TTL: 86400, urgency: 'high' });
        } catch (err) {
          // 404/410: suscripción caducada. 403: creada con otra clave VAPID (el móvil se re-suscribe al abrir la app)
          if ([403, 404, 410].includes(err.statusCode)) staleEndpoints.push(item.subscription.endpoint);
          else console.error('Error enviando push:', err.statusCode, err.body || err.message);
          // Se guarda para el diagnóstico (GET /api/subscribe)
          await redis.set(PUSH_ERROR_KEY, { at: Date.now(), status: err.statusCode || null, body: String(err.body || err.message).slice(0, 300) }).catch(() => {});
        }
      })
    );

    if (staleEndpoints.length > 0) {
      const fresh = await redis.get(SUBS_KEY);
      const cleaned = (Array.isArray(fresh) ? fresh : []).filter((s) => !staleEndpoints.includes(s?.subscription?.endpoint));
      await redis.set(SUBS_KEY, cleaned);
    }
  } catch (error) {
    console.error('Error notificando a los suscriptores:', error);
  }
}

export const notifyChange = (redis, prev, next) =>
  notifySubscribers(redis, describeChanges(prev, next), next?.lastEditedBy);

// En Vercel la función se congela al responder: hay que esperar a los envíos (con límite)
export const withTimeout = (promise, ms) => Promise.race([promise, new Promise((r) => setTimeout(r, ms))]);

export function setCommonHeaders(res, methods) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
}
