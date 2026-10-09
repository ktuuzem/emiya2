import DashboardLayout from "./DashboardLayout.jsx";
import KMeansClustering from "./pages/dashboard/KMeansClustering.jsx";

export default function KMeansPage({ lang, setLang, t, onLogout, onNavigate, onGoToTenantDashboard, onGoToAdminDashboard, dataScope, setDataScope }) {
  return (
    <DashboardLayout
      lang={lang}
      setLang={setLang}
      t={t}
      activeSidebarItem="kMeans"
      onLogout={onLogout}
      onNavigate={onNavigate}
      onGoToTenantDashboard={onGoToTenantDashboard}
      onGoToAdminDashboard={onGoToAdminDashboard}
      dataScope={dataScope}
      setDataScope={setDataScope}
    >
      <KMeansClustering t={t} dataScope={dataScope} />
    </DashboardLayout>
  );
}
