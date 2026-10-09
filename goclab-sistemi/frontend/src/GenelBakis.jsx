import DashboardLayout from "./DashboardLayout.jsx";
import Overview from "./pages/dashboard/Overview.jsx";

export default function GenelBakis({ lang, setLang, t, onLogout, onNavigate, onGoToTenantDashboard, onGoToAdminDashboard, dataScope, setDataScope }) {
  return (
    <DashboardLayout
      lang={lang}
      setLang={setLang}
      t={t}
      activeSidebarItem="genelBakis"
      onLogout={onLogout}
      onNavigate={onNavigate}
      onGoToTenantDashboard={onGoToTenantDashboard}
      onGoToAdminDashboard={onGoToAdminDashboard}
      dataScope={dataScope}
      setDataScope={setDataScope}
    >
      <Overview t={t} dataScope={dataScope} />
    </DashboardLayout>
  );
}
