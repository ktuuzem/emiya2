"""
GOCLAB - "Ortak Goc Profilleri" icin Turkiye+Moldova BIRLESIK (pooled) K-Means
on-analizi. Mevcut per-ulke kumelemelerden (cluster_centroids.json /
cluster_centroids_moldova.json) FARKLI olarak, TEK bir model/merkez seti
kurulur ki "Profil X" iki ulkede AYNI anlami tasisin.

Kontrol edilen kosullar (kullanici talebi):
1. Ulke kumeleme GIRDISI degil (sadece 7 faktor kullanilir; ulke etiketi
   sonradan dagilim karsilastirmasi icin tutulur). Goc niyeti de girdi
   DEGIL, sadece yorumlama icin ayri tutulur.
2. Ornek dengesizligi (TR=890, MD=483) kontrolu: AGIRLIKLI (sample_weight)
   pooled KMeans, agirliksiz ile karsilastirilir.
3. k sadece silhouette/elbow ile degil; kume buyuklugu dengesi ve farkli
   random_state'lerde TUTARLILIK (Adjusted Rand Index) ile de degerlendirilir.

Calistirma: python backend/scripts/analyze_pooled_profiles.py
"""
import os
from itertools import combinations
from pathlib import Path

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_rand_score, silhouette_score
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
K_RANGE = range(2, 8)
SEEDS = [1, 7, 42, 123, 2024]


def load_pooled(engine):
    tr_query = f"""
        SELECT {", ".join(FACTOR_COLUMNS)}, score_goc_niyeti, yas
        FROM raw_survey_data
        WHERE {" AND ".join(f"{c} IS NOT NULL" for c in FACTOR_COLUMNS)}
    """
    tr_df = pd.read_sql(text(tr_query), engine)
    tr_df["ulke"] = "tr"

    md_query = f"""
        SELECT {", ".join(FACTOR_COLUMNS)}, score_goc_niyeti, yas
        FROM anket_son_sayisal
        WHERE ulke = 'md' AND {" AND ".join(f"{c} IS NOT NULL" for c in FACTOR_COLUMNS)}
    """
    md_df = pd.read_sql(text(md_query), engine)
    md_df["ulke"] = "md"

    return pd.concat([tr_df, md_df], ignore_index=True)


def cluster_size_balance(labels, k):
    counts = pd.Series(labels).value_counts()
    counts = counts.reindex(range(k), fill_value=0)
    return counts.min() / counts.max() if counts.max() > 0 else 0, counts.tolist()


def stability_ari(X, k, weights=None):
    label_sets = []
    for seed in SEEDS:
        km = KMeans(n_clusters=k, n_init=10, random_state=seed)
        labels = km.fit_predict(X, sample_weight=weights)
        label_sets.append(labels)
    aris = [adjusted_rand_score(a, b) for a, b in combinations(label_sets, 2)]
    return float(np.mean(aris)), float(np.min(aris))


def country_composition(df, labels, k):
    tmp = df.copy()
    tmp["cl"] = labels
    comp = {}
    for cl in range(k):
        sub = tmp[tmp["cl"] == cl]
        comp[cl] = {"n": len(sub), "tr": int((sub["ulke"] == "tr").sum()), "md": int((sub["ulke"] == "md").sum())}
    return comp


def main():
    engine = create_engine(DATABASE_URL)
    df = load_pooled(engine)
    n_tr = (df["ulke"] == "tr").sum()
    n_md = (df["ulke"] == "md").sum()
    print(f"Pooled veri: TR={n_tr}, MD={n_md}, toplam={len(df)}")

    X = df[FACTOR_COLUMNS].astype(float).values
    # TR fazla oldugu icin (890 vs 483) agirliklandirma: MD agirligi = 890/483
    # ile iki ulke TOPLAM agirlik olarak esitlenir (veri atilmaz, downsample yok).
    weight_md = n_tr / n_md
    weights = np.where(df["ulke"].values == "tr", 1.0, weight_md)

    print(f"\n{'k':>3} {'WCSS':>12} {'Silhouette':>11} {'AgirliksizSil':>14} {'BoyutOrani':>11} {'ARI(ort)':>9} {'ARI(min)':>9}")
    rows = []
    for k in K_RANGE:
        km_unweighted = KMeans(n_clusters=k, n_init=10, random_state=42)
        labels_u = km_unweighted.fit_predict(X)
        sil_u = silhouette_score(X, labels_u)

        km_weighted = KMeans(n_clusters=k, n_init=10, random_state=42)
        labels_w = km_weighted.fit_predict(X, sample_weight=weights)
        sil_w = silhouette_score(X, labels_w)

        balance, counts = cluster_size_balance(labels_w, k)
        ari_mean, ari_min = stability_ari(X, k, weights=weights)

        print(f"{k:>3} {km_weighted.inertia_:>12.1f} {sil_w:>11.4f} {sil_u:>14.4f} {balance:>11.3f} {ari_mean:>9.3f} {ari_min:>9.3f}")
        rows.append({"k": k, "sil_weighted": sil_w, "sil_unweighted": sil_u, "balance": balance, "ari_mean": ari_mean, "counts": counts})

    print("\n--- Her k icin kume buyuklukleri (agirlikli model) ---")
    for r in rows:
        print(f"k={r['k']}: {r['counts']}")

    # En makul adaylar: silhouette yuksek VE boyut orani cok dusuk olmayan VE
    # ARI(ort) yuksek (kararli) k degerleri. Otomatik "en iyi" SECILMEZ -
    # tam liste yazdirilir, nihai k bu raporu inceleyerek elle secilir.
    print("\n--- Aday k'lar icin ulke kompozisyonu (agirlikli model) ---")
    for k in [3, 4, 5, 6]:
        km = KMeans(n_clusters=k, n_init=10, random_state=42)
        labels = km.fit_predict(X, sample_weight=weights)
        comp = country_composition(df, labels, k)
        print(f"\nk={k}:")
        for cl, c in comp.items():
            print(f"  Kume {cl}: n={c['n']} (TR={c['tr']}, MD={c['md']}, TR%={c['tr']/c['n']*100:.0f})")
        centers = pd.DataFrame(km.cluster_centers_, columns=FACTOR_COLUMNS).round(1)
        print(centers)

    # Agirlikli vs agirliksiz merkezlerin karsilastirmasi (k=5 ornek).
    print("\n--- Agirlikli vs Agirliksiz merkez karsilastirmasi (k=5) ---")
    km5_u = KMeans(n_clusters=5, n_init=10, random_state=42).fit(X)
    km5_w = KMeans(n_clusters=5, n_init=10, random_state=42).fit(X, sample_weight=weights)
    print("Agirliksiz merkezler:")
    print(pd.DataFrame(km5_u.cluster_centers_, columns=FACTOR_COLUMNS).round(1))
    print("Agirlikli merkezler:")
    print(pd.DataFrame(km5_w.cluster_centers_, columns=FACTOR_COLUMNS).round(1))


if __name__ == "__main__":
    main()
