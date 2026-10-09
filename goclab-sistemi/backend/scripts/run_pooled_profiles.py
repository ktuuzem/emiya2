"""
GOCLAB - "Ortak Goc Profilleri" icin Turkiye+Moldova BIRLESIK (pooled) K-Means
merkezlerini uretir. Mevcut per-ulke kumelemelerden (cluster_centroids.json /
cluster_centroids_moldova.json) FARKLI: TEK bir model, iki ulkede AYNI anlami
tasiyan "Profil" etiketleri icin.

Yontem (bkz. backend/scripts/analyze_pooled_profiles.py - on-analiz):
- Girdi: SADECE 7 faktor skoru (0-100). Ulke ve goc niyeti kumeleme GIRDISI
  DEGIL - ulke sonradan dagilim karsilastirmasi, goc niyeti sadece yorumlama
  icin kullanilir.
- Ornek dengesizligi (TR=890, MD=483) AGIRLIKLANDIRMA (sample_weight) ile
  kontrol edildi: MD agirligi = 890/483, boylece iki ulke toplam agirlikta
  esitlenir (veri atilmaz). On-analizde agirlikli/agirliksiz merkezler
  neredeyse ozdes cikti (fark ~1 puan) - imbalance'in sonucu cok az etkiledigi
  dogrulandi.
- k=5 secildi: k=2..7 arasinda en iyi silhouette (k=2 haric, ki o cok kaba/
  iki parcali bir ayrim verir), yuksek kararlilik (5 farkli random_state'te
  Adjusted Rand Index ortalamasi 0.96) ve makul kume buyuklugu dengesi
  (min/maks oran 0.62) bir arada degerlendirilerek secildi - sadece elbow/
  silhouette ile degil.
- Profil adlari, cikan 5 merkezin GENEL ORTALAMADAN sapma oruntusune
  bakilarak (analyze_pooled_profiles.py cikti incelemesiyle) SONRADAN
  verildi; onceden varsayilmadi.

Calistirma: python backend/scripts/run_pooled_profiles.py
(Once her iki tablonun score_* sutunlari dolu olmali.)
"""
import json
import os
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
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
N_CLUSTERS = 5
RANDOM_STATE = 42

# Rank (goc niyeti ortalamasina gore AZALAN sirada, 1=en yuksek) -> profil
# anahtari ve adi. Siralama VERIDEN hesaplanir (hangi ham kume hangi rank'e
# denk geliyor onceden bilinmez), ama rank->ad eslemesi analyze_pooled_profiles.py
# cikti incelemesiyle SABITLENMISTIR (bkz. modul docstring'i).
RANK_TO_PROFILE = {
    1: ("P1", "Eğitim Odaklı, Düşük Kaygılı Gençler"),
    2: ("P2", "Tüm Faktörlerde Yüksek Düzeyli Gençler"),
    3: ("P3", "Çevresel Kaygısı Düşük Gençler"),
    4: ("P4", "Sosyal Bağı Zayıf, Çevresel Kaygısı Yüksek Gençler"),
    5: ("P5", "Göçe Mesafeli Gençler"),
}


def load_pooled(engine):
    tr_query = f"""
        SELECT {", ".join(FACTOR_COLUMNS)}, score_goc_niyeti
        FROM raw_survey_data
        WHERE {" AND ".join(f"{c} IS NOT NULL" for c in FACTOR_COLUMNS)}
    """
    tr_df = pd.read_sql(text(tr_query), engine)
    tr_df["ulke"] = "tr"

    md_query = f"""
        SELECT {", ".join(FACTOR_COLUMNS)}, score_goc_niyeti
        FROM anket_son_sayisal
        WHERE ulke = 'md' AND {" AND ".join(f"{c} IS NOT NULL" for c in FACTOR_COLUMNS)}
    """
    md_df = pd.read_sql(text(md_query), engine)
    md_df["ulke"] = "md"

    return pd.concat([tr_df, md_df], ignore_index=True)


def main():
    engine = create_engine(DATABASE_URL)
    df = load_pooled(engine)
    n_tr = int((df["ulke"] == "tr").sum())
    n_md = int((df["ulke"] == "md").sum())
    print(f"Pooled veri: TR={n_tr}, MD={n_md}, toplam={len(df)}")

    X = df[FACTOR_COLUMNS].astype(float).values
    weight_md = n_tr / n_md
    weights = np.where(df["ulke"].values == "tr", 1.0, weight_md)

    km = KMeans(n_clusters=N_CLUSTERS, n_init=10, random_state=RANDOM_STATE)
    raw_labels = km.fit_predict(X, sample_weight=weights)
    df["raw_cluster"] = raw_labels

    sil = silhouette_score(X, raw_labels)
    print(f"Silhouette skoru (agirlikli model, agirliksiz X ile olculdu): {sil:.4f}")

    # Ham kume indekslerini goc niyeti ortalamasina gore AZALAN sirada
    # (rank 1 = en yuksek) profil anahtarlarina esler.
    intent_by_cluster = df.groupby("raw_cluster")["score_goc_niyeti"].mean().sort_values(ascending=False)
    cluster_to_rank = {cluster_idx: rank for rank, cluster_idx in enumerate(intent_by_cluster.index, start=1)}

    centroids_payload = {}
    titles_payload = {}
    participant_summary = {}
    for cluster_idx, rank in cluster_to_rank.items():
        profile_key, title = RANK_TO_PROFILE[rank]
        center = km.cluster_centers_[cluster_idx]
        centroids_payload[profile_key] = {
            col.replace("score_", ""): round(float(val), 4) for col, val in zip(FACTOR_COLUMNS, center)
        }
        titles_payload[profile_key] = title
        sub = df[df["raw_cluster"] == cluster_idx]
        participant_summary[profile_key] = {
            "n": int(len(sub)),
            "tr": int((sub["ulke"] == "tr").sum()),
            "md": int((sub["ulke"] == "md").sum()),
            "gocNiyetiOrtalama": round(float(sub["score_goc_niyeti"].mean()), 2),
        }

    print("\nProfil ozeti:")
    for key, summary in sorted(participant_summary.items()):
        print(f"{key} ({titles_payload[key]}): n={summary['n']} (TR={summary['tr']}, MD={summary['md']}), "
              f"goc_niyeti_ort={summary['gocNiyetiOrtalama']}")

    ml_dir = BACKEND_DIR / "ml"
    ml_dir.mkdir(exist_ok=True)
    payload = {
        "generatedAt": datetime.now().isoformat(),
        "algorithm": "KMeans (pooled TR+MD, sample_weight ile ornek dengesizligi kontrolu)",
        "nClusters": N_CLUSTERS,
        "randomState": RANDOM_STATE,
        "silhouetteScore": round(float(sil), 4),
        "participantCountTr": n_tr,
        "participantCountMd": n_md,
        "weightMd": round(float(weight_md), 4),
        "titles": titles_payload,
        "centroids": centroids_payload,
        "trainingSummary": participant_summary,
    }
    out_path = ml_dir / "cluster_centroids_pooled.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"\nYazildi: {out_path}")


if __name__ == "__main__":
    main()
