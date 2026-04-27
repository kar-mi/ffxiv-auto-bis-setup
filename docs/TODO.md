# TODO — Future Improvements

## Build

### Replace CDN Tailwind with a proper build step
`public/index.html` currently loads Tailwind from the CDN. Replace with Tailwind CLI or PostCSS
so the stylesheet is generated at build time and the inline config block can move to
`tailwind.config.js`.
