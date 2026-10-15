import { getRedis, notifySubscribers, SUBS_KEY, PUSH_ERROR_KEY } from '../lib/store.js';

// Clave pública que usa la app (src/lib/push.js). Debe ser igual a VAPID_PUBLIC_KEY de Vercel.
const APP_PUBLIC_KEY = 'BOH05ykgs-MQZRuk7mCpNVF7jbYhyix_BKAFoLRSIGxyIZQFM2YU1ttNkjwTgKUoOgcoKeVSEy-9q8PefNe0bpw';

// Diagnóstico sin datos sensibles: configuración, nº de móviles suscritos y último error de envío
async function diagnostics(redis) {
  const [subs, lastError] = await Promise.all([redis.get(SUBS_KEY), redis.get(PUSH_ERROR_KEY)]);
  const list = Array.isArray(subs) ? subs : [];
  let webpushInstalled = true;
  try { await import('web-push'); } catch { webpushInstalled = false; }
  return {
    webpushInstalled,
    vapidPublicSet: !!process.env.VAPID_PUBLIC_KEY,
    vapidPrivateSet: !!process.env.VAPID_PRIVATE_KEY,
    publicKeyMatchesApp: (process.env.VAPID_PUBLIC_KEY || '').trim() === APP_PUBLIC_KEY,
    vapidSubject: process.env.VAPID_SUBJECT ? 'configurado' : 'por defecto',
    subscriptions: list.map((s) => ({
      device: String(s.deviceId).slice(0, 4) + '…',
      service: (() => { try { return new URL(s.subscription.endpoint).host; } catch { return '?'; } })(),
      savedAt: s.savedAt ? new Date(s.savedAt).toISOString() : null
    })),
    lastError: lastError || null
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let redis;
    try {
      redis = await getRedis();
    } catch (err) {
      console.error('No se pudo inicializar la conexión con Redis:', err);
      return res.status(500).json({ error: 'No se pudo conectar con la base de datos.' });
    }

    if (req.method === 'GET') {
      return res.status(200).json(await diagnostics(redis));
    }

    // GUARDAR / ACTUALIZAR SUSCRIPCIÓN DE ESTE DISPOSITIVO
    if (req.method === 'POST') {
      try {
        let body = req.body;
        if (typeof body === 'string') body = JSON.parse(body);
        const { subscription, deviceId, test } = body || {};

        // Aviso de prueba a este móvil tras 10 s (para bloquear la pantalla y comprobar que llega)
        if (test && deviceId) {
          const existing = await redis.get(SUBS_KEY);
          const registered = (Array.isArray(existing) ? existing : []).some((s) => s.deviceId === deviceId);
          if (!registered) return res.status(404).json({ error: 'Este móvil no está suscrito. Activa los avisos primero.' });
          await new Promise((r) => setTimeout(r, 10000));
          await notifySubscribers(redis, { title: 'M&J 🦄 · Prueba', body: '🔔 Si ves esto con el móvil bloqueado, los avisos funcionan.' }, null, deviceId);
          return res.status(200).json({ success: true });
        }

        if (!subscription?.endpoint || !deviceId) {
          return res.status(400).json({ error: 'Falta subscription o deviceId' });
        }

        const existing = await redis.get(SUBS_KEY);
        const list = Array.isArray(existing) ? existing : [];

        const filtered = list.filter(
          (s) => s.deviceId !== deviceId && s.subscription?.endpoint !== subscription.endpoint
        );
        filtered.push({ subscription, deviceId, savedAt: Date.now() });

        await redis.set(SUBS_KEY, filtered);
        return res.status(200).json({ success: true });
      } catch (error) {
        console.error('Error guardando suscripción push:', error);
        return res.status(500).json({ error: 'Error al guardar la suscripción' });
      }
    }

    // ELIMINAR SUSCRIPCIÓN (p.ej. al desactivar notificaciones)
    if (req.method === 'DELETE') {
      try {
        let body = req.body;
        if (typeof body === 'string') body = JSON.parse(body);
        const { deviceId } = body || {};

        const existing = await redis.get(SUBS_KEY);
        const list = Array.isArray(existing) ? existing : [];
        const filtered = list.filter((s) => s.deviceId !== deviceId);

        await redis.set(SUBS_KEY, filtered);
        return res.status(200).json({ success: true });
      } catch (error) {
        console.error('Error eliminando suscripción push:', error);
        return res.status(500).json({ error: 'Error al eliminar la suscripción' });
      }
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (fatalError) {
    console.error('Error inesperado en /api/subscribe:', fatalError);
    return res.status(500).json({ error: 'Error inesperado en el servidor.' });
  }
}