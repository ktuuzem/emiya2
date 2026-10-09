import { CheckCircle2 } from "lucide-react";

export default function SurveyComplete({ t, onBack }) {
  const sc = t.surveyCompletePage;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl bg-white p-10 text-center shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-50">
          <CheckCircle2 size={36} className="text-teal-600" />
        </div>
        <h1 className="text-2xl font-extrabold text-[#001A3F]">{sc.title}</h1>
        <p className="text-sm text-gray-500">{sc.message}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
        >
          {sc.backButton}
        </button>
      </div>
    </div>
  );
}
