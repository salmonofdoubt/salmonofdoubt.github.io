# Umwelt Lens

A static, browser-only GitHub Pages demo for comparing an uploaded RGB photograph with a human-visible false-colour model of Western honey bee visual information.

## What it does

- Upload by file picker or drag and drop.
- Compare the original and bee-model view with an accessible divider.
- Switch between sunny daylight, overcast daylight and very low light.
- Adjust modelled viewing distance.
- Store up to 100 compressed photographs in IndexedDB on the visitor's own browser.
- Download the current split comparison.
- Cache the application shell for offline reopening after the first successful visit.

## Privacy and local storage

Uploaded photographs are processed in the browser. No upload endpoint exists.

The local library uses IndexedDB and is specific to the current browser profile and device. It is not shared between visitors or devices. A visitor can delete individual photographs or clear the library. The browser may clear storage under pressure, and private-browsing storage may be temporary.

## Scientific boundary

This is an educational approximation, not calibrated animal-vision analysis. Ordinary RGB photographs do not record ultraviolet reflectance. The UV channel is therefore explicitly described as a proxy. A future calibrated mode should accept matched visible and UV photographs, camera spectral sensitivity, illuminant data and a reflectance standard.

## Change the DOI

Edit only `site-config.js`:

```js
export const SITE_CONFIG = Object.freeze({
  doi: "10.5281/zenodo.YOUR_RECORD",
  doiUrl: "https://doi.org/10.5281/zenodo.YOUR_RECORD",
  // remaining settings
});
```

## Add another observer

1. Add a new data object in `profiles.js`.
2. Add a matching `<option>` in `index.html`.
3. Keep receptor, illumination and spatial parameters in the profile rather than adding species-specific CSS filters.

## Repository dependencies

The page deliberately reuses the existing shared support widget:

- `demos/shared/demo-support.css`
- `demos/shared/demo-support.js`

No framework, package manager, build step or remote image service is required.


## Version 2 additions

- Installable Progressive Web App manifest and app icons
- Offline application-shell caching
- In-app install control with iOS/Android/desktop guidance
- Mobile-first viewer ordering and larger touch controls
- Separate **UV proxy** view for visitors without UV photography

The UV proxy is deliberately described as an RGB-derived hypothesis. It is not measured ultraviolet reflectance and must not be used as scientific evidence.


## Version 3 additions

- Improved UV proxy tonemapping so the view is less crushed into black
- Six observer profiles (honey bee, bumblebee, butterfly, hoverfly, dragonfly, hawk moth)
- Separate colour-vision-difference impression with deuteranopia, protanopia and tritanopia options
- Better observer notes and clearer limitations in the UI

All added observers remain educational translations rather than calibrated multispectral reconstructions.
