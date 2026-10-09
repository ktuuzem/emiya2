import { useState } from "react";
import {
  Landmark,
  MapPin,
  User,
  Briefcase,
  Mail,
  Phone,
  Send,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";
import { LanguageSelector } from "./i18n.jsx";

const API_BASE_URL = "http://localhost:5000";

// Kurum Basvuru Formu'nun "Kurum Adi" alani icin (simdilik) sabit secenek
// listesi; mevcut kurumlarin veri tabanindaki gercek isimleriyle birebir
// aynidir ("İç işleri Bakanlığı" bosluklu yazimla, gercek/sifreli kurumla eslesir).
const INSTITUTION_NAME_OPTIONS = ["İç işleri Bakanlığı", "Dışişleri Bakanlığı", "Millî Eğitim Bakanlığı"];

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

const inputClasses =
  "w-full rounded-xl border border-gray-200 bg-white py-3 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";
const selectClasses =
  "w-full appearance-none rounded-xl border border-gray-200 bg-white py-3 pr-10 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";

function RequiredMark() {
  return <span className="text-red-500"> *</span>;
}

function TextField({ icon: Icon, label, required, value, onChange, placeholder, type = "text" }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-[#001A3F]">
        {label}
        {required && <RequiredMark />}
      </label>
      <div className="relative flex items-center">
        <div style={iconWrapperStyle}>
          <Icon size={18} className="text-blue-700" />
        </div>
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={inputPaddingStyle}
          className={inputClasses}
        />
      </div>
    </div>
  );
}

function SelectField({ icon: Icon, label, required, value, onChange, options, placeholder }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-[#001A3F]">
        {label}
        {required && <RequiredMark />}
      </label>
      <div className="relative flex items-center">
        <div style={iconWrapperStyle}>
          <Icon size={18} className="text-blue-700" />
        </div>
        <select
          value={value}
          onChange={onChange}
          style={inputPaddingStyle}
          className={`${selectClasses} ${value ? "text-gray-700" : "text-gray-400"}`}
        >
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

export default function InstitutionApply({ lang, setLang, t, onGoHome }) {
  const ia = t.institutionApplyPage;
  const provinceOptions = t.demographicsPage.provinceOptions;

  const [institutionName, setInstitutionName] = useState("");
  const [institutionType, setInstitutionType] = useState("");
  const [province, setProvince] = useState("");
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/institution-applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionName,
          institutionType,
          province,
          fullName,
          title,
          email,
          phone,
          reason,
          kvkkAccepted,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.message || ia.submitError);
        return;
      }
      setSubmitted(true);
    } catch {
      setErrorMessage(ia.networkError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[url('/girisarkaplan.png')] bg-cover bg-center bg-no-repeat bg-fixed">
      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-16 pt-8">
        {/* HEADER - Dil seçici */}
        <div className="flex justify-end">
          <LanguageSelector lang={lang} setLang={setLang} t={t} />
        </div>

        {/* KART */}
        <div className="mx-auto mt-6 w-full max-w-5xl rounded-3xl bg-white p-8 shadow-lg md:p-12">
          {/* BAŞLIK */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Landmark size={30} className="text-blue-700" strokeWidth={2} />
            </div>
            <h1 className="text-2xl font-extrabold tracking-wide text-blue-700 sm:text-3xl">
              {ia.pageTitle}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">
              {ia.pageSubtitleLine1}
              <br />
              {ia.pageSubtitleLine2}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* 1. KURUM BİLGİLERİ */}
            <div className="mb-8">
              <h2 className="mb-3 border-b border-gray-100 pb-3 text-base font-bold text-blue-700">
                {ia.section1Title}
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SelectField
                  icon={Landmark}
                  label={ia.institutionNameLabel}
                  required
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  options={INSTITUTION_NAME_OPTIONS}
                  placeholder={ia.institutionNamePlaceholder}
                />
                <SelectField
                  icon={Landmark}
                  label={ia.institutionTypeLabel}
                  required
                  value={institutionType}
                  onChange={(e) => setInstitutionType(e.target.value)}
                  options={ia.institutionTypeOptions}
                  placeholder={ia.selectPlaceholder}
                />
                <SelectField
                  icon={MapPin}
                  label={ia.provinceLabel}
                  required
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  options={provinceOptions}
                  placeholder={ia.provincePlaceholder}
                />
              </div>
            </div>

            {/* 2. YETKİLİ BİLGİLERİ */}
            <div className="mb-6">
              <h2 className="mb-3 border-b border-gray-100 pb-3 text-base font-bold text-blue-700">
                {ia.section2Title}
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField
                  icon={User}
                  label={ia.fullNameLabel}
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={ia.fullNamePlaceholder}
                />
                <TextField
                  icon={Briefcase}
                  label={ia.titleLabel}
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={ia.titlePlaceholder}
                />
                <TextField
                  icon={Mail}
                  label={ia.emailLabel}
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={ia.emailPlaceholder}
                />
                <TextField
                  icon={Phone}
                  label={ia.phoneLabel}
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={ia.phonePlaceholder}
                />
              </div>
            </div>

            {/* KVKK */}
            <label className="mb-6 flex items-start gap-2 text-sm text-[#001A3F]">
              <input
                type="checkbox"
                checked={kvkkAccepted}
                onChange={(e) => setKvkkAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-700 focus:ring-blue-600"
              />
              <span>
                {ia.kvkkPrefixText}
                <span className="font-semibold text-blue-700">{ia.kvkkWord}</span>
                {ia.kvkkMiddleText}
                <span className="font-semibold text-blue-700">{ia.kvkkDisclosureWord}</span>
                {ia.kvkkSuffixText}
              </span>
            </label>

            {/* AÇIKLAMA */}
            <div className="mb-8 flex flex-col gap-2">
              <label className="text-sm font-semibold text-[#001A3F]">
                {ia.reasonLabel}
                <RequiredMark />
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={ia.reasonPlaceholder}
                rows={4}
                className="w-full resize-y rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            {submitted && (
              <p className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-center text-sm font-medium text-blue-700">
                {ia.submittedMessage}
              </p>
            )}

            {errorMessage && (
              <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">
                {errorMessage}
              </p>
            )}

            {/* GÖNDER */}
            <button
              type="submit"
              disabled={isSubmitting || !kvkkAccepted}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 py-3.5 font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send size={18} />
              {isSubmitting ? ia.submittingLabel : ia.submitButton}
            </button>

            <p className="mt-4 text-center text-xs text-gray-500">
              {ia.requiredNote}
            </p>
          </form>

          <button
            type="button"
            onClick={onGoHome}
            className="text-sm text-gray-500 hover:text-gray-800 flex items-center justify-center gap-1.5 mt-4 transition-colors font-medium mx-auto"
          >
            <ArrowLeft size={16} />
            {ia.backToHome}
          </button>
        </div>
      </div>
    </div>
  );
}
