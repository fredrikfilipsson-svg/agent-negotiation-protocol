import json
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture(scope="session")
def vectors():
    """The published test vectors, produced by the TypeScript reference."""
    path = REPO_ROOT / "src" / "data" / "test-vectors.json"
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.fixture()
def example_log():
    path = (
        REPO_ROOT / "protocol" / "examples" / "session-log.example.json"
    )
    return json.loads(path.read_text(encoding="utf-8"))
