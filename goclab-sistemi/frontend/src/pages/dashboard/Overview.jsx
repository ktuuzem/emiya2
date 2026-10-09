import { useEffect, useState } from "react";
import {
  Activity,
  HeartPulse,
  BarChart3,
  UserCheck,
  ArrowUp,
  Users2,
} from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";

const API_BASE_URL = "http://localhost:5000";

const FACTOR_COLORS = {
  ekonomik_istihdam: "#4C1D95",
  egitim: "#0D9488",
  aile_sosyal: "#DB2777",
  kulturel: "#65A30D",
  sosyo_politik: "#1D4ED8",
  cevresel: "#0891B2",
  psikolojik: "#EA580C",
};

const CLASSIFICATION_BADGE = {
  "Yüksek": "bg-green-100 text-green-700",
  "Orta": "bg-orange-100 text-orange-600",
  "Düşük": "bg-red-100 text-red-600",
};

const SELECT_FILTERS = [
  { key: "cinsiyet", queryParam: "cinsiyet", optionsKey: "cinsiyet" },
  { key: "yasGrubu", queryParam: "yas_grubu", optionsKey: "yasGrubu" },
  { key: "egitimSeviyesi", queryParam: "egitim_seviyesi", optionsKey: "egitimSeviyesi" },
  { key: "calismaDurumu", queryParam: "calisma_durumu", optionsKey: "calismaDurumu" },
  { key: "ikametYeri", queryParam: "ikamet_yeri", optionsKey: "ikametYeri" },
];

// Moldova'da "İkamet Yeri" alani yok (kod kitapcigi: "ikamet: yalniz Turkiye").
const SELECT_FILTERS_MOLDOVA = SELECT_FILTERS.filter((f) => f.key !== "ikametYeri");

const defaultFiltersFor = (filterList) => filterList.reduce((acc, f) => ({ ...acc, [f.key]: "Hepsi" }), {});
const DEFAULT_FILTERS = defaultFiltersFor(SELECT_FILTERS);

function formatScore(value) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function StatCard({ icon, iconBg, title, value, unit, subtitle, trend }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>{icon}</div>
      </div>
      <p className="flex items-baseline gap-1.5">
        <span className="text-3xl font-extrabold text-[#001A3F]">{value}</span>
        {unit && <span className="text-sm font-medium text-gray-400">{unit}</span>}
      </p>
      {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
      {trend && (
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-green-600">
          <ArrowUp size={12} />
          {trend}
        </p>
      )}
    </div>
  );
}

function getAdminToken() {
  try {
    const stored = localStorage.getItem("goclab_admin_session");
    return stored ? JSON.parse(stored)?.token : null;
  } catch {
    return null;
  }
}

export default function Overview({ t, dataScope = "turkey" }) {
  const ov = t.overviewPage;
  const isMoldova = dataScope === "moldova";
  const activeFilters = isMoldova ? SELECT_FILTERS_MOLDOVA : SELECT_FILTERS;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [filteredResult, setFilteredResult] = useState(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterError, setFilterError] = useState("");

  useEffect(() => {
    const fetchOverview = async () => {
      setLoading(true);
      setErrorMessage("");
      setFilteredResult(null);
      setFilters(defaultFiltersFor(activeFilters));
      try {
        const token = getAdminToken();
        const query = isMoldova ? "?country=md" : "";

        const res = await fetch(`${API_BASE_URL}/api/dashboard-overview${query}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setErrorMessage(json.message || ov.notFound);
          return;
        }
        setData(json);
      } catch {
        setErrorMessage(ov.networkError);
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMoldova]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleFilterApply = async () => {
    setIsFiltering(true);
    setFilterError("");
    try {
      const token = getAdminToken();
      const params = new URLSearchParams();
      if (isMoldova) params.set("country", "md");
      activeFilters.forEach((f) => {
        if (filters[f.key] && filters[f.key] !== "Hepsi") {
          params.set(f.queryParam, filters[f.key]);
        }
      });

      const res = await fetch(`${API_BASE_URL}/api/dashboard-filter?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setFilterError(json.message || ov.filterError);
        return;
      }
      setFilteredResult(json);
    } catch {
      setFilterError(ov.networkError);
    } finally {
      setIsFiltering(false);
    }
  };

  const handleFilterReset = () => {
    setFilters(defaultFiltersFor(activeFilters));
    setFilteredResult(null);
    setFilterError("");
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <p className="text-sm font-medium text-gray-400">{ov.loading}</p>
      </div>
    );
  }

  if (errorMessage || !data) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <p className="text-sm font-medium text-red-500">{errorMessage || ov.notFound}</p>
      </div>
    );
  }

  const factorLabel = (key) => ov.factorLabels[key] || key;
  const classificationLabel = (classification) =>
    classification ? ov.classificationLabels[classification] || classification : "-";

  const radarData = data.factors.map((f) => ({ label: factorLabel(f.key), score: f.score ?? 0 }));
  const activeFactors = filteredResult?.factors ?? data.factors;
  const barData = activeFactors.map((f) => ({ label: factorLabel(f.key), score: f.score ?? 0, key: f.key }));
  const overallAverage = data.migrationIntent.average;
  const filterOptions = data.filterOptions || {};

  return (
    <div className="flex flex-col gap-6">
      {/* ÜST 4 KART */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users2 size={18} className="text-blue-700" />}
          iconBg="bg-blue-100"
          title={ov.totalParticipants.title}
          value={data.totalParticipants}
          unit={ov.totalParticipants.unit}
          subtitle={ov.totalParticipants.subtitle}
        />
        <StatCard
          icon={<HeartPulse size={18} className="text-green-700" />}
          iconBg="bg-green-100"
          title={ov.migrationIntent.title}
          value={formatScore(data.migrationIntent.average)}
          unit="/100"
          subtitle={ov.migrationIntent.subtitle}
        />
        <StatCard
          icon={<BarChart3 size={18} className="text-indigo-700" />}
          iconBg="bg-indigo-100"
          title={ov.topFactor.title}
          value={data.topFactor ? factorLabel(data.topFactor.key) : "-"}
          subtitle={
            data.topFactor
              ? `${ov.topFactor.subtitlePrefix} ${formatScore(data.topFactor.score)} /100`
              : undefined
          }
        />
        <StatCard
          icon={<UserCheck size={18} className="text-red-600" />}
          iconBg="bg-red-100"
          title={ov.highScore.title}
          value={`%${formatScore(data.highScoreStudentPercentage)}`}
          subtitle={ov.highScore.subtitle}
        />
      </div>

      {/* RADAR + PROGRESS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* RADAR CHART */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-[#001A3F]">{ov.radarTitle}</h3>
          <p className="mb-4 text-xs text-gray-400">{ov.radarSubtitle}</p>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData} outerRadius="75%">
              <PolarGrid />
              <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: "#334155" }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar
                name={ov.radarLegend}
                dataKey="score"
                stroke="#4338CA"
                fill="#4338CA"
                fillOpacity={0.15}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => formatScore(value)} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* PROGRESS BARS */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-[#001A3F]">{ov.barsTitle}</h3>
          <p className="mb-4 text-xs text-gray-400">{ov.barsSubtitle}</p>
          <div className="flex flex-col gap-4">
            {data.factors.map((f) => (
              <div key={f.key} className="flex items-center gap-4">
                <div className="w-32 shrink-0 text-sm font-semibold text-[#001A3F]">
                  {factorLabel(f.key)}
                </div>
                <div className="h-2.5 flex-1 rounded-full bg-gray-100">
                  <div
                    className="h-2.5 rounded-full"
                    style={{
                      width: `${Math.max(0, Math.min(100, f.score ?? 0))}%`,
                      backgroundColor: FACTOR_COLORS[f.key] || "#1D4ED8",
                    }}
                  />
                </div>
                <div className="w-12 shrink-0 text-right text-sm font-bold text-[#001A3F]">
                  {formatScore(f.score)}
                </div>
                <span
                  className={`w-16 shrink-0 rounded-full px-2 py-1 text-center text-xs font-bold ${
                    CLASSIFICATION_BADGE[f.classification] || "bg-gray-100 text-gray-500"
                  }`}
                >
                  {classificationLabel(f.classification)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DINAMIK ALT GRUP KIYASLAMA MOTORU (Moldova'da "İkamet Yeri" filtresi
          olmadan, diger 4 filtreyle gosterilir). */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <Activity size={18} className="text-blue-700" />
          <h3 className="text-base font-bold text-[#001A3F]">{ov.subgroupTitle}</h3>
        </div>
        <p className="mb-4 text-xs text-gray-400">{ov.subgroupSubtitle}</p>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* SOL: FİLTRELER */}
          <div className="lg:col-span-1">
            <div className="grid grid-cols-2 gap-3">
              {activeFilters.map((filter) => (
                <div key={filter.key} className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold tracking-wide text-gray-400">
                    {ov.filterLabels[filter.key]}
                  </label>
                  <select
                    value={filters[filter.key] || "Hepsi"}
                    onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="Hepsi">{ov.hepsi}</option>
                    {(filterOptions[filter.optionsKey] || []).map((opt) => (
                      <option key={opt} value={opt}>
                        {ov.optionLabels?.[filter.optionsKey]?.[opt] || opt}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleFilterApply}
                disabled={isFiltering}
                className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {isFiltering ? ov.filteringButton : ov.filterButton}
              </button>
              <button
                type="button"
                onClick={handleFilterReset}
                className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50"
              >
                {ov.resetButton}
              </button>
              {filteredResult && (
                <span className="text-xs font-medium text-gray-500">
                  {ov.filteredCountLabel} {filteredResult.totalParticipants}
                </span>
              )}
              {filterError && <span className="text-xs font-medium text-red-500">{filterError}</span>}
            </div>
          </div>

          {/* SAĞ: GRAFİK */}
          <div className="lg:col-span-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-[#001A3F]">{ov.barChartTitle}</p>
              <p className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="h-0 w-4 border-t-2 border-dashed border-indigo-400" />
                {ov.overallAverageLabel} ({formatScore(overallAverage)})
              </p>
            </div>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#334155" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => formatScore(value)} />
                {overallAverage !== null && (
                  <ReferenceLine y={overallAverage} stroke="#6366F1" strokeDasharray="4 4" />
                )}
                <Bar dataKey="score" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
