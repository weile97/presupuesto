// Tests de la lógica crítica (sin dependencias): npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentCycle, previousCycle, runAutomations, computeFund, categoryBalances, describeChanges, cycleEndSummary, findDuplicateTx, findDuplicateRule } from '../src/shared.js';
import { mergeData } from '../src/lib/merge.js';
import { currentSeason } from '../src/lib/season.js';
import { hashPin, stripPins, applyPins } from '../lib/pins.js';

const base = () => ({
  sources: [{ id: 's1', name: 'Nómina Meli', amount: 1300 }],
  categories: [{ id: 'c1', name: 'Comida', initialBalance: 0 }, { id: 'c2', name: 'Casa', initialBalance: 0 }],
  transactions: [
    { id: 'p1', type: 'payroll_income', amount: 1000, date: '2026-09-29', categoryId: null },
    { id: 'a1', type: 'income', amount: 300, date: '2026-09-30', categoryId: 'c1' },
    { id: 'e1', type: 'expense', amount: 50, date: '2026-10-02', categoryId: 'c1' }
  ],
  recurrents: [],
  payrollCycle: '2026-09'
});

test('ciclo: del 29 al 28, febrero y cambio de año', () => {
  assert.deepEqual(currentCycle('2026-10-28'), { key: '2026-09', start: '2026-09-29', nextStart: '2026-10-29' });
  assert.equal(currentCycle('2026-10-29').key, '2026-10');
  assert.equal(currentCycle('2027-02-28').start, '2027-02-28');
  assert.equal(currentCycle('2028-02-29').start, '2028-02-29');
  assert.equal(currentCycle('2027-01-05').key, '2026-12');
  assert.equal(previousCycle('2026-10-29').start, '2026-09-29');
});

test('reinicio del día 29: borra nóminas, conserva sobres y el dinero sin repartir', () => {
  const d = base();
  const before = categoryBalances(d.categories, d.transactions);
  const r = runAutomations(d, '2026-10-29');
  assert.ok(r);
  assert.equal(r.data.transactions.filter((t) => t.type === 'payroll_income').length, 0);
  assert.deepEqual(categoryBalances(r.data.categories, r.data.transactions), before);
  assert.equal(computeFund(r.data.transactions).available, computeFund(d.transactions).available);
  assert.equal(runAutomations(r.data, '2026-11-05'), null, 'idempotente dentro del mismo ciclo');
});

test('recurrentes: una vez al mes y no antes de su mes de inicio', () => {
  const d = { ...base(), recurrents: [{ id: 'r1', concept: 'Hipoteca', categoryId: 'c2', type: 'expense', amount: 600, day: 1, startMonth: '2026-11' }] };
  assert.equal(runAutomations(d, '2026-10-20'), null);
  const r = runAutomations(d, '2026-11-01');
  assert.equal(r.data.transactions.filter((t) => t.recurrentId === 'r1').length, 1);
  assert.equal(runAutomations(r.data, '2026-11-15'), null);
});

test('fusión: conserva cambios de los dos móviles', () => {
  const b = base();
  const local = { ...b, transactions: [{ id: 'L', type: 'expense', amount: 5, date: '2026-10-03', categoryId: 'c1' }, ...b.transactions] };
  const remote = { ...b, transactions: b.transactions.filter((t) => t.id !== 'e1'), categories: [...b.categories, { id: 'c3', name: 'Ocio' }] };
  const m = mergeData(b, local, remote);
  assert.deepEqual(m.transactions.map((t) => t.id).sort(), ['L', 'a1', 'p1']);
  assert.deepEqual(m.categories.map((c) => c.id), ['c1', 'c2', 'c3']);
});

test('avisos: describe el gasto y alerta de saldo negativo', () => {
  const prev = base();
  const next = { ...prev, lastEditedName: 'Meli', transactions: [{ id: 'x', type: 'expense', amount: 400, concept: 'Mercadona', categoryId: 'c1', date: '2026-10-05' }, ...prev.transactions] };
  const { title, body } = describeChanges(prev, next);
  assert.equal(title, 'M&J 🦄 · Meli');
  assert.match(body, /Mercadona/);
  assert.match(body, /Comida se ha quedado en negativo/);
});

test('resumen de fin de ciclo solo la víspera del 29', () => {
  assert.equal(cycleEndSummary(base(), '2026-10-27'), null);
  assert.match(cycleEndSummary(base(), '2026-10-28').body, /Gastado este ciclo/);
});

test('duplicados: el recurrente no se cobra si ya se pasó a mano o por otra regla igual', () => {
  const rule = { id: 'r1', concept: 'Celular Josna', categoryId: 'c1', type: 'expense', amount: 43, day: 1, startMonth: '2026-11' };
  const twin = { ...rule, id: 'r2' };
  const manual = { id: 'm1', concept: ' celular  josná ', categoryId: 'c1', type: 'expense', amount: 43, date: '2026-11-01' };
  const pagada = runAutomations({ ...base(), payrollCycle: '2026-10', recurrents: [rule], transactions: [...base().transactions, manual] }, '2026-11-02');
  assert.equal(pagada, null);
  const gemelas = runAutomations({ ...base(), payrollCycle: '2026-10', recurrents: [rule, twin] }, '2026-11-01');
  assert.equal(gemelas.data.transactions.filter((t) => t.recurrentId).length, 1);
  const otroImporte = runAutomations({ ...base(), payrollCycle: '2026-10', recurrents: [rule], transactions: [...base().transactions, { ...manual, amount: 50 }] }, '2026-11-02');
  assert.equal(otroImporte.data.transactions.filter((t) => t.recurrentId === 'r1').length, 1);
  // Un ingreso a mano el día 1 no sustituye a la regla del día 29 del mismo mes
  const dia29 = { ...rule, day: 29, startMonth: '2026-10' };
  const finDeMes = runAutomations({ ...base(), payrollCycle: '2026-11', recurrents: [dia29], transactions: [manual] }, '2026-11-29');
  assert.equal(finDeMes.data.transactions.filter((t) => t.recurrentId === 'r1').length, 1);
  // Pagado a mano unos días antes del cobro, aunque sea el mes anterior: no se cobra otra vez
  const anticipado = runAutomations({ ...base(), payrollCycle: '2026-10', recurrents: [rule], transactions: [{ ...manual, date: '2026-10-30' }] }, '2026-11-01');
  assert.equal(anticipado, null);
});

test('duplicados: detección manual', () => {
  const rule = { id: 'r1', concept: 'Hipoteca', categoryId: 'c2', type: 'expense', amount: 300, day: 1 };
  const tx = { id: 't1', concept: 'Mercadona', categoryId: 'c1', type: 'expense', amount: 25, date: '2026-11-03' };
  assert.ok(findDuplicateTx({ ...tx, id: undefined, concept: 'MERCADONA' }, [tx]));
  assert.equal(findDuplicateTx({ ...tx, date: '2026-11-10' }, [tx]), null, 'otro día no es duplicado');
  assert.equal(findDuplicateTx(tx, [tx], [], 't1'), null, 'al editar no se compara consigo mismo');
  const h = { id: 't2', concept: 'Hipoteca', categoryId: 'c2', type: 'expense', amount: 300, date: '2026-11-01' };
  assert.ok(findDuplicateTx({ ...h, date: '2026-11-15' }, [h], [rule]), 'un recurrente se compara en todo el mes');
  assert.ok(findDuplicateRule({ ...rule, id: 'x' }, [rule]));
});

test('PIN de sobres: los hash no salen hacia la app y no se pierden al guardar', () => {
  const hash = hashPin('c1', '1234');
  const stored = [{ id: 'c1', name: 'Oculto', hasPin: true, pinHash: hash }, { id: 'c2', name: 'Normal' }];
  const client = stripPins({ categories: stored }).categories;
  assert.ok(client.every((c) => !('pinHash' in c) && !('pin' in c)));
  const { categories, map } = applyPins(client, stored, {});
  assert.equal(categories[0].pinHash, hash);
  assert.equal(map.c1, hash);
  // Deshacer el borrado de un sobre: ya no está en los datos, pero el PIN sigue guardado aparte
  assert.equal(applyPins([client[0]], [], map).categories[0].pinHash, hash);
  // Un sobre sin PIN no conserva ningún hash, ni uno enviado por la app
  assert.ok(!('pinHash' in applyPins([{ id: 'c2', pinHash: 'x' }], stored, {}).categories[0]));
  // Formatos antiguos: PIN en claro y base64
  assert.equal(applyPins([], [{ id: 'c1', hasPin: true, pin: '1234' }], {}).map.c1, hash);
  assert.equal(applyPins([], [{ id: 'c1', hasPin: true, pinHash: Buffer.from('1234').toString('base64') }], {}).map.c1, hash);
});
test('temporadas de la pantalla de carga', () => {
  assert.equal(currentSeason('2026-10-23'), null);
  assert.equal(currentSeason('2026-10-31'), 'halloween');
  assert.equal(currentSeason('2026-11-01'), 'christmas');
  assert.equal(currentSeason('2026-12-25'), 'christmas');
  assert.equal(currentSeason('2027-01-06'), 'christmas');
  assert.equal(currentSeason('2027-01-07'), null);
  assert.equal(currentSeason('2027-06-15'), null);
});