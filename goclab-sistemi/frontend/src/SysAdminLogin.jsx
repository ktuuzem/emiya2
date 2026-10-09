import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, LogIn, ArrowRight } from "lucide-react";
import { LanguageSelector } from "./i18n.jsx";

const API_BASE_URL = "http://localhost:5000";

const inputClasses =
  "w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700 placeholder-gray-400";

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

export default function SysAdminLogin({ lang, setLang, t, onGoToForgotPassword, onLoginSuccess }) {
  const a = t.adminLoginPage;
  const s = t.sysAdminLoginPage;
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
    } catch {
      setErrorMessage(a.networkError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[url('/girisarkaplan.png')] bg-cover bg-center bg-no-repeat px-6 py-10">
      <div className="absolute right-6 top-6 z-10">
        <LanguageSelector lang={lang} setLang={setLang} t={t} />
      </div>

      {/* KART */}
      <div className="relative z-10 w-full max-w-xl rounded-[2rem] bg-white p-8 shadow-[0_20px_60px_rgba(30,58,138,0.12)] md:p-12">
        {/* Başlık */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold uppercase tracking-wide text-[#001A3F]">{s.title}</h1>
          <div className="mx-auto mt-3 h-1 w-48 rounded-full bg-blue-700" />
        </div>

        <form onSubmit={handleSubmit} className="mt-8">
          {/* E-posta */}
          <div className="mb-6 flex flex-col gap-2">
            <label className="ml-1 text-sm font-semibold text-[#001A3F]">{a.emailLabel}</label>
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
          <div className="mb-6 flex flex-col gap-2">
            <label className="ml-1 text-sm font-semibold text-[#001A3F]">{a.passwordLabel}</label>
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
          <div className="mb-8 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-700 focus:ring-blue-600"
              />
              {a.rememberMe}
            </label>
            <button
              type="button"
              onClick={onGoToForgotPassword}
              className="text-sm font-medium text-blue-700 hover:underline"
            >
              {a.forgotPassword}
            </button>
          </div>

          {/* Hata mesajı */}
          {errorMessage && (
            <p className="mb-4 text-center text-sm font-medium text-red-600">{errorMessage}</p>
          )}

          {/* Giriş Butonu */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-800 to-blue-950 py-4 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <LogIn size={20} />
            <span>{loading ? a.sendingLabel : a.loginButton}</span>
            <ArrowRight size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
