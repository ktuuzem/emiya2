import { useState } from "react";
import { SurveyConsentContent } from "../../SurveyConsent.jsx";
import { DemographicsContent } from "../../Demographics.jsx";
import { RatingQuestionsContent } from "../../RatingQuestions.jsx";
import SurveyComplete from "../../SurveyComplete.jsx";

// Ogrenci tarafindaki Anket adimlarinin SAF icerik bilesenlerini (ogrenciye
// ozel navbar/header olmadan) hic kod kopyalamadan doğrudan render eder;
// adim gecisleri (Onam -> Demografik -> Derecelendirme -> Tamamlandi) burada
// yerel state ile yonetilir. Cagiran bilesen kendi Layout'unu (navbar, sol
// menu) korur, sadece bu icerigi kendi ana govdesine yerlestirir.
export default function SurveyContent({ t, onFinish }) {
  const [step, setStep] = useState("consent");

  if (step === "consent") {
    return <SurveyConsentContent t={t} onContinue={() => setStep("demographic")} />;
  }
  if (step === "demographic") {
    return <DemographicsContent t={t} onNext={() => setStep("rating")} />;
  }
  if (step === "rating") {
    return (
      <RatingQuestionsContent
        t={t}
        onBack={() => setStep("demographic")}
        onNext={() => setStep("complete")}
      />
    );
  }
  return <SurveyComplete t={t} onBack={onFinish} />;
}
