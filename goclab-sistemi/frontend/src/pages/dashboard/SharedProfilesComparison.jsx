import { useState } from "react";
import { ListChecks, Users2 } from "lucide-react";
import FactorProfileList from "./FactorProfileList.jsx";

const TR_COLOR = "#287D8E";
const MD_COLOR = "#C49A55";
const FACTOR_KEYS = ["ekonomik_istihdam", "egitim", "aile_sosyal", "kulturel", "sosyo_politik", "cevresel", "psikolojik"];

function formatNumber(value, decimals = 1) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("tr-TR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// Tum profillerin TR/MD yuzdeleri AYNI eksende (0-axisMax) okunsun diye
// ortak bir ust sinir hesaplanir - en buyuk degerin bir ust 10'luguna
// yuvarlanir (en az 20, mockup'taki 0-40 eksenine benzer bir okunabilirlik icin).
function computeAxisMax(values) {
  const max = Math.max(0, ...values);
  return Math.max(20, Math.ceil((max + 2) / 10) * 10);
}

function ProfileBadge({ profileKey }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-700">
      {profileKey}
    </span>
  );
}

function BarRow({ color, value, axisMax, count }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full" style={{ width: `${((value ?? 0) / axisMax) * 100}%`, backgroundColor: color }} />
      </div>
      <span className="w-12 shrink-0 text-xs font-bold" style={{ color }}>
        %{formatNumber(value)}
      </span>
      <span className="w-14 shrink-0 text-[10px] text-gray-400">n={count ?? 0}</span>
    </div>
  );
}

function CountryStatCard({ color, label, percentage, count, personUnit }) {
  return (
    <div className="flex-1 rounded-xl p-3" style={{ backgroundColor: `${color}0F` }}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide" style={{ color }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold" style={{ color }}>
        %{formatNumber(percentage)}
      </p>
      <p className="text-[11px] text-gray-400">
        {count ?? 0} {personUnit}
      </p>
    </div>
  );
}

function DetailStat({ label, trValue, mdValue }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex items-center gap-4">
        <span className="text-xs font-bold" style={{ color: TR_COLOR }}>
          {trValue}
        </span>
        <span className="text-xs font-bold" style={{ color: MD_COLOR }}>
          {mdValue}
        </span>
      </div>
    </div>
  );
}

// data: /api/comparison-profiles yaniti ({ turkey: {totalParticipants, profiles}, moldova: {...} }),
// Comparison.jsx'teki "Ortak Filtreler" durumuna gore ONCEDEN filtrelenmis
// gelir. Profiller TR+MD BIRLESIK (pooled, sabit) merkezlere gore atandigi
// icin P1-P5 etiketi HER IKI ulkede AYNI anlami tasir.
export default function SharedProfilesComparison({ t, data, factorLabels }) {
  const sp = t.sharedProfilesPage;
  const [selectedKey, setSelectedKey] = useState(null);
  const [detailView, setDetailView] = useState(null); // null | "factors" | "demographics"

  if (!data) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center rounded-2xl bg-white shadow-sm">
        <p className="text-sm font-medium text-gray-400">{sp.loading}</p>
      </div>
    );
  }

  const trByKey = Object.fromEntries(data.turkey.profiles.map((p) => [p.key, p]));
  const mdByKey = Object.fromEntries(data.moldova.profiles.map((p) => [p.key, p]));
  const profileKeys = data.turkey.profiles.map((p) => p.key);
  const activeKey = selectedKey || profileKeys[0];
  // Profil basliklari backend'den sadece Turkce varsayilan metinle gelir -
  // arayuz dilinde dogru gorunmesi icin i18n'deki sp.profileTitles tercih
  // edilir (yoksa API'nin kendi basligina duser).
  const titleFor = (key, fallback) => sp.profileTitles?.[key] || fallback;
  const trActive = trByKey[activeKey];
  const mdActive = mdByKey[activeKey];

  const axisMax = computeAxisMax(profileKeys.flatMap((k) => [trByKey[k]?.percentage ?? 0, mdByKey[k]?.percentage ?? 0]));
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round((axisMax / tickCount) * i));

  const diff = (mdActive?.percentage ?? 0) - (trActive?.percentage ?? 0);
  const insightText =
    Math.abs(diff) < 0.5
      ? sp.similarShareNote
      : (diff > 0 ? sp.higherInMoldovaTemplate : sp.higherInTurkeyTemplate).replace("{value}", formatNumber(Math.abs(diff)));

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-[#001A3F]">{sp.title}</h3>
        <p className="mt-1 text-sm text-gray-600">{sp.subtitle}</p>
        <p className="mt-2 text-xs text-gray-400">{sp.methodNote}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {/* PROFIL DAGILIMI */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#001A3F]">{sp.distributionTitle}</h4>
            <div className="flex items-center gap-3 text-xs font-semibold text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TR_COLOR }} />
                {sp.turkey}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: MD_COLOR }} />
                {sp.moldova}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-[2.5rem_11rem_1fr] items-center gap-3 px-2">
            <div />
            <div />
            <div className="relative h-4">
              {ticks.map((tv) => (
                <span
                  key={tv}
                  className="absolute -translate-x-1/2 text-[10px] text-gray-400"
                  style={{ left: `${(tv / axisMax) * 100}%` }}
                >
                  {tv}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            {profileKeys.map((key) => {
              const tr = trByKey[key];
              const md = mdByKey[key];
              const isActive = key === activeKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  className="grid grid-cols-[2.5rem_11rem_1fr] items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-gray-50"
                  style={isActive ? { backgroundColor: "#EEF2FF" } : undefined}
                >
                  <ProfileBadge profileKey={key} />
                  <span className="text-sm font-semibold leading-tight text-[#001A3F]">{titleFor(key, tr?.title)}</span>
                  <div className="flex flex-col gap-1.5">
                    <BarRow color={TR_COLOR} value={tr?.percentage} axisMax={axisMax} count={tr?.count} />
                    <BarRow color={MD_COLOR} value={md?.percentage} axisMax={axisMax} count={md?.count} />
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-gray-400">{sp.percentageNote}</p>
        </div>

        {/* SECILI PROFIL */}
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{sp.selectedProfileLabel}</p>
            <div className="mt-2 flex items-start gap-2">
              <ProfileBadge profileKey={activeKey} />
              <h4 className="text-base font-bold leading-snug text-[#001A3F]">{titleFor(activeKey, trActive?.title)}</h4>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <CountryStatCard color={TR_COLOR} label={sp.turkey} percentage={trActive?.percentage} count={trActive?.count} personUnit={sp.personUnit} />
            <CountryStatCard color={MD_COLOR} label={sp.moldova} percentage={mdActive?.percentage} count={mdActive?.count} personUnit={sp.personUnit} />
          </div>

          <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">{insightText}</div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{sp.migrationIntentLabel}</span>
            <span>
              <span className="font-bold" style={{ color: TR_COLOR }}>
                {formatNumber(trActive?.detail?.migrationIntent)}
              </span>
              {" / "}
              <span className="font-bold" style={{ color: MD_COLOR }}>
                {formatNumber(mdActive?.detail?.migrationIntent)}
              </span>
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setDetailView((v) => (v === "factors" ? null : "factors"))}
              className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors ${
                detailView === "factors" ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <ListChecks size={14} />
              {sp.openFactorProfileButton}
            </button>
            <button
              type="button"
              onClick={() => setDetailView((v) => (v === "demographics" ? null : "demographics"))}
              className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors ${
                detailView === "demographics" ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Users2 size={14} />
              {sp.demographicDetailsButton}
            </button>
          </div>
        </div>
      </div>

      {detailView === "factors" && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h4 className="mb-4 text-sm font-bold text-[#001A3F]">{sp.openFactorProfileButton}</h4>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <FactorProfileList label={sp.turkey} color={TR_COLOR} scores={trActive?.detail?.factors || {}} factorKeys={FACTOR_KEYS} factorLabels={factorLabels} />
            <FactorProfileList label={sp.moldova} color={MD_COLOR} scores={mdActive?.detail?.factors || {}} factorKeys={FACTOR_KEYS} factorLabels={factorLabels} />
          </div>
        </div>
      )}

      {detailView === "demographics" && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h4 className="mb-2 text-sm font-bold text-[#001A3F]">{sp.demographicDetailsButton}</h4>
          <DetailStat label={sp.ageLabel} trValue={formatNumber(trActive?.detail?.age)} mdValue={formatNumber(mdActive?.detail?.age)} />
          <DetailStat
            label={sp.languageLabel}
            trValue={formatNumber(trActive?.detail?.languageCount, 2)}
            mdValue={formatNumber(mdActive?.detail?.languageCount, 2)}
          />
          <DetailStat
            label={sp.abroadExperienceLabel}
            trValue={`%${formatNumber(trActive?.detail?.abroadExperiencePercentage)}`}
            mdValue={`%${formatNumber(mdActive?.detail?.abroadExperiencePercentage)}`}
          />
        </div>
      )}
    </div>
  );
}
