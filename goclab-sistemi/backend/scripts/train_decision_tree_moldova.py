"""
GOCLAB - Moldova (anket_son_sayisal, ulke='md') Karar Agaci egitim betigi.
train_decision_tree.py (Turkiye) ile BIREBIR AYNI yontem.

Calistirma: python backend/scripts/train_decision_tree_moldova.py
"""

import json
from datetime import datetime
from pathlib import Path

import os

import pandas as pd
from dotenv import load_dotenv
from sklearn.metrics import accuracy_score, f1_score, precision_score
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
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
MAX_DEPTH = 3

FACTOR_FEATURES = {
    "score_ekonomik_istihdam": "ekonomik_istihdam",
    "score_aile_sosyal": "aile_sosyal",
    "score_sosyo_politik": "sosyo_politik",
    "score_egitim": "egitim",
    "score_cevresel": "cevresel",
    "score_psikolojik": "psikolojik",
    "score_kulturel": "kulturel",
}

FACTOR_LABELS_TR = {
    "ekonomik_istihdam": "Ekonomik / İstihdam",
    "aile_sosyal": "Sosyal Ağ",
    "sosyo_politik": "Sosyo-Politik",
    "egitim": "Eğitim ve Gelişim",
    "cevresel": "Çevresel",
    "psikolojik": "Göç Kaygıları",
    "kulturel": "Kültürel-Dini Uyum",
}


def build_tree_json(tree, feature_names, class_names):
    tree_ = tree.tree_

    def recurse(node_id):
        if tree_.feature[node_id] == -2:
            value = tree_.value[node_id][0]
            majority_idx = int(value.argmax())
            samples = int(tree_.n_node_samples[node_id])
            return {
                "isLeaf": True,
                "clusterLabel": class_names[majority_idx],
                "samples": samples,
                "confidence": round(float(value[majority_idx] / value.sum()), 3) if value.sum() > 0 else 0,
            }

        factor_key = feature_names[tree_.feature[node_id]]
        threshold = round(float(tree_.threshold[node_id]), 1)
        return {
            "isLeaf": False,
            "factorKey": factor_key,
            "threshold": threshold,
            "samples": int(tree_.n_node_samples[node_id]),
            "left": recurse(tree_.children_left[node_id]),
            "right": recurse(tree_.children_right[node_id]),
        }

    return recurse(0)


def main():
    engine = create_engine(DATABASE_URL)

    query = f"""
        SELECT {", ".join(FACTOR_FEATURES.keys())}, cluster_label
        FROM anket_son_sayisal
        WHERE ulke = 'md' AND cluster_label IS NOT NULL
        ORDER BY id
    """
    df = pd.read_sql(text(query), engine)
    print(f"Toplam Moldova satiri: {len(df)}")

    df = df.dropna(subset=list(FACTOR_FEATURES.keys()) + ["cluster_label"])

    feature_columns = list(FACTOR_FEATURES.keys())
    X = df[feature_columns]
    y = df["cluster_label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )

    model = DecisionTreeClassifier(max_depth=MAX_DEPTH, random_state=RANDOM_STATE)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)

    accuracy = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average="weighted")
    precision = precision_score(y_test, y_pred, average="weighted", zero_division=0)

    importances = model.feature_importances_
    total_importance = importances.sum()
    feature_importance_list = []
    for col, imp in zip(feature_columns, importances):
        factor_key = FACTOR_FEATURES[col]
        pct = (imp / total_importance) * 100 if total_importance > 0 else 0
        feature_importance_list.append(
            {"key": factor_key, "label": FACTOR_LABELS_TR[factor_key], "importance": round(pct, 1)}
        )
    feature_importance_list.sort(key=lambda item: item["importance"], reverse=True)

    feature_names_by_index = [FACTOR_FEATURES[col] for col in feature_columns]
    class_names = model.classes_.tolist()

    tree_json = build_tree_json(model, feature_names_by_index, class_names)

    output = {
        "generatedAt": datetime.now().isoformat(),
        "datasetName": "GOCLAB_Moldova_483",
        "algorithm": "DecisionTreeClassifier",
        "maxDepth": MAX_DEPTH,
        "testSizeRatio": TEST_SIZE,
        "totalParticipants": len(df),
        "testCount": len(y_test),
        "accuracy": round(accuracy, 4),
        "f1Score": round(f1, 4),
        "precision": round(precision, 4),
        "classes": class_names,
        "featureImportances": feature_importance_list,
        "tree": tree_json,
    }

    with open(ML_DIR / "decision_tree_moldova.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Dogruluk (Accuracy): {accuracy:.4f}")
    print(f"F1-Skoru: {f1:.4f}")
    print(f"Kesinlik (Precision): {precision:.4f}")
    print(f"Karar agaci '{ML_DIR / 'decision_tree_moldova.json'}' dosyasina kaydedildi.")


if __name__ == "__main__":
    main()
