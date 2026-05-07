# Final Report

LaTeX source for the MSBD5005 (Spring 2026) final project report —
Team USTVIS14.

Built against the **IEEE VGTC TVCG journal LaTeX template**
(release `2026-01-30`, dropped into this folder verbatim).

## Files

```
main.tex                  Our paper (the only file you usually edit)
references.bib            Our bibliography
figures/                  Drop screenshots here (.png)

# VGTC template (do not edit; treat as vendored)
vgtc.cls                  document class
abbrv-doi*.bst            4 bibliography styles (we use abbrv-doi-hyperref)
template.tex              upstream sample paper — useful as a reference
template.bib              upstream sample bibliography
template.pdf              upstream rendered sample
diamondrule.{eps,pdf}     section separator art (loaded by vgtc.cls)
figs/                     upstream sample figures
makefile                  upstream makefile (works alongside our latexmk)
README                    upstream README

.latexmkrc                tells latexmk + LaTeX Workshop how to build
.gitignore                ignores .aux/.log/main.pdf, keeps everything else
```

## One-time setup (already done if you got this far)

```bash
brew install --cask basictex
sudo /Library/TeX/texbin/tlmgr update --self
sudo /Library/TeX/texbin/tlmgr install \
    enumitem cleveref ccicons mwe lipsum tabu varwidth changepage hyperref \
    silence scalerel helvetic collection-fontsrecommended
```

After install, restart your terminal so `/Library/TeX/texbin` is on PATH.

## Build (every time)

```bash
cd report
latexmk -pdf main.tex            # auto-runs pdflatex/bibtex as needed
open main.pdf                    # macOS preview
```

`latexmk` reads `.latexmkrc` and runs the right number of pdflatex/bibtex
passes. It is incremental — it skips passes when nothing changed.

To clean build artifacts:

```bash
latexmk -C                       # nukes everything except main.tex/.bib
```

## VS Code workflow

1. Install the **LaTeX Workshop** extension (`james-yu.latex-workshop`).
2. Open the repo folder; open `report/main.tex`.
3. Save (`⌘S`) — LaTeX Workshop auto-builds via `latexmk` and shows the
   PDF in the preview pane on the right.
4. Errors land in the Problems tab and the rendered PDF auto-refreshes.

## Figures

Once a teammate captures screenshots, save them under `figures/` as:

```
figures/macro.png            (Macro view, Iran-tension window brushed)
figures/meso.png             (UMAP scatter + cluster summary table)
figures/micro-intraday.png   (3-grid intraday OHLC + volume for 2026-03-23)
figures/micro-context.png    (Headline panel + Polymarket panel)
```

In `main.tex`, each `\fbox{...}` placeholder has a commented
`\includegraphics{...}` line right above it — uncomment that line and
delete the `\fbox{...}` placeholder line. Recommended resolution
1600 × 900+ PNG.

## Submission

May 13. One team member uploads the report PDF + a separate source-code
archive of the repo. Per course instructions: *report and source code
in two separate files*.

## Current status

- 4 pages exactly (target hit)
- 155 KB PDF
- All 12 references compile cleanly with `abbrv-doi-hyperref` style
- Only warnings are underfull boxes around the figure placeholders;
  these will resolve once screenshots replace the `\fbox{...}` boxes
