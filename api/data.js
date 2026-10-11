const DATA_KEY = 'app_finanzas_data';
const REV_KEY = 'app_finanzas_rev';
const BACKUPS_KEY = 'app_finanzas_backups';
const SUBS_KEY = 'app_finanzas_push_subs';
const MAX_BACKUPS = 50;

const ARRAY_FIELDS = ['sources', 'categories', 'transactions', 'recurrents'];

// Guardado atómico con control de versión (compare-and-set).
// - Si baseRev no coincide con la versión actual => conflicto, no se escribe nada.
// - Antes de sobrescribir guarda una copia del estado anterior (últimas MAX_BACKUPS).
// ARGV[1] = baseRev ('*' = cliente antiguo sin versión), ARGV[2] = datos JSON
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

const sanitize = (data) => ({
  sources: Array.isArray(data?.sources) ? data.sources : [],
  categories: Array.isArray(data?.categories) ? data.categories : [],
  transactions: Array.isArray(data?.transactions) ? data.transactions : [],
  recurrents: Array.isArray(data?.recurrents) ? data.recurrents : [],
  lastActiveMonth: data?.lastActiveMonth || null,
  lastEditedBy: data?.lastEditedBy || null,
  lastEditedAt: data?.lastEditedAt || null
});

let redisClient = null;
async function getRedis() {
  if (redisClient) return redisClient;
  const { Redis } = await import('@upstash/redis');
  redisClient = new Redis({
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  });
  return redisClient;
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

// Notifica a los dispositivos suscritos (excepto al que hizo el cambio).
// Cualquier fallo se registra y se ignora: nunca afecta al guardado.
async function notifySubscribers(redis, message, excludeDeviceId) {
  try {
    const webpush = await getWebPush();
    if (!webpush) return;

    const existing = await redis.get(SUBS_KEY);
    const list = Array.isArray(existing) ? existing : [];
    if (list.length === 0) return;

    const payload = JSON.stringify({ title: 'M&J 🦄', body: message });
    const staleEndpoints = [];

    await Promise.all(
      list.map(async (item) => {
        if (!item?.subscription?.endpoint || item.deviceId === excludeDeviceId) return;
        try {
          await webpush.sendNotification(item.subscription, payload, { TTL: 86400, urgency: 'high' });
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            staleEndpoints.push(item.subscription.endpoint);
          } else {
            console.error('Error enviando push:', err.statusCode, err.body || err.message);
          }
        }
      })
    );

    if (staleEndpoints.length > 0) {
      const fresh = await redis.get(SUBS_KEY);
      const cleaned = (Array.isArray(fresh) ? fresh : []).filter(
        (s) => !staleEndpoints.includes(s?.subscription?.endpoint)
      );
      await redis.set(SUBS_KEY, cleaned);
    }
  } catch (error) {
    console.error('Error notificando a los suscriptores:', error);
  }
}

function buildMessage(previous, next) {
  const count = (d, k) => (Array.isArray(d?.[k]) ? d[k].length : 0);
  const oldTx = count(previous, 'transactions'), newTx = count(next, 'transactions');
  const oldCat = count(previous, 'categories'), newCat = count(next, 'categories');
  if (newTx > oldTx) return 'Se ha añadido un nuevo movimiento 💸';
  if (newTx < oldTx) return 'Se ha eliminado un movimiento 🗑️';
  if (newCat > oldCat) return 'Se ha creado un nuevo sobre 💌';
  if (newCat < oldCat) return 'Se ha eliminado un sobre 🗑️';
  return 'Vuestro presupuesto M&J se ha actualizado ✨';
}

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms))]);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Nunca cachear: un GET cacheado en el móvil hacía que se guardaran datos viejos encima de los nuevos
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let redis;
    try {
      redis = await getRedis();
    } catch (err) {
      console.error('No se pudo inicializar Redis:', err);
      return res.status(500).json({ error: 'No se pudo conectar con la base de datos.' });
    }

    if (req.method === 'GET') {
      try {
        const [data, rev] = await redis.mget(DATA_KEY, REV_KEY);
        return res.status(200).json({ ...sanitize(data), _rev: String(rev ?? '0') });
      } catch (error) {
        console.error('Error al leer en Redis:', error);
        return res.status(500).json({ error: 'Error al leer datos de la base de datos' });
      }
    }

    if (req.method === 'POST') {
      try {
        let body = req.body;
        if (typeof body === 'string') body = JSON.parse(body);

        // Formato nuevo: { data, baseRev }. Formato antiguo: el estado directamente.
        const isNewFormat = body && typeof body === 'object' && 'baseRev' in body && body.data;
        const incoming = isNewFormat ? body.data : body;
        const baseRev = isNewFormat ? String(body.baseRev) : '*';

        const validShape =
          incoming && typeof incoming === 'object' &&
          Array.isArray(incoming.transactions) && Array.isArray(incoming.categories) &&
          ARRAY_FIELDS.every((k) => incoming[k] === undefined || Array.isArray(incoming[k]));
        if (!validShape) {
          return res.status(400).json({ error: 'Datos con formato inválido. No se ha guardado nada.' });
        }

        const newData = sanitize(incoming);
        const previous = await redis.get(DATA_KEY);

        const result = await redis.eval(SAVE_SCRIPT, [DATA_KEY, REV_KEY, BACKUPS_KEY], [baseRev, JSON.stringify(newData)]);
        const ok = Number(result?.[0]) === 1;
        const rev = String(result?.[1] ?? '0');

        if (!ok) {
          const current = await redis.get(DATA_KEY);
          return res.status(409).json({ conflict: true, data: sanitize(current), _rev: rev });
        }

        // En Vercel la función se congela al responder: hay que esperar al envío del push
        await withTimeout(notifySubscribers(redis, buildMessage(previous, newData), newData.lastEditedBy), 8000);

        return res.status(200).json({ success: true, _rev: rev });
      } catch (error) {
        console.error('Error al guardar en Redis:', error);
        return res.status(500).json({ error: 'Error al guardar datos en la base de datos' });
      }
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (fatalError) {
    console.error('Error inesperado en /api/data:', fatalError);
    return res.status(500).json({ error: 'Error inesperado en el servidor.' });
  }
}
