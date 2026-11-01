// POST { action: 'login', pin }: da el token de acceso a la app.
// POST { action: 'verify-pin' | 'set-pin', categoryId, pin } (con token): PIN de un sobre protegido.
import { getRedis, readData, setCommonHeaders, PINS_KEY } from '../lib/store.js';
import { login, requireAuth, countFail } from '../lib/auth.js';
import { hashPin, applyPins } from '../lib/pins.js';

const MAX_PIN_FAILS = 5;
const PIN_LOCK_S = 300;

export default async function handler(req, res) {
  setCommonHeaders(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const redis = await getRedis();
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    const { action, pin, categoryId } = body || {};

    if (action === 'login') return await login(req, res, redis, pin);
    if (!(await requireAuth(req, res, redis))) return;

    const text = String(pin ?? '').trim();
    if (!categoryId || !text || text.length > 32) return res.status(400).json({ error: 'Datos no válidos.' });
    const pinMap = (await redis.get(PINS_KEY)) || {};

    if (action === 'set-pin') {
      await redis.set(PINS_KEY, { ...pinMap, [categoryId]: hashPin(categoryId, text) });
      return res.status(200).json({ success: true });
    }

    if (action === 'verify-pin') {
      const failKey = `app_finanzas_pin_fail:${categoryId}`;
      if (Number(await redis.get(failKey)) >= MAX_PIN_FAILS) {
        return res.status(429).json({ error: 'Demasiados intentos. Espera 5 minutos.' });
      }
      const { data } = await readData(redis);
      const { map } = applyPins([], data.categories, pinMap);
      if (map[categoryId] && map[categoryId] === hashPin(categoryId, text)) {
        await redis.del(failKey);
        return res.status(200).json({ ok: true });
      }
      await countFail(redis, failKey, PIN_LOCK_S);
      return res.status(200).json({ ok: false });
    }

    return res.status(400).json({ error: 'Acción no válida.' });
  } catch (error) {
    console.error('Error en /api/auth:', error);
    return res.status(500).json({ error: 'Error de acceso. Inténtalo de nuevo.' });
  }
}
