import { getRedis, readData, saveData, sanitize, notifyChange, withTimeout, setCommonHeaders } from '../lib/store.js';

const ARRAY_FIELDS = ['sources', 'categories', 'transactions', 'recurrents'];

export default async function handler(req, res) {
  setCommonHeaders(res, 'GET, POST, OPTIONS');
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
        const { data, rev } = await readData(redis);
        return res.status(200).json({ ...data, _rev: rev });
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
        const { data: previous } = await readData(redis);
        const { ok, rev } = await saveData(redis, newData, baseRev);

        if (!ok) {
          const { data: current, rev: currentRev } = await readData(redis);
          return res.status(409).json({ conflict: true, data: current, _rev: currentRev });
        }

        await withTimeout(notifyChange(redis, previous, newData), 8000);
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
