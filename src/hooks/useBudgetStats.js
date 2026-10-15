import { useMemo } from "react";
import { EMPTY } from "../lib/constants.js";
import { computeFund, currentCycle } from "../shared.js";

const CAT_INCOME = new Set(["income", "transfer_income", "adjustment_income"]);
const CAT_EXPENSE = new Set(["expense", "transfer_expense", "adjustment_expense"]);

// Valores derivados de los datos (saldos, Fondo General, ciclo). Se recalculan solo si cambian los datos.
export function useBudgetStats(data) {
  const sources = data?.sources || EMPTY;
  const categories = data?.categories || EMPTY;
  const transactions = data?.transactions || EMPTY;
  const recurrents = data?.recurrents || EMPTY;

  const fund = useMemo(() => computeFund(transactions), [transactions]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const categoryBalances = useMemo(() => {
    const map = {};
    for (const c of categories) map[c.id] = { income: 0, expense: 0, balance: c.initialBalance || 0 };
    for (const t of transactions) {
      const entry = map[t.categoryId];
      if (!entry) continue;
      if (CAT_INCOME.has(t.type)) entry.income += t.amount || 0;
      if (CAT_EXPENSE.has(t.type)) entry.expense += t.amount || 0;
    }
    for (const id in map) map[id].balance += map[id].income - map[id].expense;
    return map;
  }, [categories, transactions]);

  // Última nómina registrada por fuente
  const lastPayrollBySource = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      if (t.type !== "payroll_income") continue;
      if (!map[t.sourceId] || t.date > map[t.sourceId].date) map[t.sourceId] = t;
    }
    return map;
  }, [transactions]);

  return {
    sources, categories, transactions, recurrents,
    fund, catById, categoryBalances, lastPayrollBySource,
    cycle: currentCycle()
  };
}
