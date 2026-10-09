import { useState } from "react";
import { ChevronDown } from "lucide-react";
import FactorProfileList from "./FactorProfileList.jsx";

const TR_COLOR = "#287D8E";
const MD_COLOR = "#C49A55";
const LOW_N_THRESHOLD = 15;

const GROUP_ORDER = ["noneNone", "familyOnly", "experienceOnly", "both"];
const FACTOR_KEYS = ["ekonomik_istihdam", "egitim", "aile_sosyal", "kulturel", "sosyo_politik", "cevresel", "psikolojik"];

function formatScore(value) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function IndicatorBar({ color, value, count, personUnit, lowSampleLabel }) {
  const isLowN = count > 0 && count < LOW_N_THRESHOLD;
  return (
    <div className="flex items-center gap-3">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full"
          style={{ width: `${value ?? 0}%`, backgroundColor: color, opacity: isLowN ? 0.5 : 1 }}
        />
      </div>
      <span className="w-14 shrink-0 text-right text-sm font-bold" style={{ color }}>
        {formatScore(value)}
      </span>
      <span className="w-24 shrink-0 text-right text-[11px] text-gray-400">
        n={count}
        {isLowN && <span className="ml-1 text-amber-600">({lowSampleLabel})</span>}
      </span>
    </div>
  );
}

// data: /api/comparison-abroad-groups yaniti ({ turkey: {groups}, moldova: {groups} }),
// Comparison.jsx'teki "Ortak Filtreler" durumuna gore ONCEDEN filtrelenmis
// olarak gelir. Gruplar backend'de ZATEN ortalanmis (scores = grup ici
// ortalama), bu yuzden burada tekrar ortalama hesaplanmaz.
export default function AbroadConnectionComparison({ t, data, factorLabels }) {
  const ac = t.abroadConnectionPage;
  const [indicator, setIndicator] = useState("goc_niyeti");
  const [expandedGroup, setExpandedGroup] = useState(null);

  if (!data) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center rounded-2xl bg-white shadow-sm">
        <p className="text-sm font-medium text-gray-400">{ac.loading}</p>
      </div>
    );
  }

  const indicatorOptions = ["goc_niyeti", ...FACTOR_KEYS];
  const indicatorLabel = (key) => (key === "goc_niyeti" ? ac.migrationIntentLabel : factorLabels[key] || key);

  const trByKey = Object.fromEntries(data.turkey.groups.map((g) => [g.key, g]));
  const mdByKey = Object.fromEntries(data.moldova.groups.map((g) => [g.key, g]));

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-[#001A3F]">{ac.title}</h3>
        <p className="mt-1 text-sm text-gray-600">{ac.subtitle}</p>
        <p className="mt-2 text-xs text-gray-400">{ac.causalNote}</p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-1">
          <label className="text-[11px] font-bold tracking-wide text-gray-400">{ac.indicatorLabel}</label>
          <select
            value={indicator}
            onChange={(e) => setIndicator(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
          >
            {indicatorOptions.map((key) => (
              <option key={key} value={key}>
                {indicatorLabel(key)}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3 flex items-center gap-4 text-xs font-semibold text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TR_COLOR }} />
            {ac.turkey}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: MD_COLOR }} />
            {ac.moldova}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {GROUP_ORDER.map((key) => {
            const trGroup = trByKey[key];
            const mdGroup = mdByKey[key];
            const isExpanded = expandedGroup === key;
            return (
              <div key={key} className="rounded-xl border border-gray-100">
                <button
                  type="button"
                  onClick={() => setExpandedGroup(isExpanded ? null : key)}
                  className="flex w-full flex-col gap-2 px-4 py-3 text-left hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#001A3F]">{ac.groupLabels[key]}</span>
                    <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                  <IndicatorBar
                    color={TR_COLOR}
                    value={trGroup?.scores?.[indicator]}
                    count={trGroup?.count ?? 0}
                    personUnit={ac.personUnit}
                    lowSampleLabel={ac.lowSampleWarning}
                  />
                  <IndicatorBar
                    color={MD_COLOR}
                    value={mdGroup?.scores?.[indicator]}
                    count={mdGroup?.count ?? 0}
                    personUnit={ac.personUnit}
                    lowSampleLabel={ac.lowSampleWarning}
                  />
                </button>

                {isExpanded && (
                  <div className="grid grid-cols-1 gap-6 border-t border-gray-100 px-4 py-4 lg:grid-cols-2">
                    <FactorProfileList label={ac.turkey} color={TR_COLOR} scores={trGroup?.scores || {}} factorKeys={FACTOR_KEYS} factorLabels={factorLabels} />
                    <FactorProfileList label={ac.moldova} color={MD_COLOR} scores={mdGroup?.scores || {}} factorKeys={FACTOR_KEYS} factorLabels={factorLabels} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
