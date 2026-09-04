import { Redis } from '@upstash/redis';

// Inicialización leída explícitamente desde las variables KV de Vercel
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // OBTENER DATOS
  if (req.method === 'GET') {
    try {
      const data = await redis.get('app_finanzas_data');
      return res.status(200).json(data || {});
    } catch (error) {
      console.error("Error al leer de Redis:", error);
      return res.status(500).json({ error: 'Error al leer datos' });
    }
  }

  // GUARDAR DATOS
  if (req.method === 'POST') {
    try {
      let newData = req.body;
      
      if (typeof newData === 'string') {
        newData = JSON.parse(newData);
      }

      await redis.set('app_finanzas_data', newData);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error al guardar en Redis:", error);
      return res.status(500).json({ error: 'Error al guardar datos' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}