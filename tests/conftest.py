import pytest
import os

# --- PATH CONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML_FILE = f"file://{os.path.join(BASE_DIR, 'macrosynteny.html')}"
# Path where the user moved the TSVs
TSV_DIR = os.path.join(BASE_DIR, "tests", "input_folder", "tsvs")

@pytest.fixture
def html_path():
    return HTML_FILE

@pytest.fixture
def tsv_path():
    # Helper to get specific TSVs from the new folder
    def _get_tsv(filename="simple_twoGenome_threeChrom.links.tsv"):
        return os.path.join(TSV_DIR, filename)
    return _get_tsv

@pytest.fixture(autouse=True)
def setup_page(page, html_path):
    """Automatically load the page before each test."""
    page.goto(html_path)
    yield
