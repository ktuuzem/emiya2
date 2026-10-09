"""
GOCLAB - Moldova (anket_son_sayisal, ulke='md') icin K-Means kumeleme ve PCA
boyut indirgeme betigi. run_kmeans_pca.py (Turkiye/raw_survey_data) ile AYNI
yontemi, AYRI tablo/dosyalar uzerinde uygular.

Calistirma: python backend/scripts/run_kmeans_pca_moldova.py
(Once node scripts/computeMoldovaScores.js calistirilmis olmali.)
"""

import json
import os
from datetime import datetime
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sqlalchemy import create_engine, text

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "goclab")

DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

FACTOR_COLUMNS = {
    "score_ekonomik_istihdam": "Ekonomik-Istihdam",
    "score_egitim": "Egitim",
    "score_aile_sosyal": "Sosyal",
    "score_kulturel": "Kulturel",
    "score_sosyo_politik": "Sosyo-Politik",
    "score_cevresel": "Cevresel",
    "score_psikolojik": "Psikolojik",
}

N_CLUSTERS = 5
RANDOM_STATE = 42


def load_data(engine):
    columns = ", ".join(["id"] + list(FACTOR_COLUMNS.keys()))
    query = f"""
        SELECT {columns}
        FROM anket_son_sayisal
        WHERE ulke = 'md' AND {" AND ".join(f"{col} IS NOT NULL" for col in FACTOR_COLUMNS)}
        ORDER BY id
    """
    return pd.read_sql(text(query), engine)


def assign_cluster_labels(kmeans, feature_columns):
    """raw_survey_data (Turkiye) ile AYNI kural: K1=ekonomik en yuksek,
    K2=sosyal en yuksek, K3=egitim en yuksek, K4=sosyo-politik en yuksek,
    K5=kalan. (Moldova icin de ayni yontemle atanir, boylece iki ulke
    arasinda tutarli/karsilastirilabilir bir etiketleme kurali kullanilmis olur.)"""
    centers = pd.DataFrame(kmeans.cluster_centers_, columns=feature_columns)

    priority = [
        ("K1", "score_ekonomik_istihdam"),
        ("K2", "score_aile_sosyal"),
        ("K3", "score_egitim"),
        ("K4", "score_sosyo_politik"),
    ]

    assigned = {}
    remaining_clusters = set(centers.index)

    for label, column in priority:
        candidates = centers.loc[list(remaining_clusters)]
        winner = candidates[column].idxmax()
        assigned[winner] = label
        remaining_clusters.remove(winner)

    for cluster_id in remaining_clusters:
        assigned[cluster_id] = "K5"

    return assigned


def main():
    engine = create_engine(DATABASE_URL)

    df = load_data(engine)
    print(f"Faktor skorlari hazir olan Moldova katilimci sayisi: {len(df)}")

    if df.empty:
        print("Hicbir satirda faktor skoru bulunamadi. Once computeMoldovaScores.js calistirin.")
        return

    feature_columns = list(FACTOR_COLUMNS.keys())
    X = df[feature_columns].astype(float).values

    kmeans = KMeans(n_clusters=N_CLUSTERS, n_init=10, random_state=RANDOM_STATE)
    cluster_indices = kmeans.fit_predict(X)

    pca = PCA(n_components=2, random_state=RANDOM_STATE)
    coords = pca.fit_transform(X)

    cluster_label_map = assign_cluster_labels(kmeans, feature_columns)
    df["cluster_index"] = cluster_indices
    df["cluster_label"] = df["cluster_index"].map(cluster_label_map)
    df["pca_x"] = coords[:, 0]
    df["pca_y"] = coords[:, 1]

    print("\nKume profilleri (merkez/centroid ortalamalari):")
    centers = pd.DataFrame(kmeans.cluster_centers_, columns=feature_columns)
    centers["cluster_label"] = [cluster_label_map[i] for i in centers.index]
    centers["katilimci_sayisi"] = df["cluster_label"].value_counts().reindex(centers["cluster_label"]).values
    print(centers.set_index("cluster_label").round(1))

    print(f"\nAciklanan varyans orani (PCA 2 boyut): {pca.explained_variance_ratio_.sum():.2%}")

    ml_dir = BACKEND_DIR / "ml"
    ml_dir.mkdir(exist_ok=True)
    centroids_payload = {
        "generatedAt": datetime.now().isoformat(),
        "algorithm": "KMeans",
        "nClusters": N_CLUSTERS,
        "randomState": RANDOM_STATE,
        "participantCount": len(df),
        "centroids": {
            cluster_label_map[i]: {
                col.replace("score_", ""): round(float(kmeans.cluster_centers_[i][j]), 4)
                for j, col in enumerate(feature_columns)
            }
            for i in range(N_CLUSTERS)
        },
    }
    with open(ml_dir / "cluster_centroids_moldova.json", "w", encoding="utf-8") as f:
        json.dump(centroids_payload, f, ensure_ascii=False, indent=2)
    print(f"Kume merkezleri '{ml_dir / 'cluster_centroids_moldova.json'}' dosyasina yazildi.")

    with engine.begin() as conn:
        for row in df.itertuples(index=False):
            conn.execute(
                text(
                    """
                    UPDATE anket_son_sayisal
                    SET cluster_label = :cluster_label, pca_x = :pca_x, pca_y = :pca_y
                    WHERE id = :id
                    """
                ),
                {
                    "cluster_label": row.cluster_label,
                    "pca_x": float(row.pca_x),
                    "pca_y": float(row.pca_y),
                    "id": int(row.id),
                },
            )

    print(f"\nTamamlandi. {len(df)} satir icin cluster_label, pca_x, pca_y veritabanina yazildi.")


if __name__ == "__main__":
    main()
