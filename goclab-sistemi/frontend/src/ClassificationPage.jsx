import DashboardLayout from "./DashboardLayout.jsx";
import Classification from "./pages/dashboard/Classification.jsx";

export default function ClassificationPage({ lang, setLang, t, onLogout, onNavigate, onGoToTenantDashboard, onGoToAdminDashboard, dataScope, setDataScope }) {
  return (
    <DashboardLayout
      lang={lang}
      setLang={setLang}
      t={t}
      activeSidebarItem="siniflandirma"
      onLogout={onLogout}
      onNavigate={onNavigate}
      onGoToTenantDashboard={onGoToTenantDashboard}
      onGoToAdminDashboard={onGoToAdminDashboard}
      dataScope={dataScope}
      setDataScope={setDataScope}
    >
      <Classification t={t} dataScope={dataScope} />
    </DashboardLayout>
  );
}
