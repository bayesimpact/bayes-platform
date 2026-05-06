"""
pytest configuration for apps/api/test/.

Adds apps/api/bin/ to sys.path so that Python test files in this directory
can import document_chunker directly without a package install.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "bin"))
