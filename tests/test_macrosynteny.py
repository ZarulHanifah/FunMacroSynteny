import pytest
from playwright.sync_api import Page, expect

def test_initial_state_renders(page: Page):
    """Documentation: The app should render default test data on load."""
    expect(page.locator(".sample-group")).to_have_count(2)
    expect(page.locator(".chrom-bar")).to_have_count(6)

def test_tsv_upload(page: Page, tsv_path):
    """Documentation: Uploading a new TSV should clear canvas and render new tracks."""
    path = tsv_path("simple_twoGenome_threeChrom.links.tsv")
    page.set_input_files("#tsv-upload", path)
    
    expect(page.locator("text=Sample 1")).to_be_visible()
    expect(page.locator("text=Sample 2")).to_be_visible()
    expect(page.locator(".chrom-bar")).to_have_count(6)

def test_tooltip_on_hover(page: Page, tsv_path):
    """Documentation: Hovering over a block should show its genomic coordinates."""
    path = tsv_path("simple_twoGenome_threeChrom.links.tsv")
    page.set_input_files("#tsv-upload", path)
    
    block = page.locator(".block-rect").first
    block.hover()
    
    tooltip = page.locator("#tooltip")
    expect(tooltip).to_be_visible()
    expect(tooltip).to_contain_text("Block: A")

def test_reverse_orientation_rendering(page: Page, tsv_path):
    """Documentation: Blocks with start > end should show 'Inverted: true' in tooltip."""
    path = tsv_path("reverse_orientation.links.tsv")
    page.set_input_files("#tsv-upload", path)
    
    # In Sample 2, Chr 3 is inverted
    # We find blocks where inverted is true
    block = page.locator(".block-rect").nth(5) # Sample 2, Chr 3 block
    block.hover()
    expect(page.locator("#tooltip")).to_contain_text("Inverted: true")

def test_unlinked_chrom_grey(page: Page, tsv_path):
    """Documentation: Chromosomes with no synteny should be rendered as grey (#cbd5e1)."""
    path = tsv_path("genome1_got_chrom4.links.tsv")
    page.set_input_files("#tsv-upload", path)
    
    # Chr 4 in Sample 1 is unlinked
    chr4_block = page.locator(".block-rect").nth(3) 
    # Check if the fill is the grey color we defined
    expect(chr4_block).to_have_attribute("fill", "#cbd5e1")

def test_toggle_chromosome_labels(page: Page, tsv_path):
    """Documentation: Users should be able to hide chromosome names via the sidebar."""
    path = tsv_path("simple_twoGenome_threeChrom.links.tsv")
    page.set_input_files("#tsv-upload", path)
    
    label = page.locator(".chrom-name").first
    expect(label).to_be_visible()
    
    # Toggle the checkbox
    page.check("#cfg-showLabels") # Check/uncheck
    page.uncheck("#cfg-showLabels")
    
    expect(label).to_have_attribute("opacity", "0")

def test_sample_reordering_drag(page: Page, tsv_path):
    """Documentation: Dragging a sample label vertically should reorder the genomes."""
    path = tsv_path("simple_twoGenome_threeChrom.links.tsv")
    page.set_input_files("#tsv-upload", path)
    
    s1 = page.locator("#track-Sample\\ 1")
    s2 = page.locator("#track-Sample\\ 2")
    
    box1 = s1.bounding_box()
    box2 = s2.bounding_box()
    
    assert box1['y'] < box2['y']
    
    label = s1.locator(".sample-label")
    page.mouse.move(box1['x'] + 10, box1['y'] + 10)
    page.mouse.down()
    page.mouse.move(box1['x'] + 10, box2['y'] + 50, steps=10) 
    page.mouse.up()
    
    page.wait_for_timeout(500)
    new_box1 = s1.bounding_box()
    assert new_box1['y'] > box1['y']

def test_scale_clamping(page: Page, tsv_path):
    """Documentation: The horizontal scale slider should be capped to prevent overflow."""
    path = tsv_path("simple_twoGenome_threeChrom.links.tsv")
    page.set_input_files("#tsv-upload", path)
    
    slider = page.locator("#cfg-scale")
    max_val = float(slider.get_attribute("max"))
    
    page.evaluate("document.getElementById('cfg-scale').value = 1.0")
    page.evaluate("document.getElementById('cfg-scale').dispatchEvent(new Event('input'))")
    
    current_val = float(slider.get_attribute("value"))
    assert current_val <= max_val
