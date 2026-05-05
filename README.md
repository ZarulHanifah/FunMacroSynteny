# FunMacroSynteny

View macrosynteny with fun!

![Demo](static/images/demo.png)


## Inspiration

We took inspiration from macrosynteny visualization from ntsynt-viz, a very quick and easy way to:
- Compare effects of using different assemblies/params
- Assess how much the genomes evolved structurally between different species
- See how much damage the genomes that make it into NCBI Genbank

but the static image is annoying.

> "There must be a better way."
> — *Raymond Hettinger*


So, we create FunMacroSynteny because only when it is fun, then it makes it people want to check their genomes.

## Dependencies

Maybe just python, to serve the web app? And a web browser? That is it! Let the browser work for you!

## Usage

Just
`python -m http.server 8000`

or any other port.

You will see an easy demo (like the picture on top). Just load in your `.links.tsv` file from ntsynt. 

And I think from there, you should be able to figure out how to use it. Enjoy!

## Features

- Focus mode. Right click on a chromosome of a ref genome to toggle focus mode on selected chromosome, or select chromosomes to focus on the right sidebar.
- Click on a block, and a toast message reports the block `start-stop(size)`.

## Future features to add
- `.links.tsv` actually focuses only on syntenic blocks, it ignores total length info. Say a 1 Mb contig has syntenic block from position 1 to 5 Mb, then we should have gray region of 5 Mb downstream.
    - I think in our implementation, it will only show 5 Mb contig
- Turns out `.links.tsv` format is actually generated from ntsynt-viz. Is there a workable format from ntsynt without running ntsynt-viz?
- Run an algo to optimize rearranging the chroms, prioritizing chroms of higher synteny with another chrom?
- It kinda suck to run python -m http.server. Can we like: funmacrosynteny run [ -p [PORT, default 8000] ]
- Can we work on PAF formats?! That would be amazing.
- Rename genomes
- There are some usecases to include some other metadata. For example, we can see the genomic rearrangement, but we need tidk to confirm that the chrom is T2T. How to indicate if that chrom is T2T?
- ntSynt-viz actually got a 'genome sorting formula' to rearrange the chroms, but I think that is global. We want one that when applied to a genome, only applies the formula based on the adjacent genomes only
- Hover info should also indicate chrom name. Toast message click should report `syn_block [chrom:start-stop]` 
- Save state:
    - Important if we have worked on moving/hiding genomes, renamed genomes, etc.
    - Into separate json file? Exporting to html?
- Export svg/html.
    - Export to html is a crazy feature. Can embed in websites, and also share with collaborators.
- Change color palette, maybe? Im happy with the colors for now.
- The chroms are fixed horizontally. Maybe we want to allow the chroms to be positioned differently
- If I hover a chrom, the cursor shape is like two-way arrow. But I dont want that. It should be that two-way arrow only when I hold a chrom
- Can we have zoom in behaviour. Only applies with focus mode. So in focus mode, if I two-finger scroll, it zooms into where the cursor is, only expand horizontally.
    - We will also need a convenient zoom out button.
- Say I rearrange the chroms of the ref genome in the display, the arrangement of the chroms in the right sidebar needs to reflect that too.
- Wouldnt it be amazing if I can rearrange genomes not only by holding on the genome labels, but also holding-n-dragging the genome checkbox on the left sidebar?
    - Maybe rearrange chroms by holding-n-dragging on the right sidebar too?
- Right click on a synteny block to get color-picker?
    - So maybe right click should give options on what actions to take: reverse orientation? color?
