# Dark Rivers

**Dark Rivers v0.1.0** is an interactive, time-controlled exploration of Ireland's historical biological river-monitoring observations. It presents the most recently revealed biological Q-value class at locally sampled reaches, an observation history, an observation-based distribution of Q classes, and the proportion of the mapped river network represented by sampled reaches.

- Live demonstration: https://salmonofdoubt.github.io/demos/dark-rivers/
- Preserved release DOI: https://doi.org/10.5281/zenodo.22899198
- Project source: https://github.com/salmonofdoubt/salmonofdoubt.github.io/tree/master/demos/dark-rivers
- Dedicated GitHub release tag: `dark-rivers-v0.1.0`

## Reading the map and graphs

A dark reach has **no observation revealed for that reach by the selected year**; dark is not a poor ecological-quality classification. A coloured sampled reach represents the most recent recorded Q-value class revealed for that reach. A record is carried forward until a newer observation supersedes it. Its age and the geographic distribution of the sampled network should be considered when interpreting the visualisation.

The three linked mobile visualisations display (1) the composition of recorded Q classes within the sampled reaches, (2) observations through time, and (3) the fraction of the **mapped network** covered by locally sampled reaches. The first chart describes the recorded subset, not an estimate of all Irish rivers. Changing observation coverage, monitoring locations, and data availability can change the displayed distributions. A station observation is not a direct measurement of an entire river or waterbody. Q classes should not be averaged into an unqualified national ecological score.

The interface groups Q-value observations for display as High, Good, Moderate, Poor, and Bad. The data builder contains the authoritative normalisation and category mapping used for this particular snapshot. The archive is not an official Environmental Protection Agency (EPA) ecological-status assessment.

## Sources and processing

`data/official.json` is the generated observation and local-reach snapshot consumed by the browser; `data/systems.json` provides connected river-system geometry used on selection; `data/network-mobile.png` is a pre-rendered image of the mapped river network for lower-cost rendering on mobile devices. The application uses illustrative fallback observations only when the official static dataset is unavailable or invalid.

The processing script `ops/build_dark_rivers.py` draws upon the EPA's public geographical services, including historical and recent biological Q-value records, monitoring stations, and Water Framework Directive Cycle 3 river-waterbody geometry. It normalises observation classes, links recorded measurements to monitoring stations and maps short local reaches. The production browser loads a **static generated snapshot**, not a live EPA survey feed.

- EPA water maps: https://gis.epa.ie/EPAMaps/Water
- EPA downloads: https://gis.epa.ie/GetData/Download
- EPA biological Q-value survey resource: https://epawebapp.epa.ie/qvalue/webusers/
- Coastline reference: Natural Earth 1:10m, https://www.naturalearthdata.com/about/terms-of-use/

The included source and generated datasets should be attributed to their respective providers. This README **does not grant a blanket licence** over EPA-derived observations, Natural Earth material, or other third-party assets. Review the applicable source permissions and any licence selected for the Zenodo record before publishing the deposit.

## Reproduce the archived interface

The **dedicated release ZIP** preserves `demos/dark-rivers/` alongside the four shared stylesheet/script dependencies in `demos/shared/`. It includes the exact versioned application assets, the service worker and manifest, the linked icons, the generated observation data and mobile map, plus the source data builder. Obsolete build assets elsewhere in the website repository are intentionally excluded.

Extract the ZIP and start a local server from the extracted archive root:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/demos/dark-rivers/`. Do not open `index.html` directly as a `file://` URL; the application fetches local static data and registers a scoped service worker. Some navigation outside Dark Rivers points to the larger website and is not part of this dedicated preservation package.

The release ZIP contains `SNAPSHOT.json` with the Git commit and per-file SHA-256 checksums to distinguish the preserved release from later changes to the live website.

## Packaging and publication

From the website repository root:

```sh
python3 demos/dark-rivers/ops/package_release.py
```

This creates `dist/dark-rivers-v0.1.0.zip` without modifying the live site. The manual GitHub Actions workflow **Package Dark Rivers release** can run the same script and offers the ZIP as a downloadable workflow artifact. Attach the resulting Dark Rivers ZIP to the existing **draft** GitHub release and upload **the same ZIP** to the existing manual Zenodo draft for DOI `10.5281/zenodo.22899198`. Do not enable automatic GitHub-to-Zenodo archiving for this release: that could produce a different deposit and DOI.

Match the release tag's target commit to the `source_commit` recorded in `SNAPSHOT.json` before publishing. The GitHub-generated source archive on the release page covers the whole website repository; it is **not** the dedicated Dark Rivers deposit.
