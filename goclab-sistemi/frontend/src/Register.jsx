import { useState } from "react";
import {
  User,
  Mail,
  Landmark,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";
import { LanguageSelector } from "./i18n.jsx";

const inputClasses =
  "w-full pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 placeholder-gray-400";

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

export default function Register({ lang, setLang, t, onBack, onRegisterSuccess, onGoHome }) {
  const r = t.registerPage;
  const [institution, setInstitution] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    const formData = new FormData(e.target);
    const firstName = formData.get("firstName");
    const lastName = formData.get("lastName");
    const email = formData.get("email");
    const password = formData.get("password");
    const passwordConfirm = formData.get("passwordConfirm");

    if (!institution) {
      setErrorMessage(r.institutionRequired);
      return;
    }
    if (password !== passwordConfirm) {
      setErrorMessage(r.passwordMismatch);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, institution, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || r.genericError);
        return;
      }

      try {
        localStorage.setItem(
          "goclab_session",
          JSON.stringify({ first_name: firstName, last_name: lastName, email })
        );
      } catch {}

      onRegisterSuccess?.(email);
    } catch (err) {
      setErrorMessage(r.networkError);
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

        {/* FORM KARTI */}
        <div className="w-full max-w-3xl mx-auto bg-white rounded-[2rem] p-8 pb-12 md:p-14 md:pb-16 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative z-10 mt-6">
          <h2 className="text-4xl font-bold text-[#001A3F] text-center mb-10">
            {r.title}
          </h2>

          <form onSubmit={handleSubmit}>
            {/* Ad / Soyad */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[#001A3F] ml-1">
                  {r.firstNameLabel}
                </label>
                <div className="relative flex items-center">
                  <div style={iconWrapperStyle}>
                    <User size={20} className="text-[#001A3F]/50" />
                  </div>
                  <input
                    type="text"
                    name="firstName"
                    required
                    placeholder={r.firstNamePlaceholder}
                    style={inputPaddingStyle}
                    className={inputClasses}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[#001A3F] ml-1">
                  {r.lastNameLabel}
                </label>
                <div className="relative flex items-center">
                  <div style={iconWrapperStyle}>
                    <User size={20} className="text-[#001A3F]/50" />
                  </div>
                  <input
                    type="text"
                    name="lastName"
                    required
                    placeholder={r.lastNamePlaceholder}
                    style={inputPaddingStyle}
                    className={inputClasses}
                  />
                </div>
              </div>
            </div>

            {/* E-posta */}
            <div className="flex flex-col gap-2 mb-6">
              <label className="text-sm font-semibold text-[#001A3F] ml-1">
                {r.emailLabel}
              </label>
              <div className="relative flex items-center">
                <div style={iconWrapperStyle}>
                  <Mail size={20} className="text-[#001A3F]/50" />
                </div>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder={r.emailPlaceholder}
                  style={inputPaddingStyle}
                  className={inputClasses}
                />
              </div>
            </div>

            {/* Kurum */}
            <div className="flex flex-col gap-2 mb-6">
              <label className="text-sm font-semibold text-[#001A3F] ml-1">
                {r.institutionLabel}
              </label>
              <div className="relative flex items-center">
                <div style={iconWrapperStyle}>
                  <Landmark size={20} className="text-[#001A3F]/50" />
                </div>
                <select
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  style={{ ...inputPaddingStyle, paddingRight: "2.75rem" }}
                  className={`${inputClasses} appearance-none ${
                    institution ? "text-gray-700" : "text-gray-400"
                  }`}
                >
                  <option value="" disabled hidden>
                    {r.institutionPlaceholder}
                  </option>
                  {r.institutions.map((inst) => (
                    <option key={inst} value={inst} className="text-gray-700">
                      {inst}
                    </option>
                  ))}
                </select>
                <div style={rightIconWrapperStyle} className="pointer-events-none">
                  <ChevronDown size={20} className="text-[#001A3F]/50" />
                </div>
              </div>
            </div>

            {/* Şifre / Şifre Tekrarı */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[#001A3F] ml-1">
                  {r.passwordLabel}
                </label>
                <div className="relative flex items-center">
                  <div style={iconWrapperStyle}>
                    <Lock size={20} className="text-[#001A3F]/50" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    required
                    minLength={6}
                    placeholder={r.passwordPlaceholder}
                    style={{ ...inputPaddingStyle, paddingRight: "2.75rem" }}
                    className={inputClasses}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    style={rightIconWrapperStyle}
                    className="text-[#001A3F]/50 hover:text-[#001A3F]"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[#001A3F] ml-1">
                  {r.passwordConfirmLabel}
                </label>
                <div className="relative flex items-center">
                  <div style={iconWrapperStyle}>
                    <Lock size={20} className="text-[#001A3F]/50" />
                  </div>
                  <input
                    type={showPasswordConfirm ? "text" : "password"}
                    name="passwordConfirm"
                    required
                    minLength={6}
                    placeholder={r.passwordConfirmPlaceholder}
                    style={{ ...inputPaddingStyle, paddingRight: "2.75rem" }}
                    className={inputClasses}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirm((s) => !s)}
                    style={rightIconWrapperStyle}
                    className="text-[#001A3F]/50 hover:text-[#001A3F]"
                  >
                    {showPasswordConfirm ? (
                      <EyeOff size={20} />
                    ) : (
                      <Eye size={20} />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Kullanım koşulları */}
            <label className="flex items-start gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                name="terms"
                required
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="text-[#1D4ED8] font-semibold hover:underline">
                  {r.termsLinkText}
                </span>{" "}
                {r.termsSuffix}
              </span>
            </label>

            {/* Hata mesajı */}
            {errorMessage && (
              <p className="mt-4 text-center text-sm font-medium text-red-600">
                {errorMessage}
              </p>
            )}

            {/* Kayıt Ol Butonu */}
            <div className="flex justify-center mt-6">
              <button
                type="submit"
                disabled={loading}
                style={{ backgroundColor: "#1D4ED8" }}
                className="w-full max-w-sm hover:bg-blue-800 text-white font-medium py-5 rounded-xl flex items-center justify-center gap-2 transition-colors text-base disabled:opacity-60"
              >
                <UserPlus size={22} />
                <span>{loading ? r.sendingLabel : r.submitButton}</span>
                <ArrowRight size={22} />
              </button>
            </div>
          </form>

          {/* Zaten hesabınız var mı? */}
          <div className="relative flex py-8 items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink-0 mx-4 text-gray-500 text-sm">
              {r.alreadyHaveAccount}
            </span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>
          <div className="text-center">
            <button
              onClick={onBack}
              className="text-[#1D4ED8] font-semibold hover:underline"
            >
              {r.loginLink}
            </button>
          </div>

          <button
            type="button"
            onClick={onGoHome}
            className="text-sm text-gray-500 hover:text-gray-800 flex items-center justify-center gap-1.5 mt-4 transition-colors font-medium mx-auto"
          >
            <ArrowLeft size={16} />
            {r.backToHome}
          </button>
        </div>
      </div>
    </div>
  );
}
