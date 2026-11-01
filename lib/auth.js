// Acceso a la app: un PIN compartido (variable APP_PIN de Vercel) da un token que queda guardado en el móvil.
// Cambiar APP_PIN invalida todos los tokens. Sin APP_PIN nadie entra, pero los datos no se tocan.
import crypto from 'node:crypto';

const SECRET_KEY = 'app_finanzas_auth_secret';
const FAIL_WINDOW_S = 900;
const MAX_FAILS_IP = 5;
const MAX_FAILS_GLOBAL = 30; // límite común: 4 cifras no resistirían un ataque desde muchas IP

async function getSecret(redis) {
  let secret = await redis.get(SECRET_KEY);
  if (!secret) {
    await redis.set(SECRET_KEY, `s_${crypto.randomBytes(32).toString('hex')}`, { nx: true });
    secret = await redis.get(SECRET_KEY);
  }
  return String(secret);
}

const safeEqual = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

async function expectedToken(redis) {
  const pin = process.env.APP_PIN;
  if (!pin) return null;
  return crypto.createHmac('sha256', await getSecret(redis)).update(`mj-access:${pin}`).digest('hex');
}

// Devuelve true si la petición trae un token válido; si no, responde 401
export async function requireAuth(req, res, redis) {
  const expected = await expectedToken(redis);
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (expected && token && safeEqual(token, expected)) return true;
  res.status(401).json({ error: 'Se necesita el PIN de acceso.' });
  return false;
}

// Contador de fallos con caducidad. Devuelve el total tras sumar uno.
export async function countFail(redis, key, seconds) {
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, seconds);
  return n;
}

export async function login(req, res, redis, pin) {
  const appPin = process.env.APP_PIN;
  if (!appPin) return res.status(503).json({ error: 'Falta configurar APP_PIN en Vercel.' });

  const ip = String(req.headers['x-forwarded-for'] || 'desconocida').split(',')[0].trim();
  const ipKey = `app_finanzas_login_fail:${ip}`;
  const globalKey = 'app_finanzas_login_fail:all';
  const [ipFails, allFails] = await redis.mget(ipKey, globalKey);
  if (Number(ipFails) >= MAX_FAILS_IP || Number(allFails) >= MAX_FAILS_GLOBAL) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
  }
  if (!safeEqual(String(pin ?? '').trim(), appPin)) {
    await countFail(redis, ipKey, FAIL_WINDOW_S);
    await countFail(redis, globalKey, FAIL_WINDOW_S);
    return res.status(401).json({ error: 'PIN incorrecto.' });
  }
  await redis.del(ipKey);
  return res.status(200).json({ token: await expectedToken(redis) });
}
