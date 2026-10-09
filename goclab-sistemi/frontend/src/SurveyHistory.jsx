import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  BarChart3,
  History,
  Bell,
  Moon,
  Sun,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Search,
  CalendarRange,
  Download,
  Info,
  Loader2,
  Zap,
  Share2,
  GraduationCap,
  Landmark,
  Frown,
} from "lucide-react";
import { LanguageSelector } from "./i18n.jsx";
import GaugeChart from "./components/GaugeChart.jsx";

const API_BASE_URL = "http://localhost:5000";

const CLUSTER_ICONS = { K1: Zap, K2: Share2, K3: GraduationCap, K4: Landmark, K5: Frown };

function classifyScore(score) {
  if (score === null || score === undefined) return null;
  if (score <= 33) return "Düşük";
  if (score <= 66) return "Orta";
  return "Yüksek";
}

const CLASSIFICATION_BUTTON_STYLES = {
  Yüksek: "border-green-600 text-green-700 hover:bg-green-50",
  Orta: "border-amber-500 text-amber-600 hover:bg-amber-50",
  Düşük: "border-red-500 text-red-600 hover:bg-red-50",
};

function formatDate(iso, locale) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "medium" });
}

function formatDateOnly(iso, locale) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

function toCsvValue(value) {
  const str = String(value ?? "");
  return `"${str.replace(/"/g, '""')}"`;
}

function exportToCsv(items, header, locale, clusterTitleFor) {
  const rows = items.map((it) => [
    it.surveyNumber,
    it.generalScore,
    it.assignedCluster ?? "",
    it.assignedCluster ? clusterTitleFor(it) : "",
    formatDate(it.completedAt, locale),
  ]);
  const csv = [header, ...rows].map((row) => row.map(toCsvValue).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "anket-gecmisim.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function SurveyHistory({ lang, setLang, t, onGoToSurvey, onGoToResults, onLogout, onViewResponse }) {
  const sh = t.surveyHistoryPage;
  const sr = t.studentReportPage;
  const classificationLabels = t.overviewPage.classificationLabels;
  const clusterTitleFor = (item) => (item.assignedCluster ? t.kMeansPage.clusters[item.assignedCluster] || item.clusterInfo?.title : item.clusterInfo?.title);
  const [user, setUser] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [history, setHistory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tümü");
  const [clusterFilter, setClusterFilter] = useState("Tümü");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("goclab_session");
      if (stored) setUser(JSON.parse(stored));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      const stored = localStorage.getItem("goclab_session");
      const token = stored ? JSON.parse(stored)?.token : null;

      if (!token) {
        setErrorMessage(sh.needLoginError);
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/api/student/survey-history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          setErrorMessage(data.message || sh.fetchError);
          return;
        }

        setHistory(data);
      } catch {
        setErrorMessage(sh.networkError);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [sh]);

  const displayName = user?.first_name
    ? `${user.first_name} ${user?.last_name ? user.last_name.charAt(0).toUpperCase() + "." : ""}`.trim()
    : sr.defaultName;
  const avatarInitials = (user?.first_name?.charAt(0) ?? "") + (user?.last_name?.charAt(0) ?? "");

  const handleLogout = () => {
    try {
      localStorage.removeItem("goclab_session");
    } catch {}
    setIsDropdownOpen(false);
    onLogout?.();
  };

  // En yeni en ustte gelen liste, kronolojik (en eski=1) anket numarasi ile zenginlestirilir.
  const numberedItems = useMemo(() => {
    if (!history) return [];
    const total = history.items.length;
    return history.items.map((it, idx) => ({
      ...it,
      surveyNumber: total - idx,
      classification: classifyScore(it.generalScore),
    }));
  }, [history]);

  const filteredItems = useMemo(() => {
    return numberedItems.filter((it) => {
      if (statusFilter !== "Tümü" && it.classification !== statusFilter) return false;
      if (clusterFilter !== "Tümü" && it.assignedCluster !== clusterFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const haystack = `${sh.surveyNumberPrefix} #${it.surveyNumber} ${clusterTitleFor(it) ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (dateFrom && new Date(it.completedAt) < new Date(dateFrom)) return false;
      if (dateTo && new Date(it.completedAt) > new Date(`${dateTo}T23:59:59`)) return false;
      return true;
    });
  }, [numberedItems, statusFilter, clusterFilter, searchTerm, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("Tümü");
    setClusterFilter("Tümü");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

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
            onClick={onGoToResults}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            <BarChart3 size={18} />
            {sr.navResults}
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
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
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal-50">
            <RotateCcw size={26} className="text-teal-600" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-[#001A3F]">{sh.pageTitle}</h1>
            <p className="text-sm text-gray-500">{sh.pageSubtitle}</p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-white p-16 text-gray-400 shadow-sm">
            <Loader2 size={20} className="animate-spin" />
            {sh.loadingHistory}
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-sm font-medium text-red-600">{errorMessage}</p>
          </div>
        )}

        {!isLoading && !errorMessage && history && (
          <>
            {/* ÖZET KARTLARI */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal-50">
                  <ClipboardList size={24} className="text-teal-600" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-[#001A3F]">{history.summary.totalSurveys}</p>
                  <p className="text-sm font-semibold text-[#001A3F]">{sh.totalSurveysLabel}</p>
                  <p className="text-xs text-gray-400">{sh.totalSurveysDesc}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-green-50">
                  <TrendingUp size={24} className="text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-[#001A3F]">
                    {history.summary.averageScore ?? "-"}
                  </p>
                  <p className="text-sm font-semibold text-[#001A3F]">{sh.avgScoreLabel}</p>
                  <p className="text-xs text-gray-400">{sh.avgScoreDesc}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-orange-50">
                  <TrendingUp size={24} className="text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-[#001A3F]">{history.summary.highest?.score ?? "-"}</p>
                  <p className="text-sm font-semibold text-[#001A3F]">{sh.highestScoreLabel}</p>
                  <p className="text-xs text-gray-400">
                    {history.summary.highest
                      ? sh.onDateTemplate.replace("{date}", formatDateOnly(history.summary.highest.date, sr.dateLocale))
                      : "-"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-50">
                  <TrendingDown size={24} className="text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-[#001A3F]">{history.summary.lowest?.score ?? "-"}</p>
                  <p className="text-sm font-semibold text-[#001A3F]">{sh.lowestScoreLabel}</p>
                  <p className="text-xs text-gray-400">
                    {history.summary.lowest
                      ? sh.onDateTemplate.replace("{date}", formatDateOnly(history.summary.lowest.date, sr.dateLocale))
                      : "-"}
                  </p>
                </div>
              </div>
            </div>

            {/* ARAMA + FILTRE */}
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <div className="relative min-w-[200px] flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  placeholder={sh.searchPlaceholder}
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                <option value="Tümü">{sh.statusAllOption}</option>
                <option value="Yüksek">{classificationLabels["Yüksek"]}</option>
                <option value="Orta">{classificationLabels["Orta"]}</option>
                <option value="Düşük">{classificationLabels["Düşük"]}</option>
              </select>

              <select
                value={clusterFilter}
                onChange={(e) => {
                  setClusterFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                <option value="Tümü">{sh.clusterAllOption}</option>
                <option value="K1">{sr.clusterNumberPrefix} 1</option>
                <option value="K2">{sr.clusterNumberPrefix} 2</option>
                <option value="K3">{sr.clusterNumberPrefix} 3</option>
                <option value="K4">{sr.clusterNumberPrefix} 4</option>
                <option value="K5">{sr.clusterNumberPrefix} 5</option>
              </select>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDateRangeOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  <CalendarRange size={16} />
                  {dateFrom || dateTo ? `${dateFrom || "…"} – ${dateTo || "…"}` : sh.dateRangeButton}
                </button>
                {isDateRangeOpen && (
                  <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-gray-100 bg-white p-4 shadow-lg">
                    <label className="mb-1 block text-xs font-semibold text-gray-500">{sh.dateRangeStart}</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setPage(1);
                      }}
                      className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <label className="mb-1 block text-xs font-semibold text-gray-500">{sh.dateRangeEnd}</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        setPage(1);
                      }}
                      className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setIsDateRangeOpen(false)}
                      className="w-full rounded-lg bg-teal-600 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                    >
                      {sh.applyButton}
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => exportToCsv(filteredItems, sh.csvHeaders, sr.dateLocale, clusterTitleFor)}
                disabled={filteredItems.length === 0}
                className="flex items-center gap-2 rounded-xl border border-teal-600 px-4 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download size={16} />
                {sh.exportButton}
              </button>
            </div>

            {/* LISTE */}
            {filteredItems.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
                <p className="text-sm text-gray-400">{sh.noResultsText}</p>
                <button type="button" onClick={resetFilters} className="mt-2 text-sm font-semibold text-teal-600 hover:underline">
                  {sh.clearFiltersLink}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {pageItems.map((item) => {
                  const ClusterIcon = item.assignedCluster ? CLUSTER_ICONS[item.assignedCluster] ?? Zap : Zap;
                  const color = item.clusterInfo?.color ?? "#64748B";
                  const buttonStyle = CLASSIFICATION_BUTTON_STYLES[item.classification] ?? CLASSIFICATION_BUTTON_STYLES.Orta;

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm md:flex-row md:items-center"
                      style={{ borderLeft: `5px solid ${color}` }}
                    >
                      <div className="flex items-center gap-3 md:w-40 md:shrink-0">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${color}1A` }}
                        >
                          <ClusterIcon size={20} style={{ color }} />
                        </div>
                        <p className="text-base font-extrabold text-[#001A3F]">{sh.surveyNumberPrefix} #{item.surveyNumber}</p>
                      </div>

                      <div className="flex shrink-0 items-center justify-center md:w-32">
                        <GaugeChart score={item.generalScore} size="mini" />
                      </div>

                      <div className="shrink-0 md:w-40">
                        {item.assignedCluster && (
                          <span
                            className="mb-1.5 inline-block rounded-full px-2.5 py-1 text-xs font-bold"
                            style={{ backgroundColor: `${color}1A`, color }}
                          >
                            {sr.clusterNumberPrefix} {item.assignedCluster.replace("K", "")}
                          </span>
                        )}
                        <p className="text-sm font-bold leading-snug text-[#001A3F]">{clusterTitleFor(item)}</p>
                      </div>

                      <ul className="flex-1 space-y-1 text-sm text-gray-600">
                        {(item.assignedCluster ? sr.clusterSummaryBullets[item.assignedCluster] ?? item.clusterInfo?.summaryBullets ?? [] : []).map((bullet, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
                            {bullet}
                          </li>
                        ))}
                      </ul>

                      <div className="flex shrink-0 flex-col items-start gap-3 md:w-56 md:items-end">
                        <p className="flex items-center gap-1.5 text-xs text-gray-400">
                          <CalendarRange size={13} />
                          {formatDate(item.completedAt, sr.dateLocale)}
                        </p>
                        <button
                          type="button"
                          onClick={() => onViewResponse?.(item.id)}
                          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${buttonStyle}`}
                        >
                          {sh.viewResultButton}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* SAYFALAMA */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-5 py-3 shadow-sm">
              <p className="text-sm text-gray-500">
                {filteredItems.length === 0
                  ? sh.showingZero
                  : sh.showingRangeTemplate
                      .replace("{from}", (currentPage - 1) * pageSize + 1)
                      .replace("{to}", Math.min(currentPage * pageSize, filteredItems.length))
                      .replace("{total}", filteredItems.length)}
              </p>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold ${
                      p === currentPage ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500">
                {sh.perPageLabel}
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-700 focus:border-teal-600 focus:outline-none"
                >
                  {[5, 10, 20].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* BILGILENDIRME */}
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">
              <Info size={18} className="mt-0.5 shrink-0 text-blue-600" />
              <div>
                <p className="font-bold">{sh.infoTitle}</p>
                <p className="text-blue-800">{sh.infoText}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
