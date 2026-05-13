"""
pytest configuration for apps/api/test/.

document_chunker.py lives in apps/api/bin/ as a standalone CLI script — it is
not part of a Python package. Without this conftest, `from document_chunker
import ...` in the test file would fail with ModuleNotFoundError because pytest
only adds the test directory itself to sys.path.

This is the most idiomatic pytest answer for that layout. Alternatives would be
to add a pyproject.toml/pytest.ini just to set `pythonpath`, or to restructure
bin/ into a package (which would break the existing bash wrapper at
apps/api/bin/document_chunker).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "bin"))
