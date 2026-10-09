import { Fragment, useMemo, useState } from "react";
import { MapPin, Users, UserCheck, Venus, Mars, CalendarDays, ChevronRight, RotateCcw, Layers, Gauge, BarChart3 } from "lucide-react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { geoCentroid } from "d3-geo";
import { PROVINCE_TO_REGION, REGION_ORDER } from "../dashboard/turkeyRegions.js";

const REGION_GEO_URL = "/turkey-regions.geojson";
const PROVINCE_GEO_URL = "/turkey-provinces.geojson";

const LABEL_POSITION_OVERRIDES = {
  akdeniz: [32.6, 36.85],
};

// Kurum panelindeki Kume Profilleri (Overview.jsx) ile aynı, sayfaya özgü renk paleti.
const CLUSTER_COLORS = { K1: "#16A34A", K2: "#2563EB", K3: "#7C3AED", K4: "#DC2626", K5: "#EA580C" };
const CLUSTER_ORDER = ["K1", "K2", "K3", "K4", "K5"];

// Her kumenin baskin faktorune gore kisa etiketi (Overview.jsx'teki CLUSTER_MOCK ile ayni eslesme).
const CLUSTER_DOMINANT_FACTOR = {
  K1: "ekonomik_istihdam",
  K2: "aile_sosyal",
  K3: "egitim",
  K4: "sosyo_politik",
  K5: "psikolojik",
};

const MAP_FILTERS = ["genel", "k1", "k2", "k3", "k4", "k5"];
const VIEW_MODES = ["bolge", "il"];

// Kume filtresi (k1-k5) aktifken sag panelde gosterilen yas gruplari.
const AGE_GROUPS = ["18-20", "21-23", "24-26", "27+"];

function ageGroupFor(age) {
  if (age === null || age === undefined) return null;
  if (age <= 20) return "18-20";
  if (age <= 23) return "21-23";
  if (age <= 26) return "24-26";
  return "27+";
}

function emptyDist() {
  return { K1: 0, K2: 0, K3: 0, K4: 0, K5: 0 };
}

// Bir kumede (Turkiye genelinde veya secili bolge/ilde) hic katilimci
// bulunmadigi durumda, sag panelin ("Secili Kume Ozeti") tasarimi bozulmadan
// (crash olmadan) N=0 ile gosterilebilmesi icin kullanilan sifir-deger seti.
function emptyClusterBreakdown() {
  return {
    participantCount: 0,
    avgScore: null,
    maleCount: 0,
    femaleCount: 0,
    malePct: 0,
    femalePct: 0,
    ageGroups: AGE_GROUPS.reduce((acc, g) => ({ ...acc, [g]: { count: 0, pct: 0 } }), {}),
  };
}

// Bir katilimci grubunun (bir il/bolgeye ait, gercek) ozet istatistiklerini
// hesaplar: ortalama skor, cinsiyet/yas dagilimi ve kume yogunluk yuzdeleri
// (dist). Grup bossa (o il/bolgede hic katilimci yoksa) tum degerler null/0
// doner -> haritada gri (veri yok) olarak gosterilir.
function computeGroupStats(group) {
  const n = group.length;
  if (n === 0) {
    return { score: null, participantCount: 0, femalePct: null, malePct: null, commonAge: null, dist: emptyDist() };
  }

  const scores = group.map((p) => p.generalScore).filter((v) => v !== null && v !== undefined);
  const score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const femaleCount = group.filter((p) => p.gender === "Kadın").length;
  const maleCount = group.filter((p) => p.gender === "Erkek").length;
  const genderKnown = femaleCount + maleCount;
  const femalePct = genderKnown > 0 ? Math.round((femaleCount / genderKnown) * 100) : null;
  const malePct = genderKnown > 0 ? 100 - femalePct : null;

  const ageCounts = {};
  group.forEach((p) => {
    if (p.age !== null && p.age !== undefined) ageCounts[p.age] = (ageCounts[p.age] || 0) + 1;
  });
  let commonAge = null;
  let bestCount = 0;
  Object.entries(ageCounts).forEach(([age, count]) => {
    if (count > bestCount || (count === bestCount && (commonAge === null || Number(age) < commonAge))) {
      bestCount = count;
      commonAge = Number(age);
    }
  });

  const dist = emptyDist();
  group.forEach((p) => {
    if (p.assignedCluster && dist[p.assignedCluster] !== undefined) dist[p.assignedCluster] += 1;
  });
  CLUSTER_ORDER.forEach((k) => {
    dist[k] = Math.round((dist[k] / n) * 100);
  });

  return { score, participantCount: n, femalePct, malePct, commonAge, dist };
}

// Bir grup icinde, tek bir kumeye (K1-K5) ait katilimcilarin demografi
// kirilimini hesaplar. Bu kumede hic katilimci yoksa null doner (harita
// panelinde "veri yok" olarak ele alinir).
function computeClusterStats(group, clusterKey) {
  const clusterGroup = group.filter((p) => p.assignedCluster === clusterKey);
  const n = clusterGroup.length;
  if (n === 0) return null;

  const scores = clusterGroup.map((p) => p.generalScore).filter((v) => v !== null && v !== undefined);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const femaleCount = clusterGroup.filter((p) => p.gender === "Kadın").length;
  const maleCount = clusterGroup.filter((p) => p.gender === "Erkek").length;
  const malePct = Math.round((maleCount / n) * 1000) / 10;
  const femalePct = Math.round((femaleCount / n) * 1000) / 10;

  const ageCounts = AGE_GROUPS.reduce((acc, g) => ({ ...acc, [g]: 0 }), {});
  clusterGroup.forEach((p) => {
    const g = ageGroupFor(p.age);
    if (g) ageCounts[g] += 1;
  });
  const ageGroups = AGE_GROUPS.reduce(
    (acc, g) => ({ ...acc, [g]: { count: ageCounts[g], pct: Math.round((ageCounts[g] / n) * 1000) / 10 } }),
    {}
  );

  return { participantCount: n, avgScore, maleCount, femaleCount, malePct, femalePct, ageGroups };
}

// Acik kirmizi (#FEE2E2) -> kirmizi (#EF4444) -> koyu kirmizi (#7F1D1D) dogrusal isi skalasi.
const HEAT_STOPS = [
  { stop: 0, rgb: [254, 226, 226] },
  { stop: 0.5, rgb: [239, 68, 68] },
  { stop: 1, rgb: [127, 29, 29] },
];

function colorForRatio(ratio) {
  if (ratio === null || ratio === undefined) return "#e2e8f0";
  const clamped = Math.max(0, Math.min(1, ratio));
  const lower = clamped <= 0.5 ? HEAT_STOPS[0] : HEAT_STOPS[1];
  const upper = clamped <= 0.5 ? HEAT_STOPS[1] : HEAT_STOPS[2];
  const span = upper.stop - lower.stop || 1;
  const localRatio = (clamped - lower.stop) / span;
  const rgb = lower.rgb.map((c, i) => Math.round(c + (upper.rgb[i] - c) * localRatio));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export default function RegionalMap({ t, participants = [] }) {
  const rm = t.tenantRegionalMapPage;
  const rp = t.regionalHeatmapPage;
  const tp = t.tenantOverviewPage;
  const factorLabels = t.overviewPage.factorLabels;
  const clusterLabels = t.kMeansPage.clusters;

  const [mapFilter, setMapFilter] = useState("genel");
  const [viewMode, setViewMode] = useState("il");
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedProvince, setSelectedProvince] = useState(null);

  // Kurumun gercek katilimcilarindan (Overview.jsx'in zaten cektigi
  // dashboard-summary yanitindan) il/bolge bazli gercek istatistikler.
  // Katilimcisi olmayan il/bolgeler icin score=null doner -> haritada gri
  // (veri yok) gosterilir.
  const { provinceData, provinceClusterBreakdown } = useMemo(() => {
    const byProvince = {};
    participants.forEach((p) => {
      if (!p.province) return;
      (byProvince[p.province] ||= []).push(p);
    });

    const data = {};
    const breakdown = {};
    Object.keys(PROVINCE_TO_REGION).forEach((provinceName) => {
      const group = byProvince[provinceName] || [];
      data[provinceName] = { ...computeGroupStats(group), regionKey: PROVINCE_TO_REGION[provinceName] };
      breakdown[provinceName] = CLUSTER_ORDER.reduce(
        (acc, k) => ({ ...acc, [k]: computeClusterStats(group, k) }),
        {}
      );
    });
    return { provinceData: data, provinceClusterBreakdown: breakdown };
  }, [participants]);

  const { regionData, regionClusterBreakdown } = useMemo(() => {
    const byRegion = {};
    participants.forEach((p) => {
      const regionKey = p.province ? PROVINCE_TO_REGION[p.province] : null;
      if (!regionKey) return;
      (byRegion[regionKey] ||= []).push(p);
    });

    const data = {};
    const breakdown = {};
    REGION_ORDER.forEach((regionKey) => {
      const group = byRegion[regionKey] || [];
      data[regionKey] = computeGroupStats(group);
      breakdown[regionKey] = CLUSTER_ORDER.reduce(
        (acc, k) => ({ ...acc, [k]: computeClusterStats(group, k) }),
        {}
      );
    });
    return { regionData: data, regionClusterBreakdown: breakdown };
  }, [participants]);

  // Kurum geneli (secim kaldirildiginda / "Sifirla" ile gosterilen ozet).
  const institutionAggregate = useMemo(() => computeGroupStats(participants), [participants]);

  const institutionClusterAvgScore = useMemo(
    () =>
      CLUSTER_ORDER.reduce((acc, clusterKey) => {
        const scores = REGION_ORDER.map((r) => regionClusterBreakdown[r]?.[clusterKey]?.avgScore).filter(
          (v) => v !== null && v !== undefined
        );
        acc[clusterKey] = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
        return acc;
      }, {}),
    [regionClusterBreakdown]
  );

  // Haritanin renklendirmesi ve etiketleri icin KULLANILACAK TEK deger: her zaman
  // Goc Niyeti Skoru (0-100). Kume filtresi aktifken bu, o bolgedeki/ildeki
  // SECILI KUMENIN ortalama skorudur (yogunluk yuzdesi/N degil).
  const scoreForKey = (key, filter, mode) => {
    if (filter === "genel") {
      if (!key) return institutionAggregate.score;
      const data = mode === "il" ? provinceData[key] : regionData[key];
      return data?.score ?? null;
    }
    const clusterKey = filter.toUpperCase();
    if (!key) return institutionClusterAvgScore[clusterKey] ?? null;
    const breakdown = mode === "il" ? provinceClusterBreakdown : regionClusterBreakdown;
    return breakdown[key]?.[clusterKey]?.avgScore ?? null;
  };

  const filterLabels = {
    genel: rm.generalMapLabel,
    k1: `${rm.clusterFilterPrefix} 1`,
    k2: `${rm.clusterFilterPrefix} 2`,
    k3: `${rm.clusterFilterPrefix} 3`,
    k4: `${rm.clusterFilterPrefix} 4`,
    k5: `${rm.clusterFilterPrefix} 5`,
  };

  const viewModeLabels = { bolge: rm.viewModeRegional, il: rm.viewModeProvince };

  const selectedKey = viewMode === "il" ? selectedProvince : selectedRegion;
  const selectedData = selectedKey ? (viewMode === "il" ? provinceData[selectedKey] : regionData[selectedKey]) : institutionAggregate;
  const selectedValue = scoreForKey(selectedKey, mapFilter, viewMode);
  const dominantClusterKey = useMemo(() => {
    return CLUSTER_ORDER.reduce((best, key) => (selectedData.dist[key] > selectedData.dist[best] ? key : best), "K1");
  }, [selectedData]);

  const scoreLabel = mapFilter === "genel" ? rm.overallScoreLabel : rm.intensityLabelTemplate.replace("{cluster}", filterLabels[mapFilter]);

  const clusterWideTotal = useMemo(() => {
    if (mapFilter === "genel") return null;
    const clusterKey = mapFilter.toUpperCase();
    const breakdown = viewMode === "il" ? provinceClusterBreakdown : regionClusterBreakdown;
    const keys = viewMode === "il" ? Object.keys(provinceData) : REGION_ORDER;
    return keys.reduce((sum, key) => sum + (breakdown[key]?.[clusterKey]?.participantCount || 0), 0);
  }, [mapFilter, viewMode, provinceClusterBreakdown, regionClusterBreakdown, provinceData]);

  // Bir kume sekmesi (Kume 1-5) aktifken sag panel HER ZAMAN "Secili Kume
  // Ozeti" tasarimini gosterir. Haritadan henuz bir il/bolge secilmemisse
  // (selectedKey=null), bu kumenin Turkiye genelindeki (tum katilimcilar
  // uzerinden) ozeti gosterilir; bir il/bolge secildiginde ayni tasarimin
  // icindeki veriler o secime gore dinamik olarak guncellenir.
  const selectedClusterBreakdown = useMemo(() => {
    if (mapFilter === "genel") return null;
    const clusterKey = mapFilter.toUpperCase();
    if (!selectedKey) return computeClusterStats(participants, clusterKey) ?? emptyClusterBreakdown();
    const breakdown = viewMode === "il" ? provinceClusterBreakdown : regionClusterBreakdown;
    return breakdown[selectedKey]?.[clusterKey] ?? emptyClusterBreakdown();
  }, [mapFilter, viewMode, selectedKey, provinceClusterBreakdown, regionClusterBreakdown, participants]);

  const showClusterPanel = mapFilter !== "genel";

  const handleReset = () => {
    if (viewMode === "il") setSelectedProvince(null);
    else setSelectedRegion(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-extrabold text-[#001A3F]">{rm.title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">{rm.subtitle}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {MAP_FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setMapFilter(key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              mapFilter === key ? "bg-indigo-100 text-indigo-700" : "bg-white text-gray-600 shadow-sm hover:bg-gray-50"
            }`}
          >
            {filterLabels[key]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {VIEW_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === mode ? "bg-indigo-100 text-indigo-700" : "bg-white text-gray-600 shadow-sm hover:bg-gray-50"
            }`}
          >
            <Layers size={13} />
            {viewModeLabels[mode]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-6 xl:flex-row">
        {/* HARİTA */}
        <div className="flex-1 rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-200"
            >
              {rm.breadcrumbHome}
              <ChevronRight size={13} />
            </button>

            <div className="flex flex-col items-end">
              <p className="mb-1 text-[11px] font-bold text-gray-500">{scoreLabel}</p>
              <div
                className="h-2 w-48 rounded-full"
                style={{ background: "linear-gradient(to right, #FEE2E2, #EF4444, #7F1D1D)" }}
              />
              <div className="mt-1 flex w-48 justify-between text-[10px] font-medium text-gray-400">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>
          </div>

          <div className="w-full">
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ center: [35.5, 39], scale: 3300 }}
              width={1300}
              height={700}
              style={{ width: "100%", height: "auto", display: "block" }}
            >
              <Geographies geography={PROVINCE_GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const provinceName = geo.properties.name;
                    const regionKey = PROVINCE_TO_REGION[provinceName] ?? null;
                    const isIlMode = viewMode === "il";
                    const value = isIlMode
                      ? scoreForKey(provinceName, mapFilter, "il")
                      : scoreForKey(regionKey, mapFilter, "bolge");
                    const ratio = value === null ? null : value / 100;
                    const isSelected = isIlMode ? provinceName === selectedProvince : regionKey === selectedRegion;
                    const centroid = isIlMode ? geoCentroid(geo) : null;
                    return (
                      <Fragment key={geo.rsmKey}>
                        <Geography
                          geography={geo}
                          fill={colorForRatio(ratio)}
                          stroke="#FFFFFF"
                          strokeWidth={isSelected ? (isIlMode ? 2.5 : 1.5) : 1}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          style={{
                            default: { outline: "none", transition: "fill 150ms ease, stroke-width 150ms ease" },
                            hover: { outline: "none", cursor: "pointer" },
                            pressed: { outline: "none" },
                          }}
                          onClick={() => {
                            if (isIlMode) {
                              if (provinceName) setSelectedProvince(provinceName);
                            } else if (regionKey) {
                              setSelectedRegion(regionKey);
                            }
                          }}
                        />
                        {isIlMode && centroid && !Number.isNaN(centroid[0]) && (
                          <Marker coordinates={centroid}>
                            <text
                              textAnchor="middle"
                              style={{
                                pointerEvents: "none",
                                fontSize: 7.6,
                                fontWeight: 700,
                                fill: "#1e293b",
                                paintOrder: "stroke",
                                stroke: "rgba(255,255,255,0.92)",
                                strokeWidth: 2.3,
                                strokeLinejoin: "round",
                              }}
                            >
                              {provinceName}
                            </text>
                          </Marker>
                        )}
                      </Fragment>
                    );
                  })
                }
              </Geographies>

              {viewMode === "bolge" && (
                <>
                  <Geographies geography={REGION_GEO_URL}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const regionKey = geo.properties.region;
                        const isSelected = regionKey === selectedRegion;
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill="transparent"
                            stroke="#FFFFFF"
                            strokeWidth={isSelected ? 4.2 : 1.5}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            style={{
                              default: { outline: "none", pointerEvents: "none", transition: "stroke-width 150ms ease" },
                              hover: { outline: "none", pointerEvents: "none" },
                              pressed: { outline: "none", pointerEvents: "none" },
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>

                  <Geographies geography={REGION_GEO_URL}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const regionKey = geo.properties.region;
                        const centroid = LABEL_POSITION_OVERRIDES[regionKey] || geoCentroid(geo);
                        const regionStats = regionData[regionKey];
                        const value = scoreForKey(regionKey, mapFilter, "bolge");
                        if (!centroid || Number.isNaN(centroid[0]) || !regionStats) return null;
                        return (
                          <Marker key={geo.rsmKey} coordinates={centroid}>
                            <foreignObject x={-42} y={-26} width={84} height={52} style={{ overflow: "visible" }}>
                              <button
                                type="button"
                                onClick={() => setSelectedRegion(regionKey)}
                                className="flex w-full cursor-pointer flex-col items-center rounded-lg border border-gray-100 bg-white/95 px-2 py-1 text-center shadow-md"
                              >
                                <span className="truncate text-[9px] font-bold leading-tight text-[#001A3F]">
                                  {rp.regions[regionKey]}
                                </span>
                                <span className="text-base font-extrabold leading-tight text-red-600">{value ?? "-"}</span>
                                <span className="text-[8px] font-medium text-gray-400">N={regionStats.participantCount}</span>
                              </button>
                            </foreignObject>
                          </Marker>
                        );
                      })
                    }
                  </Geographies>
                </>
              )}
            </ComposableMap>
          </div>

          {/* HARİTA ALTI ÖZET KARTLARI */}
          <div className="mt-5 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-3">
            <div className="flex items-center gap-2.5 rounded-xl bg-gray-50 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                <Layers size={16} className="text-indigo-700" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400">{rm.selectedLevelCardLabel}</p>
                <p className="text-sm font-extrabold text-[#001A3F]">{viewModeLabels[viewMode]}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-gray-50 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                <Users size={16} className="text-blue-700" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400">{rm.totalParticipantsCardLabel}</p>
                <p className="text-sm font-extrabold text-[#001A3F]">N = {participants.length.toLocaleString("tr-TR")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-gray-50 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100">
                <Gauge size={16} className="text-orange-700" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400">{rm.turkeyOverallScoreCardLabel}</p>
                <p className="text-sm font-extrabold text-[#001A3F]">{institutionAggregate.score ?? "-"} / 100</p>
              </div>
            </div>
          </div>
        </div>

        {/* SAĞ DETAY PANELİ */}
        {showClusterPanel ? (
          <div className="w-full shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm xl:w-96">
            <div className="flex items-center gap-2 bg-blue-900 px-5 py-4 text-white">
              <Users size={18} />
              <p className="text-sm font-bold">{rm.totalParticipantsHeaderTemplate.replace("{count}", clusterWideTotal)}</p>
            </div>

            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
              <BarChart3 size={15} className="text-indigo-600" />
              <p className="text-sm font-bold text-[#001A3F]">{rm.selectedClusterSummaryLabel}</p>
            </div>

            <div className="border-b border-gray-100 px-5 py-3">
              <div className="flex items-start gap-2">
                <Users size={15} className="mt-0.5 shrink-0 text-gray-400" />
                <div>
                  <p className="text-xs font-semibold text-gray-400">{rm.clusterNameLabel}</p>
                  <p className="text-sm font-bold text-[#001A3F]">{clusterLabels[mapFilter.toUpperCase()]}</p>
                </div>
              </div>
            </div>

            <div className="border-b border-gray-100 px-5 py-3">
              <div className="flex items-start gap-2">
                <MapPin size={15} className="mt-0.5 shrink-0 text-gray-400" />
                <div>
                  <p className="text-xs font-semibold text-gray-400">
                    {viewMode === "il" ? rm.selectedProvinceLabel : rm.selectedRegionLabel}
                  </p>
                  <p className="text-sm font-bold text-[#001A3F]">
                    {selectedKey ? (viewMode === "il" ? selectedProvince : rp.regions[selectedRegion]) : rm.turkeyWideLabel}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-b border-gray-100 px-5 py-3">
              <div className="flex items-start gap-2">
                <Users size={15} className="mt-0.5 shrink-0 text-gray-400" />
                <div>
                  <p className="text-xs font-semibold text-gray-400">
                    {viewMode === "il" ? rm.provinceParticipantCountLabel : rm.regionParticipantCountLabel}
                  </p>
                  <p className="text-sm font-bold text-[#001A3F]">{selectedClusterBreakdown.participantCount}</p>
                </div>
              </div>
            </div>

            <div className="border-b border-gray-100 px-5 py-3">
              <div className="flex items-start gap-2">
                <Gauge size={15} className="mt-0.5 shrink-0 text-gray-400" />
                <div>
                  <p className="text-xs font-semibold text-gray-400">
                    {viewMode === "il" ? rm.provinceAvgScoreLabel : rm.regionAvgScoreLabel}
                  </p>
                  <p className="text-2xl font-extrabold text-red-600">{selectedClusterBreakdown.avgScore ?? "-"}</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-100 px-5 py-2.5">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-purple-700" />
                <p className="text-xs font-bold text-purple-800">
                  {viewMode === "il" ? rm.demographicsTitleProvince : rm.demographicsTitleRegion}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 px-5 py-4">
              <div>
                <p className="mb-2 text-[11px] font-bold text-gray-400">{rm.genderDistributionLabel}</p>
                <div className="mb-3">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-semibold text-blue-600">
                      <Mars size={12} />
                      {tp.genderMale}
                    </span>
                    <span className="font-bold text-gray-600">
                      {selectedClusterBreakdown.maleCount} (%{selectedClusterBreakdown.malePct.toLocaleString("tr-TR")})
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100">
                    <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${selectedClusterBreakdown.malePct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-semibold text-pink-600">
                      <Venus size={12} />
                      {tp.genderFemale}
                    </span>
                    <span className="font-bold text-gray-600">
                      {selectedClusterBreakdown.femaleCount} (%{selectedClusterBreakdown.femalePct.toLocaleString("tr-TR")})
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100">
                    <div className="h-1.5 rounded-full bg-pink-500" style={{ width: `${selectedClusterBreakdown.femalePct}%` }} />
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold text-gray-400">{rm.ageDistributionLabel}</p>
                <div className="flex flex-col gap-2">
                  {AGE_GROUPS.map((group) => (
                    <div key={group}>
                      <div className="mb-0.5 flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-gray-500">
                          {group} {rm.ageSuffix}
                        </span>
                        <span className="font-bold text-gray-600">
                          {selectedClusterBreakdown.ageGroups[group].count} (%
                          {selectedClusterBreakdown.ageGroups[group].pct.toLocaleString("tr-TR")})
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-100">
                        <div
                          className="h-1.5 rounded-full bg-blue-400"
                          style={{ width: `${selectedClusterBreakdown.ageGroups[group].pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="border-t border-gray-100 px-5 py-3 text-[10px] text-gray-400">
              {(viewMode === "il" ? rm.demographicsFootnoteProvinceTemplate : rm.demographicsFootnoteRegionTemplate).replace(
                "{count}",
                selectedClusterBreakdown.participantCount
              )}
            </p>
          </div>
        ) : (
          <div className="w-full shrink-0 rounded-2xl bg-white p-5 shadow-sm xl:w-96">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#001A3F]">
                {viewMode === "il" ? rm.selectedProvinceInfoTitle : rm.selectedRegionInfoTitle}
              </h3>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-50"
              >
                <RotateCcw size={12} />
                {rm.resetLabel}
              </button>
            </div>

            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-gray-400">
              {viewMode === "il" ? rm.selectedProvinceLabel : rm.selectedRegionLabel}
            </p>
            <div className="mt-1 flex items-start gap-1.5">
              <MapPin size={16} className="mt-0.5 shrink-0 text-indigo-600" />
              {viewMode === "il" && selectedProvince ? (
                <div>
                  <p className="text-sm font-bold leading-tight text-[#001A3F]">{selectedProvince}</p>
                  <p className="text-xs text-gray-400">{rp.regions[provinceData[selectedProvince]?.regionKey]}</p>
                </div>
              ) : (
                <p className="text-sm font-bold text-[#001A3F]">
                  {selectedKey ? rp.regionTitleTemplate.replace("{region}", rp.regions[selectedKey]) : rm.breadcrumbHome}
                </p>
              )}
            </div>

            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-gray-400">{scoreLabel}</p>
            <p className="mt-1 text-3xl font-extrabold text-red-600">{selectedValue} / 100</p>

            <div className="mt-4 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
              <Users size={16} className="text-gray-500" />
              <p className="text-xs font-semibold text-gray-500">{rm.participantCountLabel}</p>
              <p className="ml-auto text-sm font-extrabold text-[#001A3F]">N={selectedData.participantCount.toLocaleString("tr-TR")}</p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-gray-50 p-2.5">
                <p className="mb-1 text-[10px] font-bold text-gray-400">{rm.genderDistributionLabel}</p>
                <div className="flex items-center gap-1 text-xs font-bold text-pink-600">
                  <Venus size={13} />
                  %{selectedData.femalePct}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-xs font-bold text-blue-600">
                  <Mars size={13} />
                  %{selectedData.malePct}
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 p-2.5">
                <p className="mb-1 text-[10px] font-bold text-gray-400">{rm.commonAgeLabel}</p>
                <div className="flex items-center gap-1 text-sm font-extrabold text-[#001A3F]">
                  <CalendarDays size={14} className="text-gray-400" />
                  {selectedData.commonAge} {rm.ageSuffix}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-gray-50 p-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                <UserCheck size={13} className="text-gray-400" />
                {rm.dominantProfileLabel}
              </div>
              <p className="text-sm font-bold" style={{ color: CLUSTER_COLORS[dominantClusterKey] }}>
                {dominantClusterKey.replace("K", `${rm.clusterFilterPrefix} `)}
              </p>
              <p className="text-xs text-gray-500">{clusterLabels[dominantClusterKey]}</p>
            </div>

            <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-gray-400">
              {viewMode === "il" ? rm.clusterDistributionLabelProvince : rm.clusterDistributionLabel}
            </p>
            <div className="flex flex-col gap-2.5">
              {CLUSTER_ORDER.map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-36 shrink-0 text-xs font-semibold leading-snug text-gray-600">
                    {key.replace("K", `${rm.clusterFilterPrefix} `)} ({factorLabels[CLUSTER_DOMINANT_FACTOR[key]]})
                  </span>
                  <div className="h-2 flex-1 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${selectedData.dist[key]}%`, backgroundColor: CLUSTER_COLORS[key] }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right text-xs font-bold text-gray-500">%{selectedData.dist[key]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
