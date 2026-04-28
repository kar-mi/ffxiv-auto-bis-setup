# TODO — Future Improvements

## Build

### Replace CDN Tailwind with a proper build step
`public/index.html` currently loads Tailwind from the CDN. Replace with Tailwind CLI or PostCSS
so the stylesheet is generated at build time and the inline config block can move to
`tailwind.config.js`.


## Bugs
Materia slots show 5 for bis side, 2 equiped and 3 empty. bis shouldn't show empty materia
not showing materia alongside upgrades, only shows materia needed or upgrade needed
resize causes issue, unable to click on bottom element after resizing
add cache/live status to each tab, not just gear
no save button for renaming sets with bis sets
load from balance - needs class selection