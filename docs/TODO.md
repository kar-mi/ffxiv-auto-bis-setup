# TODO — Future Improvements

## Frontend

### Component-based tab rendering
Currently the tab sections in `public/index.html` are static HTML referenced by ID from `src/ui/`.
Once a frontend framework or lightweight component system is introduced, each tab (Gear, BIS Sets,
Items, Upgrades) should be rendered as a proper component rather than manipulated directly via DOM
IDs. This would make the tab structure self-contained and easier to extend.

## Build

### Replace CDN Tailwind with a proper build step
`public/index.html` currently loads Tailwind from the CDN. Replace with Tailwind CLI or PostCSS
so the stylesheet is generated at build time and the inline config block can move to
`tailwind.config.js`.
