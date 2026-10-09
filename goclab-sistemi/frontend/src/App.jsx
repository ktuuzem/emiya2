import { useState } from "react";
import { GraduationCap, Compass, User, Briefcase, LogIn } from "lucide-react";
import { TRANSLATIONS, LanguageSelector } from "./i18n.jsx";
import Register from "./Register.jsx";
import Activation from "./Activation.jsx";
import StudentLogin from "./StudentLogin.jsx";
import ForgotPassword from "./ForgotPassword.jsx";
import ResetPassword from "./ResetPassword.jsx";
import SetPassword from "./SetPassword.jsx";
import SurveyConsent from "./SurveyConsent.jsx";
import Demographics from "./Demographics.jsx";
import RatingQuestions from "./RatingQuestions.jsx";
import SurveyComplete from "./SurveyComplete.jsx";
import StudentReport from "./StudentReport.jsx";
import SurveyHistory from "./SurveyHistory.jsx";
import InstitutionApply from "./InstitutionApply.jsx";
import AdminLogin from "./AdminLogin.jsx";
import SysAdminLogin from "./SysAdminLogin.jsx";
import SysAdminLayout from "./SysAdminLayout.jsx";
import InstitutionManagement from "./pages/sysadmin/InstitutionManagement.jsx";
import PermissionManagement from "./pages/sysadmin/PermissionManagement.jsx";
import LogViewer from "./pages/sysadmin/LogViewer.jsx";
import AdminDashboard from "./pages/sysadmin/AdminDashboard.jsx";
import AdminForgotPassword from "./AdminForgotPassword.jsx";
import GenelBakis from "./GenelBakis.jsx";
import KMeansPage from "./KMeansPage.jsx";
import DistributionPage from "./DistributionPage.jsx";
import CorrelationPage from "./CorrelationPage.jsx";
import ClassificationPage from "./ClassificationPage.jsx";
import RegionalHeatmapPage from "./RegionalHeatmapPage.jsx";
import DecisionTreePage from "./DecisionTreePage.jsx";
import TenantOverviewPage from "./TenantOverviewPage.jsx";

function SolidBarChartIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="14" width="4" height="7" rx="1" fill="#1D4ED8" />
            <rect x="10" y="9" width="4" height="12" rx="1" fill="#1D4ED8" />
            <rect x="17" y="4" width="4" height="17" rx="1" fill="#1D4ED8" />
        </svg>
    );
}

function TurkeyMapIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
            <path
                d="M3,9 L5,7 L9,6 L13,6.5 L17,7 L20,8 L21,10 L20,12 L19,14 L17,15.5 L18,17 L16,16 L13,16.5 L10,17 L7,16 L5,14.5 L3,13 L4,11 L2.5,10 Z"
                fill="#1D4ED8"
            />
        </svg>
    );
}

function getInitialPage() {
    if (typeof window === "undefined") return "login";
    if (window.location.pathname === "/kurum-sifre-belirle") return "setPassword";
    const isResetPath = window.location.pathname === "/reset-password";
    const hasToken = new URLSearchParams(window.location.search).has("token");
    if (isResetPath || hasToken) return "resetPassword";
    if (window.location.pathname === "/kurum-basvuru") return "institutionApply";
    if (window.location.pathname === "/admin-login") return "adminLogin";
    if (window.location.pathname === "/sys-auth-goclab-7f3d21") return "sysAdminLogin";
    if (window.location.pathname === "/sys-auth-goclab-7f3d21/kontrol-paneli") return "sysAdminDashboard";
    if (window.location.pathname === "/sys-auth-goclab-7f3d21/kurum-yonetimi") return "sysAdminInstitutions";
    if (window.location.pathname === "/sys-auth-goclab-7f3d21/yetki-yonetimi") return "sysAdminPermissions";
    if (window.location.pathname === "/sys-auth-goclab-7f3d21/log-izleme") return "sysAdminLogs";
    if (window.location.pathname === "/admin-forgot-password") return "adminForgotPassword";
    if (window.location.pathname === "/dashboard/genel-bakis") return "adminDashboard";
    if (window.location.pathname === "/dashboard/k-means") return "adminKMeans";
    if (window.location.pathname === "/dashboard/dagilim") return "adminDistribution";
    if (window.location.pathname === "/dashboard/korelasyon") return "adminCorrelation";
    if (window.location.pathname === "/dashboard/siniflandirma") return "adminClassification";
    if (window.location.pathname === "/dashboard/isi-haritasi") return "adminHeatmap";
    if (window.location.pathname === "/dashboard/karar-agaci") return "adminDecisionTree";
    if (window.location.pathname === "/kurum/genel-bakis") return "tenantOverview";
    return "login";
}

export default function App() {
    const [lang, setLang] = useState("TR");
    const [currentPage, setCurrentPage] = useState(getInitialPage);
    const [registeredEmail, setRegisteredEmail] = useState("");
    const [selectedResponseId, setSelectedResponseId] = useState(null);
    // "Goc Niyeti Arastirmasi Sonuclari" dashboard'unun ust kismindaki
    // Turkiye/Moldova/Karsilastirma secimi - sayfalar arasi gezinirken (Genel
    // Bakis -> K-Means -> ...) kaybolmamasi icin App seviyesinde tutulur.
    const [dataScope, setDataScope] = useState("turkey");
    const t = TRANSLATIONS[lang];

    const DASHBOARD_ROUTES = {
        genelBakis: { path: "/dashboard/genel-bakis", page: "adminDashboard" },
        kMeans: { path: "/dashboard/k-means", page: "adminKMeans" },
        dagilim: { path: "/dashboard/dagilim", page: "adminDistribution" },
        korelasyon: { path: "/dashboard/korelasyon", page: "adminCorrelation" },
        siniflandirma: { path: "/dashboard/siniflandirma", page: "adminClassification" },
        isiHaritasi: { path: "/dashboard/isi-haritasi", page: "adminHeatmap" },
        kararAgaci: { path: "/dashboard/karar-agaci", page: "adminDecisionTree" },
    };

    const handleDashboardNavigate = (key) => {
        const route = DASHBOARD_ROUTES[key];
        if (!route) return;
        window.history.pushState({}, "", route.path);
        setCurrentPage(route.page);
    };

    const TENANT_ROUTES = {
        genelBakis: { path: "/kurum/genel-bakis", page: "tenantOverview" },
    };

    const handleTenantNavigate = (key) => {
        const route = TENANT_ROUTES[key];
        if (!route) return;
        window.history.pushState({}, "", route.path);
        setCurrentPage(route.page);
    };

    const SYS_ADMIN_ROUTES = {
        kontrolPaneli: { path: "/sys-auth-goclab-7f3d21/kontrol-paneli", page: "sysAdminDashboard" },
        kurumYonetimi: { path: "/sys-auth-goclab-7f3d21/kurum-yonetimi", page: "sysAdminInstitutions" },
        yetkiYonetimi: { path: "/sys-auth-goclab-7f3d21/yetki-yonetimi", page: "sysAdminPermissions" },
        logIzleme: { path: "/sys-auth-goclab-7f3d21/log-izleme", page: "sysAdminLogs" },
    };

    const handleSysAdminNavigate = (key) => {
        const route = SYS_ADMIN_ROUTES[key];
        if (!route) return;
        window.history.pushState({}, "", route.path);
        setCurrentPage(route.page);
    };

    const goToTenantOverview = () => {
        window.history.pushState({}, "", "/kurum/genel-bakis");
        setCurrentPage("tenantOverview");
    };

    // Giris, kayit, yonetici girisi ve kurum basvuru formu sayfalarinin
    // altindaki "Ana Sayfaya Dön" baglantisi icin ortak yonlendirme.
    const goHome = () => {
        window.history.pushState({}, "", "/");
        setCurrentPage("login");
    };

    const goToAdminOverview = () => {
        window.history.pushState({}, "", "/dashboard/genel-bakis");
        setCurrentPage("adminDashboard");
    };

    if (currentPage === "register") {
        return (
            <Register
                lang={lang}
                setLang={setLang}
                t={t}
                onBack={() => setCurrentPage("studentLogin")}
                onRegisterSuccess={(email) => {
                    setRegisteredEmail(email);
                    setCurrentPage("activation");
                }}
                onGoHome={goHome}
            />
        );
    }

    if (currentPage === "activation") {
        return (
            <Activation
                lang={lang}
                setLang={setLang}
                t={t}
                email={registeredEmail}
                onChangeEmail={() => setCurrentPage("register")}
                onVerified={() => setCurrentPage("studentLogin")}
            />
        );
    }

    if (currentPage === "studentLogin") {
        return (
            <StudentLogin
                lang={lang}
                setLang={setLang}
                t={t}
                onGoToRegister={() => setCurrentPage("register")}
                onLoginSuccess={() => setCurrentPage("surveyConsent")}
                onGoToForgotPassword={() => setCurrentPage("forgotPassword")}
                onGoHome={goHome}
            />
        );
    }

    if (currentPage === "forgotPassword") {
        return (
            <ForgotPassword
                lang={lang}
                setLang={setLang}
                t={t}
                onGoToLogin={() => setCurrentPage("studentLogin")}
            />
        );
    }

    if (currentPage === "resetPassword") {
        return (
            <ResetPassword
                lang={lang}
                setLang={setLang}
                t={t}
                onSuccess={() => setCurrentPage("studentLogin")}
                onGoToLogin={() => setCurrentPage("studentLogin")}
            />
        );
    }

    if (currentPage === "setPassword") {
        return (
            <SetPassword
                lang={lang}
                setLang={setLang}
                t={t}
                onGoToLogin={() => setCurrentPage("login")}
            />
        );
    }

    if (currentPage === "institutionApply") {
        return <InstitutionApply lang={lang} setLang={setLang} t={t} onGoHome={goHome} />;
    }

    if (currentPage === "adminLogin") {
        return (
            <AdminLogin
                lang={lang}
                setLang={setLang}
                t={t}
                onGoToInstitutionApply={() => {
                    window.history.pushState({}, "", "/kurum-basvuru");
                    setCurrentPage("institutionApply");
                }}
                onGoToForgotPassword={() => {
                    window.history.pushState({}, "", "/admin-forgot-password");
                    setCurrentPage("adminForgotPassword");
                }}
                onGoHome={goHome}
                onLoginSuccess={() => {
                    let accountType = null;
                    try {
                        const stored = localStorage.getItem("goclab_admin_session");
                        accountType = stored ? JSON.parse(stored)?.accountType : null;
                    } catch {}

                    if (accountType === "institution") {
                        window.history.pushState({}, "", "/kurum/genel-bakis");
                        setCurrentPage("tenantOverview");
                        return;
                    }
                    window.history.pushState({}, "", "/dashboard/genel-bakis");
                    setCurrentPage("adminDashboard");
                }}
            />
        );
    }

    if (currentPage === "sysAdminLogin") {
        return (
            <SysAdminLogin
                lang={lang}
                setLang={setLang}
                t={t}
                onGoToForgotPassword={() => {
                    window.history.pushState({}, "", "/admin-forgot-password");
                    setCurrentPage("adminForgotPassword");
                }}
                onLoginSuccess={() => {
                    let role = null;
                    try {
                        const stored = localStorage.getItem("goclab_admin_session");
                        role = stored ? JSON.parse(stored)?.role : null;
                    } catch {}

                    if (role === "super_admin") {
                        window.history.pushState({}, "", "/sys-auth-goclab-7f3d21/kontrol-paneli");
                        setCurrentPage("sysAdminDashboard");
                        return;
                    }
                    window.history.pushState({}, "", "/dashboard/genel-bakis");
                    setCurrentPage("adminDashboard");
                }}
            />
        );
    }

    if (currentPage === "sysAdminDashboard") {
        return (
            <SysAdminLayout
                lang={lang}
                setLang={setLang}
                t={t}
                activeSidebarItem="kontrolPaneli"
                onLogout={() => {
                    window.history.pushState({}, "", "/sys-auth-goclab-7f3d21");
                    setCurrentPage("sysAdminLogin");
                }}
                onNavigate={handleSysAdminNavigate}
                onBackToLogin={() => {
                    try {
                        localStorage.removeItem("goclab_admin_session");
                    } catch {}
                    window.history.pushState({}, "", "/sys-auth-goclab-7f3d21");
                    setCurrentPage("sysAdminLogin");
                }}
            >
                <AdminDashboard t={t} lang={lang} onNavigate={handleSysAdminNavigate} />
            </SysAdminLayout>
        );
    }

    if (currentPage === "sysAdminInstitutions") {
        return (
            <SysAdminLayout
                lang={lang}
                setLang={setLang}
                t={t}
                activeSidebarItem="kurumYonetimi"
                onLogout={() => {
                    window.history.pushState({}, "", "/sys-auth-goclab-7f3d21");
                    setCurrentPage("sysAdminLogin");
                }}
                onNavigate={handleSysAdminNavigate}
                onBackToLogin={() => {
                    try {
                        localStorage.removeItem("goclab_admin_session");
                    } catch {}
                    window.history.pushState({}, "", "/sys-auth-goclab-7f3d21");
                    setCurrentPage("sysAdminLogin");
                }}
            >
                <InstitutionManagement t={t} />
            </SysAdminLayout>
        );
    }

    if (currentPage === "sysAdminPermissions") {
        return (
            <SysAdminLayout
                lang={lang}
                setLang={setLang}
                t={t}
                activeSidebarItem="yetkiYonetimi"
                onLogout={() => {
                    window.history.pushState({}, "", "/sys-auth-goclab-7f3d21");
                    setCurrentPage("sysAdminLogin");
                }}
                onNavigate={handleSysAdminNavigate}
                onBackToLogin={() => {
                    try {
                        localStorage.removeItem("goclab_admin_session");
                    } catch {}
                    window.history.pushState({}, "", "/sys-auth-goclab-7f3d21");
                    setCurrentPage("sysAdminLogin");
                }}
            >
                <PermissionManagement t={t} />
            </SysAdminLayout>
        );
    }

    if (currentPage === "sysAdminLogs") {
        return (
            <SysAdminLayout
                lang={lang}
                setLang={setLang}
                t={t}
                activeSidebarItem="logIzleme"
                onLogout={() => {
                    window.history.pushState({}, "", "/sys-auth-goclab-7f3d21");
                    setCurrentPage("sysAdminLogin");
                }}
                onNavigate={handleSysAdminNavigate}
                onBackToLogin={() => {
                    try {
                        localStorage.removeItem("goclab_admin_session");
                    } catch {}
                    window.history.pushState({}, "", "/sys-auth-goclab-7f3d21");
                    setCurrentPage("sysAdminLogin");
                }}
            >
                <LogViewer t={t} />
            </SysAdminLayout>
        );
    }

    if (currentPage === "adminDashboard") {
        return (
            <GenelBakis
                lang={lang}
                setLang={setLang}
                t={t}
                dataScope={dataScope}
                setDataScope={setDataScope}
                onLogout={() => {
                    window.history.pushState({}, "", "/admin-login");
                    setCurrentPage("adminLogin");
                }}
                onNavigate={handleDashboardNavigate}
                onGoToTenantDashboard={goToTenantOverview}
                onGoToAdminDashboard={goToAdminOverview}
            />
        );
    }

    if (currentPage === "adminKMeans") {
        return (
            <KMeansPage
                lang={lang}
                setLang={setLang}
                t={t}
                dataScope={dataScope}
                setDataScope={setDataScope}
                onLogout={() => {
                    window.history.pushState({}, "", "/admin-login");
                    setCurrentPage("adminLogin");
                }}
                onNavigate={handleDashboardNavigate}
                onGoToTenantDashboard={goToTenantOverview}
                onGoToAdminDashboard={goToAdminOverview}
            />
        );
    }

    if (currentPage === "adminDistribution") {
        return (
            <DistributionPage
                lang={lang}
                setLang={setLang}
                t={t}
                dataScope={dataScope}
                setDataScope={setDataScope}
                onLogout={() => {
                    window.history.pushState({}, "", "/admin-login");
                    setCurrentPage("adminLogin");
                }}
                onNavigate={handleDashboardNavigate}
                onGoToTenantDashboard={goToTenantOverview}
                onGoToAdminDashboard={goToAdminOverview}
            />
        );
    }

    if (currentPage === "adminCorrelation") {
        return (
            <CorrelationPage
                lang={lang}
                setLang={setLang}
                t={t}
                dataScope={dataScope}
                setDataScope={setDataScope}
                onLogout={() => {
                    window.history.pushState({}, "", "/admin-login");
                    setCurrentPage("adminLogin");
                }}
                onNavigate={handleDashboardNavigate}
                onGoToTenantDashboard={goToTenantOverview}
                onGoToAdminDashboard={goToAdminOverview}
            />
        );
    }

    if (currentPage === "adminClassification") {
        return (
            <ClassificationPage
                lang={lang}
                setLang={setLang}
                t={t}
                dataScope={dataScope}
                setDataScope={setDataScope}
                onLogout={() => {
                    window.history.pushState({}, "", "/admin-login");
                    setCurrentPage("adminLogin");
                }}
                onNavigate={handleDashboardNavigate}
                onGoToTenantDashboard={goToTenantOverview}
                onGoToAdminDashboard={goToAdminOverview}
            />
        );
    }

    if (currentPage === "adminHeatmap") {
        return (
            <RegionalHeatmapPage
                lang={lang}
                setLang={setLang}
                t={t}
                dataScope={dataScope}
                setDataScope={setDataScope}
                onLogout={() => {
                    window.history.pushState({}, "", "/admin-login");
                    setCurrentPage("adminLogin");
                }}
                onNavigate={handleDashboardNavigate}
                onGoToTenantDashboard={goToTenantOverview}
                onGoToAdminDashboard={goToAdminOverview}
            />
        );
    }

    if (currentPage === "adminDecisionTree") {
        return (
            <DecisionTreePage
                lang={lang}
                setLang={setLang}
                t={t}
                dataScope={dataScope}
                setDataScope={setDataScope}
                onLogout={() => {
                    window.history.pushState({}, "", "/admin-login");
                    setCurrentPage("adminLogin");
                }}
                onNavigate={handleDashboardNavigate}
                onGoToTenantDashboard={goToTenantOverview}
                onGoToAdminDashboard={goToAdminOverview}
            />
        );
    }

    if (currentPage === "tenantOverview") {
        return (
            <TenantOverviewPage
                lang={lang}
                setLang={setLang}
                t={t}
                onLogout={() => {
                    window.history.pushState({}, "", "/admin-login");
                    setCurrentPage("adminLogin");
                }}
                onNavigate={handleTenantNavigate}
                onGoToTenantDashboard={goToTenantOverview}
                onGoToAdminDashboard={goToAdminOverview}
            />
        );
    }

    if (currentPage === "adminForgotPassword") {
        return (
            <AdminForgotPassword
                lang={lang}
                setLang={setLang}
                t={t}
                onGoToAdminLogin={() => {
                    window.history.pushState({}, "", "/admin-login");
                    setCurrentPage("adminLogin");
                }}
            />
        );
    }

    if (currentPage === "surveyConsent") {
        return (
            <SurveyConsent
                lang={lang}
                setLang={setLang}
                t={t}
                onContinue={() => setCurrentPage("demographic")}
                onLogout={() => setCurrentPage("login")}
                onGoToResults={() => {
                    setSelectedResponseId(null);
                    setCurrentPage("studentReport");
                }}
                onGoToHistory={() => setCurrentPage("surveyHistory")}
            />
        );
    }

    if (currentPage === "demographic") {
        return (
            <Demographics
                lang={lang}
                setLang={setLang}
                t={t}
                onNext={() => setCurrentPage("ratingQuestions")}
                onLogout={() => setCurrentPage("login")}
                onGoToResults={() => {
                    setSelectedResponseId(null);
                    setCurrentPage("studentReport");
                }}
                onGoToHistory={() => setCurrentPage("surveyHistory")}
            />
        );
    }

    if (currentPage === "ratingQuestions") {
        return (
            <RatingQuestions
                lang={lang}
                setLang={setLang}
                t={t}
                onBack={() => setCurrentPage("demographic")}
                onNext={() => {
                    setSelectedResponseId(null);
                    setCurrentPage("studentReport");
                }}
                onLogout={() => setCurrentPage("login")}
                onGoToResults={() => {
                    setSelectedResponseId(null);
                    setCurrentPage("studentReport");
                }}
                onGoToHistory={() => setCurrentPage("surveyHistory")}
            />
        );
    }

    if (currentPage === "studentReport") {
        return (
            <StudentReport
                lang={lang}
                setLang={setLang}
                t={t}
                responseId={selectedResponseId}
                onGoToSurvey={() => setCurrentPage("surveyConsent")}
                onGoToHistory={() => setCurrentPage("surveyHistory")}
                onGoToLatest={() => setSelectedResponseId(null)}
                onLogout={() => setCurrentPage("login")}
            />
        );
    }

    if (currentPage === "surveyHistory") {
        return (
            <SurveyHistory
                lang={lang}
                setLang={setLang}
                t={t}
                onGoToSurvey={() => setCurrentPage("surveyConsent")}
                onGoToResults={() => {
                    setSelectedResponseId(null);
                    setCurrentPage("studentReport");
                }}
                onViewResponse={(id) => {
                    setSelectedResponseId(id);
                    setCurrentPage("studentReport");
                }}
                onLogout={() => setCurrentPage("login")}
            />
        );
    }

    if (currentPage === "surveyComplete") {
        return (
            <SurveyComplete
                t={t}
                onBack={() => {
                    try {
                        localStorage.removeItem("goclab_session");
                    } catch { }
                    setCurrentPage("login");
                }}
            />
        );
    }

    return (
        <div className="relative min-h-screen w-full bg-[url('/girisarkaplan.png')] bg-cover bg-center bg-no-repeat bg-fixed">
            {/* İÇERİK */}
            <div className="relative z-10 mx-auto max-w-6xl px-6 pb-16 pt-8">
                {/* HEADER - Dil seçici */}
                <div className="flex justify-end">
                    <LanguageSelector lang={lang} setLang={setLang} t={t} />
                </div>

                {/* BAŞLIK */}
                <div className="mb-14 mt-2 text-center">
                    <p className="text-lg font-semibold text-blue-950 sm:text-xl">
                        {t.welcome}
                    </p>
                    <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-5xl">
                        <span className="text-blue-950">{t.titleLine1}</span>
                        <br />
                        <span className="text-teal-600">{t.titleLine2}</span>
                    </h1>
                </div>

                {/* KARTLAR */}
                <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
                    {/* ÖĞRENCİ KARTI */}
                    <div className="flex flex-col items-center rounded-3xl bg-white p-8 text-center shadow-lg">
                        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                            <GraduationCap className="h-10 w-10 text-green-700" strokeWidth={2} />
                        </div>
                        <h2 className="text-xl font-bold tracking-wide text-green-700">
                            {t.student.title}
                        </h2>
                        <div className="mb-4 mt-2 h-1 w-[12.5rem] rounded-full bg-green-600" />
                        <p className="mb-6 text-sm text-gray-500">{t.student.subtitle}</p>

                        <div className="mb-8 w-full space-y-5 text-left">
                            <div className="flex items-start gap-4 border-b border-gray-100 pb-5">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-100">
                                    <Compass className="h-5 w-5 text-green-700" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-green-700">
                                        {t.student.item1Title}
                                    </h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        {t.student.item1Desc}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-100">
                                    <User className="h-5 w-5 text-green-700" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-green-700">
                                        {t.student.item2Title}
                                    </h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        {t.student.item2Desc}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setCurrentPage("studentLogin")}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 py-3.5 font-semibold text-white transition-colors hover:bg-green-800"
                        >
                            <LogIn className="h-5 w-5" />
                            {t.student.button}
                        </button>

                        <button
                            onClick={() => setCurrentPage("register")}
                            className="mt-4 flex items-center gap-2 text-sm font-medium text-green-700 hover:underline"
                        >
                            <User className="h-4 w-4" />
                            {t.student.register}
                        </button>
                    </div>

                    {/* YÖNETİCİ KARTI */}
                    <div className="flex flex-col items-center rounded-3xl bg-white p-8 text-center shadow-lg">
                        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
                            <Briefcase className="h-10 w-10 text-blue-900" strokeWidth={2} />
                        </div>
                        <h2 className="text-xl font-bold tracking-wide text-blue-900">
                            {t.admin.title}
                        </h2>
                        <div className="mb-4 mt-2 h-1 w-[12.5rem] rounded-full bg-blue-700" />
                        <p className="mb-6 text-sm text-gray-500">{t.admin.subtitle}</p>

                        <div className="mb-8 w-full space-y-5 text-left">
                            <div className="flex items-start gap-4 border-b border-gray-100 pb-5">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100">
                                    <SolidBarChartIcon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-blue-900">
                                        {t.admin.item1Title}
                                    </h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        {t.admin.item1Desc}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100">
                                    <TurkeyMapIcon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-blue-900">
                                        {t.admin.item2Title}
                                    </h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        {t.admin.item2Desc}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                window.history.pushState({}, "", "/admin-login");
                                setCurrentPage("adminLogin");
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-800 py-3.5 font-semibold text-white transition-colors hover:bg-blue-900"
                        >
                            <LogIn className="h-5 w-5" />
                            {t.admin.button}
                        </button>

                        <button
                            onClick={() => {
                                window.history.pushState({}, "", "/kurum-basvuru");
                                setCurrentPage("institutionApply");
                            }}
                            className="mt-4 text-sm font-medium text-blue-700 hover:underline"
                        >
                            {t.admin.institutionFormLink}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
