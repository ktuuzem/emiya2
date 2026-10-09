"""
GOCLAB - Turkiye ve Moldova icin optimal K-Means kume sayisini (k) istatistiksel
olarak belirlemeye yardimci analiz betigi. Mevcut sabit k=5 varsayimini
SORGULAMAK icin: her iki ornneklem icin k=2..8 araliginda Silhouette Skoru
ve WCSS (dirsek/elbow yontemi icin) hesaplanir.

Calistirma: python backend/scripts/analyze_optimal_k.py
"""
import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler
from sqlalchemy import create_engine, text

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "goclab")
DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

FACTOR_COLUMNS = [
    "score_ekonomik_istihdam", "score_egitim", "score_aile_sosyal", "score_kulturel",
    "score_sosyo_politik", "score_cevresel", "score_psikolojik",
]
RANDOM_STATE = 42
K_RANGE = range(2, 9)


def analyze(df, label):
    X = df[FACTOR_COLUMNS].astype(float).values
    # Not: mevcut run_kmeans_pca.py / _moldova.py ham (0-100 normalize) skorlar
    # uzerinde, olceklendirme yapmadan KMeans calistiriyor - tutarlilik icin
    # burada da AYNI (olceksiz) veri kullanilir. (Standardizasyonun sonucu
    # nasil degistirdigini gormek icin karsilastirma amacli ayrica raporlanir.)
    print(f"\n{'='*60}\n{label} (n={len(df)}) - OLCEKSIZ (mevcut pipeline ile ayni)\n{'='*60}")
    print(f"{'k':>3} {'WCSS (inertia)':>16} {'Silhouette':>12}")
    results = []
    for k in K_RANGE:
        km = KMeans(n_clusters=k, n_init=10, random_state=RANDOM_STATE)
        labels = km.fit_predict(X)
        sil = silhouette_score(X, labels)
        print(f"{k:>3} {km.inertia_:>16.1f} {sil:>12.4f}")
        results.append((k, km.inertia_, sil))
    best_k = max(results, key=lambda r: r[2])
    print(f"-> En yuksek Silhouette skoru: k={best_k[0]} (skor={best_k[2]:.4f})")

    print(f"\n{label} - STANDARDIZE EDILMIS (z-score, karsilastirma amacli)")
    Xs = StandardScaler().fit_transform(X)
    results_s = []
    for k in K_RANGE:
        km = KMeans(n_clusters=k, n_init=10, random_state=RANDOM_STATE)
        labels = km.fit_predict(Xs)
        sil = silhouette_score(Xs, labels)
        results_s.append((k, km.inertia_, sil))
    best_k_s = max(results_s, key=lambda r: r[2])
    for k, inertia, sil in results_s:
        print(f"{k:>3} {inertia:>16.1f} {sil:>12.4f}")
    print(f"-> En yuksek Silhouette skoru (standardize): k={best_k_s[0]} (skor={best_k_s[2]:.4f})")
    return best_k[0], best_k_s[0]


def main():
    engine = create_engine(DATABASE_URL)

    tr_query = f"""
        SELECT {", ".join(FACTOR_COLUMNS)} FROM raw_survey_data
        WHERE {" AND ".join(f"{c} IS NOT NULL" for c in FACTOR_COLUMNS)}
    """
    tr_df = pd.read_sql(text(tr_query), engine)
    tr_best, tr_best_s = analyze(tr_df, "TURKIYE (raw_survey_data)")

    md_query = f"""
        SELECT {", ".join(FACTOR_COLUMNS)} FROM anket_son_sayisal
        WHERE ulke = 'md' AND {" AND ".join(f"{c} IS NOT NULL" for c in FACTOR_COLUMNS)}
    """
    md_df = pd.read_sql(text(md_query), engine)
    md_best, md_best_s = analyze(md_df, "MOLDOVA (anket_son_sayisal)")

    print(f"\n{'='*60}\nOZET\n{'='*60}")
    print(f"Turkiye  -> olceksiz en iyi k={tr_best} | standardize en iyi k={tr_best_s} | su an kullanilan k=5")
    print(f"Moldova  -> olceksiz en iyi k={md_best} | standardize en iyi k={md_best_s} | su an kullanilan k=5")


if __name__ == "__main__":
    main()
