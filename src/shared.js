// Lógica compartida entre la app (navegador) y las funciones de Vercel (api/).
// Sin dependencias: debe funcionar igual en ambos lados.

export const TZ = 'Europe/Madrid';
export const RESET_DAY = 29; // día del mes en que se cobran las nóminas y empieza un ciclo nuevo

const pad = (n) => String(n).padStart(2, '0');
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1-12

// Fecha de hoy (YYYY-MM-DD) en hora de España, no en UTC
export function todayLocal(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const cycleStartOf = (y, m) => `${y}-${pad(m)}-${pad(Math.min(RESET_DAY, daysIn(y, m)))}`;

// Ciclo actual: del día 29 (o último día si el mes es más corto) al 28 del mes siguiente
export function currentCycle(today = todayLocal()) {
  const [y, m] = today.split('-').map(Number);
  let cy = y, cm = m;
  if (today < cycleStartOf(y, m)) {
    cm = m === 1 ? 12 : m - 1;
    cy = m === 1 ? y - 1 : y;
  }
  const ny = cm === 12 ? cy + 1 : cy;
  const nm = cm === 12 ? 1 : cm + 1;
  return { key: `${cy}-${pad(cm)}`, start: cycleStartOf(cy, cm), nextStart: cycleStartOf(ny, nm) };
}

export const isAllocation = (t) => t.type === 'income' && !!t.categoryId;
export const isFundIncome = (t) => t.type === 'payroll_income' || t.type === 'carryover';
export const isExpenseType = (type) => type === 'expense' || type === 'transfer_expense' || type === 'adjustment_expense';

// Fondo General = nóminas del ciclo + remanente - lo asignado a sobres en este ciclo
export function computeFund(transactions = []) {
  let income = 0, carry = 0, assigned = 0;
  for (const t of transactions) {
    const a = Number(t.amount) || 0;
    if (t.type === 'payroll_income') income += a;
    else if (t.type === 'carryover') carry += a;
    else if (isAllocation(t) && !t.settled) assigned += a;
  }
  return { income, carry, assigned, available: income + carry - assigned };
}

// Cambio de ciclo (día 29): borra las nóminas del ciclo anterior. Los sobres no se tocan.
// Lo que quedaba sin repartir en el Fondo General pasa como "remanente" para que no se pierda dinero.
// Ids deterministas: si los dos móviles (o el cron) lo hacen a la vez, el resultado es idéntico.
function applyCycleReset(data, today) {
  const { key, start } = currentCycle(today);
  if (data.payrollCycle === key) return null;

  let carry = 0, removedPayrolls = 0;
  const kept = [];
  for (const t of data.transactions || []) {
    const isOld = (t.date || '') < start;
    if (isOld && isFundIncome(t)) {
      carry += Number(t.amount) || 0;
      if (t.type === 'payroll_income') removedPayrolls++;
      continue;
    }
    if (isOld && isAllocation(t) && !t.settled) {
      carry -= Number(t.amount) || 0;
      kept.push({ ...t, settled: true });
      continue;
    }
    kept.push(t);
  }
  carry = Math.round(carry * 100) / 100;
  if (carry !== 0) {
    kept.unshift({
      id: `carry-${key}`, concept: 'Remanente del ciclo anterior', categoryId: null, sourceId: null,
      type: 'carryover', amount: carry, date: start
    });
  }
  return {
    data: { ...data, transactions: kept, payrollCycle: key, lastActiveMonth: key },
    message: removedPayrolls > 0 || data.payrollCycle
      ? '🗓️ ¡Nuevo ciclo! Se han reiniciado las nóminas. Registrad las de este mes.'
      : null
  };
}

// Recurrentes automáticos: se aplican solos el día indicado (una vez por mes).
function applyRecurrents(data, today) {
  const month = today.slice(0, 7);
  const [y, m, d] = today.split('-').map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  const txs = data.transactions || [];
  const added = [];
  let rulesChanged = false;

  const recurrents = (data.recurrents || []).map((rec) => {
    // Reglas antiguas sin fecha de inicio: empiezan el mes que viene (no cobramos algo ya pagado a mano)
    if (!rec.startMonth) { rulesChanged = true; return { ...rec, startMonth: nextMonth }; }
    return rec;
  });

  for (const rec of recurrents) {
    if (rec.auto === false || month < rec.startMonth) continue;
    const day = Math.min(Number(rec.day) || 1, daysIn(y, m));
    if (d < day) continue;
    const id = `rec-${rec.id}-${month}`;
    if (txs.some((t) => t.id === id || (t.recurrentId === rec.id && (t.date || '').startsWith(month)))) continue;
    added.push({
      id, recurrentId: rec.id, concept: rec.concept, categoryId: rec.categoryId, sourceId: null,
      type: rec.type, amount: rec.amount, date: `${month}-${pad(day)}`
    });
  }
  if (added.length === 0 && !rulesChanged) return null;
  return {
    data: { ...data, recurrents, transactions: [...added, ...txs] },
    message: added.length ? `🔁 Se han aplicado ${added.length} movimiento${added.length > 1 ? 's' : ''} recurrente${added.length > 1 ? 's' : ''}.` : null
  };
}

// Ejecuta las automatizaciones pendientes. Devuelve null si no hay nada que hacer.
export function runAutomations(data, today = todayLocal()) {
  if (!data) return null;
  let current = data;
  const messages = [];
  for (const step of [applyCycleReset, applyRecurrents]) {
    const r = step(current, today);
    if (r) { current = r.data; if (r.message) messages.push(r.message); }
  }
  return current === data ? null : { data: current, messages };
}

// --- Texto de las notificaciones -------------------------------------
const money = (n) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100);

function describeTx(t, cats, verb) {
  const cat = cats.get(t.categoryId);
  if (cat?.hasPin) return `🔒 ${verb === 'add' ? 'Nuevo movimiento' : verb === 'del' ? 'Movimiento eliminado' : 'Movimiento editado'} en un sobre protegido`;
  const where = cat ? cat.name : 'Fondo General';
  const prefix = verb === 'del' ? '🗑️ Eliminado: ' : verb === 'edit' ? '✏️ Editado: ' : '';
  switch (t.type) {
    case 'expense': return `${prefix || '💸 '}${t.concept} · -${money(t.amount)} (${where})`;
    case 'income': return `${prefix || '📥 '}${money(t.amount)} asignados a ${where}`;
    case 'payroll_income': return `${prefix || '💰 '}${t.concept} · +${money(t.amount)}`;
    case 'transfer_expense': return `${prefix || '🔄 '}${t.concept} · ${money(t.amount)} desde ${where}`;
    case 'transfer_income': return null; // ya se describe con su pareja transfer_expense
    case 'adjustment_income': return `${prefix || '✏️ '}Ajuste en ${where}: +${money(t.amount)}`;
    case 'adjustment_expense': return `${prefix || '✏️ '}Ajuste en ${where}: -${money(t.amount)}`;
    case 'carryover': return null;
    default: return `${prefix}${t.concept} · ${money(t.amount)}`;
  }
}

// Describe qué ha cambiado entre dos estados, para las notificaciones push y los avisos de la app
export function describeChanges(prev, next) {
  const who = next?.lastEditedName || 'Alguien';
  if (prev && next?.payrollCycle && prev.payrollCycle && prev.payrollCycle !== next.payrollCycle) {
    return { title: 'M&J 🦄 · Nuevo ciclo', body: '🗓️ Se han reiniciado las nóminas. ¡Registrad las de este mes!' };
  }
  const cats = new Map([...(prev?.categories || []), ...(next?.categories || [])].map((c) => [c.id, c]));
  const lines = [];

  const pTx = new Map((prev?.transactions || []).map((t) => [t.id, t]));
  const nTx = new Map((next?.transactions || []).map((t) => [t.id, t]));
  for (const [id, t] of nTx) {
    const old = pTx.get(id);
    if (!old) lines.push(describeTx(t, cats, 'add'));
    else if (JSON.stringify(old) !== JSON.stringify({ ...t, settled: old.settled })) lines.push(describeTx(t, cats, 'edit'));
  }
  for (const [id, t] of pTx) if (!nTx.has(id)) lines.push(describeTx(t, cats, 'del'));

  const pCat = new Map((prev?.categories || []).map((c) => [c.id, c]));
  const nCat = new Map((next?.categories || []).map((c) => [c.id, c]));
  for (const [id, c] of nCat) {
    if (!pCat.has(id)) lines.push(`💌 Nuevo sobre: ${c.name}`);
    else if (pCat.get(id).name !== c.name) lines.push(`💌 Sobre renombrado: ${pCat.get(id).name} → ${c.name}`);
  }
  for (const [id, c] of pCat) if (!nCat.has(id)) lines.push(`🗑️ Sobre eliminado: ${c.name}`);

  const pSrc = new Set((prev?.sources || []).map((s) => s.id));
  for (const s of next?.sources || []) if (!pSrc.has(s.id)) lines.push(`💼 Nueva fuente de nómina: ${s.name}`);

  const clean = lines.filter(Boolean);
  if (clean.length === 0) {
    const reordered = (prev?.categories || []).map((c) => c.id).join() !== (next?.categories || []).map((c) => c.id).join();
    clean.push(reordered ? '↕️ Ha reordenado los sobres' : '✨ Ha actualizado el presupuesto');
  }
  const body = clean.slice(0, 4).join('\n') + (clean.length > 4 ? `\n…y ${clean.length - 4} cambio${clean.length - 4 > 1 ? 's' : ''} más` : '');
  return { title: `M&J 🦄 · ${who}`, body };
}
