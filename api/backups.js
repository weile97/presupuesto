// Copias de seguridad automáticas (las 50 últimas versiones antes de cada guardado).
// GET: lista resumida. POST { index, deviceId, name }: restaura esa copia (la actual queda también como copia).
import { getRedis, readData, saveData, sanitize, notifyChange, withTimeout, setCommonHeaders, BACKUPS_KEY } from '../lib/store.js';

const summary = (d, index) => ({
  index,
  at: d?.lastEditedAt || null,
  by: d?.lastEditedName || null,
  categories: d?.categories?.length || 0,
  transactions: d?.transactions?.length || 0
});

export default async function handler(req, res) {
  setCommonHeaders(res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const redis = await getRedis();

    if (req.method === 'GET') {
      const list = await redis.lrange(BACKUPS_KEY, 0, -1);
      return res.status(200).json((list || []).map((d, i) => summary(typeof d === 'string' ? JSON.parse(d) : d, i)));
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const index = Number(body?.index);
      if (!Number.isInteger(index) || index < 0) return res.status(400).json({ error: 'Copia no válida' });

      const raw = await redis.lindex(BACKUPS_KEY, index);
      if (!raw) return res.status(404).json({ error: 'La copia ya no existe' });
      const backup = sanitize(typeof raw === 'string' ? JSON.parse(raw) : raw);

      const { data: current, rev } = await readData(redis);
      const restored = { ...backup, lastEditedBy: body?.deviceId || null, lastEditedName: body?.name || 'Restauración', lastEditedAt: Date.now() };
      const saved = await saveData(redis, restored, rev);
      if (!saved.ok) return res.status(409).json({ error: 'Alguien acaba de guardar. Inténtalo de nuevo.' });

      await withTimeout(notifyChange(redis, current, { ...restored, lastEditedName: `${restored.lastEditedName} (copia restaurada)` }), 8000);
      return res.status(200).json({ success: true, _rev: saved.rev });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error en /api/backups:', error);
    return res.status(500).json({ error: 'Error con las copias de seguridad' });
  }
}
