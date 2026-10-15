import { useMemo } from "react";
import { EMPTY } from "../lib/constants.js";
import { computeFund, currentCycle, previousCycle, categoryBalances as calcBalances, expensesBetween } from "../shared.js";

// Valores derivados de los datos (saldos, Fondo General, ciclo). Se recalculan solo si cambian los datos.
export function useBudgetStats(data) {
  const sources = data?.sources || EMPTY;
  const categories = data?.categories || EMPTY;
  const transactions = data?.transactions || EMPTY;
  const recurrents = data?.recurrents || EMPTY;
  const cycle = currentCycle();

  const fund = useMemo(() => computeFund(transactions), [transactions]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const categoryBalances = useMemo(() => calcBalances(categories, transactions), [categories, transactions]);

  // Última nómina registrada por fuente
  const lastPayrollBySource = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      if (t.type !== "payroll_income") continue;
      if (!map[t.sourceId] || t.date > map[t.sourceId].date) map[t.sourceId] = t;
    }
    return map;
  }, [transactions]);

  // Resumen del ciclo: gasto por sobre (este ciclo vs anterior) y quién ha pagado
  const cycleSummary = useMemo(() => {
    const prev = previousCycle(cycle.start);
    const paidBy = {};
    for (const t of transactions) {
      if (t.type !== "expense" || !t.paidBy || t.date < cycle.start || t.date >= cycle.nextStart) continue;
      paidBy[t.paidBy] = (paidBy[t.paidBy] || 0) + (t.amount || 0);
    }
    return {
      current: expensesBetween(transactions, cycle.start, cycle.nextStart),
      previous: expensesBetween(transactions, prev.start, cycle.start),
      paidBy
    };
  }, [transactions, cycle.start, cycle.nextStart]);

  // Nombres de quienes han pagado algo alguna vez (para elegir rápido en el formulario)
  const payers = useMemo(() => [...new Set(transactions.map((t) => t.paidBy).filter(Boolean))], [transactions]);

  return {
    sources, categories, transactions, recurrents,
    fund, catById, categoryBalances, lastPayrollBySource, cycleSummary, payers, cycle
  };
}
