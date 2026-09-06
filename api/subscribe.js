const SUBS_KEY = 'app_finanzas_push_subs';

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

    // GUARDAR / ACTUALIZAR SUSCRIPCIÓN DE ESTE DISPOSITIVO
    if (req.method === 'POST') {
      try {
        let body = req.body;
        if (typeof body === 'string') body = JSON.parse(body);
        const { subscription, deviceId } = body || {};

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

