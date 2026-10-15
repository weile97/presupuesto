// Tests de la lógica crítica (sin dependencias): npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentCycle, previousCycle, runAutomations, computeFund, categoryBalances, describeChanges, cycleEndSummary } from '../src/shared.js';
import { mergeData } from '../src/lib/merge.js';

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
