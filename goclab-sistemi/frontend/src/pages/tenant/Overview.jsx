import { useEffect, useMemo, useState } from "react";
import { Users, Activity, UserCheck, Briefcase, Share2, GraduationCap, Landmark, Frown, Info, BarChart3, X } from "lucide-react";
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import RegionalMap from "./RegionalMap.jsx";
import GlobalMap from "./GlobalMap.jsx";
import ParticipantAnalysis from "./ParticipantAnalysis.jsx";
import { PROVINCE_TO_REGION, REGION_ORDER } from "../dashboard/turkeyRegions.js";

const API_BASE_URL = "http://localhost:5000";

const FACTOR_ORDER = ["ekonomik_istihdam", "aile_sosyal", "sosyo_politik", "egitim", "cevresel", "psikolojik", "kulturel"];

const FACTOR_ICONS = {
  ekonomik_istihdam: "💰",
  aile_sosyal: "👥",
  sosyo_politik: "🏛️",
  egitim: "🎓",
  cevresel: "🍃",
  psikolojik: "😟",
  kulturel: "⚖️",
};

const CLUSTER_KEYS = ["K1", "K2", "K3", "K4", "K5"];

// Kume Profilleri bolumunun sunum-katmani (renk/ikon) sabitleri; sayisal
// veriler (count/percentage/dominantFactorKey/radar) API'den gelir. Renkler
// bu sayfaya ozgudur ve Yonetici panelindeki K-Means renk paletinden
// farklidir (kullanici talebi).
const CLUSTER_PRESENTATION = {
  K1: { color: "#16A34A", icon: Briefcase },
  K2: { color: "#2563EB", icon: Share2 },
  K3: { color: "#7C3AED", icon: GraduationCap },
  K4: { color: "#DC2626", icon: Landmark },
  K5: { color: "#EA580C", icon: Frown },
};

const EDUCATION_ORDER = ["İlköğretim", "Lise", "Meslek Yüksekokulu", "Lisans", "Yüksek Lisans", "Doktora", "Diğer"];

const FILTER_OPTIONS = ["gender", "age", "education", "region"];

// Katilimcilarin (gercek, kuruma ait) ham demografik listesinden, secilen
// filtreye gore kume (K1-K5) kirilimli yigilmis bar-grafik verisi uretir.
// Eksik/bos deger tasiyan katilimcilar ilgili kirilimda atlanir (veri uydurulmaz).
function buildDemographicBreakdown(participants, filterKey, regionLabels) {
  const buckets = new Map();

  const ensureBucket = (name) => {
    if (!buckets.has(name)) {
      buckets.set(name, { name, K1: 0, K2: 0, K3: 0, K4: 0, K5: 0 });
    }
    return buckets.get(name);
  };

  for (const p of participants) {
    let bucketName = null;
    if (filterKey === "gender") bucketName = p.gender || null;
    else if (filterKey === "age") bucketName = p.age !== null && p.age !== undefined ? String(p.age) : null;
    else if (filterKey === "education") bucketName = p.educationLevel || null;
    else if (filterKey === "region") bucketName = p.province ? PROVINCE_TO_REGION[p.province] || null : null;

    if (!bucketName) continue;

    const bucket = ensureBucket(bucketName);
    if (p.assignedCluster && bucket[p.assignedCluster] !== undefined) {
      bucket[p.assignedCluster] += 1;
    }
  }

  if (filterKey === "age") {
    return Array.from(buckets.values()).sort((a, b) => Number(a.name) - Number(b.name));
  }
  if (filterKey === "education") {
    return Array.from(buckets.values()).sort(
      (a, b) => EDUCATION_ORDER.indexOf(a.name) - EDUCATION_ORDER.indexOf(b.name)
    );
  }
  if (filterKey === "region") {
    return Array.from(buckets.entries())
      .sort(([a], [b]) => REGION_ORDER.indexOf(a) - REGION_ORDER.indexOf(b))
      .map(([key, bucket]) => ({ ...bucket, name: regionLabels[key] ?? key }));
  }
  return Array.from(buckets.values());
}

function TopDot({ x, y, width }) {
  if (x === undefined || y === undefined || width === undefined) return null;
  const cx = x + width / 2;
  return <circle cx={cx} cy={y} r={5} fill="#ffffff" stroke="#2563EB" strokeWidth={2.5} />;
}

function CustomTick({ x, y, payload, factorLabels }) {
  const factorKey = payload.value;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="middle" fontSize={16}>
        {FACTOR_ICONS[factorKey]}
      </text>
      <text x={0} y={0} dy={38} textAnchor="middle" fontSize={11} fontWeight={600} fill="#334155">
        {factorLabels[factorKey]}
      </text>
    </g>
  );
}

function ClusterRadar({ radarValues, color, factorLabels }) {
  const data = FACTOR_ORDER.map((key) => ({ factor: factorLabels[key], value: radarValues[key] }));
  return (
    <ResponsiveContainer width="100%" height={190}>
      <RadarChart data={data} outerRadius="68%" margin={{ top: 4, right: 6, bottom: 4, left: 6 }}>
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis dataKey="factor" tick={{ fontSize: 8, fill: "#64748b" }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 7, fill: "#94a3b8" }} tickCount={5} />
        <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.25} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function ClusterCard({ cluster, tp, factorLabels, clusterLabels, onInfoClick }) {
  const Icon = cluster.icon;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onInfoClick(cluster)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onInfoClick(cluster);
        }
      }}
      className="cursor-pointer rounded-2xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${cluster.color}1A` }}
          >
            <Icon size={16} style={{ color: cluster.color }} />
          </div>
          <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: cluster.color }}>
            {tp.clusterLegendPrefix} {cluster.key.replace("K", "")}
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInfoClick(cluster);
          }}
          className="shrink-0 rounded-full p-0.5 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-500"
        >
          <Info size={14} />
        </button>
      </div>

      <p className="mb-2 min-h-[32px] text-xs font-bold leading-snug text-[#001A3F]">{clusterLabels[cluster.key]}</p>

      <p className="text-2xl font-extrabold" style={{ color: cluster.color }}>
        %{cluster.percentage.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
      </p>
      <p className="mb-3 text-xs text-gray-400">
        {cluster.count} {tp.personSuffix}
      </p>

      <div className="mb-2 rounded-lg bg-gray-50 p-2">
        <p className="mb-1 text-[10px] font-bold text-gray-400">{tp.dominantFactorLabel}</p>
        <div className="flex items-center gap-1.5">
          <Icon size={13} style={{ color: cluster.color }} />
          <p className="text-xs font-bold" style={{ color: cluster.color }}>
            {factorLabels[cluster.dominantFactorKey]}
          </p>
        </div>
      </div>

      <ClusterRadar radarValues={cluster.radar} color={cluster.color} factorLabels={factorLabels} />
    </div>
  );
}

// Kurum verileri API'den gelene kadar gosterilen, gercek sayfa duzenini
// taklit eden Skeleton Loader (Tailwind animate-pulse).
function SkeletonBlock({ className = "", style }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} style={style} />;
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* KPI KARTLARI */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border-l-4 border-l-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <SkeletonBlock className="h-3 w-28" />
              <SkeletonBlock className="h-9 w-9 rounded-xl" />
            </div>
            <SkeletonBlock className="h-8 w-20" />
            {i === 1 && <SkeletonBlock className="mt-4 h-8 w-full rounded-lg" />}
            {i === 2 && <SkeletonBlock className="mt-2 h-3 w-32" />}
          </div>
        ))}
      </div>

      {/* KARSILASTIRMA GRAFIGI */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <SkeletonBlock className="h-4 w-48" />
          <SkeletonBlock className="h-4 w-32" />
        </div>
        <div className="flex h-[300px] items-end gap-4 px-2">
          {[55, 75, 60, 85, 70, 50, 65].map((h, i) => (
            <SkeletonBlock key={i} className="flex-1 rounded-t-lg rounded-b-none" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>

      {/* KUME PROFILLERI */}
      <div className="flex flex-col gap-4">
        <div>
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="mt-2 h-3 w-56" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <SkeletonBlock className="h-8 w-8 rounded-full" />
                <SkeletonBlock className="h-3 w-16" />
              </div>
              <SkeletonBlock className="mb-2 h-4 w-full" />
              <SkeletonBlock className="mb-3 h-7 w-14" />
              <SkeletonBlock className="mb-3 h-10 w-full rounded-lg" />
              <SkeletonBlock className="h-[150px] w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>

      {/* DEMOGRAFIK KIRILIM */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-9 w-9 rounded-xl" />
            <div>
              <SkeletonBlock className="h-4 w-44" />
              <SkeletonBlock className="mt-2 h-3 w-32" />
            </div>
          </div>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonBlock key={i} className="h-7 w-20 rounded-lg" />
            ))}
          </div>
        </div>
        <SkeletonBlock className="h-[260px] w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function Overview({ t, lang, genelBakisRef, katilimciAnaliziRef, kumeProfilleriRef, demografikAnalizRef, bolgeselHaritaRef, kureselHaritaRef, bireyselIzlemeRef }) {
  const tp = t.tenantOverviewPage;
  const factorLabels = t.overviewPage.factorLabels;
  const clusterLabels = t.kMeansPage.clusters;

  const [activeFilter, setActiveFilter] = useState("gender");
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchDashboard = async () => {
      const stored = localStorage.getItem("goclab_admin_session");
      const token = stored ? JSON.parse(stored)?.token : null;

      if (!token) {
        setErrorMessage("Kurum panelini görüntülemek için giriş yapmalısınız.");
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/api/tenant/dashboard-summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          setErrorMessage(data.message || "Kurum verileri alınamadı.");
          return;
        }

        console.log("API'den Gelen Veri:", data);
        setDashboardData(data);
      } catch {
        setErrorMessage("Sunucuya bağlanılamadı.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const clusters = useMemo(
    () => CLUSTER_KEYS.map((key) => {
      const apiCluster = dashboardData?.clusters?.find((c) => c.key === key);
      return { key, count: 0, percentage: 0, dominantFactorKey: "ekonomik_istihdam", radar: {}, ...apiCluster, ...CLUSTER_PRESENTATION[key] };
    }),
    [dashboardData]
  );

  const chartData = FACTOR_ORDER.map((key) => ({
    key,
    score: dashboardData?.factorAverages?.[key] ?? 0,
    label: factorLabels[key],
  }));

  const regionLabels = t.regionalMapPage?.regions ?? {};
  const currentChartData = useMemo(
    () => buildDemographicBreakdown(dashboardData?.participants ?? [], activeFilter, regionLabels),
    [dashboardData, activeFilter, regionLabels]
  );

  useEffect(() => {
    console.log(`Demografik Kırılım (${activeFilter}) grafiğine giden data:`, currentChartData);
  }, [activeFilter, currentChartData]);

  const filterLabels = {
    gender: tp.filterByGender,
    age: tp.filterByAge,
    education: tp.filterByEducation,
    region: tp.filterByRegion,
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (errorMessage) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-medium text-red-600">{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ÜST İSTATİSTİK KARTLARI */}
      <div ref={genelBakisRef} data-section-key="genelBakis" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border-l-4 border-l-emerald-500 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-start justify-between">
            <p className="text-xs font-bold tracking-wide text-gray-500">{tp.totalParticipantsLabel}</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
              <Users size={18} className="text-emerald-600" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[#001A3F]">{dashboardData?.totalParticipants ?? 0}</p>
        </div>

        <div className="rounded-2xl border-l-4 border-l-blue-500 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-start justify-between">
            <p className="text-xs font-bold tracking-wide text-gray-500">{tp.generalIntentLabel}</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
              <Activity size={18} className="text-blue-600" />
            </div>
          </div>
          <p className="mb-3 text-3xl font-extrabold text-[#001A3F]">{dashboardData?.generalScore ?? "-"}</p>
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">
            {tp.nationalAverageTemplate.replace("{value}", dashboardData?.nationalAverage ?? "-")}
          </div>
        </div>

        <div className="rounded-2xl border-l-4 border-l-purple-500 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-start justify-between">
            <p className="text-xs font-bold tracking-wide text-gray-500">{tp.dominantClusterLabel}</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50">
              <UserCheck size={18} className="text-purple-600" />
            </div>
          </div>
          <p className="text-xl font-extrabold leading-snug text-[#001A3F]">
            {dashboardData?.dominantClusterKey ? clusterLabels[dashboardData.dominantClusterKey] : "Henüz veri yok"}
          </p>
          <p className="mt-1 text-xs text-gray-400">{tp.dominantClusterSubtitle}</p>
        </div>
      </div>

      {/* KARŞILAŞTIRMA GRAFİĞİ */}
      <div ref={katilimciAnaliziRef} data-section-key="katilimciAnalizi" className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold tracking-wide text-[#001A3F]">{tp.comparisonChartTitle}</h3>
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
            {tp.generalMigrationAverageLegend}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 40, left: 0 }}>
            <defs>
              <linearGradient id="barGradientBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#FFFFFF" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="key"
              tick={(props) => <CustomTick {...props} factorLabels={factorLabels} />}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              interval={0}
              height={50}
            />
            <YAxis domain={[0, 100]} ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value) => [value, tp.scoreTooltipLabel]} labelFormatter={(key) => factorLabels[key]} />
            <ReferenceLine
              y={dashboardData?.generalScore ?? 0}
              stroke="#2563EB"
              strokeDasharray="3 3"
              label={{ value: String(dashboardData?.generalScore ?? 0), position: "right", fill: "#2563EB", fontSize: 11, fontWeight: 700 }}
            />
            <Bar dataKey="score" fill="url(#barGradientBlue)" radius={[8, 8, 0, 0]} barSize={44}>
              <LabelList dataKey="score" content={<TopDot />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <p className="mt-4 rounded-lg bg-gray-50 px-4 py-2.5 text-center text-xs font-medium text-gray-400">
          {tp.filterHint}
        </p>
      </div>

      {/* KÜME PROFİLLERİ */}
      <div ref={kumeProfilleriRef} data-section-key="kumeProfilleri" className="flex flex-col gap-4">
        <div>
          <h3 className="text-lg font-bold text-[#001A3F]">{tp.clusterProfilesTitle}</h3>
          <p className="text-xs text-gray-400">{tp.clusterProfilesSubtitle}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          {clusters.map((cluster) => (
            <ClusterCard
              key={cluster.key}
              cluster={cluster}
              tp={tp}
              factorLabels={factorLabels}
              clusterLabels={clusterLabels}
              onInfoClick={setSelectedCluster}
            />
          ))}
        </div>
      </div>

      {/* DEMOGRAFİK KIRILIM */}
      <div ref={demografikAnalizRef} data-section-key="demografikAnaliz" className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
              <BarChart3 size={18} className="text-indigo-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#001A3F]">{tp.demographicBreakdownTitle}</h3>
              <p className="text-xs text-gray-400">{tp.demographicBreakdownSubtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFilter(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeFilter === key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {filterLabels[key]}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={activeFilter === "education" ? 340 : 300}>
          <BarChart
            data={currentChartData}
            margin={{ top: 20, right: 20, bottom: activeFilter === "education" ? 55 : 10, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              tickFormatter={(value) => {
                if (activeFilter !== "gender") return value;
                return value === "Erkek" ? tp.genderMale : tp.genderFemale;
              }}
              tick={{ fontSize: activeFilter === "education" ? 10.5 : 12, fontWeight: 600, fill: "#334155" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              interval={0}
              angle={activeFilter === "education" ? -25 : 0}
              textAnchor={activeFilter === "education" ? "end" : "middle"}
              height={activeFilter === "education" ? 65 : 30}
            />
            <YAxis domain={[0, "dataMax + 5"]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip />
            {clusters.map((cluster, i) => (
              <Bar
                key={cluster.key}
                dataKey={cluster.key}
                stackId="a"
                fill={cluster.color}
                radius={i === clusters.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                isAnimationActive={true}
                animationDuration={800}
                animationEasing="ease-in-out"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-gray-500">
          {clusters.map((cluster) => (
            <div key={cluster.key} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cluster.color }} />
              <span>
                {tp.clusterLegendPrefix} {cluster.key.replace("K", "")} {clusterLabels[cluster.key]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* BÖLGESEL HARİTA */}
      <div ref={bolgeselHaritaRef} data-section-key="bolgeselHarita">
        <RegionalMap t={t} participants={dashboardData?.participants ?? []} />
      </div>

      {/* KÜRESEL HARİTA */}
      <div ref={kureselHaritaRef} data-section-key="kureselHarita">
        <GlobalMap t={t} lang={lang} participants={dashboardData?.participants ?? []} />
      </div>

      {/* BİREYSEL KATILIMCI İZLEME */}
      <div ref={bireyselIzlemeRef} data-section-key="bireyselIzleme">
        <ParticipantAnalysis t={t} referenceScore={dashboardData?.generalScore ?? null} />
      </div>

      {/* KÜME DETAY MODALI */}
      {selectedCluster && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={() => setSelectedCluster(null)}
        >
          <div
            className="relative w-[500px] max-w-full rounded-2xl bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedCluster(null)}
              className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col items-center text-center">
              <div
                className="mb-4 flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${selectedCluster.color}1A` }}
              >
                {(() => {
                  const ModalIcon = selectedCluster.icon;
                  return <ModalIcon size={30} style={{ color: selectedCluster.color }} />;
                })()}
              </div>

              <p className="text-sm font-extrabold uppercase tracking-wide" style={{ color: selectedCluster.color }}>
                {tp.clusterLegendPrefix} {selectedCluster.key.replace("K", "")}
              </p>
              <p className="mt-1 text-lg font-bold leading-snug text-[#001A3F]">{clusterLabels[selectedCluster.key]}</p>

              <p className="mt-4 text-4xl font-extrabold" style={{ color: selectedCluster.color }}>
                %{selectedCluster.percentage.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </p>
              <p className="mt-1 text-sm text-gray-400">
                {selectedCluster.count} {tp.personSuffix}
              </p>

              <div className="mt-5 w-full rounded-xl bg-gray-50 p-3">
                <p className="mb-1 text-xs font-bold text-gray-400">{tp.dominantFactorLabel}</p>
                <div className="flex items-center justify-center gap-2">
                  {(() => {
                    const ModalIcon = selectedCluster.icon;
                    return <ModalIcon size={16} style={{ color: selectedCluster.color }} />;
                  })()}
                  <p className="text-sm font-bold" style={{ color: selectedCluster.color }}>
                    {factorLabels[selectedCluster.dominantFactorKey]}
                  </p>
                </div>
              </div>

              <div className="mt-4 w-full">
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart
                    data={FACTOR_ORDER.map((key) => ({ factor: factorLabels[key], value: selectedCluster.radar[key] }))}
                    outerRadius="70%"
                    margin={{ top: 10, right: 30, bottom: 10, left: 30 }}
                  >
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="factor" tick={{ fontSize: 11, fill: "#334155", fontWeight: 600 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: "#94a3b8" }} tickCount={5} />
                    <Radar
                      dataKey="value"
                      stroke={selectedCluster.color}
                      fill={selectedCluster.color}
                      fillOpacity={0.25}
                      strokeWidth={2.5}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
