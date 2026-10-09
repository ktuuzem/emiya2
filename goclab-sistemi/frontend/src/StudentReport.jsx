import { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { toJpeg } from "html-to-image";
import {
  ClipboardList,
  BarChart3,
  History,
  Bell,
  Moon,
  Sun,
  ChevronDown,
  User,
  LogOut,
  Info,
  IdCard,
  Download,
  ShieldCheck,
  Briefcase,
  Share2,
  GraduationCap,
  Landmark,
  Frown,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";
import { LanguageSelector } from "./i18n.jsx";
import GaugeChart from "./components/GaugeChart.jsx";
import ProfileCardModal from "./components/ProfileCardModal.jsx";

const API_BASE_URL = "http://localhost:5000";

// Gosterim sirasi - factorLabels icin t.distributionPage.factorLabels (TR/EN/RO) kullanilir.
const FACTOR_ORDER = ["ekonomik_istihdam", "aile_sosyal", "sosyo_politik", "egitim", "cevresel", "psikolojik", "kulturel"];

const FACTOR_BAR_COLORS = {
  ekonomik_istihdam: "#2563EB",
  egitim: "#16A34A",
  kulturel: "#38BDF8",
  aile_sosyal: "#EC4899",
  psikolojik: "#DC2626",
  sosyo_politik: "#EF4444",
  cevresel: "#F97316",
};

const CLUSTER_ICONS = { K1: Briefcase, K2: Share2, K3: GraduationCap, K4: Landmark, K5: Frown };

const CLASSIFICATION_BADGE_STYLES = {
  Yüksek: { bg: "bg-green-100", text: "text-green-700" },
  Orta: { bg: "bg-orange-100", text: "text-orange-600" },
  Düşük: { bg: "bg-red-100", text: "text-red-600" },
};

export default function StudentReport({ lang, setLang, t, onGoToSurvey, onLogout, onGoToHistory, onGoToLatest, responseId }) {
  const sr = t.studentReportPage;
  const factorLabels = t.distributionPage.factorLabels;
  const [user, setUser] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isProfileCardOpen, setIsProfileCardOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const reportContentRef = useRef(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("goclab_session");
      if (stored) setUser(JSON.parse(stored));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const fetchReport = async () => {
      setIsLoading(true);
      setErrorMessage("");

      const stored = localStorage.getItem("goclab_session");
      const token = stored ? JSON.parse(stored)?.token : null;

      if (!token) {
        setErrorMessage(sr.needLoginError);
        setIsLoading(false);
        return;
      }

      try {
        const url = responseId
          ? `${API_BASE_URL}/api/student-report?responseId=${responseId}`
          : `${API_BASE_URL}/api/student-report`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          setErrorMessage(data.message || sr.fetchError);
          return;
        }

        setReport(data);
      } catch {
        setErrorMessage(sr.networkError);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReport();
  }, [responseId, sr]);

  const displayName = user?.first_name
    ? `${user.first_name} ${user?.last_name ? user.last_name.charAt(0).toUpperCase() + "." : ""}`.trim()
    : sr.defaultName;
  const avatarInitials = (user?.first_name?.charAt(0) ?? "") + (user?.last_name?.charAt(0) ?? "");

  const handleDownloadPdf = async () => {
    if (!reportContentRef.current || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      const dataUrl = await toJpeg(reportContentRef.current, {
        backgroundColor: "#F9FAFB",
        pixelRatio: 2,
        quality: 0.92,
      });

      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = dataUrl;
      });

      const pdf = new jsPDF({ orientation: "p", unit: "px", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;
      const imgHeight = (image.naturalHeight / image.naturalWidth) * usableWidth;

      let heightLeft = imgHeight;
      let position = margin;
      pdf.addImage(dataUrl, "JPEG", margin, position, usableWidth, imgHeight);
      heightLeft -= usableHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(dataUrl, "JPEG", margin, position, usableWidth, imgHeight);
        heightLeft -= usableHeight;
      }

      const dateSuffix = new Date().toISOString().slice(0, 10);
      pdf.save(`goc-raporu-${dateSuffix}.pdf`);
    } catch {
      setErrorMessage(sr.pdfError);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("goclab_session");
    } catch {}
    setIsDropdownOpen(false);
    onLogout?.();
  };

  const comparisonData = report
    ? [
        { name: sr.ownLabel, shortName: sr.ownShort, value: report.comparison.own ?? 0, color: "#16A34A" },
        { name: sr.institutionLabel, shortName: sr.institutionShort, value: report.comparison.institution ?? 0, color: "#2563EB" },
        { name: sr.nationalLabel, shortName: sr.nationalShort, value: report.comparison.national ?? 0, color: "#F97316" },
      ]
    : [];

  const orderedFactors = report
    ? FACTOR_ORDER.map((key) => report.factors.find((f) => f.key === key)).filter(Boolean)
    : [];

  const sortedFactors = report ? [...report.factors].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) : [];

  const ClusterIcon = report?.assignedCluster ? CLUSTER_ICONS[report.assignedCluster] ?? Briefcase : Briefcase;
  const clusterNumber = report?.assignedCluster ? report.assignedCluster.replace("K", "") : null;

  return (
    <div className="min-h-screen w-full bg-gray-50">
      {/* NAVBAR */}
      <nav className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 bg-white px-6 py-3 md:px-10">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onGoToSurvey}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            <ClipboardList size={18} />
            {sr.navSurvey}
          </button>
          <button
            type="button"
            onClick={onGoToLatest}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <BarChart3 size={18} />
            {sr.navResults}
          </button>
          <button
            type="button"
            onClick={onGoToHistory}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            <History size={18} />
            {sr.navHistory}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDropdownOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-sm font-semibold text-white">
                {avatarInitials ? avatarInitials.toUpperCase() : <User size={16} />}
              </div>
              <div className="text-left leading-tight">
                <p className="text-sm font-semibold text-[#001A3F]">{displayName}</p>
                <p className="text-xs text-gray-500">{sr.roleLabel}</p>
              </div>
              <ChevronDown size={16} className="text-gray-400" />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg bg-white py-2 shadow-lg z-50">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <LogOut size={16} />
                  {sr.logout}
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-50"
          >
            <Bell size={18} />
          </button>

          <LanguageSelector lang={lang} setLang={setLang} t={t} />

          <button
            type="button"
            onClick={() => setIsDark((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-50"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </nav>

      <div className="w-full px-4 py-8 md:px-12 lg:px-20 mx-auto">
        {/* BAŞLIK */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal-600">
              <IdCard size={26} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-[#001A3F]">{sr.pageTitle}</h1>
              <p className="text-sm text-gray-500">{sr.pageSubtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsProfileCardOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#001A3F] hover:bg-gray-50"
            >
              <IdCard size={18} />
              {sr.openProfileCard}
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!report || isGeneratingPdf}
              className="flex items-center gap-2 rounded-xl bg-[#001A3F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#00234f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGeneratingPdf ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {isGeneratingPdf ? sr.preparingPdf : sr.downloadPdf}
            </button>
          </div>
        </div>

        {!isLoading && responseId && report?.completedAt && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span>
              {sr.viewingPastPrefix}{" "}
              {new Date(report.completedAt).toLocaleString(sr.dateLocale, { dateStyle: "medium", timeStyle: "short" })}
            </span>
            <button type="button" onClick={onGoToLatest} className="font-semibold text-amber-900 underline underline-offset-2">
              {sr.backToLatest}
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-white p-16 text-gray-400 shadow-sm">
            <Loader2 size={20} className="animate-spin" />
            {sr.loadingReport}
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-sm font-medium text-red-600">{errorMessage}</p>
          </div>
        )}

        {!isLoading && !errorMessage && report && (
          <div ref={reportContentRef}>
            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* GENEL GÖÇ EĞİLİMİ SKORU */}
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="text-lg font-bold text-[#001A3F]">{sr.generalScoreTitle}</h2>
                  <Info size={16} className="text-gray-300" />
                </div>
                <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
                  <div className="flex flex-col items-center">
                    <GaugeChart score={report.generalScore} />
                  </div>
                  <div className="flex-1">
                    <p className="mb-2 text-center text-sm font-semibold text-gray-500 md:text-left">{sr.scoreComparisonLabel}</p>
                    <ResponsiveContainer width="100%" height={190}>
                      <BarChart
                        key={report?.responseId ?? "no-report"}
                        data={comparisonData}
                        margin={{ top: 20, right: 10, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis
                          dataKey="shortName"
                          interval={0}
                          tick={{ fontSize: 12, fill: "#64748B" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94A3B8" }} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{ fill: "rgba(0,0,0,0.03)" }} formatter={(value) => Number(value).toFixed(2)} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={48} isAnimationActive={false}>
                          {comparisonData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                          <LabelList
                            dataKey="value"
                            position="top"
                            formatter={(value) => Number(value).toFixed(2)}
                            style={{ fontSize: 15, fontWeight: 700, fill: "#001A3F" }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                {report.comparison.institution !== null && report.comparison.national !== null && (
                  <div className="mt-2 flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                    <BarChart3 size={16} className="shrink-0 text-teal-600" />
                    {sr.comparisonNoteTemplate
                      .replace("{institution}", (report.comparison.own - report.comparison.institution).toFixed(2))
                      .replace("{national}", (report.comparison.own - report.comparison.national).toFixed(2))}
                  </div>
                )}
              </div>

              {/* GÖÇ NEDENLERİ PUANLARI */}
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-[#001A3F]">{sr.reasonsScoreTitle}</h2>
                <p className="mb-4 text-sm text-gray-400">{sr.reasonsScoreSubtitle}</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs font-semibold uppercase text-gray-400">
                        <th className="pb-2 pr-2">{sr.tableReason}</th>
                        <th className="pb-2 pr-2 text-right">{sr.tableAvgScore}</th>
                        <th className="pb-2 text-right">{sr.tableReasonLevel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderedFactors.map((factor) => {
                        const style = CLASSIFICATION_BADGE_STYLES[factor.classification] ?? CLASSIFICATION_BADGE_STYLES.Düşük;
                        const label = sr.migrationIntentLabels[factor.classification] ?? factor.classification;
                        const isDominant = factor.key === report.topFactorKey;
                        return (
                          <tr key={factor.key} className="border-b border-gray-50 last:border-b-0">
                            <td className="py-3 pr-2 font-semibold text-[#001A3F]">
                              <span className="flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: FACTOR_BAR_COLORS[factor.key] }}
                                />
                                {factorLabels[factor.key]}
                                {isDominant && (
                                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700">
                                    {sr.dominantBadge}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="py-3 pr-2 text-right font-bold text-[#001A3F]">
                              {factor.score !== null ? factor.score.toFixed(1) : "-"}
                            </td>
                            <td className="py-3 text-right">
                              <span className={`rounded-full px-3 py-1 text-xs font-bold ${style.bg} ${style.text}`}>
                                {label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* GÖÇ NEDENLERİ / ETKİLEYEN NEDENLER */}
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-[#001A3F]">{sr.reasonsBarChartTitle}</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={sortedFactors}
                    layout="vertical"
                    margin={{ top: 0, right: 40, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#94A3B8" }} tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="key"
                      tickFormatter={(key) => factorLabels[key]}
                      width={130}
                      tick={{ fontSize: 12, fill: "#334155", fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip cursor={{ fill: "rgba(0,0,0,0.03)" }} formatter={(value) => value.toFixed(1)} />
                    <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={20}>
                      {sortedFactors.map((entry) => (
                        <Cell key={entry.key} fill={FACTOR_BAR_COLORS[entry.key]} />
                      ))}
                      <LabelList dataKey="score" position="right" formatter={(v) => v.toFixed(1)} style={{ fontSize: 12, fontWeight: 700, fill: "#001A3F" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-1 text-center text-xs text-gray-400">{sr.barChartXAxisLabel}</p>
              </div>

              {/* EN BASKIN KÜME SONUCU */}
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="mb-6 text-lg font-bold text-[#001A3F]">{sr.dominantClusterTitle}</h2>
                {report.clusterInfo ? (
                  <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-start md:text-left">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-teal-100 bg-teal-50">
                        <ClusterIcon size={36} className="text-teal-600" />
                      </div>
                      {clusterNumber && (
                        <span className="text-sm font-semibold text-gray-400">{sr.clusterNumberPrefix} {clusterNumber}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="mb-2 inline-block rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-700">
                        {sr.dominantClusterBadge}
                      </span>
                      <h3 className="mb-2 text-lg font-extrabold uppercase leading-snug text-[#001A3F]">
                        {t.kMeansPage.clusters[report.clusterInfo.key] || report.clusterInfo.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-gray-500">
                        {sr.clusterDescriptions[report.clusterInfo.key] || report.clusterInfo.description}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">{sr.noClusterAssignment}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-400">
          <ShieldCheck size={14} className="text-teal-600" />
          {sr.sslFooter}
        </div>
      </div>

      <ProfileCardModal isOpen={isProfileCardOpen} onClose={() => setIsProfileCardOpen(false)} report={report} t={t} />
    </div>
  );
}
