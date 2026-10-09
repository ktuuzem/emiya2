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
  CheckCircle2,
  Shield,
  BookOpen,
  Lock,
  AlertTriangle,
  Mail,
  Phone,
  MessageSquare,
  ArrowRight,
  LogOut,
  Loader2,
} from "lucide-react";
import { LanguageSelector } from "./i18n.jsx";

const API_BASE_URL = "http://localhost:5000";

// Onam Formu'nun (adim cubugu + asil beyaz kart) saf icerigi: ogrenciye ozel
// navbar/header disinda, tek basina (ornegin kurum panelinde) da gomulebilir.
export function SurveyConsentContent({ t, onContinue }) {
  const c = t.surveyConsentPage;
  const [isConsentGiven, setIsConsentGiven] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const infoParts = c.infoParagraph.split("{pi}");

  const handleContinue = async () => {
    setErrorMessage("");

    const stored = localStorage.getItem("goclab_session");
    const token = stored ? JSON.parse(stored)?.token : null;

    // Ogrenci oturumu yoksa (orn. kurum panelinden onizleme yapiliyorsa),
    // sunucuya kaydetmeden dogrudan bir sonraki adima gec.
    if (!token) {
      onContinue?.();
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/consent`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || c.consentCheckbox);
        return;
      }

      onContinue?.();
    } catch {
      setErrorMessage(c.consentCheckbox);
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
        <h1 className="text-3xl font-extrabold text-[#001A3F]">{c.pageTitle}</h1>
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

          <div className="mx-4 h-px flex-1 bg-gray-200" />

          <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-gray-200 text-sm font-bold text-gray-400">
            2
          </div>
          <span className="ml-2 text-sm font-medium text-gray-400">{c.steps.demographic}</span>

          <div className="mx-4 h-px flex-1 bg-gray-200" />

          <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-gray-200 text-sm font-bold text-gray-400">
            3
          </div>
          <span className="ml-2 text-sm font-medium text-gray-400">{c.steps.rating}</span>
        </div>

        <div className="flex items-center gap-4 border-t border-gray-100 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <div>
            <p className="text-xs font-medium text-gray-400">{c.progressLabel}</p>
            <p className="text-xl font-bold text-[#001A3F]">%1</p>
            <div className="mt-1 h-1.5 w-32 rounded-full bg-gray-100">
              <div className="h-1.5 w-[1%] rounded-full bg-teal-600" />
            </div>
            <p className="mt-1 text-xs text-gray-400">{c.estimatedTime}</p>
          </div>
        </div>
      </div>

      {/* ANA İÇERİK KARTI */}
      <div className="w-full rounded-2xl bg-white p-6 shadow-sm md:p-8">
        <h2 className="mb-4 text-xl font-bold text-[#001A3F]">{c.sectionTitle}</h2>

        {/* Etik Kurul Kutusu */}
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-5 py-4">
          <Shield size={22} className="shrink-0 text-teal-600" />
          <p className="text-sm text-[#001A3F]">
            <span className="font-bold">{c.ethicsLabel}</span> {c.ethicsText}
          </p>
        </div>

        {/* Bilgi paragrafı */}
        <p className="mb-6 text-sm leading-relaxed text-gray-600">
          {infoParts[0]}
          <span className="font-semibold text-[#001A3F]">{c.piName}</span>
          {infoParts[1]}
        </p>

        {/* 4'lü kart grid */}
        <div className="mb-8 grid w-full grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="mb-2 flex items-center gap-2 font-semibold text-[#001A3F]">
              <BookOpen size={18} className="text-teal-600" />
              {c.card1.title}
            </div>
            <ul className="space-y-1.5 text-xs text-gray-600">
              {c.card1.items.map((item, i) => (
                <li key={i} className="flex gap-1.5">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-teal-600" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="mb-2 flex items-center gap-2 font-semibold text-[#001A3F]">
              <Lock size={18} className="text-teal-600" />
              {c.card2.title}
            </div>
            <ul className="space-y-1.5 text-xs text-gray-600">
              {c.card2.items.map((item, i) => (
                <li key={i} className="flex gap-1.5">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-teal-600" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="mb-2 flex items-center gap-2 font-semibold text-[#001A3F]">
              <AlertTriangle size={18} className="text-teal-600" />
              {c.card3.title}
            </div>
            <ul className="space-y-1.5 text-xs text-gray-600">
              {c.card3.items.map((item, i) => (
                <li key={i} className="flex gap-1.5">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-teal-600" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="mb-2 flex items-center gap-2 font-semibold text-[#001A3F]">
              <MessageSquare size={18} className="text-teal-600" />
              {c.card4.title}
            </div>
            <p className="mb-1 text-xs font-semibold text-[#001A3F]">{c.card4.name}</p>
            <ul className="space-y-1.5 text-xs text-gray-600">
              <li className="flex items-center gap-1.5">
                <Mail size={14} className="shrink-0 text-teal-600" />
                {c.card4.email}
              </li>
              <li className="flex items-center gap-1.5">
                <Phone size={14} className="shrink-0 text-teal-600" />
                {c.card4.phone}
              </li>
              <li className="text-gray-500">{c.card4.questionCount}</li>
            </ul>
          </div>
        </div>

        {/* ONAM BEYANI */}
        <div className="rounded-xl bg-gray-50 p-5">
          <h3 className="mb-2 text-sm font-bold tracking-wide text-[#001A3F]">
            {c.declarationTitle}
          </h3>
          <p className="mb-4 text-sm italic text-gray-600">"{c.declarationText}"</p>
          <label className="flex items-center gap-2 text-sm font-medium text-[#001A3F]">
            <input
              type="checkbox"
              checked={isConsentGiven}
              onChange={(e) => setIsConsentGiven(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            {c.consentCheckbox}
          </label>
        </div>

        {/* Hata mesajı */}
        {errorMessage && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">
            {errorMessage}
          </p>
        )}

        {/* SSL + Devam Et */}
        <div className="mt-6 flex flex-col-reverse items-center justify-between gap-4 md:flex-row">
          <p className="flex items-center gap-2 text-xs text-gray-500">
            <Shield size={14} className="text-teal-600" />
            {c.sslText}
          </p>
          <button
            type="button"
            disabled={!isConsentGiven || isSubmitting}
            onClick={handleContinue}
            className="flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-teal-600"
          >
            {isSubmitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                {c.continueButton}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SurveyConsent({ lang, setLang, t, onContinue, onLogout, onGoToResults, onGoToHistory }) {
  const c = t.surveyConsentPage;
  const [isDark, setIsDark] = useState(false);
  const [user, setUser] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("goclab_session");
      if (stored) setUser(JSON.parse(stored));
    } catch {
      setUser(null);
    }
  }, []);

  // "Ahmet Y." mantığı: ad tam, soyadın sadece baş harfi + nokta.
  const displayName = user?.first_name
    ? `${user.first_name} ${user?.last_name ? user.last_name.charAt(0).toUpperCase() + "." : ""}`.trim()
    : c.userRole;

  const avatarInitials =
    (user?.first_name?.charAt(0) ?? "") + (user?.last_name?.charAt(0) ?? "");

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

      <SurveyConsentContent t={t} onContinue={onContinue} />
    </div>
  );
}
