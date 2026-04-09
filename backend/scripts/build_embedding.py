"""Build a 2D embedding from the daily feature table.

Input:
- data/derived/daily_features.csv

Output:
- data/derived/embedding_results.csv

Round-1 behavior:
- Standardize numeric feature columns
- Use UMAP when available
- Fall back to PCA when UMAP is unavailable or unsuitable
- Add a simple KMeans cluster label
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

REPO_ROOT = Path(__file__).resolve().parents[2]
DERIVED_DIR = REPO_ROOT / "data" / "derived"
FEATURES_INPUT_PATH = DERIVED_DIR / "daily_features.csv"
EMBEDDING_OUTPUT_PATH = DERIVED_DIR / "embedding_results.csv"

RANDOM_STATE = 42


def load_daily_features(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Expected input file: {path}")

    frame = pd.read_csv(path)
    if "date" not in frame.columns:
        raise ValueError("Expected a 'date' column in daily_features.csv")

    frame = frame.copy()
    frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    frame = frame.dropna(subset=["date"]).sort_values("date").reset_index(drop=True)
    return frame


def prepare_feature_matrix(frame: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    numeric_columns = [
        column for column in frame.columns if column != "date" and pd.api.types.is_numeric_dtype(frame[column])
    ]
    if not numeric_columns:
        raise ValueError("No numeric feature columns found in daily_features.csv")

    numeric_frame = frame[numeric_columns].copy()
    numeric_frame = numeric_frame.apply(pd.to_numeric, errors="coerce")
    numeric_frame = numeric_frame.fillna(numeric_frame.median(numeric_only=True))
    numeric_frame = numeric_frame.fillna(0.0)
    return numeric_frame, numeric_columns


def standardize_features(feature_frame: pd.DataFrame) -> pd.DataFrame:
    scaler = StandardScaler()
    scaled = scaler.fit_transform(feature_frame)
    return pd.DataFrame(scaled, columns=feature_frame.columns, index=feature_frame.index)


def compute_embedding(feature_frame: pd.DataFrame) -> pd.DataFrame:
    n_samples = len(feature_frame)
    n_features = feature_frame.shape[1]

    if n_samples == 0:
        raise ValueError("No rows available to embed")

    if n_samples == 1:
        return pd.DataFrame({"x": [0.0], "y": [0.0]}, index=feature_frame.index)

    try:
        import umap  # type: ignore

        if n_samples >= 3:
            reducer = umap.UMAP(
                n_components=2,
                n_neighbors=min(15, n_samples - 1),
                min_dist=0.1,
                random_state=RANDOM_STATE,
            )
            embedded = reducer.fit_transform(feature_frame)
            return pd.DataFrame(embedded, columns=["x", "y"], index=feature_frame.index)
    except ImportError:
        pass

    n_components = min(2, n_samples, n_features)
    reducer = PCA(n_components=n_components, random_state=RANDOM_STATE)
    embedded = reducer.fit_transform(feature_frame)

    embedding_frame = pd.DataFrame(index=feature_frame.index)
    embedding_frame["x"] = embedded[:, 0]
    embedding_frame["y"] = embedded[:, 1] if n_components > 1 else 0.0
    return embedding_frame


def assign_clusters(feature_frame: pd.DataFrame) -> pd.Series:
    n_samples = len(feature_frame)
    n_clusters = min(3, n_samples)

    if n_samples == 0:
        raise ValueError("No rows available for clustering")
    if n_clusters == 1:
        return pd.Series([0] * n_samples, index=feature_frame.index, dtype="int64")

    model = KMeans(n_clusters=n_clusters, random_state=RANDOM_STATE, n_init="auto")
    labels = model.fit_predict(feature_frame)
    return pd.Series(labels, index=feature_frame.index, dtype="int64")


def build_embedding_results(daily_features: pd.DataFrame) -> pd.DataFrame:
    numeric_features, _ = prepare_feature_matrix(daily_features)
    scaled_features = standardize_features(numeric_features)
    embedding = compute_embedding(scaled_features)
    cluster_labels = assign_clusters(scaled_features)

    results = pd.DataFrame(
        {
            "date": daily_features["date"].dt.strftime("%Y-%m-%d"),
            "x": embedding["x"],
            "y": embedding["y"],
            "cluster_id": cluster_labels,
        }
    )
    return results


def save_embedding_results(frame: pd.DataFrame, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(output_path, index=False)


def main() -> None:
    daily_features = load_daily_features(FEATURES_INPUT_PATH)
    embedding_results = build_embedding_results(daily_features)
    save_embedding_results(embedding_results, EMBEDDING_OUTPUT_PATH)
    print(f"Saved {len(embedding_results)} rows -> {EMBEDDING_OUTPUT_PATH}")


if __name__ == "__main__":
    main()
