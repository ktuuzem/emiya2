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
  Check,
  Info,
  Shield,
  ArrowLeft,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { LanguageSelector } from "./i18n.jsx";

const API_BASE_URL = "http://localhost:5000";

const LIKERT_COLORS = [
  { bg: "bg-red-600", border: "border-red-600", text: "text-red-600" },
  { bg: "bg-orange-500", border: "border-orange-500", text: "text-orange-500" },
  { bg: "bg-yellow-400", border: "border-yellow-400", text: "text-yellow-500" },
  { bg: "bg-teal-500", border: "border-teal-500", text: "text-teal-500" },
  { bg: "bg-green-700", border: "border-green-700", text: "text-green-700" },
];

// Derecelendirme Sorulari adiminin (adim cubugu + soru listesi) saf icerigi:
// ogrenciye ozel navbar/header disinda, tek basina da gomulebilir.
export function RatingQuestionsContent({ t, onNext, onBack }) {
  const c = t.surveyConsentPage;
  const rq = t.ratingQuestionsPage;

  const [answers, setAnswers] = useState({});
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAnswer = (questionIndex, value) => {
    setAnswers((prev) => ({ ...prev, [questionIndex]: value }));
  };

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = rq.questions.length;
  const isComplete = answeredCount === totalQuestions;

  const handleNext = async () => {
    if (!isComplete) {
      setErrorMessage(rq.requiredFieldsError);
      return;
    }
    setErrorMessage("");

    const stored = localStorage.getItem("goclab_session");
    const token = stored ? JSON.parse(stored)?.token : null;

    // Ogrenci oturumu yoksa (orn. kurum panelinden onizleme yapiliyorsa),
    // sunucuya kaydetmeden dogrudan tamamlandi adimina gec.
    if (!token) {
      onNext?.(answers);
      return;
    }

    // Elenen 35. madde (L49) anketten kaldirildi; likert_responses.q35 sutunu
    // bu yuzden artik hic doldurulmuyor (q1-q34 aynen, son soru dogrudan q36'ya yazilir).
    const QUESTION_TO_DB_COLUMN = [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
      18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 36,
    ];
    const questionAnswers = {};
    rq.questions.forEach((_, index) => {
      questionAnswers[`q${QUESTION_TO_DB_COLUMN[index]}`] = answers[index];
    });

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/likert-responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ answers: questionAnswers }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || rq.requiredFieldsError);
        return;
      }

      onNext?.(answers);
    } catch {
      setErrorMessage(rq.requiredFieldsError);
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
          <p className="text-sm text-gray-500">{t.demographicsPage.pageSubtitle}</p>
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

          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">
              2
            </div>
            <CheckCircle2 size={18} className="text-teal-600" />
          </div>
          <span className="ml-2 text-sm font-semibold text-teal-600">{c.steps.demographic}</span>

          <div className="mx-4 h-px flex-1 bg-teal-200" />

          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">
            3
          </div>
          <span className="ml-2 text-sm font-semibold text-teal-600">{c.steps.rating}</span>
        </div>

        <div className="flex items-center gap-4 border-t border-gray-100 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <div>
            <p className="text-xs font-medium text-gray-400">{c.progressLabel}</p>
            <p className="text-xl font-bold text-[#001A3F]">%80</p>
            <div className="mt-1 h-1.5 w-32 rounded-full bg-gray-100">
              <div className="h-1.5 w-[80%] rounded-full bg-teal-600" />
            </div>
            <p className="mt-1 text-xs text-gray-400">{rq.estimatedTime}</p>
          </div>
        </div>
      </div>

      {/* YÖNERGE + LEJANT */}
      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-green-200 bg-green-50 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <Info size={20} className="mt-0.5 shrink-0 text-green-700" />
          <div>
            <p className="text-sm font-bold text-green-800">{rq.instructionTitle}</p>
            <p className="mt-1 text-sm text-green-900">{rq.instructionText}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
          {rq.legend.map((label, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${LIKERT_COLORS[i].bg}`}
              >
                {i + 1}
              </span>
              <span className="text-xs font-medium text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SORU LİSTESİ */}
      <div className="w-full rounded-2xl bg-white p-6 shadow-sm md:p-8">
        <h2 className="mb-6 text-xl font-bold text-[#001A3F]">{rq.sectionTitle}</h2>

        <div>
          {rq.questions.map((question, index) => (
            <div
              key={index}
              className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 items-center w-full py-4 border-b border-gray-100 last:border-b-0"
            >
              <p className="flex gap-2 text-sm text-[#001A3F] lg:col-span-5">
                <span className="shrink-0 font-bold text-teal-600">{index + 1}.</span>
                {question}
              </p>

              <div className="grid grid-cols-5 gap-2 lg:col-span-7">
                {rq.legend.map((label, optionIndex) => {
                  const value = optionIndex + 1;
                  const isSelected = answers[index] === value;
                  const color = LIKERT_COLORS[optionIndex];
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleAnswer(index, value)}
                      className={`relative flex h-full min-h-[85px] w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-1 py-3 text-center transition-colors ${
                        isSelected
                          ? `${color.bg} ${color.border} text-white`
                          : `bg-white ${color.border} ${color.text} hover:bg-gray-50`
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow">
                          <Check size={14} className={color.text} strokeWidth={3} />
                        </span>
                      )}
                      <span className="text-base font-bold">{value}</span>
                      <span className="hidden text-[11px] font-medium leading-tight sm:text-xs lg:block">
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Hata mesajı */}
        {errorMessage && (
          <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">
            {errorMessage}
          </p>
        )}

        {/* Geri + SSL + İleri */}
        <div className="mt-8 flex flex-col-reverse items-center justify-between gap-4 border-t border-gray-100 pt-6 md:flex-row">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 rounded-xl border border-gray-200 px-6 py-3 font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            <ArrowLeft size={18} />
            {rq.backButton}
          </button>

          <p className="flex items-center gap-2 text-xs text-gray-500">
            <Shield size={14} className="text-teal-600" />
            {answeredCount}/{totalQuestions} · {rq.sslText}
          </p>

          <button
            type="button"
            onClick={handleNext}
            disabled={!isComplete || isSubmitting}
            className="flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-teal-600"
          >
            {isSubmitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                {rq.nextButton}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RatingQuestions({ lang, setLang, t, onNext, onBack, onLogout, onGoToResults, onGoToHistory }) {
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

      <RatingQuestionsContent t={t} onNext={onNext} onBack={onBack} />
    </div>
  );
}
