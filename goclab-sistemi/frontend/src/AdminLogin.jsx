import { useState } from "react";
import { Briefcase, Mail, Lock, Eye, EyeOff, LogIn, ArrowRight, ArrowLeft } from "lucide-react";
import { LanguageSelector } from "./i18n.jsx";

const inputClasses =
  "w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 placeholder-gray-400";

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

export default function AdminLogin({ lang, setLang, t, onGoToInstitutionApply, onGoToForgotPassword, onLoginSuccess, onGoHome }) {
  const a = t.adminLoginPage;
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    const formData = new FormData(e.target);
    const email = formData.get("email");
    const password = formData.get("password");

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || a.genericError);
        return;
      }

      try {
        localStorage.setItem("goclab_admin_session", JSON.stringify({ ...data.user, token: data.token }));
      } catch {}

      onLoginSuccess?.();
    } catch (err) {
      setErrorMessage(a.networkError);
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
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-100">
              <Briefcase size={44} className="text-blue-700" />
            </div>
          </div>

          {/* Başlık */}
          <div className="mt-6 text-center">
            <h2 className="text-3xl font-bold text-blue-700">{a.title}</h2>
            <div className="mx-auto mt-3 h-1 w-48 rounded-full bg-blue-600" />
          </div>

          <form onSubmit={handleSubmit} className="mt-8">
            {/* E-posta */}
            <div className="flex flex-col gap-2 mb-6">
              <label className="text-sm font-semibold text-[#001A3F] ml-1">
                {a.emailLabel}
              </label>
              <div className="relative flex items-center">
                <div style={iconWrapperStyle}>
                  <Mail size={20} className="text-[#001A3F]/50" />
                </div>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder={a.emailPlaceholder}
                  style={inputPaddingStyle}
                  className={inputClasses}
                />
              </div>
            </div>

            {/* Şifre */}
            <div className="flex flex-col gap-2 mb-6">
              <label className="text-sm font-semibold text-[#001A3F] ml-1">
                {a.passwordLabel}
              </label>
              <div className="relative flex items-center">
                <div style={iconWrapperStyle}>
                  <Lock size={20} className="text-[#001A3F]/50" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  placeholder={a.passwordPlaceholder}
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

            {/* Beni hatırla / Şifremi unuttum */}
            <div className="flex items-center justify-between mb-8">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {a.rememberMe}
              </label>
              <button
                type="button"
                onClick={onGoToForgotPassword}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                {a.forgotPassword}
              </button>
            </div>

            {/* Hata mesajı */}
            {errorMessage && (
              <p className="mb-4 text-center text-sm font-medium text-red-600">
                {errorMessage}
              </p>
            )}

            {/* Giriş Butonu */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-800 py-4 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <LogIn size={20} />
              <span>{loading ? a.sendingLabel : a.loginButton}</span>
              <ArrowRight size={20} />
            </button>
          </form>

          {/* Hesabınız yok mu? */}
          <div className="mt-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="whitespace-nowrap text-sm text-gray-500">
              {a.noAccountText}
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <button
            type="button"
            onClick={onGoToInstitutionApply}
            className="mt-2 block w-full text-center font-semibold text-green-600 hover:underline"
          >
            {a.contactLink}
          </button>

          <button
            type="button"
            onClick={onGoHome}
            className="text-sm text-gray-500 hover:text-gray-800 flex items-center justify-center gap-1.5 mt-4 transition-colors font-medium mx-auto"
          >
            <ArrowLeft size={16} />
            {a.backToHome}
          </button>
        </div>
      </div>
    </div>
  );
}
