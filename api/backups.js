// Copias de seguridad: las 50 últimas versiones y una copia al día durante 35 días.
// GET: listas resumidas. POST { index } o { day }: restaura esa copia (la actual queda también como copia).
import { getRedis, readData, saveData, sanitize, notifyChange, withTimeout, setCommonHeaders, BACKUPS_KEY, dailyKey, DAILY_DAYS } from '../lib/store.js';
import { requireAuth } from '../lib/auth.js';
import { todayLocal } from '../src/shared.js';

const parse = (d) => (typeof d === 'string' ? JSON.parse(d) : d);
const summary = (d) => ({
  at: d?.lastEditedAt || null,
  by: d?.lastEditedName || null,
  categories: d?.categories?.length || 0,
  transactions: d?.transactions?.length || 0
});

function lastDays(n) {
  const base = new Date(`${todayLocal()}T12:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(base.getTime() - i * 86400000).toISOString().slice(0, 10));
}

export default async function handler(req, res) {
  setCommonHeaders(res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const redis = await getRedis();
    if (!(await requireAuth(req, res, redis))) return;

    if (req.method === 'GET') {
      const days = lastDays(DAILY_DAYS);
      const [list, daily] = await Promise.all([redis.lrange(BACKUPS_KEY, 0, -1), redis.mget(...days.map(dailyKey))]);
      return res.status(200).json({
        recent: (list || []).map((d, index) => ({ index, ...summary(parse(d)) })),
        daily: days.flatMap((day, i) => (daily[i] ? [{ day, ...summary(parse(daily[i])) }] : []))
      });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);

      let raw = null;
      if (typeof body?.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.day)) {
        raw = await redis.get(dailyKey(body.day));
      } else if (Number.isInteger(Number(body?.index)) && Number(body.index) >= 0) {
        raw = await redis.lindex(BACKUPS_KEY, Number(body.index));
      } else {
        return res.status(400).json({ error: 'Copia no válida' });
      }
      if (!raw) return res.status(404).json({ error: 'La copia ya no existe' });
      const backup = sanitize(parse(raw));

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
