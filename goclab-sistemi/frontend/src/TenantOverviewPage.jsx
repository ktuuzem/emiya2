import { useEffect, useRef, useState } from "react";
import TenantLayout from "./TenantLayout.jsx";
import Overview from "./pages/tenant/Overview.jsx";
import SurveyContent from "./pages/tenant/SurveyContent.jsx";
import GlobalDataView from "./pages/tenant/GlobalDataView.jsx";

const API_BASE_URL = "http://localhost:5000";

const SECTION_KEYS = ["genelBakis", "katilimciAnalizi", "kumeProfilleri", "demografikAnaliz", "bolgeselHarita", "kureselHarita", "bireyselIzleme"];

function scrollToSection(ref) {
  ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function TenantOverviewPage({ lang, setLang, t, onLogout, onNavigate, onGoToTenantDashboard, onGoToAdminDashboard }) {
  const genelBakisRef = useRef(null);
  const katilimciAnaliziRef = useRef(null);
  const kumeProfilleriRef = useRef(null);
  const demografikAnalizRef = useRef(null);
  const bolgeselHaritaRef = useRef(null);
  const kureselHaritaRef = useRef(null);
  const bireyselIzlemeRef = useRef(null);

  const sectionRefs = {
    genelBakis: genelBakisRef,
    katilimciAnalizi: katilimciAnaliziRef,
    kumeProfilleri: kumeProfilleriRef,
    demografikAnaliz: demografikAnalizRef,
    bolgeselHarita: bolgeselHaritaRef,
    kureselHarita: kureselHaritaRef,
    bireyselIzleme: bireyselIzlemeRef,
  };

  const [activeSection, setActiveSection] = useState("genelBakis");
  // 'Anket' sekmesi: ayri bir sayfaya/route'a gitmeden, ayni TenantLayout
  // govdesi icinde Genel Bakis icerigiyle Anket icerigi arasinda gecis yapar.
  const [showSurvey, setShowSurvey] = useState(false);
  const [pendingScrollKey, setPendingScrollKey] = useState(null);

  // 'dashboard': Genel Bakis'in kaydirmali (scrollspy) bolumleri (Genel Bakis,
  // Katilimci Analizi, Kumeler, Demografik, Haritalar, Bireysel Izleme).
  // 'global-data': BUNLARIN TAMAMI GIZLENIR ve yerine SADECE GlobalDataView
  // (Genel Veriler) tam ekran basilir - kurumun kendi verileriyle Turkiye
  // geneli verinin ayni ekranda karismamasi icin kasitli olarak ayri/baskin
  // bir gorunum (Anket/Dashboard geçişiyle ayni desen).
  const [activeView, setActiveView] = useState("dashboard");

  // Yetki Talebi onaylanmis kurumlarda sol menude "Genel Veriler" ogesini
  // gostermek icin canli durumu kontrol eder. Onaysiz/bekleyen/reddedilmis
  // kurumlarda bu oge sidebar'da hic gorunmez.
  const [isGlobalDataApproved, setIsGlobalDataApproved] = useState(false);

  useEffect(() => {
    const checkGlobalDataStatus = async () => {
      try {
        const stored = localStorage.getItem("goclab_admin_session");
        const token = stored ? JSON.parse(stored)?.token : null;
        if (!token) return;
        const res = await fetch(`${API_BASE_URL}/api/permission-requests/my-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setIsGlobalDataApproved(data.globalDataStatus === "approved");
        }
      } catch {
        // Sessizce yok say - "Genel Veriler" ogesi varsayilan olarak gizli kalir.
      }
    };
    checkGlobalDataStatus();
  }, []);

  // Scroll pozisyonuna gore aktif bolgeyi belirler: aktivasyon cizgisinin
  // (viewport'un ustunden 140px) uzerinden gecmis en son bolge aktif sayilir.
  // IntersectionObserver'daki oran tabanli yaklasimin aksine, sayfanin en
  // altindaki (kisa) bolumde de dogru calisir. Sadece 'dashboard' gorunumunde
  // calisir - 'global-data' gorunumunde bu bolumler DOM'da hic yoktur.
  useEffect(() => {
    const ACTIVATION_LINE = 140;
    const handleScroll = () => {
      if (showSurvey || activeView !== "dashboard") return;
      // Sayfa en alta kadar kaydirildiysa (tarayici daha fazla kaydiramiyorsa),
      // son bolumun basi aktivasyon cizgisine hic ulasamayabilir (ozellikle
      // kisa/son bolum icin) - bu durumda son bolumu direkt aktif say.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) {
        setActiveSection(SECTION_KEYS[SECTION_KEYS.length - 1]);
        return;
      }

      let current = SECTION_KEYS[0];
      for (const key of SECTION_KEYS) {
        const el = sectionRefs[key].current;
        if (!el) continue;
        if (el.getBoundingClientRect().top <= ACTIVATION_LINE) {
          current = key;
        }
      }
      setActiveSection(current);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSurvey, activeView]);

  // Anket kapatildiginda VEYA Genel Veriler'den Genel Bakis'a donuldugunde,
  // bekleyen bir sidebar-kaydirma istegi varsa - Genel Bakis DOM'a yeniden
  // monte olduktan sonra - o bolume kaydirir.
  useEffect(() => {
    if (showSurvey || activeView !== "dashboard" || !pendingScrollKey) return;
    const ref = sectionRefs[pendingScrollKey];
    if (ref?.current) {
      setActiveSection(pendingScrollKey);
      scrollToSection(ref);
    }
    setPendingScrollKey(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSurvey, activeView, pendingScrollKey]);

  const handleSidebarNavigate = (key) => {
    // "Genel Veriler": diger tum bilesenleri gizleyip bagimsiz, tam ekran
    // gorunume gecer - normal scrollspy mantigina dahil degildir.
    if (key === "genelVeriler") {
      setShowSurvey(false);
      setActiveView("global-data");
      return;
    }

    const ref = sectionRefs[key];
    if (ref) {
      if (showSurvey || activeView !== "dashboard") {
        setShowSurvey(false);
        setActiveView("dashboard");
        setPendingScrollKey(key);
      } else {
        setActiveSection(key);
        scrollToSection(ref);
      }
      return;
    }
    onNavigate?.(key);
  };

  return (
    <TenantLayout
      lang={lang}
      setLang={setLang}
      t={t}
      activeSidebarItem={activeView === "global-data" ? "genelVeriler" : activeSection}
      activeNavTab={showSurvey ? "survey" : "dashboard"}
      isGlobalDataApproved={isGlobalDataApproved}
      onLogout={onLogout}
      onNavigate={handleSidebarNavigate}
      onGoToSurvey={() => setShowSurvey(true)}
      onGoToTenantDashboard={() => {
        setShowSurvey(false);
        setActiveView("dashboard");
        onGoToTenantDashboard?.();
      }}
      onGoToAdminDashboard={onGoToAdminDashboard}
    >
      {showSurvey ? (
        <SurveyContent t={t} onFinish={() => setShowSurvey(false)} />
      ) : activeView === "global-data" ? (
        <GlobalDataView t={t} />
      ) : (
        <Overview
          t={t}
          lang={lang}
          genelBakisRef={genelBakisRef}
          katilimciAnaliziRef={katilimciAnaliziRef}
          kumeProfilleriRef={kumeProfilleriRef}
          demografikAnalizRef={demografikAnalizRef}
          bolgeselHaritaRef={bolgeselHaritaRef}
          kureselHaritaRef={kureselHaritaRef}
          bireyselIzlemeRef={bireyselIzlemeRef}
        />
      )}
    </TenantLayout>
  );
}
