const DATA_KEY = 'app_finanzas_data';
const SUBS_KEY = 'app_finanzas_push_subs';

// Estructura por defecto para evitar que los arrays sean undefined
const defaultData = {
  sources: [],
  categories: [],
  transactions: [],
  recurrents: [],
  lastActiveMonth: null,
  lastEditedBy: null,
  lastEditedAt: null
};

// --- Carga perezosa de dependencias -----------------------------------
// Nunca importamos nada "en caliente" al arrancar el módulo. Si un paquete
// falta o falla, se captura aquí y se convierte en un JSON de error legible,
// en vez de tumbar toda la función (que es lo que causaba la pantalla
// "A server error has occurred..." / 500 sin JSON válido).

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
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return null;
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
    console.error("No se pudo cargar 'web-push' (¿está instalado?). Las notificaciones quedan desactivadas, pero los datos funcionan con normalidad:", err);
    return null;
  }
}

// Notifica a los dispositivos suscritos. Cualquier fallo aquí se registra y se
// ignora: nunca debe afectar a la respuesta de guardado de datos.
async function notifySubscribers(redis, message, excludeDeviceId) {
  try {
    const webpush = await getWebPush();
    if (!webpush) return;

    const existing = await redis.get(SUBS_KEY);
    const list = Array.isArray(existing) ? existing : [];
    if (list.length === 0) return;

    const payload = JSON.stringify({ title: 'M&J 🦄', body: message });
    const staleDeviceIds = [];

    await Promise.all(
      list.map(async (item) => {
        if (!item?.subscription || item.deviceId === excludeDeviceId) return;
        try {
          await webpush.sendNotification(item.subscription, payload);
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            staleDeviceIds.push(item.deviceId);
          } else {
            console.error('Error enviando push a un dispositivo:', err);
          }
        }
      })
    );

    if (staleDeviceIds.length > 0) {
      const cleaned = list.filter((s) => !staleDeviceIds.includes(s.deviceId));
      await redis.set(SUBS_KEY, cleaned);
    }
  } catch (error) {
    console.error('Error notificando a los suscriptores (no afecta a tus datos):', error);
  }
}

export default async function handler(req, res) {
  // Cabeceras CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Red de seguridad total: pase lo que pase, respondemos siempre JSON válido,
  // nunca dejamos que el runtime crashee con una página de error genérica.
  try {
    let redis;
    try {
      redis = await getRedis();
    } catch (err) {
      console.error('No se pudo inicializar la conexión con Redis:', err);
      return res.status(500).json({
        error: 'No se pudo conectar con la base de datos. Revisa que el paquete "@upstash/redis" esté instalado y que las variables de entorno KV_REST_API_URL / KV_REST_API_TOKEN estén configuradas en Vercel.'
      });
    }

    // OBTENER DATOS (GET)
    if (req.method === 'GET') {
      try {
        const data = await redis.get(DATA_KEY);

        if (!data) {
          return res.status(200).json(defaultData);
        }

        const sanitizedData = {
          sources: Array.isArray(data.sources) ? data.sources : [],
          categories: Array.isArray(data.categories) ? data.categories : [],
          transactions: Array.isArray(data.transactions) ? data.transactions : [],
          recurrents: Array.isArray(data.recurrents) ? data.recurrents : [],
          lastActiveMonth: data.lastActiveMonth || null,
          lastEditedBy: data.lastEditedBy || null,
          lastEditedAt: data.lastEditedAt || null
        };

        return res.status(200).json(sanitizedData);
      } catch (error) {
        console.error("Error al leer en Redis:", error);
        return res.status(500).json({ error: 'Error al leer datos de la base de datos' });
      }
    }

    // GUARDAR DATOS (POST)
    if (req.method === 'POST') {
      try {
        let newData = req.body;

        if (typeof newData === 'string') {
          newData = JSON.parse(newData);
        }

        const previous = await redis.get(DATA_KEY);

        await redis.set(DATA_KEY, newData);

        const oldTxCount = Array.isArray(previous?.transactions) ? previous.transactions.length : 0;
        const newTxCount = Array.isArray(newData?.transactions) ? newData.transactions.length : 0;
        const oldCatCount = Array.isArray(previous?.categories) ? previous.categories.length : 0;
        const newCatCount = Array.isArray(newData?.categories) ? newData.categories.length : 0;

        let message = 'Vuestro presupuesto M&J se ha actualizado.';
        if (newTxCount > oldTxCount) message = 'Se ha añadido un nuevo movimiento 💸';
        else if (newTxCount < oldTxCount) message = 'Se ha eliminado un movimiento 🗑️';
        else if (newCatCount > oldCatCount) message = 'Se ha creado un nuevo sobre 💌';
        else if (newCatCount < oldCatCount) message = 'Se ha eliminado un sobre 🗑️';
        else if (oldCatCount !== 0 || newCatCount !== 0) message = 'Se ha actualizado un sobre 💌';

        // No bloqueamos la respuesta al cliente por el envío de notificaciones
        notifySubscribers(redis, message, newData?.lastEditedBy).catch((err) =>
          console.error('Error en notifySubscribers:', err)
        );

        return res.status(200).json({ success: true });
      } catch (error) {
        console.error("Error al guardar en Redis:", error);
        return res.status(500).json({ error: 'Error al guardar datos en la base de datos' });
      }
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (fatalError) {
    // Última red de seguridad: si algo inesperado revienta, seguimos devolviendo JSON.
    console.error('Error inesperado en /api/data:', fatalError);
    return res.status(500).json({ error: 'Error inesperado en el servidor.' });
  }
}