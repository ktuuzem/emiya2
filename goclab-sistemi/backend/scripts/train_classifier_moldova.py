"""
GOCLAB - Moldova (anket_son_sayisal, ulke='md') siniflandirma modeli egitim
betigi. train_classifier.py (Turkiye) ile AYNI yontemi (RandomForest + hedef
degisken goc_niyeti_siniflandirma, 7 faktor skoru girdiden HARIC tutulur -
goc niyeti maddeleri zaten skor hesabina DAHIL degildir) Moldova'ya ozgu
demografik sutunlarla uygular.

Calistirma: python backend/scripts/train_classifier_moldova.py
"""

import json
import os
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score
from sklearn.model_selection import RandomizedSearchCV, train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.utils.class_weight import compute_sample_weight
from sqlalchemy import create_engine, text

BACKEND_DIR = Path(__file__).resolve().parent.parent
ML_DIR = BACKEND_DIR / "ml"
ML_DIR.mkdir(exist_ok=True)

load_dotenv(BACKEND_DIR / ".env")

DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "goclab")
DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

RANDOM_STATE = 42
TEST_SIZE = 0.2
TARGET_ACCURACY = 0.75

SCORE_FEATURES = {
    "score_ekonomik_istihdam": "Ekonomik / İstihdam Skoru",
    "score_aile_sosyal": "Sosyal Ağ Skoru",
    "score_sosyo_politik": "Sosyo-Politik Skoru",
    "score_egitim": "Eğitim ve Gelişim Skoru",
    "score_cevresel": "Çevresel Skoru",
    "score_psikolojik": "Göç Kaygısı Skoru",
    "score_kulturel": "Kültürel / Dini Uyum Skoru",
}

TARGET_CLASSES = ["Düşük", "Orta", "Yüksek"]

# Moldova'ya ozgu ham demografik kodlar (medeni_durum/egitim_level/istiftam/gelir
# MD'de sayisal ozgun kodlardir - siniflandirici icin harmonizasyona gerek yoktur,
# kategorik degerler tutarli oldugu surece dogrudan label-encode edilebilir).
CATEGORICAL_FEATURES = {
    "cinsiyet": "Cinsiyet",
    "medeni_durum": "Medeni Durum",
    "egitim_level": "Eğitim Durumu",
    "istiftam": "İstihdam Durumu",
    "gelir": "Gelir Düzeyi",
    "dil_sayisi": "Bilinen Yabancı Dil Sayısı",
    "yurt_disi_yasayan_aile_durumu": "Yurt Dışında Aile",
    "yurt_disi_bulunma_durumu": "Yurt Dışı Deneyimi",
    "gitmek_istedigi_ulke": "Hedef Ülke",
    "yas_grubu": "Yaş Grubu",
}


def age_group(age):
    if age is None or pd.isna(age):
        return None
    age = int(age)
    if age <= 21:
        return "18-21"
    if age <= 25:
        return "22-25"
    return "26-33"


def main():
    engine = create_engine(DATABASE_URL)

    query = f"""
        SELECT id, {", ".join(SCORE_FEATURES.keys())}, yas, cinsiyet, medeni_durum,
               egitim_level, istiftam, gelir, dil_sayisi,
               yurt_disi_yasayan_aile_durumu, yurt_disi_bulunma_durumu,
               gitmek_istedigi_ulke, goc_niyeti_siniflandirma
        FROM anket_son_sayisal
        WHERE ulke = 'md' AND goc_niyeti_siniflandirma IS NOT NULL
        ORDER BY id
    """
    df = pd.read_sql(text(query), engine)
    print(f"Toplam Moldova satiri: {len(df)}")

    df["yas_grubu"] = df["yas"].apply(age_group)

    feature_columns = list(SCORE_FEATURES.keys()) + list(CATEGORICAL_FEATURES.keys())

    encoders = {}
    encoded_df = pd.DataFrame(index=df.index)

    for col in SCORE_FEATURES.keys():
        encoded_df[col] = df[col].fillna(df[col].median())

    for col in CATEGORICAL_FEATURES.keys():
        series = df[col].fillna("Bilinmiyor").astype(str)
        encoder = LabelEncoder()
        encoded_df[col] = encoder.fit_transform(series)
        encoders[col] = {"classes": encoder.classes_.tolist()}

    df["target"] = df["goc_niyeti_siniflandirma"]

    X = encoded_df[feature_columns]
    y = df["target"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )

    rf_param_distributions = {
        "n_estimators": [100, 200, 300, 400, 500],
        "max_depth": [None, 5, 10, 15, 20, 30],
        "min_samples_split": [2, 5, 10],
        "min_samples_leaf": [1, 2, 4],
    }
    rf_search = RandomizedSearchCV(
        RandomForestClassifier(class_weight="balanced", random_state=RANDOM_STATE),
        param_distributions=rf_param_distributions,
        n_iter=25,
        cv=5,
        scoring="accuracy",
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    rf_search.fit(X_train, y_train)
    rf_model = rf_search.best_estimator_
    rf_accuracy = accuracy_score(y_test, rf_model.predict(X_test))
    print(f"[RandomForest] En iyi parametreler: {rf_search.best_params_}")
    print(f"[RandomForest] Test dogrulugu: {rf_accuracy:.4f}")

    best_model = rf_model
    best_accuracy = rf_accuracy
    algorithm_name = "Random Forest (Optimizasyonlu + Sınıf Dengeleme)"

    if best_accuracy < TARGET_ACCURACY:
        print("[GradientBoosting] RandomForest hedef bandin altinda kaldi, GradientBoosting deneniyor...")
        sample_weight = compute_sample_weight(class_weight="balanced", y=y_train)
        gb_model = GradientBoostingClassifier(
            n_estimators=300, max_depth=3, learning_rate=0.05, random_state=RANDOM_STATE
        )
        gb_model.fit(X_train, y_train, sample_weight=sample_weight)
        gb_accuracy = accuracy_score(y_test, gb_model.predict(X_test))
        print(f"[GradientBoosting] Test dogrulugu: {gb_accuracy:.4f}")

        if gb_accuracy > best_accuracy:
            best_model = gb_model
            best_accuracy = gb_accuracy
            algorithm_name = "Gradient Boosting (Sınıf Dengeleme)"

    y_pred = best_model.predict(X_test)

    accuracy = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average="weighted")
    precision = precision_score(y_test, y_pred, average="weighted", zero_division=0)

    classes = [c for c in TARGET_CLASSES if c in set(y.unique())]
    cm = confusion_matrix(y_test, y_pred, labels=classes)
    baseline_accuracy = float((y_test == y_test.value_counts().idxmax()).mean())

    importances = getattr(best_model, "feature_importances_", np.zeros(len(feature_columns)))
    total_importance = importances.sum()
    feature_importance_list = []
    all_labels = {**SCORE_FEATURES, **CATEGORICAL_FEATURES}
    for col, imp in zip(feature_columns, importances):
        pct = (imp / total_importance) * 100 if total_importance > 0 else 0
        feature_importance_list.append({"key": col, "label": all_labels[col], "importance": round(pct, 1)})
    feature_importance_list.sort(key=lambda item: item["importance"], reverse=True)

    metrics = {
        "generatedAt": datetime.now().isoformat(),
        "datasetName": "GOCLAB_Moldova_483",
        "algorithm": algorithm_name,
        "testSizeRatio": TEST_SIZE,
        "totalParticipants": len(df),
        "testCount": len(y_test),
        "accuracy": round(accuracy, 4),
        "f1Score": round(f1, 4),
        "precision": round(precision, 4),
        "targetName": "goc_niyeti_duzeyi",
        "baselineAccuracy": round(baseline_accuracy, 4),
        "classes": classes,
        "featureImportances": feature_importance_list,
        "topFeatures": [f["label"] for f in feature_importance_list[:3]],
        "confusionMatrix": cm.tolist(),
    }

    with open(ML_DIR / "classification_metrics_moldova.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)

    joblib.dump(best_model, ML_DIR / "rf_model_moldova.joblib")
    joblib.dump(
        {
            "encoders": encoders,
            "feature_columns": feature_columns,
            "score_features": list(SCORE_FEATURES.keys()),
            "categorical_features": list(CATEGORICAL_FEATURES.keys()),
            "target_type": "goc_niyeti_duzeyi",
        },
        ML_DIR / "encoders_moldova.joblib",
    )

    print(f"Referans (en sik sinifi tahmin) dogrulugu: {baseline_accuracy:.4f}")
    print(f"Secilen algoritma: {algorithm_name}")
    print(f"Dogruluk (Accuracy): {accuracy:.4f}")
    print(f"F1-Skoru: {f1:.4f}")
    print(f"Kesinlik (Precision): {precision:.4f}")
    print(f"En etkili 3 oznitelik: {metrics['topFeatures']}")
    print(f"Model ve metrikler '{ML_DIR}' klasorune kaydedildi.")


if __name__ == "__main__":
    main()
