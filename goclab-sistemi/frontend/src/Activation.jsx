import { useEffect, useRef, useState } from "react";
import { Mail, CheckCircle2, ArrowRight } from "lucide-react";
import { LanguageSelector } from "./i18n.jsx";

const CODE_LENGTH = 6;
const CODE_TIMEOUT_SECONDS = 5 * 60;
const RESEND_COOLDOWN_SECONDS = 45;

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const API_BASE_URL = "http://localhost:5000";

export default function Activation({ lang, setLang, t, email = "ornek@eposta.com", onChangeEmail, onVerified }) {
  const a = t.activationPage;
  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(""));
  const [secondsLeft, setSecondsLeft] = useState(CODE_TIMEOUT_SECONDS);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const inputRefs = useRef([]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft > 0]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown > 0]);

  const handleDigitChange = (index, value) => {
    const clean = value.replace(/[^0-9]/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = clean;
      return next;
    });
    if (clean && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    setDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < CODE_LENGTH; i++) next[i] = pasted[i] || "";
      return next;
    });
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  };

  const handleResend = () => {
    if (resendCooldown > 0) return;
    setSecondsLeft(CODE_TIMEOUT_SECONDS);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setDigits(Array(CODE_LENGTH).fill(""));
    inputRefs.current[0]?.focus();
  };

  const handleVerify = async () => {
    setErrorMessage("");
    const code = digits.join("");

    if (code.length < CODE_LENGTH) {
      setErrorMessage(a.incompleteCodeError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/verify-activation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || a.genericError);
        return;
      }
      onVerified?.();
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
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-blue-100">
              <Mail size={40} className="text-[#001A3F]" />
              <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-green-500 ring-4 ring-white">
                <CheckCircle2 size={18} className="text-white" strokeWidth={2.5} />
              </div>
            </div>
          </div>

          {/* Başlık */}
          <div className="mt-6 text-center">
            <h2 className="text-3xl font-bold text-[#001A3F]">{a.title}</h2>
            <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-blue-600" />
          </div>

          {/* Alt metin */}
          <p className="mx-auto mt-4 max-w-md text-center text-gray-500">{a.subtitle}</p>

          {/* E-posta bilgi kutusu */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 px-5 py-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail size={18} className="text-blue-600" />
              <span>
                {a.codeSentPrefix} <span className="font-medium text-gray-700">{email}</span>{" "}
                {a.codeSentSuffix}
              </span>
            </div>
            <button
              type="button"
              onClick={onChangeEmail}
              className="text-sm font-semibold text-blue-600 hover:underline"
            >
              {a.changeEmail}
            </button>
          </div>

          {/* Aktivasyon kodu */}
          <div className="mt-8">
            <label className="mb-3 block text-sm font-bold text-[#001A3F]">{a.codeLabel}</label>
            <div className="flex justify-center gap-3 sm:gap-4">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className="h-14 w-12 sm:w-14 rounded-xl border border-gray-200 text-center text-xl font-semibold text-[#001A3F] focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600"
                />
              ))}
            </div>
            <p className="mt-3 text-sm text-gray-500">
              {a.timerPrefix}{" "}
              <span className="font-bold text-blue-600">{formatTime(secondsLeft)}</span> {a.timerSuffix}
            </p>
          </div>

          {/* Hata mesajı */}
          {errorMessage && (
            <p className="mt-4 text-center text-sm font-medium text-red-600">{errorMessage}</p>
          )}

          {/* Doğrulama Butonu */}
          <button
            type="button"
            onClick={handleVerify}
            disabled={loading}
            style={{ backgroundColor: "#1D4ED8" }}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl py-4 font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60"
          >
            <span>{loading ? a.verifyingLabel : a.verifyButton}</span>
            <ArrowRight size={20} />
          </button>

          {/* Kodu almadınız mı? */}
          <div className="mt-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="whitespace-nowrap text-sm text-gray-500">{a.noCodeText}</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <div className="text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className={`mt-2 font-semibold ${
                resendCooldown > 0
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-blue-600 hover:underline"
              }`}
            >
              {a.resendLink}
              {resendCooldown > 0 ? ` (${formatTime(resendCooldown)})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
