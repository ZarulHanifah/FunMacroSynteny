# FunMacroSynteny 🧬

View macrosynteny with fun! Transform your structural genomics analysis from static images into a dynamic, interactive experience.

![Demo](static/images/demo.png)

## Why FunMacroSynteny?

We took inspiration from traditional macrosynteny visualizations, which are great for:
- Comparing different assemblies or parameters.
- Assessing structural evolution between species.
- Identifying genomic rearrangements and damage.

**But static images are a dead end.** We created FunMacroSynteny because genomic analysis should be fluid, interactive, and—most importantly—fun.

## 🚀 Quick Start

1. **Serve the app**:
   `python -m http.server 8000`
2. **Load your data**: Open your browser to `localhost:8000` and load your `.links.tsv` file.
3. **Explore**: Drag, drop, and right-click to discover structural insights.

## ✨ Premium Features

### 🎮 Total Interactive Control
- **Fluid Drag-and-Drop**: Rearrange genomes or individual chromosomes instantly to find the best alignment.
- **Deep Context Menus**: Right-click any syntenic block or chromosome to:
  - 🎨 **Change Colors**: Pick custom colors for specific synteny groups.
  - 🔄 **Reverse Orientation**: Flip chromosomes on the fly.
  - 🎯 **Focus Mode**: Zero in on specific chromosomes to clear the noise.
  - 🏷️ **Add Markers**: Tag important regions with red flags or icons.

### 📏 Smart Alignment
- **Neighbor-Sense Sorting**: Don't waste time manual-sorting. Right-click a genome to automatically align its chromosomes based on its neighbors (above or below).

### 📸 Publication-Ready Exports
- **The Export Hub**: A dedicated panel for high-quality outputs:
  - **300 DPI PNG**: Perfectly sized (18cm width) for journals and posters.
  - **Vector SVG**: Fully editable vector files with embedded styles for Illustrator or Inkscape.

### 🌍 Interactive Reporting (The "Collaborator Mode")
- **One-File Portability**: Export your entire analysis as a **single `.html` file**. 
- **No Server Required**: Share this file with collaborators; they can open it in any browser and use the full interactive engine to explore your data without installing a thing.

## 🛠 Dependencies

- A modern web browser.
- (Optional) Python to serve the files locally.

---
*Enjoy your genomic journey. Only when it is fun, do people truly want to check their genomes.*
