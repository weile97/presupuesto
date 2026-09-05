import { Redis } from '@upstash/redis';
import webpush from 'web-push';

// Inicialización conectando con las variables de entorno que te generó Vercel
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

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

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:hola@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Envía una notificación push a todos los dispositivos suscritos, excepto el que hizo el cambio.
async function notifySubscribers(message, excludeDeviceId) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  try {
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
          // 404/410 = la suscripción ya no existe (navegador desinstalado, permiso revocado, etc.)
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
    console.error('Error notificando a los suscriptores:', error);
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

  // OBTENER DATOS (GET)
  if (req.method === 'GET') {
    try {
      const data = await redis.get(DATA_KEY);

      if (!data) {
        return res.status(200).json(defaultData);
      }

      // Aseguramos que siempre existan todas las propiedades clave
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

      // Si el cuerpo llega como string, lo parseamos a JSON
      if (typeof newData === 'string') {
        newData = JSON.parse(newData);
      }

      // Leemos el estado anterior para poder describir el cambio en la notificación
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
      notifySubscribers(message, newData?.lastEditedBy).catch((err) =>
        console.error('Error en notifySubscribers:', err)
      );

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error al guardar en Redis:", error);
      return res.status(500).json({ error: 'Error al guardar datos en la base de datos' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}