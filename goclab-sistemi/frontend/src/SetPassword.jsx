import { useEffect, useState } from "react";
import { Lock, Eye, EyeOff, Shield, CheckCircle2, ArrowRight } from "lucide-react";
import { LanguageSelector } from "./i18n.jsx";

const API_BASE_URL = "http://localhost:5000";

const inputClasses =
  "w-full pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 placeholder-gray-400";

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

// Kurum onay e-postasindaki tek kullanimlik baglantidan (token URL parametresi
// ile) erisilen, disaridan (herkese acik) ulasilabilen sifre belirleme sayfasi.
export default function SetPassword({ lang, setLang, t, onGoToLogin }) {
  const s = t.setPasswordPage;
  const [token, setToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      setToken(urlToken);
    } else {
      setErrorMessage(s.missingTokenError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!token) {
      setErrorMessage(s.missingTokenError);
      return;
    }

    const formData = new FormData(e.target);
    const newPassword = formData.get("newPassword");
    const confirmPassword = formData.get("confirmPassword");

    if (newPassword !== confirmPassword) {
      setErrorMessage(s.passwordMismatch);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/institutions/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || s.genericError);
        return;
      }
      setSuccessMessage(s.successMessage);
    } catch {
      setErrorMessage(s.networkError);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    window.history.replaceState({}, "", "/");
    onGoToLogin?.();
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[url('/girisarkaplan.png')] bg-cover bg-center bg-no-repeat px-6 py-10">
      <div className="absolute right-6 top-6 z-10">
        <LanguageSelector lang={lang} setLang={setLang} t={t} />
      </div>

      {/* KART */}
      <div className="relative z-10 w-full max-w-xl rounded-[2rem] bg-white p-8 shadow-[0_20px_60px_rgba(6,95,70,0.12)] md:p-12">
        {/* İkon */}
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <Lock size={34} className="text-green-700" />
          </div>
        </div>

        {/* Başlık */}
        <div className="mt-5 text-center">
          <h1 className="text-2xl font-extrabold uppercase tracking-wide text-green-700">{s.title}</h1>
          <div className="mx-auto mt-3 h-1 w-40 rounded-full bg-green-600" />
        </div>

        <p className="mx-auto mt-4 max-w-md text-center text-sm text-gray-500">{s.subtitle}</p>

        <form onSubmit={handleSubmit} className="mt-8">
          {/* Yeni Şifre */}
          <div className="mb-6 flex flex-col gap-2">
            <label className="ml-1 text-sm font-semibold text-[#001A3F]">{s.newPasswordLabel}</label>
            <div className="relative flex items-center">
              <div style={iconWrapperStyle}>
                <Lock size={20} className="text-[#001A3F]/50" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                name="newPassword"
                required
                minLength={8}
                placeholder={s.newPasswordPlaceholder}
                style={{ ...inputPaddingStyle, paddingRight: "2.75rem" }}
                className={inputClasses}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={rightIconWrapperStyle}
                className="text-[#001A3F]/50 hover:text-[#001A3F]"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Yeni Şifre Tekrar */}
          <div className="mb-6 flex flex-col gap-2">
            <label className="ml-1 text-sm font-semibold text-[#001A3F]">{s.confirmPasswordLabel}</label>
            <div className="relative flex items-center">
              <div style={iconWrapperStyle}>
                <Lock size={20} className="text-[#001A3F]/50" />
              </div>
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                required
                minLength={8}
                placeholder={s.confirmPasswordPlaceholder}
                style={{ ...inputPaddingStyle, paddingRight: "2.75rem" }}
                className={inputClasses}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                style={rightIconWrapperStyle}
                className="text-[#001A3F]/50 hover:text-[#001A3F]"
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Şifre önerileri kutusu */}
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-green-50 px-5 py-4">
            <Shield size={20} className="mt-0.5 shrink-0 text-green-600" />
            <div>
              <p className="mb-1.5 text-sm font-semibold text-[#001A3F]">{s.tipsTitle}</p>
              <ul className="space-y-1 text-xs text-gray-600">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="shrink-0 text-green-600" />
                  {s.tip1}
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="shrink-0 text-green-600" />
                  {s.tip2}
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="shrink-0 text-green-600" />
                  {s.tip3}
                </li>
              </ul>
            </div>
          </div>

          {successMessage && (
            <p className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-700">
              {successMessage}
            </p>
          )}
          {errorMessage && (
            <p className="mb-4 text-center text-sm font-medium text-red-600">{errorMessage}</p>
          )}

          {/* Güncelle Butonu */}
          <button
            type="submit"
            disabled={loading || Boolean(successMessage)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-800 to-blue-950 py-4 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <span>{loading ? s.sendingLabel : s.submitButton}</span>
            <ArrowRight size={20} />
          </button>
        </form>

        {/* Giriş sayfasına dön */}
        <div className="mt-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-gray-200" />
          <button
            type="button"
            onClick={handleGoToLogin}
            className="whitespace-nowrap text-sm font-semibold text-blue-700 hover:underline"
          >
            {s.backToLoginLink}
          </button>
          <div className="h-px flex-1 bg-gray-200" />
        </div>
      </div>
    </div>
  );
}
