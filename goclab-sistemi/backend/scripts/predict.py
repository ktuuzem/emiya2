"""
GOCLAB - Egitilmis Random Forest modeliyle anlik (tekil) tahmin uretir.

Node.js /api/predict-simulation ucnoktasi bu betigi, simulatorden gelen
JSON girdisini STDIN uzerinden vererek cagirir; sonuc JSON olarak
stdout'a yazilir. (Argv yerine stdin kullanilir; boylece kabuk/shell
tirnak isaretleme sorunlarindan etkilenmez.)

Calistirma: echo '<json_girdi>' | python backend/scripts/predict.py
"""

import json
import sys
from pathlib import Path

import joblib
import pandas as pd

# Windows'ta stdout varsayilan olarak konsolun kod sayfasini (orn. cp1254/
# cp1252) kullanir, UTF-8 degil - "Duşuk"/"Yuksek" gibi Turkce karakterli
# (ü, ş) JSON ciktisi bu yuzden Node tarafinda bozuk (mojibake) gorunuyordu.
# stdout'u acikca UTF-8'e sabitleyerek (platform/konsol kod sayfasindan
# BAGIMSIZ) bu sorun onlenir.
sys.stdout.reconfigure(encoding="utf-8")

BACKEND_DIR = Path(__file__).resolve().parent.parent
ML_DIR = BACKEND_DIR / "ml"


def encode_categorical(value, classes):
    value = "Bilinmiyor" if value is None or value == "" else str(value)
    if value in classes:
        return classes.index(value)
    # Egitim sirasinda gorulmemis bir deger gelirse "Bilinmiyor" sinifina (varsa) dus.
    if "Bilinmiyor" in classes:
        return classes.index("Bilinmiyor")
    return 0


def main():
    raw_input = sys.stdin.buffer.read().decode("utf-8-sig")
    if not raw_input.strip():
        print(json.dumps({"success": False, "message": "Girdi JSON verisi eksik."}))
        return

    payload = json.loads(raw_input)

    if payload.get("country") == "md":
        model_path = ML_DIR / "rf_model_moldova.joblib"
        encoders_path = ML_DIR / "encoders_moldova.joblib"
    else:
        model_path = ML_DIR / "rf_model.joblib"
        encoders_path = ML_DIR / "encoders.joblib"
    if not model_path.exists() or not encoders_path.exists():
        print(
            json.dumps(
                {
                    "success": False,
                    "message": "Model henuz egitilmemis. Once 'python backend/scripts/train_classifier.py' calistirin.",
                }
            )
        )
        return

    model = joblib.load(model_path)
    meta = joblib.load(encoders_path)
    encoders = meta["encoders"]
    feature_columns = meta["feature_columns"]
    score_features = meta["score_features"]
    categorical_features = meta["categorical_features"]

    row = {}
    for col in score_features:
        row[col] = float(payload.get(col, 50))

    for col in categorical_features:
        classes = encoders[col]["classes"]
        row[col] = encode_categorical(payload.get(col), classes)

    X = pd.DataFrame([row])[feature_columns]

    prediction = model.predict(X)[0]
    probabilities = model.predict_proba(X)[0]
    classes = model.classes_.tolist()

    class_probabilities = [
        {"label": str(c), "probability": round(float(p), 4)} for c, p in zip(classes, probabilities)
    ]
    class_probabilities.sort(key=lambda item: item["probability"], reverse=True)

    print(
        json.dumps(
            {
                "success": True,
                "predictedLabel": str(prediction),
                "confidence": round(float(max(probabilities)), 4),
                "classProbabilities": class_probabilities,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
