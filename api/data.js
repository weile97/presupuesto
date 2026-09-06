const DATA_KEY = 'app_finanzas_data';
const SUBS_KEY = 'app_finanzas_push_subs';

const defaultData = {
  sources: [],
  categories: [],
  transactions: [],
  recurrents: [],
  lastActiveMonth: null,
  lastEditedBy: null,
  lastEditedAt: null
};

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
let webpushChecked = false;

async function getWebPush() {
  if (webpushChecked) return webpushLib;
  webpushChecked = true;
  try {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      console.warn('Claves VAPID no configuradas en las variables de entorno.');
      return null;
    }
    const mod = await import('web-push');
    const webpush = mod.default || mod;
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:soporte@example.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    webpushLib = webpush;
    return webpushLib;
  } catch (err) {
    console.error('Error al importar la librería web-push:', err);
    return null;
  }
}

async function notifySubscribers(redis, message, excludeDeviceId) {
  try {
    const webpush = await getWebPush();
    if (!webpush) return;

    const existing = await redis.get(SUBS_KEY);
    const list = Array.isArray(existing) ? existing : [];
    if (list.length === 0) return;

    const payload = JSON.stringify({
      title: 'M&J 🦄',
      body: message
    });

    const staleDeviceIds = [];

    await Promise.all(
      list.map(async (item) => {
        if (!item?.subscription || item.deviceId === excludeDeviceId) return;
        try {
          await webpush.sendNotification(item.subscription, payload);
        } catch (err) {
          // Si el usuario revocó el permiso o cambió el navegador (404/410), se elimina la suscripción caducada
          if (err.statusCode === 404 || err.statusCode === 410) {
            staleDeviceIds.push(item.deviceId);
          } else {
            console.error('Error enviando notificación push:', err);
          }
        }
      })
    );

    // Limpieza de suscripciones inactivas en Redis
    if (staleDeviceIds.length > 0) {
      const cleanedList = list.filter((s) => !staleDeviceIds.includes(s.deviceId));
      await redis.set(SUBS_KEY, cleanedList);
    }
  } catch (error) {
    console.error('Error general en notifySubscribers:', error);
  }
}

export default async function handler(req, res) {
  // Configuración de cabeceras CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const redis = await getRedis();

    // Obtener datos almacenados
    if (req.method === 'GET') {
      const stored = await redis.get(DATA_KEY);
      const data = stored ? (typeof stored === 'string' ? JSON.parse(stored) : stored) : defaultData;
      return res.status(200).json(data);
    }

    // Actualizar datos y emitir notificación Push
    if (req.method === 'POST') {
      const newData = req.body;
      await redis.set(DATA_KEY, JSON.stringify(newData));

      // Disparar aviso push a los suscriptores
      const editorName = newData.lastEditedBy || 'Alguien';
      const notificationMessage = `${editorName} ha actualizado el presupuesto M&J 💸`;
      
      await notifySubscribers(redis, notificationMessage, newData.lastEditedBy);

      return res.status(200).json({ ok: true, data: newData });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error('Error procesando /api/data:', err);
    return res.status(500).json({ 
      error: 'Error interno del servidor', 
      details: err.message 
    });
  }
}

