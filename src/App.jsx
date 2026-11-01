import { useState, useEffect, useCallback } from "react";


import { useBudgetSync } from "./hooks/useBudgetSync.js";
import { useBudgetStats } from "./hooks/useBudgetStats.js";
import { useBudgetActions } from "./hooks/useBudgetActions.js";
import { usePushNotifications } from "./hooks/usePushNotifications.js";
import { readUserName, writeUserName } from "./lib/device.js";

import Toast from "./components/ui/Toast.jsx";
import Header from "./components/Header.jsx";
import BottomNav from "./components/BottomNav.jsx";
import Summary from "./components/Summary.jsx";
import UnicornLoader from "./components/unicorn/UnicornLoader.jsx";
import { currentSeason, SEASON_LOADER_MS } from "./lib/season.js";
import { todayLocal } from "./shared.js";
import UnicornCelebration from "./components/unicorn/UnicornCelebration.jsx";

import PayrollSection from "./features/payroll/PayrollSection.jsx";
import { SourceForm, DepositForm, BulkPayrollForm, DistributeForm } from "./features/payroll/PayrollForms.jsx";
import CategoriesSection from "./features/categories/CategoriesSection.jsx";
import CategoryDetail from "./features/categories/CategoryDetail.jsx";
import { CategoryForm, TransferForm } from "./features/categories/CategoryForms.jsx";
import TransactionsSection from "./features/transactions/TransactionsSection.jsx";
import TransactionForm from "./features/transactions/TransactionForm.jsx";
import RecurrentsSection, { RecurrentForm } from "./features/recurrents/RecurrentsSection.jsx";
import NameForm from "./features/settings/NameForm.jsx";
import BackupsForm from "./features/settings/BackupsForm.jsx";
import WhatsNew from "./features/settings/WhatsNew.jsx";
import { hasUnseenUpdate, markUpdateSeen } from "./lib/changelog.js";
import { AUTH_REQUIRED_EVENT } from "./lib/api.js";
import PinGate from "./components/PinGate.jsx";
import CycleSummary from "./features/summary/CycleSummary.jsx";
import AnnualChart from "./features/summary/AnnualChart.jsx";
import PinDialog from "./components/ui/PinDialog.jsx";
import ConfirmDialog from "./components/ui/ConfirmDialog.jsx";

// Tiempo mínimo de la pantalla de carga, para que se vea al unicornio desplegar las alas
const MIN_LOADER_MS = 1400;
// En temporada (Halloween, Navidad) la pantalla de carga temática dura 5 s (se puede saltar tocando).
// En desarrollo, ?season=christmas o ?season=halloween la fuerza para probarla.
const devSeason = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("season") : null;
const SEASON = devSeason || currentSeason(todayLocal());

export default function App() {
  // --- Avisos -------------------------------------------------------------
  const [toast, setToast] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const notify = useCallback((message, type = "success", action = null) => setToast({ message, type, action, id: Date.now() }), []);
  const celebrate = useCallback((message) => setCelebration({ message, id: Date.now() }), []);
  const closeToast = useCallback(() => setToast(null), []);
  const endCelebration = useCallback(() => setCelebration(null), []);

  // --- Usuario de este móvil ---------------------------------------------------
  const [userName, setUserName] = useState(readUserName);

  // --- Acceso: si el servidor pide el PIN (401) se muestra la pantalla de entrada ---
  const [authRequired, setAuthRequired] = useState(false);
  useEffect(() => {
    const onAuth = () => setAuthRequired(true);
    window.addEventListener(AUTH_REQUIRED_EVENT, onAuth);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, onAuth);
  }, []);

  // --- Datos -------------------------------------------------------------------
  const { data, loading, loadError, save, getData, refresh } = useBudgetSync({ userName, onMessage: notify });

  // Ventana de PIN: askPin(título) devuelve una promesa con el PIN escrito o null
  const [pinRequest, setPinRequest] = useState(null);
  const askPin = useCallback((title) => new Promise((resolve) => setPinRequest({ title, resolve, id: Date.now() })), []);
  const answerPin = (pin) => { pinRequest?.resolve(pin); setPinRequest(null); };

  // Confirmación: askConfirm({ title, message, confirmLabel }) devuelve una promesa con true o false
  const [confirmRequest, setConfirmRequest] = useState(null);
  const askConfirm = useCallback((options) => new Promise((resolve) => setConfirmRequest({ ...options, resolve, id: Date.now() })), []);
  const answerConfirm = (ok) => { confirmRequest?.resolve(ok); setConfirmRequest(null); };
  const stats = useBudgetStats(data);
  const actions = useBudgetActions({ data, stats, save, getData, notify, celebrate, askPin, askConfirm, userName });
  const push = usePushNotifications(notify);

  // --- Navegación: una hoja (formulario) y/o el detalle de un sobre ---------------
  const [sheet, setSheet] = useState(null); // { type, n, ...props }
  const [detailId, setDetailId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const openSheet = useCallback((type, props = {}) => setSheet({ type, n: Date.now(), ...props }), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const [minTimePassed, setMinTimePassed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinTimePassed(true), SEASON ? SEASON_LOADER_MS : MIN_LOADER_MS);
    return () => clearTimeout(t);
  }, []);

  // Bloquea el scroll de la página mientras hay una hoja o ventana abierta
  // Novedades: salen una vez tras cada actualización (también se pueden volver a ver desde Ajustes)
  const [showNews, setShowNews] = useState(hasUnseenUpdate);
  const closeNews = () => { markUpdateSeen(); setShowNews(false); };

  const overlayOpen = !!sheet || !!detailId || showNews;
  useEffect(() => {
    document.body.style.overflow = overlayOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [overlayOpen]);

  function saveUserName(name) {
    const n = name.trim().slice(0, 24);
    if (!n) return notify("Escribe tu nombre.", "error");
    writeUserName(n);
    setUserName(n);
    closeSheet();
    notify(`¡Hola, ${n}! 👋`);
  }

  function enableNotifications() {
    if (!userName) openSheet("name");
    push.enable();
  }

  if (authRequired) return <PinGate />;

  if (loading || !minTimePassed) return <UnicornLoader season={SEASON} onSkip={loading ? undefined : () => setMinTimePassed(true)} />;

  if (loadError && !data) {
    return (
      <div className="loading-screen">
        ⚠️ No se han podido cargar los datos del servidor.
        <p className="load-error-hint">Suele ser un problema temporal de conexión. Tus datos guardados no se han borrado.</p>
        <button className="btn-primary" style={{ margin: "0 auto" }} onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    );
  }

  const { sources, categories, transactions, recurrents, fund, catById, categoryBalances, lastPayrollBySource, cycle } = stats;
  const detailCat = detailId ? catById.get(detailId) : null;
  const formProps = { actions, onClose: closeSheet };

  return (
    <div className="app-container">
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} action={toast.action} onClose={closeToast} />}
      {celebration && <UnicornCelebration key={celebration.id} message={celebration.message} onDone={endCelebration} />}

      <Header
        userName={userName}
        showBell={push.permission !== "granted"}
        onEnableNotifications={enableNotifications}
        onEditName={() => openSheet("name")}
        onExport={actions.exportCSV}
      />

      <main className="main-content">
        <Summary
          fund={fund}
          cycle={cycle}
          categories={categories}
          categoryBalances={categoryBalances}
          hasSources={sources.length > 0}
          onRegisterPayroll={() => openSheet("bulkPayroll")}
        />
        <CategoriesSection
          categories={categories}
          categoryBalances={categoryBalances}
          actions={actions}
          openSheet={openSheet}
          onOpenDetail={setDetailId}
        />
        <CycleSummary categories={categories} cycleSummary={stats.cycleSummary} isLocked={actions.isLocked} />
        <PayrollSection sources={sources} lastPayrollBySource={lastPayrollBySource} openSheet={openSheet} actions={actions} />
        <RecurrentsSection recurrents={recurrents} transactions={transactions} catById={catById} categoryBalances={categoryBalances} actions={actions} openSheet={openSheet} />
        <AnnualChart transactions={transactions} categories={categories} isLocked={actions.isLocked} />
        <TransactionsSection
          transactions={transactions}
          catById={catById}
          actions={actions}
          openSheet={openSheet}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
        />
      </main>

      {/* Barra inferior con botón central "+" para apuntar un gasto en 2 toques */}
      <BottomNav
        hidden={overlayOpen}
        onAdd={() => openSheet("tx", { preset: { type: "expense" } })}
        onSettings={() => openSheet("name")}
      />

      {detailCat && (
        <CategoryDetail
          category={detailCat}
          stats={categoryBalances[detailCat.id] || { balance: 0, income: 0, expense: 0 }}
          transactions={transactions}
          actions={actions}
          openSheet={openSheet}
          onFilterHistory={setCategoryFilter}
          onClose={() => setDetailId(null)}
        />
      )}

      {sheet?.type === "source" && <SourceForm key={sheet.n} {...formProps} source={sheet.source} />}
      {sheet?.type === "deposit" && <DepositForm key={sheet.n} {...formProps} source={sheet.source} />}
      {sheet?.type === "bulkPayroll" && <BulkPayrollForm key={sheet.n} {...formProps} sources={sources} onDistribute={() => openSheet("distribute")} />}
      {sheet?.type === "distribute" && <DistributeForm key={sheet.n} {...formProps} rules={actions.pendingAllocations()} categoriesById={catById} available={fund.available} />}
      {sheet?.type === "category" && <CategoryForm key={sheet.n} {...formProps} category={sheet.category} />}
      {sheet?.type === "transfer" && <TransferForm key={sheet.n} {...formProps} categories={categories} from={sheet.from} />}
      {sheet?.type === "tx" && <TransactionForm key={sheet.n} {...formProps} tx={sheet.tx} preset={sheet.preset} categories={categories} payers={stats.payers} shortcuts={stats.shortcuts} />}
      {sheet?.type === "recurrent" && <RecurrentForm key={sheet.n} {...formProps} rule={sheet.rule} categories={categories} />}
      {sheet?.type === "name" && <NameForm key={sheet.n} initial={userName} onSave={saveUserName} onClose={closeSheet} notify={notify} onOpenBackups={() => openSheet("backups")} onOpenNews={() => { closeSheet(); setShowNews(true); }} />}
      {sheet?.type === "backups" && <BackupsForm key={sheet.n} userName={userName} notify={notify} onRestored={refresh} onClose={closeSheet} />}
      {showNews && <WhatsNew onClose={closeNews} />}
      {pinRequest && <PinDialog key={pinRequest.id} title={pinRequest.title} onDone={answerPin} />}
      {confirmRequest && <ConfirmDialog key={confirmRequest.id} title={confirmRequest.title} message={confirmRequest.message} confirmLabel={confirmRequest.confirmLabel} onDone={answerConfirm} />}
    </div>
  );
}
