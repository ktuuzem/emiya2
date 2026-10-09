import { useEffect, useState } from "react";
import {
  Users,
  Search,
  Target,
  Landmark,
  Wallet,
  Shield,
  Globe2,
  Leaf,
  Diamond,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { REGION_ORDER } from "../dashboard/turkeyRegions.js";

const API_BASE_URL = "http://localhost:5000";

// Bu panele ozgu 7 skor: Genel Bakis'taki 7 faktorden farkli olarak "Egitim"
// yerine "Genel Goc Niyeti" iceren, kullanicinin acikca belirttigi liste.
const FACTOR_ORDER = ["goc_niyeti", "sosyo_politik", "ekonomik_istihdam", "aile_sosyal", "psikolojik", "kulturel", "cevresel"];

const FACTOR_ICONS = {
  goc_niyeti: Target,
  sosyo_politik: Landmark,
  ekonomik_istihdam: Wallet,
  aile_sosyal: Users,
  psikolojik: Shield,
  kulturel: Globe2,
  cevresel: Leaf,
};

const AGE_OPTIONS = Array.from({ length: 30 - 18 + 1 }, (_, i) => String(18 + i));
const EDUCATION_OPTIONS = ["İlköğretim", "Lise", "Meslek Yüksekokulu", "Lisans", "Yüksek Lisans", "Doktora", "Diğer"];
const EMPLOYMENT_OPTIONS = [
  "Şu anda çalışıyorum (tam zamanlı veya yarı zamanlı)",
  "Daha önce çalıştım ama şu anda çalışmıyorum",
  "Hiç çalışmadım",
  "Öğrenciyim",
];

const EMPTY_FILTERS = { gender: "", age: "", region: "", educationLevel: "", employmentStatus: "" };

function classifyScore(score) {
  if (score === null || score === undefined) return null;
  if (score <= 33) return "Düşük";
  if (score <= 66) return "Orta";
  return "Yüksek";
}

function TopDot({ x, y, width }) {
  if (x === undefined || y === undefined || width === undefined) return null;
  const cx = x + width / 2;
  return <circle cx={cx} cy={y} r={5} fill="#ffffff" stroke="#2563EB" strokeWidth={2.5} />;
}

function CustomTick({ x, y, payload, factorLabels }) {
  const Icon = FACTOR_ICONS[payload.value];
  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject x={-10} y={6} width={20} height={20}>
        <div className="flex h-full w-full items-center justify-center text-gray-400">
          {Icon && <Icon size={14} />}
        </div>
      </foreignObject>
      <text x={0} y={40} textAnchor="middle" fontSize={11} fontWeight={600} fill="#334155">
        {factorLabels[payload.value]}
      </text>
    </g>
  );
}

const selectClasses =
  "w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";

export default function ParticipantAnalysis({ t, referenceScore }) {
  const pa = t.participantAnalysisPage;
  const classificationLabels = t.overviewPage.classificationLabels;

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const regionLabels = t.regionalHeatmapPage?.regions ?? {};

  useEffect(() => {
    const fetchAnalysis = async () => {
      const stored = localStorage.getItem("goclab_admin_session");
      const token = stored ? JSON.parse(stored)?.token : null;

      if (!token) {
        setErrorMessage(pa.authRequiredError);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.set(key, value);
        });

        const res = await fetch(`${API_BASE_URL}/api/tenant/participant-analysis?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          setErrorMessage(data.message || pa.loadError);
          return;
        }

        setAnalysis(data);
        setErrorMessage("");
      } catch {
        setErrorMessage(pa.networkError);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const hasActiveFilter = Object.values(filters).some((v) => v);

  const chartData = FACTOR_ORDER.map((key) => ({
    key,
    score: analysis?.factorAverages?.[key] ?? 0,
  }));

  const classification = classifyScore(analysis?.averageGeneralScore);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600">
          <Users size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#001A3F]">{pa.panelTitle}</h2>
          <p className="text-xs text-gray-400">{pa.panelSubtitle}</p>
        </div>
      </div>

      <div className="flex flex-col gap-6 xl:flex-row">
        {/* GRAFİK */}
        <div className="flex-1 rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold tracking-wide text-[#001A3F]">
              <Users size={16} className="text-blue-600" />
              {pa.engineTitle}
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-500">{pa.comparisonSubtitle}</p>
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
              {pa.legendLabel}
            </div>
          </div>

          {isLoading ? (
            <div className="flex h-[340px] items-center justify-center gap-2 text-gray-400">
              <Loader2 size={20} className="animate-spin" />
              {pa.loadingLabel}
            </div>
          ) : errorMessage ? (
            <div className="flex h-[340px] items-center justify-center text-sm font-medium text-red-600">{errorMessage}</div>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 40, left: 0 }}>
                <defs>
                  <linearGradient id="participantBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#FFFFFF" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="key"
                  tick={(props) => <CustomTick {...props} factorLabels={pa.factorLabels} />}
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                  interval={0}
                  height={50}
                />
                <YAxis domain={[0, 100]} ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => [value, t.tenantOverviewPage.scoreTooltipLabel]} labelFormatter={(key) => pa.factorLabels[key]} />
                {referenceScore !== null && referenceScore !== undefined && (
                  <ReferenceLine
                    y={referenceScore}
                    stroke="#2563EB"
                    strokeDasharray="3 3"
                    label={{ value: String(referenceScore), position: "right", fill: "#2563EB", fontSize: 11, fontWeight: 700 }}
                  />
                )}
                <Bar dataKey="score" fill="url(#participantBarGradient)" radius={[8, 8, 0, 0]} barSize={44} isAnimationActive={false}>
                  <LabelList dataKey="score" content={<TopDot />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          <p className="mt-4 rounded-lg bg-gray-50 px-4 py-2.5 text-center text-xs font-medium text-gray-400">
            {t.tenantOverviewPage.filterHint}
          </p>
        </div>

        {/* FİLTRE PANELİ */}
        <div className="w-full shrink-0 rounded-2xl bg-white p-5 shadow-sm xl:w-96">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-[#001A3F]">{pa.viewSelectionTitle}</p>

          <div className="mb-4 flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-500">
            <Search size={16} className="shrink-0 text-gray-400" />
            <span className="truncate">
              {hasActiveFilter ? pa.filteredViewLabel : pa.allSampleLabel}
            </span>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700">
              <Diamond size={12} />
              {hasActiveFilter ? pa.filteredGroupLabel : pa.allSampleBadgeLabel}
            </span>
            <span className="flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-600">
              {pa.personAverageTemplate
                .replace("{count}", analysis?.totalParticipants ?? 0)
                .replace("{score}", analysis?.averageGeneralScore ?? "-")}
              {classification && <span className="ml-1 text-orange-700">{classificationLabels[classification] || classification}</span>}
            </span>
          </div>

          <p className="mb-3 text-sm font-bold text-[#001A3F]">{pa.comparisonSubtitle}</p>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">{pa.genderLabel}</label>
                <select
                  value={filters.gender}
                  onChange={(e) => updateFilter("gender", e.target.value)}
                  className={selectClasses}
                >
                  <option value="">{pa.allOptionLabel}</option>
                  <option value="Kadın">{pa.femaleLabel}</option>
                  <option value="Erkek">{pa.maleLabel}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">{pa.ageGroupLabel}</label>
                <select
                  value={filters.age}
                  onChange={(e) => updateFilter("age", e.target.value)}
                  className={selectClasses}
                >
                  <option value="">{pa.allOptionLabel}</option>
                  {AGE_OPTIONS.map((age) => (
                    <option key={age} value={age}>
                      {age}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-gray-500">
                  {pa.regionLabel} <span className="font-normal text-gray-400">{pa.regionHint}</span>
                </label>
                <select
                  value={filters.region}
                  onChange={(e) => updateFilter("region", e.target.value)}
                  className={selectClasses}
                >
                  <option value="">{pa.allOptionLabel}</option>
                  {REGION_ORDER.map((key) => (
                    <option key={key} value={key}>
                      {regionLabels[key] ?? key}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">{pa.educationLevelLabel}</label>
                <select
                  value={filters.educationLevel}
                  onChange={(e) => updateFilter("educationLevel", e.target.value)}
                  className={selectClasses}
                >
                  <option value="">{pa.allOptionLabel}</option>
                  {EDUCATION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {pa.educationOptions[opt] || opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">{pa.employmentLabel}</label>
              <select
                value={filters.employmentStatus}
                onChange={(e) => updateFilter("employmentStatus", e.target.value)}
                className={selectClasses}
              >
                <option value="">{pa.allOptionLabel}</option>
                {EMPLOYMENT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {pa.employmentOptions[opt] || opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700">
            <Diamond size={12} />
            {pa.generalMigrationAvgLabel} {referenceScore ?? "-"}
          </div>
        </div>
      </div>
    </div>
  );
}
