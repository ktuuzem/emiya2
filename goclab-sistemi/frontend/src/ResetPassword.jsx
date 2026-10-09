import { useEffect, useState } from "react";
import { Lock, Eye, EyeOff, Shield, CheckCircle2, ArrowRight } from "lucide-react";
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
const rightIconWrapperStyle = {
  position: "absolute",
  right: "0.85rem",
  top: "50%",
  transform: "translateY(-50%)",
};

const API_BASE_URL = "http://localhost:5000";

export default function ResetPassword({ lang, setLang, t, onSuccess, onGoToLogin }) {
  const r = t.resetPasswordPage;
  const [token, setToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    // Bu proje React Router kullanmadigi icin token'i dogrudan URL'den okuyoruz
    // (useSearchParams'in native karsiligi).
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      setToken(urlToken);
    } else {
      setErrorMessage(r.missingTokenError);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!token) {
      setErrorMessage(r.missingTokenError);
      return;
    }

    const formData = new FormData(e.target);
    const newPassword = formData.get("newPassword");
    const confirmPassword = formData.get("confirmPassword");

    if (newPassword !== confirmPassword) {
      setErrorMessage(r.passwordMismatch);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || r.genericError);
        return;
      }

      setSuccessMessage(r.successMessage);
      window.history.replaceState({}, "", "/");
      setTimeout(() => onSuccess?.(), 1200);
    } catch (err) {
      setErrorMessage(r.networkError);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    window.history.replaceState({}, "", "/");
    onGoToLogin?.();
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
            <h2 className="text-3xl font-bold text-green-700">{r.title}</h2>
            <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-green-600" />
          </div>

          {/* Alt metin */}
          <p className="mx-auto mt-4 max-w-md text-center text-gray-500">{r.subtitle}</p>

          <form onSubmit={handleSubmit} className="mt-8">
            {/* Yeni Şifre */}
            <div className="flex flex-col gap-2 mb-6">
              <label className="text-sm font-semibold text-[#001A3F] ml-1">
                {r.newPasswordLabel}
              </label>
              <div className="relative flex items-center">
                <div style={iconWrapperStyle}>
                  <Lock size={20} className="text-[#001A3F]/50" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="newPassword"
                  required
                  minLength={8}
                  placeholder={r.newPasswordPlaceholder}
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
            <div className="flex flex-col gap-2 mb-6">
              <label className="text-sm font-semibold text-[#001A3F] ml-1">
                {r.confirmPasswordLabel}
              </label>
              <div className="relative flex items-center">
                <div style={iconWrapperStyle}>
                  <Lock size={20} className="text-[#001A3F]/50" />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  required
                  minLength={8}
                  placeholder={r.confirmPasswordPlaceholder}
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
                <p className="mb-1.5 text-sm font-semibold text-[#001A3F]">{r.tipsTitle}</p>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="shrink-0 text-green-600" />
                    {r.tip1}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="shrink-0 text-green-600" />
                    {r.tip2}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="shrink-0 text-green-600" />
                    {r.tip3}
                  </li>
                </ul>
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

            {/* Güncelle Butonu */}
            <button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: "#001A3F" }}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-4 font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
            >
              <span>{loading ? r.sendingLabel : r.submitButton}</span>
              <ArrowRight size={20} />
            </button>
          </form>

          {/* Giriş sayfasına dön */}
          <div className="mt-8 h-px w-full bg-gray-200" />
          <button
            type="button"
            onClick={handleGoToLogin}
            className="mt-4 block w-full text-center font-semibold text-[#001A3F] hover:underline"
          >
            {r.backToLoginLink}
          </button>
        </div>
      </div>
    </div>
  );
}
