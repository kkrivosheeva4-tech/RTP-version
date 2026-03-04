import json
from pathlib import Path


def get_default_data_dir() -> Path:
    # backend/config/seed_utils.py -> repository root -> src/data/ru
    return Path(__file__).resolve().parents[2] / "src" / "data" / "ru"


def load_json(path: Path):
    with path.open("r", encoding="utf-8-sig") as file:
        return json.load(file)
