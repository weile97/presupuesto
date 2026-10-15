// Ejecutado a diario por Vercel Cron (ver vercel.json).
// Hace el cambio de ciclo del día 29 y aplica los recurrentes aunque nadie abra la app,
// y avisa a los móviles por push.
import { getRedis, readData, saveData, notifySubscribers, withTimeout, setCommonHeaders } from '../lib/store.js';
import { runAutomations, cycleEndSummary } from '../src/shared.js';

export default async function handler(req, res) {
  setCommonHeaders(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Si CRON_SECRET está configurado, Vercel lo envía como "Authorization: Bearer <secreto>"
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const redis = await getRedis();
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, rawExists, rev } = await readData(redis);
      if (!rawExists) return res.status(200).json({ skipped: 'sin datos' });

      // Cron de la tarde (?summary=1): solo la víspera del día 29, resumen de lo gastado y lo que queda sin repartir
      if (req.query?.summary) {
        const endSummary = cycleEndSummary(data);
        if (endSummary) await withTimeout(notifySubscribers(redis, endSummary, null), 8000);
        return res.status(200).json({ endSummary: !!endSummary });
      }

      const result = runAutomations(data);
      if (!result) return res.status(200).json({ changed: false });

      const next = { ...result.data, lastEditedBy: 'cron', lastEditedName: 'M&J', lastEditedAt: Date.now() };
      const saved = await saveData(redis, next, rev);
      if (!saved.ok) continue; // alguien guardó a la vez: reintentamos con los datos nuevos

      if (result.messages.length) {
        await withTimeout(notifySubscribers(redis, { title: 'M&J 🦄', body: result.messages.join('\n') }, null), 8000);
      }
      return res.status(200).json({ changed: true, messages: result.messages, _rev: saved.rev });
    }
    return res.status(409).json({ error: 'Conflictos repetidos, se reintentará mañana' });
  } catch (error) {
    console.error('Error en /api/cron:', error);
    return res.status(500).json({ error: 'Error en el cron' });
  }
}
