import { Redis } from '@upstash/redis';

// Inicialización conectando con las variables de entorno que te generó Vercel
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Estructura por defecto para evitar que los arrays sean undefined
const defaultData = {
  sources: [],
  categories: [],
  transactions: [],
  recurrents: []
};

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
      const data = await redis.get('app_finanzas_data');
      
      if (!data) {
        return res.status(200).json(defaultData);
      }

      // Aseguramos que siempre existan todas las propiedades clave
      const sanitizedData = {
        sources: Array.isArray(data.sources) ? data.sources : [],
        categories: Array.isArray(data.categories) ? data.categories : [],
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
        recurrents: Array.isArray(data.recurrents) ? data.recurrents : [],
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

      await redis.set('app_finanzas_data', newData);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error al guardar en Redis:", error);
      return res.status(500).json({ error: 'Error al guardar datos en la base de datos' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}