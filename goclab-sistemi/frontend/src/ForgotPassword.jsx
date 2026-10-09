import { useState } from "react";
import { Lock, Mail, LogIn, ArrowRight } from "lucide-react";
import { LanguageSelector } from "./i18n.jsx";

const inputClasses =
  "w-full pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 placeholder-gray-400";

// Inline stiller, Tailwind sınıflarının önbellek/derleme gecikmesinden
// bağımsız olarak ikon-metin boşluğunun her zaman doğru görünmesini garanti eder.
const inputPaddingStyle = { paddingLeft: "2.75rem" };
const iconWrapperStyle = {
  position: "absolute",
  left: "0.85rem",
  top: "50%",
  transform: "translateY(-50%)",
  pointerEvents: "none",
};

const API_BASE_URL = "http://localhost:5000";

export default function ForgotPassword({ lang, setLang, t, onGoToLogin }) {
  const f = t.forgotPasswordPage;
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const email = new FormData(e.target).get("email");

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || f.genericError);
        return;
      }
      setSuccessMessage(f.successMessage);
    } catch (err) {
      setErrorMessage(f.networkError);
    } finally {
      setLoading(false);
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
        <div className="w-full max-w-2xl mx-auto bg-white rounded-[2rem] p-8 md:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative z-10 mt-6">
          {/* İkon */}
          <div className="flex justify-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
              <Lock size={40} className="text-green-700" />
            </div>
          </div>

          {/* Başlık */}
          <div className="mt-6 text-center">
            <h2 className="text-3xl font-bold text-green-700">{f.title}</h2>
            <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-green-600" />
          </div>

          {/* Alt metin */}
          <p className="mx-auto mt-4 max-w-md text-center text-gray-500">{f.subtitle}</p>

          <form onSubmit={handleSubmit} className="mt-8">
            {/* E-posta */}
            <div className="flex flex-col gap-2 mb-6">
              <label className="text-sm font-semibold text-[#001A3F] ml-1">
                {f.emailLabel}
              </label>
              <div className="relative flex items-center">
                <div style={iconWrapperStyle}>
                  <Mail size={20} className="text-[#001A3F]/50" />
                </div>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder={f.emailPlaceholder}
                  style={inputPaddingStyle}
                  className={inputClasses}
                />
              </div>
            </div>

            {/* Bildirimler */}
            {successMessage && (
              <p className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-700">
                {successMessage}
              </p>
            )}
            {errorMessage && (
              <p className="mb-4 text-center text-sm font-medium text-red-600">{errorMessage}</p>
            )}

            {/* Gönder Butonu */}
            <button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: "#001A3F" }}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-4 font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
            >
              <LogIn size={20} />
              <span>{loading ? f.sendingLabel : f.submitButton}</span>
              <ArrowRight size={20} />
            </button>
          </form>

          {/* Şifreyi hatırladınız mı? */}
          <div className="mt-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="whitespace-nowrap text-sm text-gray-500">
              {f.rememberPasswordText}
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <button
            type="button"
            onClick={onGoToLogin}
            className="mt-2 block w-full text-center font-semibold text-green-600 hover:underline"
          >
            {f.loginLink}
          </button>
        </div>
      </div>
    </div>
  );
}
