# Final Report

LaTeX source for the MSBD5005 final report (Team USTVIS14).

## Files

```
main.tex          # paper source
references.bib    # bibliography
figures/          # screenshots (placeholders for now)
```

## One-time setup (no Overleaf — local LaTeX)

The paper uses the IEEE VGTC conference template. The class file is **not**
checked into the repo (license + binary) — drop it in once and you are set.

### macOS

```bash
# 1. Install MacTeX (full distribution; ~5 GB).  BasicTeX is too small.
brew install --cask mactex
# OR a smaller full distribution:
# brew install --cask mactex-no-gui

# 2. Make sure latexmk is on PATH (re-open shell after install).
which latexmk

# 3. Download the VGTC template bundle.
#    Source: https://tc.computer.org/vgtc/publications/journal
#    The file you want is the LaTeX style: vgtc.cls (and vgtc-conf.bst,
#    abbrv-doi.bst, etc.).  Drop the unpacked .cls and .bst files into
#    this `report/` folder alongside main.tex.

# 4. Build.
cd report
latexmk -pdf -interaction=nonstopmode main.tex
```

### VS Code workflow

1. Install the **LaTeX Workshop** extension (`james-yu.latex-workshop`).
2. Open the repo folder in VS Code; open `report/main.tex`.
3. Use the side-panel build button or `⌘⇧B` (auto-detected from
   `latexmkrc`-style defaults) — LaTeX Workshop runs `latexmk` and shows
   the PDF in the right preview pane with sync-jump.
4. Errors land in the Problems tab and the rendered PDF auto-refreshes on
   save.

### If you don't want to install MacTeX yet

The `main.tex` has a commented-out `article`-class fallback near the top.
Uncomment those three lines and comment out the VGTC `\documentclass`
line, and the paper will compile against any vanilla LaTeX install for
draft / word-count purposes (final submission still uses VGTC).

## Figures

`figures/` is empty for now. Capture screenshots from the running dashboard
and save them as:

```
figures/macro.png            (Macro view, Iran-tension window brushed)
figures/meso.png             (UMAP scatter + cluster summary table)
figures/micro-intraday.png   (3-grid intraday OHLC + volume for 2026-03-23)
figures/micro-context.png    (Headline panel + Polymarket panel)
```

Recommended resolution: at least 1600 × 900, PNG. The `\fbox{...}`
placeholders in `main.tex` will be replaced with `\includegraphics{...}` —
those `\includegraphics` lines are already commented in next to each
placeholder.

## Word count

The current draft is sized for the 4-page VGTC two-column layout. Run a
build and check; if the body overflows, the discussion or related-work
section is the most flexible place to trim.

## Submission

May 13. One team member uploads the report PDF + a separate source-code
archive (the `.zip` of this repo). Per course instructions: `report and
source code in two separate files`.
