import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const data = await redis.get('app_finanzas_data');
      return res.status(200).json(data || {});
    } catch (error) {
      return res.status(500).json({ error: 'Error al leer datos' });
    }
  }

  if (req.method === 'POST') {
    try {
      const newData = req.body;
      await redis.set('app_finanzas_data', newData);
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Error al guardar datos' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}