# EnvLens

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


## Version 4 additions

- Child-friendlier simple top controls with five big quick-view buttons
- Distance control hidden from the main interface
- Local saving simplified to an automatic private-local note
- Focused set of quick views: Bee, Dragonfly, Night moth, UV clue, Colour-blind
- Service-worker cache bumped again to reduce stale localhost confusion


## Version 5 mobile-first redesign

- The picture is the first and largest element on a phone.
- Five views use a balanced 3+2 grid of large buttons.
- Lighting remains one three-way control.
- Upload is one large primary action.
- Model metrics, local library and scientific method are collapsed until requested.
- Desktop remains a balanced viewer-plus-controls layout.


## Version 6 changes

- The photo chooser is now above the comparison image on every viewport.
- A selected photo automatically brings the comparison into view.
- The chooser becomes “Change photo” after loading an image.
- Removed accidental repeated click-handler registration from the view update function.
- Mobile layout now follows the actual task order: choose photo, see result, then explore views.


## Version 7 corrections

- Replaced the accumulated mobile CSS patches with one coherent responsive stylesheet.
- Photo chooser is the first actionable control.
- Comparison and control panels are guaranteed full width on phones.
- Added a header back button and removed fixed bottom controls from the mobile content area.
- Removed duplicate event-handler registration that accumulated on each view change.


## Rename compatibility

EnvLens uses a new application and cache name. On browsers that expose the IndexedDB database list, existing photos from the former local library are copied into the EnvLens library automatically. The old database is left untouched as a safety copy.
