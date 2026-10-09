import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { geoNaturalEarth1 } from "d3-geo";

const WORLD_GEO_URL = "/world-countries-110m.json";

// react-simple-maps'in "geoNaturalEarth1" string projeksiyonu sabit bir
// varsayilan olcek (scale) kullanir - bu da dar (yarim genislikteki) kart
// kutularinda dunyanin sag tarafinin (Asya/Avustralya) kutu disina tasip
// kirpilmasina yol aciyordu. Bunun yerine fitSize ile KUTU boyutuna gore
// dinamik olcek hesaplanir, boylece harita boyuttan bagimsiz HER ZAMAN
// tam sigar.
function fitWorldProjection(width, height) {
  return geoNaturalEarth1().fitSize([width, height], { type: "Sphere" });
}

const TR_COLOR = "#287D8E";
const MD_COLOR = "#C49A55";

function formatPct(value) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// 0 (acik) -> renk (koyu) dogrusal gecis.
function colorScale(ratio, baseColorRgb) {
  const LIGHT = [241, 245, 249]; // slate-100 (veri yok / en dusuk)
  const clamped = Math.max(0, Math.min(1, ratio));
  const rgb = LIGHT.map((c, i) => Math.round(c + (baseColorRgb[i] - c) * clamped));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

const TR_RGB = [40, 125, 142];
const MD_RGB = [196, 154, 85];

const FILTER_KEYS = ["cinsiyet", "yasGrubu", "egitimSeviyesi", "calismaDurumu"];

// Tek bir ulkenin choropleth kartini cizer - Turkiye ve Moldova icin yan yana
// iki ornegi kullanilir, boylece paylasilan renk olcegi (sharedMaxPercentage)
// sayesinde iki harita goz karariyla DOGRUDAN kiyaslanabilir (ayri ayri
// aktif-ulke toggle'i ile gidip gelmek yerine).
const CARD_MAP_WIDTH = 480;
const CARD_MAP_HEIGHT = 280;

function ChoroplethCard({ label, color, colorRgb, side, sharedMaxPercentage, tc, onHover, onLeave }) {
  const projection = useMemo(() => fitWorldProjection(CARD_MAP_WIDTH, CARD_MAP_HEIGHT), []);

  const percentageByName = useMemo(() => {
    const map = {};
    if (side) for (const c of side.countries) map[c.name] = c;
    return map;
  }, [side]);

  const topFive = useMemo(() => {
    if (!side) return [];
    return [...side.countries].sort((a, b) => b.percentage - a.percentage).slice(0, 5);
  }, [side]);

  const hasNoData = !side || side.resolvedTotal === 0;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <h4 className="text-sm font-bold text-[#001A3F]">{label}</h4>
      </div>

      {side && (
        <p className="mb-3 text-xs text-gray-500">
          {tc.participantSummaryPrefix} <span className="font-semibold text-[#001A3F]">{side.totalResponses}</span> {tc.personUnit}
          {"; "}
          {tc.namedCountryPrefix} <span className="font-semibold text-[#001A3F]">{side.resolvedTotal}</span> {tc.personUnit}
          {" ("}
          {tc.nonCountryLabel}: {side.nonCountryCount}
          {")"}
        </p>
      )}

      {hasNoData ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-xl bg-gray-50">
          <p className="text-sm font-medium text-gray-400">{tc.noDataForFilters}</p>
        </div>
      ) : (
        <>
          <ComposableMap projection={projection} width={CARD_MAP_WIDTH} height={CARD_MAP_HEIGHT} style={{ width: "100%", height: "auto" }}>
            <Geographies geography={WORLD_GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const match = percentageByName[geo.properties.name];
                  const ratio = match ? match.percentage / sharedMaxPercentage : 0;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={colorScale(ratio, colorRgb)}
                      stroke="#ffffff"
                      strokeWidth={0.4}
                      style={{
                        default: { outline: "none" },
                        hover: { outline: "none", cursor: match ? "pointer" : "default", opacity: match ? 0.85 : 1 },
                        pressed: { outline: "none" },
                      }}
                      onMouseEnter={() => match && onHover(match)}
                      onMouseLeave={onLeave}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>

          <div className="mx-auto mb-4 mt-2 flex max-w-xs items-center gap-2">
            <span className="text-[10px] text-gray-400">{tc.legendLow}</span>
            <div
              className="h-2 flex-1 rounded-full"
              style={{ background: `linear-gradient(to right, ${colorScale(0, colorRgb)}, ${colorScale(1, colorRgb)})` }}
            />
            <span className="text-[10px] text-gray-400">{tc.legendHigh}</span>
          </div>

          <div className="rounded-xl bg-gray-50 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">{tc.topFiveTitle}</p>
            <div className="flex flex-col gap-2">
              {topFive.map((c, i) => (
                <div key={c.name} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-gray-500 shadow-sm">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-xs font-medium text-[#001A3F]" title={tc.countryNames?.[c.name] || c.name}>
                    {tc.countryNames?.[c.name] || c.name}
                  </span>
                  <span className="shrink-0 text-xs font-bold" style={{ color }}>
                    %{formatPct(c.percentage)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// data: /api/target-countries yaniti ({ turkey, moldova, maxPercentage }) -
// Comparison.jsx'teki paylasilan "Ortak Filtreler" durumuna gore ONCEDEN
// filtrelenmis olarak gelir (bkz. Comparison.jsx -> fetchAll). Bu bilesen
// SADECE gosterim yapar, kendi veri cekmez - boylece ayni filtre durumu
// Genel Bakis grafikleriyle TUTARLI kalir.
export default function TargetCountryMaps({ t, data, filters }) {
  const tc = t.targetCountryMapsPage;
  const [tooltip, setTooltip] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Renk olcegi TUM istekte (TR+MD, bu filtre durumu icin) PAYLASILAN tek bir
  // tavana (data.maxPercentage) gore kurulur - boylece "ayni renk, Turkiye ve
  // Moldova'da ayni yuzdeyi ifade etsin" sarti saglanir ve iki harita yan
  // yana DOGRUDAN kiyaslanabilir.
  const sharedMaxPercentage = data?.maxPercentage || 1;

  // Secili grup rozetleri (ulke adi hariç - artik her iki ulke de ayni anda
  // gosterildigi icin rozetler sadece ortak filtreleri yansitir).
  const selectedGroupBadges = useMemo(() => {
    const badges = [];
    for (const key of FILTER_KEYS) {
      const value = filters?.[key];
      if (value && value !== "Hepsi") badges.push(key === "yasGrubu" ? `${value} ${tc.yearsSuffix}` : value);
    }
    return badges;
  }, [filters, tc]);

  if (!data) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center rounded-2xl bg-white shadow-sm">
        <p className="text-sm font-medium text-gray-400">{tc.loading}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" onMouseMove={(e) => setMousePos({ x: e.clientX + 15, y: e.clientY + 15 })}>
      {/* HEDEF ULKE HARITASI (yan yana iki choropleth) */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-[#001A3F]">{tc.choroplethTitle}</h3>
        <p className="mb-3 text-xs text-gray-400">{tc.choroplethSubtitle}</p>

        {selectedGroupBadges.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold tracking-wide text-gray-400">{tc.selectedGroupLabel}:</span>
            {selectedGroupBadges.map((badge, i) => (
              <span key={i} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                {badge}
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ChoroplethCard
            label={tc.turkey}
            color={TR_COLOR}
            colorRgb={TR_RGB}
            side={data.turkey}
            sharedMaxPercentage={sharedMaxPercentage}
            tc={tc}
            onHover={setTooltip}
            onLeave={() => setTooltip(null)}
          />
          <ChoroplethCard
            label={tc.moldova}
            color={MD_COLOR}
            colorRgb={MD_RGB}
            side={data.moldova}
            sharedMaxPercentage={sharedMaxPercentage}
            tc={tc}
            onHover={setTooltip}
            onLeave={() => setTooltip(null)}
          />
        </div>

        {tooltip && (
          <div
            className="pointer-events-none fixed z-50 rounded-xl border border-gray-100 bg-white px-4 py-2.5 shadow-lg"
            style={{ top: mousePos.y, left: mousePos.x }}
          >
            <p className="text-sm font-bold text-[#001A3F]">{tc.countryNames?.[tooltip.name] || tooltip.name}</p>
            <p className="text-xs text-gray-500">
              {tooltip.count} {tc.personUnit} • %{formatPct(tooltip.percentage)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
