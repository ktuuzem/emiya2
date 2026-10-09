import { useEffect, useState } from "react";
import {
  ClipboardList,
  BarChart3,
  History,
  Bell,
  Moon,
  Sun,
  ChevronDown,
  User,
  LogOut,
  CheckCircle2,
  Shield,
  Calendar,
  Users,
  GraduationCap,
  Wallet,
  Home,
  MapPin,
  Briefcase,
  Languages,
  Globe,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { LanguageSelector } from "./i18n.jsx";

const API_BASE_URL = "http://localhost:5000";

const selectClasses =
  "w-full appearance-none pr-10 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600";
const inputClasses =
  "w-full pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600";
const inputPaddingStyle = { paddingLeft: "2.75rem" };
const iconWrapperStyle = {
  position: "absolute",
  left: "0.85rem",
  top: "50%",
  transform: "translateY(-50%)",
  pointerEvents: "none",
};
const rightIconWrapperStyle = {
  position: "absolute",
  right: "0.85rem",
  top: "50%",
  transform: "translateY(-50%)",
};

function RequiredMark() {
  return <span className="text-red-500"> *</span>;
}

function SelectField({ icon: Icon, label, value, onChange, options, placeholder }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-[#001A3F]">
        {label}
        <RequiredMark />
      </label>
      <div className="relative flex items-center">
        <div style={iconWrapperStyle}>
          <Icon size={18} className="text-teal-600" />
        </div>
        <select value={value} onChange={onChange} style={inputPaddingStyle} className={`${selectClasses} ${value ? "text-gray-700" : "text-gray-400"}`}>
          <option value="" disabled hidden>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt} value={opt} className="text-gray-700">
              {opt}
            </option>
          ))}
        </select>
        <div style={rightIconWrapperStyle} className="pointer-events-none">
          <ChevronDown size={18} className="text-gray-400" />
        </div>
      </div>
    </div>
  );
}

// Demografik Bilgiler adiminin (adim cubugu + form + sidebar) saf icerigi:
// ogrenciye ozel navbar/header disinda, tek basina da gomulebilir.
export function DemographicsContent({ t, onNext }) {
  const c = t.surveyConsentPage;
  const d = t.demographicsPage;

  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [education, setEducation] = useState("");
  const [income, setIncome] = useState("");
  const [birthplace, setBirthplace] = useState("");
  const [currentResidence, setCurrentResidence] = useState("");
  const [province, setProvince] = useState("");
  const [employment, setEmployment] = useState("");
  const [sector, setSector] = useState("");
  const [sectorOther, setSectorOther] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [customLanguageName, setCustomLanguageName] = useState("");
  const [languageLevels, setLanguageLevels] = useState({});
  const [familyAbroad, setFamilyAbroad] = useState("");
  const [previousAbroad, setPreviousAbroad] = useState("");
  const [targetCountry, setTargetCountry] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ageOptions = Array.from({ length: 30 - 18 + 1 }, (_, i) => String(18 + i));
  const noForeignLanguage = d.languageOptions[0];
  const otherLanguageOption = d.languageOptions[d.languageOptions.length - 1];

  const toggleLanguage = (option) => {
    setSelectedLanguages((prev) => {
      if (option === noForeignLanguage) {
        return prev.includes(option) ? [] : [option];
      }
      const withoutNoLanguage = prev.filter((l) => l !== noForeignLanguage);
      const next = withoutNoLanguage.includes(option)
        ? withoutNoLanguage.filter((l) => l !== option)
        : [...withoutNoLanguage, option];

      // Seçim kaldırıldığında o dile ait seviye kaydını da temizle.
      if (!next.includes(option)) {
        const keyToRemove = option === otherLanguageOption
          ? customLanguageName.trim() || otherLanguageOption
          : option;
        setLanguageLevels((prevLevels) => {
          const { [keyToRemove]: _removed, ...rest } = prevLevels;
          return rest;
        });
        if (option === otherLanguageOption) {
          setCustomLanguageName("");
        }
      }

      return next;
    });
  };

  const handleCustomLanguageNameChange = (value) => {
    const oldKey = customLanguageName.trim() || otherLanguageOption;
    setLanguageLevels((prevLevels) => {
      const { [oldKey]: _removed, ...rest } = prevLevels;
      return rest;
    });
    setCustomLanguageName(value);
  };

  // "Diğer" işaretlenir işaretlenmez, kullanıcı henüz bir dil adı yazmamış olsa
  // bile "Diğer dil düzeyiniz:" seviyesi hemen görünür; dil adı yazıldığında
  // etiket o dile göre güncellenir.
  const languagesNeedingLevel = selectedLanguages
    .filter((l) => l !== noForeignLanguage && l !== otherLanguageOption)
    .concat(
      selectedLanguages.includes(otherLanguageOption)
        ? [customLanguageName.trim() || otherLanguageOption]
        : []
    );

  const isCurrentlyEmployed = employment === d.employmentOptions[0];
  const isSectorOther = sector === d.sectorOptions[d.sectorOptions.length - 1];

  const isFormComplete = () => {
    if (!gender) return false;
    if (!age) return false;
    if (!maritalStatus) return false;
    if (!education) return false;
    if (!income) return false;
    if (!birthplace) return false;
    if (!currentResidence) return false;
    if (!province) return false;
    if (!employment) return false;
    if (isCurrentlyEmployed) {
      if (!sector) return false;
      if (isSectorOther && !sectorOther.trim()) return false;
    }
    if (selectedLanguages.length === 0) return false;
    if (selectedLanguages.includes(otherLanguageOption) && !customLanguageName.trim()) return false;
    for (const langName of languagesNeedingLevel) {
      if (!languageLevels[langName]) return false;
    }
    if (!familyAbroad) return false;
    if (!previousAbroad) return false;
    if (!targetCountry) return false;
    return true;
  };

  const handleNext = async () => {
    if (!isFormComplete()) {
      setErrorMessage(d.requiredFieldsError);
      return;
    }
    setErrorMessage("");

    const stored = localStorage.getItem("goclab_session");
    const token = stored ? JSON.parse(stored)?.token : null;

    // Ogrenci oturumu yoksa (orn. kurum panelinden onizleme yapiliyorsa),
    // sunucuya kaydetmeden dogrudan bir sonraki adima gec.
    if (!token) {
      onNext?.();
      return;
    }

    const resolvedLanguages = selectedLanguages.map((l) =>
      l === otherLanguageOption ? customLanguageName.trim() || otherLanguageOption : l
    );

    const payload = {
      gender,
      age: age ? parseInt(age, 10) : null,
      maritalStatus,
      education,
      income,
      province,
      targetCountry,
      employment,
      employmentSector: isCurrentlyEmployed ? (isSectorOther ? sectorOther : sector) : null,
      foreignLanguage: resolvedLanguages.join(", "),
      languageLevel: JSON.stringify(languageLevels),
    };

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/demographics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || d.requiredFieldsError);
        return;
      }

      onNext?.();
    } catch {
      setErrorMessage(d.requiredFieldsError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full px-4 py-8 md:px-12 lg:px-20 mx-auto">
      {/* BAŞLIK */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black">
          <img src="/onam.png" alt="" className="h-full w-full object-cover" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-[#001A3F]">{c.pageTitle}</h1>
          <p className="text-sm text-gray-500">{d.pageSubtitle}</p>
        </div>
      </div>

      {/* STEPPER + İLERLEME */}
      <div className="mb-6 flex w-full flex-col gap-6 rounded-2xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">
              1
            </div>
            <CheckCircle2 size={18} className="text-teal-600" />
          </div>
          <span className="ml-2 text-sm font-semibold text-teal-600">{c.steps.consent}</span>

          <div className="mx-4 h-px flex-1 bg-teal-200" />

          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">
            2
          </div>
          <span className="ml-2 text-sm font-semibold text-teal-600">{c.steps.demographic}</span>

          <div className="mx-4 h-px flex-1 bg-gray-200" />

          <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-gray-200 text-sm font-bold text-gray-400">
            3
          </div>
          <span className="ml-2 text-sm font-medium text-gray-400">{c.steps.rating}</span>
        </div>

        <div className="flex items-center gap-4 border-t border-gray-100 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <div>
            <p className="text-xs font-medium text-gray-400">{c.progressLabel}</p>
            <p className="text-xl font-bold text-[#001A3F]">%33</p>
            <div className="mt-1 h-1.5 w-32 rounded-full bg-gray-100">
              <div className="h-1.5 w-[33%] rounded-full bg-teal-600" />
            </div>
            <p className="mt-1 text-xs text-gray-400">{c.estimatedTime}</p>
          </div>
        </div>
      </div>

      {/* Etik Kurul Kutusu */}
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-5 py-4">
        <Shield size={20} className="shrink-0 text-teal-600" />
        <p className="text-sm text-[#001A3F]">
          <span className="font-bold">{c.ethicsLabel}</span> {c.ethicsText}
        </p>
      </div>

      {/* GRID: FORM + SIDEBAR */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* FORM ALANI */}
        <div className="lg:col-span-3 w-full rounded-2xl bg-white p-6 shadow-sm md:p-8">
          <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-[#001A3F]">
            <Users size={22} className="text-teal-600" />
            {d.sectionTitle}
          </h2>

          <div className="space-y-6">
            {/* Cinsiyet + Yaş */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[#001A3F]">
                  {d.genderLabel}
                  <RequiredMark />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setGender(d.genderFemale)}
                    className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-colors ${
                      gender === d.genderFemale
                        ? "border-teal-600 bg-teal-50 text-teal-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span aria-hidden="true">♀</span>
                    {d.genderFemale}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender(d.genderMale)}
                    className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-colors ${
                      gender === d.genderMale
                        ? "border-teal-600 bg-teal-50 text-teal-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span aria-hidden="true">♂</span>
                    {d.genderMale}
                  </button>
                </div>
              </div>

              <SelectField
                icon={Calendar}
                label={d.ageLabel}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                options={ageOptions}
                placeholder={d.agePlaceholder}
              />
            </div>

            {/* Medeni Durum / Eğitim / Gelir */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SelectField
                icon={Users}
                label={d.maritalStatusLabel}
                value={maritalStatus}
                onChange={(e) => setMaritalStatus(e.target.value)}
                options={d.maritalStatusOptions}
                placeholder={d.selectPlaceholder}
              />
              <SelectField
                icon={GraduationCap}
                label={d.educationLabel}
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                options={d.educationOptions}
                placeholder={d.selectPlaceholder}
              />
              <SelectField
                icon={Wallet}
                label={d.incomeLabel}
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                options={d.incomeOptions}
                placeholder={d.selectPlaceholder}
              />
            </div>

            {/* Doğum Yeri / Mevcut İkamet / İl */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SelectField
                icon={MapPin}
                label={d.birthplaceLabel}
                value={birthplace}
                onChange={(e) => setBirthplace(e.target.value)}
                options={d.birthplaceOptions}
                placeholder={d.selectPlaceholder}
              />
              <SelectField
                icon={Home}
                label={d.currentResidenceLabel}
                value={currentResidence}
                onChange={(e) => setCurrentResidence(e.target.value)}
                options={d.currentResidenceOptions}
                placeholder={d.selectPlaceholder}
              />
              <SelectField
                icon={MapPin}
                label={d.provinceLabel}
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                options={d.provinceOptions}
                placeholder={d.provincePlaceholder}
              />
            </div>

            {/* İş/Çalışma Durumu */}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-sm font-semibold text-[#001A3F]">
                <Briefcase size={16} className="text-teal-600" />
                {d.employmentLabel}
                <RequiredMark />
              </label>
              <div className="flex flex-wrap gap-3">
                {d.employmentOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setEmployment(opt);
                      if (opt !== d.employmentOptions[0]) {
                        setSector("");
                        setSectorOther("");
                      }
                    }}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                      employment === opt
                        ? "border-teal-600 bg-teal-50 text-teal-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                        employment === opt ? "border-teal-600" : "border-gray-300"
                      }`}
                    >
                      {employment === opt && <span className="h-2 w-2 rounded-full bg-teal-600" />}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Koşullu: Sektör */}
            {isCurrentlyEmployed && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectField
                  icon={Briefcase}
                  label={d.sectorLabel}
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  options={d.sectorOptions}
                  placeholder={d.sectorPlaceholder}
                />

                {/* Koşullu: Sektör = Diğer */}
                {isSectorOther && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-[#001A3F]">
                      {d.sectorOtherLabel}
                      <RequiredMark />
                    </label>
                    <div className="relative flex items-center">
                      <div style={iconWrapperStyle}>
                        <Briefcase size={18} className="text-teal-600" />
                      </div>
                      <input
                        type="text"
                        value={sectorOther}
                        onChange={(e) => setSectorOther(e.target.value)}
                        placeholder={d.sectorOtherPlaceholder}
                        style={inputPaddingStyle}
                        className={inputClasses}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Yabancı Dil Bilgisi */}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-sm font-semibold text-[#001A3F]">
                <Languages size={16} className="text-teal-600" />
                {d.languageLabel}
                <RequiredMark />
              </label>
              <div className="flex flex-wrap gap-3">
                {d.languageOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleLanguage(opt)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      selectedLanguages.includes(opt)
                        ? "border-teal-600 bg-teal-50 text-teal-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              {/* Koşullu: "Diğer" seçilirse dil adı metin kutusu */}
              {selectedLanguages.includes(otherLanguageOption) && (
                <div className="mt-2 flex flex-col gap-2">
                  <label className="text-sm font-semibold text-[#001A3F]">
                    {d.customLanguageLabel}
                    <RequiredMark />
                  </label>
                  <div className="relative flex items-center">
                    <div style={iconWrapperStyle}>
                      <Languages size={18} className="text-teal-600" />
                    </div>
                    <input
                      type="text"
                      value={customLanguageName}
                      onChange={(e) => handleCustomLanguageNameChange(e.target.value)}
                      placeholder={d.customLanguagePlaceholder}
                      style={inputPaddingStyle}
                      className={inputClasses}
                    />
                  </div>
                </div>
              )}

              {/* Koşullu: Seçilen her dil için seviye menüsü */}
              {languagesNeedingLevel.length > 0 && (
                <div className="mt-2 grid grid-cols-1 gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
                  {languagesNeedingLevel.map((langName) => (
                    <SelectField
                      key={langName}
                      icon={Languages}
                      label={d.languageLevelLabel.replace("{lang}", langName)}
                      value={languageLevels[langName] || ""}
                      onChange={(e) =>
                        setLanguageLevels((prev) => ({ ...prev, [langName]: e.target.value }))
                      }
                      options={d.languageLevelOptions}
                      placeholder={d.languageLevelPlaceholder}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Aile / Önceki Yurt Dışı Deneyimi */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[#001A3F]">
                  {d.familyAbroadLabel}
                  <RequiredMark />
                </label>
                <div className="flex gap-3">
                  {[d.yes, d.no].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFamilyAbroad(opt)}
                      className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                        familyAbroad === opt
                          ? "border-teal-600 bg-teal-50 text-teal-700"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                          familyAbroad === opt ? "border-teal-600" : "border-gray-300"
                        }`}
                      >
                        {familyAbroad === opt && <span className="h-2 w-2 rounded-full bg-teal-600" />}
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[#001A3F]">
                  {d.previousAbroadLabel}
                  <RequiredMark />
                </label>
                <div className="flex gap-3">
                  {[d.yes, d.no].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setPreviousAbroad(opt)}
                      className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                        previousAbroad === opt
                          ? "border-teal-600 bg-teal-50 text-teal-700"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                          previousAbroad === opt ? "border-teal-600" : "border-gray-300"
                        }`}
                      >
                        {previousAbroad === opt && <span className="h-2 w-2 rounded-full bg-teal-600" />}
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Hedef Ülke */}
            <SelectField
              icon={Globe}
              label={d.targetCountryLabel}
              value={targetCountry}
              onChange={(e) => setTargetCountry(e.target.value)}
              options={d.targetCountryOptions}
              placeholder={d.targetCountryPlaceholder}
            />
          </div>

          {/* Hata mesajı */}
          {errorMessage && (
            <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">
              {errorMessage}
            </p>
          )}

          {/* SSL + İleri */}
          <div className="mt-6 flex flex-col-reverse items-center justify-between gap-4 border-t border-gray-100 pt-6 md:flex-row">
            <p className="flex items-center gap-2 text-xs text-gray-500">
              <Shield size={14} className="text-teal-600" />
              {d.sslText}
            </p>
            <button
              type="button"
              onClick={handleNext}
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {d.nextButton}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl bg-blue-50 p-6">
            <div className="mb-3 flex items-center gap-2">
              <Shield size={20} className="text-blue-600" />
              <h3 className="font-bold text-[#001A3F]">{d.sidebarTitle}</h3>
            </div>
            <p className="mb-4 text-sm text-gray-600">{d.sidebarText}</p>
            <ul className="space-y-3 text-sm text-[#001A3F]">
              {d.sidebarItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-blue-600" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex justify-center overflow-hidden rounded-2xl bg-black/90">
              <img src="/onam.png" alt="" className="h-40 w-full object-cover opacity-90" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Demographics({ lang, setLang, t, onNext, onLogout, onGoToResults, onGoToHistory }) {
  const c = t.surveyConsentPage;

  const [user, setUser] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("goclab_session");
      if (stored) setUser(JSON.parse(stored));
    } catch {
      setUser(null);
    }
  }, []);

  const displayName = user?.first_name
    ? `${user.first_name} ${user?.last_name ? user.last_name.charAt(0).toUpperCase() + "." : ""}`.trim()
    : c.userRole;
  const avatarInitials = (user?.first_name?.charAt(0) ?? "") + (user?.last_name?.charAt(0) ?? "");

  const handleLogout = () => {
    try {
      localStorage.removeItem("goclab_session");
    } catch {}
    setIsDropdownOpen(false);
    onLogout?.();
  };

  return (
    <div className="min-h-screen w-full bg-gray-50">
      {/* NAVBAR */}
      <nav className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 bg-white px-6 py-3 md:px-10">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <ClipboardList size={18} />
            {c.navSurvey}
          </button>
          <button
            type="button"
            onClick={onGoToResults}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            <BarChart3 size={18} />
            {c.navResults}
          </button>
          <button
            type="button"
            onClick={onGoToHistory}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            <History size={18} />
            {c.navHistory}
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
                <p className="text-xs text-gray-500">{c.userRole}</p>
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
                  {c.logoutLabel}
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

      <DemographicsContent t={t} onNext={onNext} />
    </div>
  );
}
