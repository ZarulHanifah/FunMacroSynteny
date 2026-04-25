# Testing Macrosynteny Visualization

This project uses `pytest` and `playwright` for behavior-driven testing.

## Prerequisites

1. **Install Python dependencies**:
   ```bash
   pip install pytest-playwright
   playwright install
   ```

## Running Tests

To run the full test suite and verify the tool's behavior:

```bash
# Run tests in headless mode (terminal only)
pytest tests/test_macrosynteny.py

# Run tests in headed mode (to watch the browser perform the actions)
pytest tests/test_macrosynteny.py --headed
```

## Behavior Documented in Tests

The current suite (`tests/test_macrosynteny.py`) verifies:

1. **`test_initial_state_renders`**: Ensures the app loads with default demo data if no file is provided.
2. **`test_tsv_upload`**: verifies that loading a `.links.tsv` file correctly identifies genomes and chromosomes.
3. **`test_tooltip_on_hover`**: Verifies that hovering over synteny blocks displays genomic coordinates.
4. **`test_sample_reordering_drag`**: Documents the "Dodge-style" vertical reordering. It drags Sample 1 past Sample 2 and verifies they swapped positions.
5. **`test_scale_clamping`**: Verifies that the Horizontal Scale cannot be set to a value that would cause canvas overflow.
