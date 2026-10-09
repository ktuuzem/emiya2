import { useEffect, useState } from "react";
import { Users2, Scale } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import TargetCountryMaps from "./TargetCountryMaps.jsx";
import IntentAnxietyRelation from "./IntentAnxietyRelation.jsx";
import AbroadConnectionComparison from "./AbroadConnectionComparison.jsx";
import SharedProfilesComparison from "./SharedProfilesComparison.jsx";

const API_BASE_URL = "http://localhost:5000";

const TR_COLOR = "#287D8E";
const MD_COLOR = "#C49A55";
const BUTTON_COLOR = "#33465C";
const BUTTON_COLOR_HOVER = "#263447";

const SELECT_FILTERS = [
  { key: "cinsiyet", queryParam: "cinsiyet", optionsKey: "cinsiyet" },
  { key: "yasGrubu", queryParam: "yas_grubu", optionsKey: "yasGrubu" },
  { key: "egitimSeviyesi", queryParam: "egitim_seviyesi", optionsKey: "egitimSeviyesi" },
  { key: "calismaDurumu", queryParam: "calisma_durumu", optionsKey: "calismaDurumu" },
];

const DEFAULT_FILTERS = SELECT_FILTERS.reduce((acc, f) => ({ ...acc, [f.key]: "Hepsi" }), {});

const CLASS_ORDER = ["Düşük", "Orta", "Yüksek"];

function getAdminToken() {
  try {
    const stored = localStorage.getItem("goclab_admin_session");
    return stored ? JSON.parse(stored)?.token : null;
  } catch {
    return null;
  }
}

function formatScore(value) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function StatCard({ icon, iconBg, title, trValue, mdValue, unit }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>{icon}</div>
      </div>
      <div className="flex items-stretch gap-3">
        <div className="flex-1 rounded-xl p-3" style={{ backgroundColor: `${TR_COLOR}0F` }}>
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide" style={{ color: TR_COLOR }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: TR_COLOR }} />
            TÜRKİYE
          </p>
          <p className="mt-1 text-2xl font-extrabold text-[#001A3F]">
            {trValue} <span className="text-sm font-medium text-gray-400">{unit}</span>
          </p>
        </div>
        <div className="flex-1 rounded-xl p-3" style={{ backgroundColor: `${MD_COLOR}0F` }}>
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide" style={{ color: MD_COLOR }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: MD_COLOR }} />
            MOLDOVA
          </p>
          <p className="mt-1 text-2xl font-extrabold text-[#001A3F]">
            {mdValue} <span className="text-sm font-medium text-gray-400">{unit}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function buildFilterParams(activeFilters) {
  const params = new URLSearchParams();
  SELECT_FILTERS.forEach((f) => {
    if (activeFilters[f.key] && activeFilters[f.key] !== "Hepsi") {
      params.set(f.queryParam, activeFilters[f.key]);
    }
  });
  return params;
}

export default function Comparison({ t, activeSidebarItem = "genelBakis" }) {
  const showMapsOnly = activeSidebarItem === "kMeans";
  const showRelationOnly = activeSidebarItem === "dagilim";
  const showAbroadOnly = activeSidebarItem === "korelasyon";
  const showProfilesOnly = activeSidebarItem === "siniflandirma";
  const ov = t.overviewPage;
  const cp = t.comparisonPage;

  const [data, setData] = useState(null);
  const [targetCountryData, setTargetCountryData] = useState(null);
  const [scatterData, setScatterData] = useState(null);
  const [abroadData, setAbroadData] = useState(null);
  const [profilesData, setProfilesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  // Her sayfaya (Genel Bakis/Harita/Iliskisel Analiz/Yurt Disi Baglantisi/
  // Profil) gecildiginde filtreler "Hepsi"ye sifirlanir ve o sayfa kendi
  // basina yeniden filtrelenir (kullanici talebi - sayfalar arasi ORTAK
  // filtre durumu ISTENMIYOR).
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [isFiltering, setIsFiltering] = useState(false);

  const fetchAll = async (activeFilters) => {
    try {
      const token = getAdminToken();
      const params = buildFilterParams(activeFilters);
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      const [comparisonRes, targetRes, scatterRes, abroadRes, profilesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/comparison?${params.toString()}`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/api/target-countries?${params.toString()}`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/api/comparison-scatter?${params.toString()}`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/api/comparison-abroad-groups?${params.toString()}`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/api/comparison-profiles?${params.toString()}`, { headers: authHeaders }),
      ]);
      const comparisonJson = await comparisonRes.json();
      const targetJson = await targetRes.json();
      const scatterJson = await scatterRes.json();
      const abroadJson = await abroadRes.json();
      const profilesJson = await profilesRes.json();
      if (!comparisonRes.ok || !comparisonJson.success) {
        setErrorMessage(comparisonJson.message || cp.notFound);
        return;
      }
      setData(comparisonJson);
      if (targetRes.ok && targetJson.success) setTargetCountryData(targetJson);
      if (scatterRes.ok && scatterJson.success) setScatterData(scatterJson);
      if (abroadRes.ok && abroadJson.success) setAbroadData(abroadJson);
      if (profilesRes.ok && profilesJson.success) setProfilesData(profilesJson);
      setErrorMessage("");
    } catch {
      setErrorMessage(cp.networkError);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchAll(DEFAULT_FILTERS).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleFilterApply = async () => {
    setIsFiltering(true);
    await fetchAll(filters);
    setIsFiltering(false);
  };

  const handleFilterReset = async () => {
    setFilters(DEFAULT_FILTERS);
    setIsFiltering(true);
    await fetchAll(DEFAULT_FILTERS);
    setIsFiltering(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <p className="text-sm font-medium text-gray-400">{cp.loading}</p>
      </div>
    );
  }

  if (errorMessage || !data) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <p className="max-w-md text-center text-sm font-medium text-red-500">{errorMessage || cp.notFound}</p>
      </div>
    );
  }

  const factorLabel = (key) => ov.factorLabels[key] || key;
  const filterOptions = data.filterOptions || {};

  const factorBarData = data.turkey.factors.map((f, i) => ({
    label: factorLabel(f.key),
    Türkiye: f.score ?? 0,
    Moldova: data.moldova.factors[i]?.score ?? 0,
  }));

  const classBarData = CLASS_ORDER.map((cls) => ({
    label: ov.classificationLabels[cls] || cls,
    Türkiye: data.turkey.classificationDistribution[cls] ?? 0,
    Moldova: data.moldova.classificationDistribution[cls] ?? 0,
  }));

  const ageSet = [...new Set([...data.turkey.ageTrend.map((p) => p.age), ...data.moldova.ageTrend.map((p) => p.age)])].sort(
    (a, b) => a - b
  );
  const trAgeMap = Object.fromEntries(data.turkey.ageTrend.map((p) => [p.age, p.average]));
  const mdAgeMap = Object.fromEntries(data.moldova.ageTrend.map((p) => [p.age, p.average]));
  const ageTrendData = ageSet.map((age) => ({
    age,
    Türkiye: trAgeMap[age] ?? null,
    Moldova: mdAgeMap[age] ?? null,
  }));

  // Filtre paneli: hem Genel Bakis hem Harita gorunumunde AYNI sekilde
  // gosterilir (kullanici talebi - haritanin da bu filtrelere gore
  // degismesi icin filtrelerin her zaman erisilebilir olmasi gerekir).
  const filterPanel = (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-base font-bold text-[#001A3F]">{cp.filterTitle}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SELECT_FILTERS.map((filter) => (
          <div key={filter.key} className="flex flex-col gap-1">
            <label className="text-[11px] font-bold tracking-wide text-gray-400">
              {ov.filterLabels[filter.key]}
            </label>
            <select
              value={filters[filter.key] || "Hepsi"}
              onChange={(e) => handleFilterChange(filter.key, e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
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
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleFilterApply}
          disabled={isFiltering}
          style={{ backgroundColor: BUTTON_COLOR }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BUTTON_COLOR_HOVER)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BUTTON_COLOR)}
          className="rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isFiltering ? ov.filteringButton : ov.filterButton}
        </button>
        <button
          type="button"
          onClick={handleFilterReset}
          disabled={isFiltering}
          className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50"
        >
          {ov.resetButton}
        </button>
      </div>
    </div>
  );

  if (showMapsOnly) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
            <Scale size={22} className="text-indigo-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#001A3F]">{cp.mapsTitle}</h2>
            <p className="mt-1 text-sm text-gray-500">{cp.mapsSubtitle}</p>
          </div>
        </div>
        {filterPanel}
        <TargetCountryMaps t={t} data={targetCountryData} filters={filters} filterOptions={filterOptions} />
      </div>
    );
  }

  if (showRelationOnly) {
    return (
      <div className="flex flex-col gap-6">
        {filterPanel}
        <IntentAnxietyRelation t={t} data={scatterData} factorLabels={ov.factorLabels} />
      </div>
    );
  }

  if (showAbroadOnly) {
    return (
      <div className="flex flex-col gap-6">
        {filterPanel}
        <AbroadConnectionComparison t={t} data={abroadData} factorLabels={ov.factorLabels} />
      </div>
    );
  }

  if (showProfilesOnly) {
    return (
      <div className="flex flex-col gap-6">
        {filterPanel}
        <SharedProfilesComparison t={t} data={profilesData} factorLabels={ov.factorLabels} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {filterPanel}

      {/* KATILIMCI SAYISI + GÖÇ NİYETİ ORTALAMASI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          icon={<Users2 size={18} className="text-indigo-700" />}
          iconBg="bg-indigo-100"
          title={cp.participantCountTitle}
          trValue={data.turkey.totalParticipants}
          mdValue={data.moldova.totalParticipants}
          unit={cp.personUnit}
        />
        <StatCard
          icon={<Scale size={18} className="text-indigo-700" />}
          iconBg="bg-indigo-100"
          title={cp.migrationIntentTitle}
          trValue={formatScore(data.turkey.migrationIntent.average)}
          mdValue={formatScore(data.moldova.migrationIntent.average)}
          unit="/100"
        />
      </div>

      {/* FAKTÖR KARŞILAŞTIRMASI + GÖÇ NİYETİ SINIFLANDIRMA DAĞILIMI (yan yana) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-[#001A3F]">{cp.factorChartTitle}</h3>
          <p className="mb-4 text-xs text-gray-400">{cp.factorChartSubtitle}</p>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={factorBarData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11, fill: "#334155" }} />
              <Tooltip formatter={(value) => formatScore(value)} />
              <Legend />
              <Bar dataKey="Türkiye" fill={TR_COLOR} radius={[0, 4, 4, 0]} barSize={14} />
              <Bar dataKey="Moldova" fill={MD_COLOR} radius={[0, 4, 4, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-[#001A3F]">{cp.classChartTitle}</h3>
          <p className="mb-4 text-xs text-gray-400">{cp.classChartSubtitle}</p>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={classBarData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#334155" }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `%${v}`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => `%${formatScore(value)}`} />
              <Legend />
              <Bar dataKey="Türkiye" fill={TR_COLOR} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Moldova" fill={MD_COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* YAŞA GÖRE GÖÇ NİYETİ EĞİLİMİ */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-[#001A3F]">{cp.ageTrendTitle}</h3>
        <p className="mb-4 text-xs text-gray-400">{cp.ageTrendSubtitle}</p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={ageTrendData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="age" tick={{ fontSize: 11, fill: "#334155" }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => formatScore(value)} />
            <Legend />
            <Line type="monotone" dataKey="Türkiye" stroke={TR_COLOR} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line type="monotone" dataKey="Moldova" stroke={MD_COLOR} strokeWidth={2} dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
