import { useEffect, useState } from "react";
import { X, CheckCircle2, Send, Loader2 } from "lucide-react";

const API_BASE_URL = "http://localhost:5000";

function getAdminToken() {
  try {
    const stored = localStorage.getItem("goclab_admin_session");
    return stored ? JSON.parse(stored)?.token : null;
  } catch {
    return null;
  }
}

export default function PermissionRequestModal({ onClose }) {
  const [isGlobalDataChecked, setIsGlobalDataChecked] = useState(false);
  const [isKvkkChecked, setIsKvkkChecked] = useState(false);
  const [requestStatus, setRequestStatus] = useState("none");
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Modal acildiginda, kurumun daha once gonderdigi bekleyen/onaylanmis bir
  // talebi varsa formu tekrar doldurmasini engellemek icin backend'den kalici
  // durumu kontrol eder.
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const token = getAdminToken();
        const res = await fetch(`${API_BASE_URL}/api/permission-requests/my-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.success && data.hasActiveRequest) {
          setRequestStatus("submitted");
        }
      } catch {
        // Durum kontrolu basarisiz olursa formu normal (gonderilebilir) halde birakir.
      } finally {
        setIsCheckingStatus(false);
      }
    };
    checkStatus();
  }, []);

  const canSubmit = isGlobalDataChecked && isKvkkChecked && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const stored = localStorage.getItem("goclab_admin_session");
      const token = stored ? JSON.parse(stored)?.token : null;
      const res = await fetch(`${API_BASE_URL}/api/permission-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.message || "Talep gonderilirken bir hata olustu.");
        return;
      }
      setRequestStatus("submitted");
    } catch {
      setErrorMessage("Sunucuya baglanilamadi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#001A3F]">Yetki Talebi</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className={`rounded-lg border border-gray-200 bg-gray-50 p-4 ${requestStatus === "submitted" ? "" : "mb-5"}`}>
          <p className="mb-2 text-sm font-semibold text-gray-700">Yetki Durumu</p>
          <div className="flex items-center gap-2">
            {isCheckingStatus ? (
              <Loader2 size={18} className="shrink-0 animate-spin text-gray-400" />
            ) : (
              <CheckCircle2 size={18} className="shrink-0 text-gray-500" />
            )}
            <span className="text-sm font-semibold text-green-700">
              {isCheckingStatus
                ? "Durum kontrol ediliyor..."
                : requestStatus === "submitted"
                ? "Talebiniz başarı ile alındı"
                : "Aktif talebiniz bulunmamaktadır"}
            </span>
          </div>
        </div>

        {!isCheckingStatus && requestStatus === "none" && (
          <>
            <p className="mb-3 mt-5 text-sm font-semibold text-[#001A3F]">Yetki Talebi</p>
            <div className="mb-6 flex flex-col gap-3">
              <label className="flex items-start gap-2.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={isGlobalDataChecked}
                  onChange={(e) => setIsGlobalDataChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                />
                Türkiye geneli sistem verilerine erişmek istiyorum
              </label>
              <label className="flex items-start gap-2.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={isKvkkChecked}
                  onChange={(e) => setIsKvkkChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                />
                <span>
                  <a href="#" onClick={(e) => e.preventDefault()} className="font-medium text-blue-600 underline hover:text-blue-700">
                    KVKK ve Aydınlatma Metni
                  </a>
                  'ni okudum, kabul ediyorum.
                </span>
              </label>
            </div>

            {errorMessage && <p className="mb-3 text-sm font-medium text-red-600">{errorMessage}</p>}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition-colors ${
                canSubmit ? "bg-blue-600 hover:bg-blue-700" : "cursor-not-allowed bg-blue-600 opacity-50"
              }`}
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Talep Gönder
            </button>
          </>
        )}
      </div>
    </div>
  );
}
