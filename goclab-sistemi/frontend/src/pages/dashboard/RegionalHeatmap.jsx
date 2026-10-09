import { useMemo, useState, useEffect } from "react";
import { Star } from "lucide-react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { geoCentroid } from "d3-geo";
import { PROVINCE_TO_REGION } from "./turkeyRegions.js";

const API_BASE_URL = "http://localhost:5000";
const REGION_GEO_URL = "/turkey-regions.geojson";
const PROVINCE_GEO_URL = "/turkey-provinces.geojson";

const CLUSTER_COLORS = {
  K1: "#DC2626",
  K2: "#2563EB",
  K3: "#16A34A",
  K4: "#14B8A6",
  K5: "#7C3AED",
};
const CLUSTER_ORDER = ["K1", "K2", "K3", "K4", "K5"];

// Bazi bolgelerin geometrik centroid'i (ozellikle Akdeniz gibi ic kesimlere
// (Isparta/Burdur) uzanan, kiyi seridi boyunca uzun/iceri girintili sekiller
// icin) etiketi yanlis/yanlis bolgeye kayan bir noktaya tasiyabiliyor. Bu
// bolgeler icin elle ayarlanmis bir etiket konumu (lon, lat) kullanilir.
const LABEL_POSITION_OVERRIDES = {
  akdeniz: [32.6, 36.85],
};

// Acik yesilden (#D1FAE5) koyu zumrut yesiline (#065F46) giden dogrusal renk skalasi.
const LIGHT_RGB = [209, 250, 229];
const DARK_RGB = [6, 95, 70];

function colorForScore(rawScore, min, max) {
  if (rawScore === null || rawScore === undefined) return "#e2e8f0";
  const span = max - min;
  const ratio = span > 0 ? (rawScore - min) / span : 0.5;
  const clamped = Math.max(0, Math.min(1, ratio));
  const rgb = LIGHT_RGB.map((c, i) => Math.round(c + (DARK_RGB[i] - c) * clamped));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

// Aktif (hover) bolgenin dolgusunu hafifce parlaklastirir.
function brightenColor(rgbString, amount = 0.16) {
  const values = rgbString.match(/\d+/g);
  if (!values) return rgbString;
  const [r, g, b] = values.map(Number);
  const brightened = [r, g, b].map((c) => Math.round(c + (255 - c) * amount));
  return `rgb(${brightened[0]}, ${brightened[1]}, ${brightened[2]})`;
}

// 0-100 normalize skoru, gosterim icin 1-5 ham Likert olcegine geri cevirir.
function toRawScale(score0to100) {
  if (score0to100 === null || score0to100 === undefined) return null;
  return (score0to100 / 100) * 4 + 1;
}

function formatScore(value) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatPct(value) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function getAdminToken() {
  try {
    const stored = localStorage.getItem("goclab_admin_session");
    return stored ? JSON.parse(stored)?.token : null;
  } catch {
    return null;
  }
}

// --- MOLDOVA ---
// Gercek ilce (raion) sinirlari: geoBoundaries (CC-BY 4.0, MDA ADM1, 37 birim)
// kaynagindan indirilip (bkz. scripts/buildMoldovaGeo.mjs) her raion, Moldova
// Ulusal Istatistik Burosu'nun 2005'ten beri kullandigi 4 resmi istatistiksel
// bolgeye (Nord/Centru/Sud/Chisinau) etiketlenerek public/moldova-raions.geojson
// olarak kaydedildi (bkz. statistica.gov.md). Bender/Transnistria bu resmi
// siniflandirmanin DISINDADIR (Moldova istatistiklerine dahil edilmez).
const MOLDOVA_RAION_GEO_URL = "/moldova-raions.geojson";
const MOLDOVA_REGION_ORDER = ["nord", "centru", "sud", "chisinau"];
// Her bolgenin etiket konumu (raion sinirlarinin duz/planar orta noktalarinin
// ortalamasi - bkz. scripts/buildMoldovaGeo.mjs, moldova-region-labels.json).
const MOLDOVA_REGION_LABEL_POSITION = {
  nord: [27.807, 47.968],
  centru: [28.624, 47.209],
  sud: [28.800, 46.295],
  chisinau: [28.877, 47.007],
};
// anket_son_sayisal.bolge sutunundaki 1-4 kodlarinin hangi bolgeye karsilik
// geldigi, kullanicinin sagladigi kod kitapcigi (raion listeleri) ile
// DOGRULANMISTIR: 1=Chisinau (Mun. Chisinau), 2=Nord, 3=Centru,
// 4=Sud + UTA Gagauzia (Sud bolgesi anket kod kitapciginda Gagauzia'yi da
// icerir - bkz. rp.regionsMoldova.sud etiketi).
const MOLDOVA_BOLGE_TO_REGION = {
  bolge1: "chisinau",
  bolge2: "nord",
  bolge3: "centru",
  bolge4: "sud",
};

function MoldovaRegionalHeatmap({ rp, clusterLabels, regions, tooltipData, setTooltipData, mousePosition, setMousePosition }) {
  const regionDataByKey = useMemo(() => {
    const map = {};
    for (const region of regions) {
      const regionKey = MOLDOVA_BOLGE_TO_REGION[region.key];
      if (regionKey) map[regionKey] = region;
    }
    return map;
  }, [regions]);

  const { minScore, maxScore } = useMemo(() => {
    const scores = MOLDOVA_REGION_ORDER.map((key) => toRawScale(regionDataByKey[key]?.migrationIntentScore)).filter(
      (v) => v !== null && v !== undefined
    );
    if (scores.length === 0) return { minScore: 1, maxScore: 5 };
    return { minScore: Math.min(...scores), maxScore: Math.max(...scores) };
  }, [regionDataByKey]);

  const handleMouseEnter = (regionKey) => {
    const regionData = regionDataByKey[regionKey];
    if (!regionData) return;
    setTooltipData({ regionKey, regionData });
  };
  const handleMouseMove = (e) => setMousePosition({ x: e.clientX + 15, y: e.clientY + 15 });
  const handleMouseLeave = () => setTooltipData(null);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-center text-xl font-extrabold tracking-wide text-[#001A3F]">{rp.titleMoldova}</h2>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mx-auto max-w-3xl">
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ center: [28.5, 47.1], scale: 7000 }}
            width={700}
            height={500}
            style={{ width: "100%", height: "auto", display: "block" }}
          >
            <Geographies geography={MOLDOVA_RAION_GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const regionKey = geo.properties.region;
                  const regionData = regionKey ? regionDataByKey[regionKey] : null;
                  const rawScore = toRawScale(regionData?.migrationIntentScore);
                  const baseFill = colorForScore(rawScore, minScore, maxScore);
                  const isActiveRegion = tooltipData && tooltipData.regionKey === regionKey;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={regionKey ? (isActiveRegion ? brightenColor(baseFill) : baseFill) : "#f1f5f9"}
                      stroke={isActiveRegion ? "#065F46" : "rgba(6, 95, 70, 0.45)"}
                      strokeWidth={isActiveRegion ? 1.6 : 0.8}
                      style={{
                        default: { outline: "none", transition: "fill 150ms ease, stroke 150ms ease" },
                        hover: { outline: "none", cursor: regionKey ? "pointer" : "default" },
                        pressed: { outline: "none" },
                      }}
                      onMouseEnter={() => regionKey && handleMouseEnter(regionKey)}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                    />
                  );
                })
              }
            </Geographies>

            {MOLDOVA_REGION_ORDER.map((key) => (
              <Marker key={key} coordinates={MOLDOVA_REGION_LABEL_POSITION[key]}>
                <text
                  textAnchor="middle"
                  style={{
                    pointerEvents: "none",
                    fontSize: 12,
                    fontWeight: 800,
                    fill: "#0f172a",
                    paintOrder: "stroke",
                    stroke: "rgba(255,255,255,0.85)",
                    strokeWidth: 3,
                    strokeLinejoin: "round",
                  }}
                >
                  {rp.regionsMoldova[key]}
                </text>
              </Marker>
            ))}
          </ComposableMap>
        </div>

        {/* LEJANT */}
        <div className="mt-4">
          <p className="mb-2 text-center text-xs font-bold tracking-wide text-gray-500">{rp.legendTitle}</p>
          <div
            className="mx-auto h-2.5 w-full max-w-3xl rounded-full"
            style={{ background: `linear-gradient(to right, ${colorForScore(0, 0, 1)}, ${colorForScore(1, 0, 1)})` }}
          />
          <div className="mx-auto mt-1 flex max-w-3xl justify-between text-xs font-medium text-gray-500">
            <span>{rp.legendLow}</span>
            <span>{rp.legendHigh}</span>
          </div>
        </div>

        {/* ALT LEJANT: PROFİL AÇIKLAMALARI */}
        <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-gray-100 pt-4">
          {CLUSTER_ORDER.map((label) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[label] }} />
              <span>
                <span className="font-bold text-[#001A3F]">{label}:</span> {clusterLabels[label]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* FAREYİ TAKİP EDEN TOOLTIP */}
      {tooltipData && (
        <div
          className="pointer-events-none fixed z-50 w-80 rounded-2xl border border-white/10 bg-[#0B1120] p-5 text-white shadow-2xl"
          style={{ top: mousePosition.y, left: mousePosition.x }}
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400/20">
              <Star size={18} className="fill-amber-400 text-amber-400" />
            </div>
            <div>
              <p className="text-base font-bold leading-tight">{rp.regionsMoldova[tooltipData.regionKey]}</p>
              <p className="text-xs text-blue-200">
                N={tooltipData.regionData.participantCount} {rp.participantsSuffix}
              </p>
            </div>
          </div>

          {tooltipData.regionData.dominantProfile ? (
            <div className="mb-3 rounded-xl bg-white/10 p-3">
              <p className="mb-1 text-[10px] font-bold tracking-wide text-blue-200">{rp.dominantProfileLabel}</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-teal-400">
                  {clusterLabels[tooltipData.regionData.dominantProfile.clusterLabel]}
                </p>
                <p className="shrink-0 text-base font-extrabold text-amber-400">
                  %{formatPct(tooltipData.regionData.dominantProfile.percentage)}
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-3 rounded-xl bg-white/10 p-3 text-xs text-blue-200">{rp.noDataLabel}</div>
          )}

          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/10 p-3">
              <p className="mb-1 text-[10px] font-bold tracking-wide text-blue-200">{rp.overallIntentLabel}</p>
              <p className="text-xl font-extrabold text-yellow-300">
                {formatScore(tooltipData.regionData.migrationIntentScore)}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="mb-1 text-[10px] font-bold tracking-wide text-blue-200">{rp.overallAnxietyLabel}</p>
              <p className="text-xl font-extrabold text-yellow-300">
                {formatScore(tooltipData.regionData.anxietyScore)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="mb-0.5 text-[10px] font-bold tracking-wide text-blue-200">{rp.profileDistributionLabel}</p>
            {CLUSTER_ORDER.map((label) => {
              const dist = tooltipData.regionData.clusterDistribution.find((c) => c.clusterLabel === label);
              return (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[label] }} />
                  <span className="flex-1 text-blue-100">{clusterLabels[label]}</span>
                  <span className="shrink-0 font-bold text-white">{formatPct(dist?.percentage ?? 0)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RegionalHeatmap({ t, dataScope = "turkey" }) {
  const rp = t.regionalHeatmapPage;
  const isMoldova = dataScope === "moldova";
  const clusterLabels = isMoldova ? t.kMeansPage.clustersMoldova : t.kMeansPage.clusters;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [tooltipData, setTooltipData] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const fetchHeatmap = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const token = getAdminToken();
        const query = isMoldova ? "?country=md" : "";
        const res = await fetch(`${API_BASE_URL}/api/regional-heatmap${query}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setErrorMessage(json.message || rp.notFound);
          return;
        }
        setData(json);
      } catch {
        setErrorMessage(rp.networkError);
      } finally {
        setLoading(false);
      }
    };

    fetchHeatmap();
  }, [rp, isMoldova]);

  const regionByKey = useMemo(() => {
    if (!data) return {};
    return data.regions.reduce((acc, r) => {
      acc[r.key] = r;
      return acc;
    }, {});
  }, [data]);

  const { minScore, maxScore } = useMemo(() => {
    if (!data) return { minScore: 1, maxScore: 5 };
    const scores = data.regions
      .map((r) => toRawScale(r.migrationIntentScore))
      .filter((v) => v !== null && v !== undefined);
    if (scores.length === 0) return { minScore: 1, maxScore: 5 };
    return { minScore: Math.min(...scores), maxScore: Math.max(...scores) };
  }, [data]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <p className="text-sm font-medium text-gray-400">{rp.loading}</p>
      </div>
    );
  }

  if (errorMessage || !data) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <p className="max-w-md text-center text-sm font-medium text-red-500">
          {errorMessage || rp.notFound}
        </p>
      </div>
    );
  }

  if (isMoldova) {
    return (
      <MoldovaRegionalHeatmap
        rp={rp}
        clusterLabels={clusterLabels}
        regions={data.regions}
        tooltipData={tooltipData}
        setTooltipData={setTooltipData}
        mousePosition={mousePosition}
        setMousePosition={setMousePosition}
      />
    );
  }

  const handleMouseEnter = (regionKey, regionData) => {
    if (!regionData) return;
    setTooltipData({ regionKey, regionData });
  };

  const handleMouseMove = (e) => {
    setMousePosition({ x: e.clientX + 15, y: e.clientY + 15 });
  };

  const handleMouseLeave = () => {
    setTooltipData(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-center text-xl font-extrabold tracking-wide text-[#001A3F]">{rp.title}</h2>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mx-auto max-w-6xl">
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ center: [35.5, 39], scale: 2600 }}
            width={900}
            height={440}
            style={{ width: "100%", height: "auto", display: "block" }}
          >
            <defs>
              <filter id="region-outline-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="2.2" floodColor="#065F46" floodOpacity="0.55" />
              </filter>
            </defs>

            {/* İL DOLGUSU (varsayılanda soluk sınırlar, hover'da odaklanan bölge belirginleşir) */}
            <Geographies geography={PROVINCE_GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const regionKey = PROVINCE_TO_REGION[geo.properties.name] ?? null;
                  const regionData = regionKey ? regionByKey[regionKey] : null;
                  const rawScore = toRawScale(regionData?.migrationIntentScore);
                  const baseFill = colorForScore(rawScore, minScore, maxScore);
                  const isActiveRegion = tooltipData && tooltipData.regionKey === regionKey;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={isActiveRegion ? brightenColor(baseFill) : baseFill}
                      stroke={isActiveRegion ? "#FFFFFF" : "rgba(255,255,255,0.35)"}
                      strokeWidth={isActiveRegion ? 1 : 0.6}
                      style={{
                        default: { outline: "none", transition: "fill 150ms ease, stroke 150ms ease, stroke-width 150ms ease" },
                        hover: { outline: "none", cursor: "pointer" },
                        pressed: { outline: "none" },
                      }}
                      onMouseEnter={() => handleMouseEnter(regionKey, regionData)}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                    />
                  );
                })
              }
            </Geographies>

            {/* BÖLGE DIŞ HATLARI (kalın) */}
            <Geographies geography={REGION_GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const regionKey = geo.properties.region;
                  const isActiveRegion = tooltipData && tooltipData.regionKey === regionKey;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="transparent"
                      stroke="#ffffff"
                      strokeWidth={isActiveRegion ? 2 : 1.25}
                      filter={isActiveRegion ? "url(#region-outline-glow)" : undefined}
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

            {/* KALICI BÖLGE ETİKETLERİ */}
            <Geographies geography={REGION_GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const regionKey = geo.properties.region;
                  const centroid = LABEL_POSITION_OVERRIDES[regionKey] || geoCentroid(geo);
                  if (!centroid || Number.isNaN(centroid[0])) return null;
                  return (
                    <Marker key={geo.rsmKey} coordinates={centroid}>
                      <text
                        textAnchor="middle"
                        style={{
                          pointerEvents: "none",
                          fontSize: 11,
                          fontWeight: 800,
                          fill: "#0f172a",
                          paintOrder: "stroke",
                          stroke: "rgba(255,255,255,0.85)",
                          strokeWidth: 3,
                          strokeLinejoin: "round",
                        }}
                      >
                        {rp.regions[regionKey]}
                      </text>
                    </Marker>
                  );
                })
              }
            </Geographies>
          </ComposableMap>
        </div>

        {/* LEJANT */}
        <div className="mt-4">
          <p className="mb-2 text-center text-xs font-bold tracking-wide text-gray-500">{rp.legendTitle}</p>
          <div
            className="mx-auto h-2.5 w-full max-w-6xl rounded-full"
            style={{ background: `linear-gradient(to right, ${colorForScore(0, 0, 1)}, ${colorForScore(1, 0, 1)})` }}
          />
          <div className="mx-auto mt-1 flex max-w-6xl justify-between text-xs font-medium text-gray-500">
            <span>{rp.legendLow}</span>
            <span>{rp.legendHigh}</span>
          </div>
        </div>

        {/* ALT LEJANT: PROFİL AÇIKLAMALARI */}
        <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-gray-100 pt-4">
          {CLUSTER_ORDER.map((label) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[label] }} />
              <span>
                <span className="font-bold text-[#001A3F]">{label}:</span> {clusterLabels[label]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* FAREYİ TAKİP EDEN TOOLTIP */}
      {tooltipData && (
        <div
          className="pointer-events-none fixed z-50 w-80 rounded-2xl border border-white/10 bg-[#0B1120] p-5 text-white shadow-2xl"
          style={{ top: mousePosition.y, left: mousePosition.x }}
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400/20">
              <Star size={18} className="fill-amber-400 text-amber-400" />
            </div>
            <div>
              <p className="text-base font-bold leading-tight">
                {rp.regionTitleTemplate.replace("{region}", rp.regions[tooltipData.regionKey])}
              </p>
              <p className="text-xs text-blue-200">
                N={tooltipData.regionData.participantCount} {rp.participantsSuffix}
              </p>
            </div>
          </div>

          {tooltipData.regionData.dominantProfile ? (
            <div className="mb-3 rounded-xl bg-white/10 p-3">
              <p className="mb-1 text-[10px] font-bold tracking-wide text-blue-200">{rp.dominantProfileLabel}</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-teal-400">
                  {clusterLabels[tooltipData.regionData.dominantProfile.clusterLabel]}
                </p>
                <p className="shrink-0 text-base font-extrabold text-amber-400">
                  %{formatPct(tooltipData.regionData.dominantProfile.percentage)}
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-3 rounded-xl bg-white/10 p-3 text-xs text-blue-200">{rp.noDataLabel}</div>
          )}

          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/10 p-3">
              <p className="mb-1 text-[10px] font-bold tracking-wide text-blue-200">{rp.overallIntentLabel}</p>
              <p className="text-xl font-extrabold text-yellow-300">
                {formatScore(tooltipData.regionData.migrationIntentScore)}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="mb-1 text-[10px] font-bold tracking-wide text-blue-200">{rp.overallAnxietyLabel}</p>
              <p className="text-xl font-extrabold text-yellow-300">
                {formatScore(tooltipData.regionData.anxietyScore)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="mb-0.5 text-[10px] font-bold tracking-wide text-blue-200">{rp.profileDistributionLabel}</p>
            {CLUSTER_ORDER.map((label) => {
              const dist = tooltipData.regionData.clusterDistribution.find((c) => c.clusterLabel === label);
              return (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[label] }} />
                  <span className="flex-1 text-blue-100">{clusterLabels[label]}</span>
                  <span className="shrink-0 font-bold text-white">{formatPct(dist?.percentage ?? 0)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
