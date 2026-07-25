/*
  Observer profiles are data, not one-off visual filters.
  Add future species here and keep the renderer generic.

  Important: the RGB-to-receptor matrices below are educational approximations.
  A conventional RGB photograph contains no measured ultraviolet channel.
*/

export const OBSERVER_PROFILES = Object.freeze({
  "apis-mellifera": Object.freeze({
    id: "apis-mellifera",
    commonName: "Western honey bee",
    scientificName: "Apis mellifera",
    activityClass: "Primarily diurnal",
    receptorModel: Object.freeze({
      uvProxy: Object.freeze([-0.22, 0.18, 0.78]),
      blue: Object.freeze([0.08, 0.22, 0.70]),
      green: Object.freeze([0.18, 0.72, 0.10])
    }),
    displayModel: Object.freeze({
      redFrom: Object.freeze([0.12, 0.88, 0.00]),
      greenFrom: Object.freeze([0.00, 0.10, 0.90]),
      blueFrom: Object.freeze([0.88, 0.12, 0.00])
    }),
    spatialModel: Object.freeze({
      baseBlurPx: 0.48,
      distanceExponent: 0.82,
      referenceDistanceCm: 40
    }),
    modes: Object.freeze({
      sunny: Object.freeze({
        label: "Sunny daylight",
        description: "Strongest colour signal and the highest modelled spatial detail.",
        exposure: 1.06,
        contrast: 1.08,
        chroma: 1.00,
        uvGain: 1.05,
        blueGain: 1.00,
        greenGain: 1.02,
        blurMultiplier: 1.00,
        noise: 0.006
      }),
      overcast: Object.freeze({
        label: "Overcast daylight",
        description: "Diffuse, cooler light with lower contrast and slightly reduced chromatic separation.",
        exposure: 0.84,
        contrast: 0.91,
        chroma: 0.78,
        uvGain: 0.96,
        blueGain: 1.03,
        greenGain: 0.93,
        blurMultiplier: 1.28,
        noise: 0.014
      }),
      night: Object.freeze({
        label: "Very low light",
        description: "A deliberately dark, noisy view: Western honey bees are primarily diurnal and do not gain cinematic night vision.",
        exposure: 0.19,
        contrast: 0.69,
        chroma: 0.08,
        uvGain: 0.28,
        blueGain: 0.31,
        greenGain: 0.58,
        blurMultiplier: 2.45,
        noise: 0.090
      })
    })
  })
});

export const DEFAULT_PROFILE_ID = "apis-mellifera";
