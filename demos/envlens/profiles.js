/*
  Observer profiles are data, not one-off visual filters.
  Add future species here and keep the renderer generic.

  Important: the RGB-to-receptor matrices below are educational approximations.
  A conventional RGB photograph contains no measured ultraviolet channel.
*/

function createModes({
  sunny,
  overcast,
  night
}) {
  return Object.freeze({
    sunny: Object.freeze({
      label: "Sunny daylight",
      description: sunny.description,
      exposure: sunny.exposure,
      contrast: sunny.contrast,
      chroma: sunny.chroma,
      uvGain: sunny.uvGain,
      blueGain: sunny.blueGain,
      greenGain: sunny.greenGain,
      blurMultiplier: sunny.blurMultiplier,
      noise: sunny.noise
    }),
    overcast: Object.freeze({
      label: "Overcast daylight",
      description: overcast.description,
      exposure: overcast.exposure,
      contrast: overcast.contrast,
      chroma: overcast.chroma,
      uvGain: overcast.uvGain,
      blueGain: overcast.blueGain,
      greenGain: overcast.greenGain,
      blurMultiplier: overcast.blurMultiplier,
      noise: overcast.noise
    }),
    night: Object.freeze({
      label: "Very low light",
      description: night.description,
      exposure: night.exposure,
      contrast: night.contrast,
      chroma: night.chroma,
      uvGain: night.uvGain,
      blueGain: night.blueGain,
      greenGain: night.greenGain,
      blurMultiplier: night.blurMultiplier,
      noise: night.noise
    })
  });
}

function createProfile(config) {
  return Object.freeze({
    id: config.id,
    commonName: config.commonName,
    scientificName: config.scientificName,
    summary: config.summary,
    distinction: config.distinction,
    activityClass: config.activityClass,
    modelFamily: config.modelFamily || "insect",
    dichromatModel: config.dichromatModel
      ? Object.freeze({
          short: Object.freeze(config.dichromatModel.short),
          long: Object.freeze(config.dichromatModel.long),
          displayRed: Object.freeze(config.dichromatModel.displayRed),
          displayGreen: Object.freeze(config.dichromatModel.displayGreen),
          displayBlue: Object.freeze(config.dichromatModel.displayBlue)
        })
      : null,
    receptorModel: Object.freeze({
      uvProxy: Object.freeze(config.receptorModel.uvProxy),
      blue: Object.freeze(config.receptorModel.blue),
      green: Object.freeze(config.receptorModel.green)
    }),
    displayModel: Object.freeze({
      redFrom: Object.freeze(config.displayModel.redFrom),
      greenFrom: Object.freeze(config.displayModel.greenFrom),
      blueFrom: Object.freeze(config.displayModel.blueFrom)
    }),
    spatialModel: Object.freeze({
      baseBlurPx: config.spatialModel.baseBlurPx,
      distanceExponent: config.spatialModel.distanceExponent,
      referenceDistanceCm: config.spatialModel.referenceDistanceCm
    }),
    modes: createModes(config.modes)
  });
}

export const OBSERVER_PROFILES = Object.freeze({
  "apis-mellifera": createProfile({
    id: "apis-mellifera",
    commonName: "Western honey bee",
    scientificName: "Apis mellifera",
    summary: "UV, blue and green receptor-inspired translation for a classic diurnal pollinator.",
    distinction: "A compact trichromatic pollinator model with modest spatial acuity and weak very-low-light performance.",
    activityClass: "Primarily diurnal",
    receptorModel: {
      uvProxy: [-0.22, 0.18, 0.78],
      blue: [0.08, 0.22, 0.70],
      green: [0.18, 0.72, 0.10]
    },
    displayModel: {
      redFrom: [0.12, 0.88, 0.00],
      greenFrom: [0.00, 0.10, 0.90],
      blueFrom: [0.88, 0.12, 0.00]
    },
    spatialModel: {
      baseBlurPx: 0.48,
      distanceExponent: 0.82,
      referenceDistanceCm: 40
    },
    modes: {
      sunny: {
        description: "Strongest colour signal and the highest modelled spatial detail.",
        exposure: 1.06,
        contrast: 1.08,
        chroma: 1.00,
        uvGain: 1.05,
        blueGain: 1.00,
        greenGain: 1.02,
        blurMultiplier: 1.00,
        noise: 0.006
      },
      overcast: {
        description: "Diffuse, cooler light with lower contrast and slightly reduced chromatic separation.",
        exposure: 0.84,
        contrast: 0.91,
        chroma: 0.78,
        uvGain: 0.96,
        blueGain: 1.03,
        greenGain: 0.93,
        blurMultiplier: 1.28,
        noise: 0.014
      },
      night: {
        description: "A deliberately dark, noisy view: honey bees are day-active and do not gain cinematic night vision.",
        exposure: 0.19,
        contrast: 0.69,
        chroma: 0.08,
        uvGain: 0.28,
        blueGain: 0.31,
        greenGain: 0.58,
        blurMultiplier: 2.45,
        noise: 0.09
      }
    }
  }),
  "bombus-terrestris": createProfile({
    id: "bombus-terrestris",
    commonName: "Bumblebee",
    scientificName: "Bombus terrestris",
    summary: "Another UV-blue-green pollinator, but larger-bodied and slightly steadier under dull daylight.",
    distinction: "Keeps a little more colour and detail in overcast light than the honey-bee profile.",
    activityClass: "Diurnal, often active under cool and cloudy conditions",
    receptorModel: {
      uvProxy: [-0.18, 0.16, 0.80],
      blue: [0.06, 0.26, 0.68],
      green: [0.20, 0.70, 0.10]
    },
    displayModel: {
      redFrom: [0.10, 0.84, 0.06],
      greenFrom: [0.02, 0.14, 0.84],
      blueFrom: [0.84, 0.16, 0.00]
    },
    spatialModel: {
      baseBlurPx: 0.44,
      distanceExponent: 0.79,
      referenceDistanceCm: 42
    },
    modes: {
      sunny: {
        description: "Bright daylight with strong floral contrast and slightly softer colour separation than the honey-bee profile.",
        exposure: 1.03,
        contrast: 1.04,
        chroma: 0.98,
        uvGain: 1.03,
        blueGain: 1.00,
        greenGain: 1.01,
        blurMultiplier: 0.94,
        noise: 0.006
      },
      overcast: {
        description: "Bumblebees often continue foraging under dull conditions, so colour loss is softened here.",
        exposure: 0.88,
        contrast: 0.95,
        chroma: 0.84,
        uvGain: 0.97,
        blueGain: 1.01,
        greenGain: 0.95,
        blurMultiplier: 1.16,
        noise: 0.012
      },
      night: {
        description: "Still a daytime insect, but the low-light collapse is slightly less severe than for the honey-bee profile.",
        exposure: 0.24,
        contrast: 0.72,
        chroma: 0.11,
        uvGain: 0.32,
        blueGain: 0.34,
        greenGain: 0.60,
        blurMultiplier: 2.05,
        noise: 0.075
      }
    }
  }),
  "pieris-rapae": createProfile({
    id: "pieris-rapae",
    commonName: "Butterfly",
    scientificName: "Pieris rapae-inspired",
    summary: "A compressed approximation of a butterfly-like system; real butterflies often have more than three receptor classes.",
    distinction: "The translation is more chromatic and UV-forward, standing in for a richer colour space than a bee-like model.",
    activityClass: "Diurnal",
    receptorModel: {
      uvProxy: [0.02, 0.10, 0.88],
      blue: [0.10, 0.18, 0.72],
      green: [0.24, 0.66, 0.10]
    },
    displayModel: {
      redFrom: [0.16, 0.74, 0.10],
      greenFrom: [0.08, 0.18, 0.74],
      blueFrom: [0.82, 0.14, 0.04]
    },
    spatialModel: {
      baseBlurPx: 0.38,
      distanceExponent: 0.76,
      referenceDistanceCm: 45
    },
    modes: {
      sunny: {
        description: "High-chroma, UV-rich translation standing in for a visually colourful butterfly system.",
        exposure: 1.08,
        contrast: 1.06,
        chroma: 1.12,
        uvGain: 1.10,
        blueGain: 1.02,
        greenGain: 0.98,
        blurMultiplier: 0.90,
        noise: 0.005
      },
      overcast: {
        description: "Colour remains vivid but softens under cloud as chromatic separation narrows.",
        exposure: 0.87,
        contrast: 0.93,
        chroma: 0.92,
        uvGain: 0.98,
        blueGain: 1.00,
        greenGain: 0.94,
        blurMultiplier: 1.08,
        noise: 0.012
      },
      night: {
        description: "This is still an illustrative collapse into low light, not a nocturnal butterfly model.",
        exposure: 0.18,
        contrast: 0.67,
        chroma: 0.08,
        uvGain: 0.24,
        blueGain: 0.30,
        greenGain: 0.50,
        blurMultiplier: 2.20,
        noise: 0.085
      }
    }
  }),
  "episyrphus-balteatus": createProfile({
    id: "episyrphus-balteatus",
    commonName: "Hoverfly",
    scientificName: "Episyrphus balteatus-inspired",
    summary: "A fly-like observer with a distinct balance between UV, blue and green responses.",
    distinction: "Shifted towards motion-friendly fly vision, with less bee-like mapping and a greener overall rendering.",
    activityClass: "Diurnal",
    receptorModel: {
      uvProxy: [-0.08, 0.10, 0.80],
      blue: [0.14, 0.18, 0.68],
      green: [0.30, 0.58, 0.12]
    },
    displayModel: {
      redFrom: [0.08, 0.60, 0.32],
      greenFrom: [0.08, 0.22, 0.70],
      blueFrom: [0.74, 0.22, 0.04]
    },
    spatialModel: {
      baseBlurPx: 0.46,
      distanceExponent: 0.75,
      referenceDistanceCm: 50
    },
    modes: {
      sunny: {
        description: "A fly-like translation with cooler highlights and slightly stronger green-channel emphasis.",
        exposure: 1.01,
        contrast: 1.02,
        chroma: 0.96,
        uvGain: 1.00,
        blueGain: 1.00,
        greenGain: 1.02,
        blurMultiplier: 0.92,
        noise: 0.006
      },
      overcast: {
        description: "The rendering softens gently under cloud while keeping a distinct fly-inspired colour balance.",
        exposure: 0.85,
        contrast: 0.92,
        chroma: 0.82,
        uvGain: 0.96,
        blueGain: 0.99,
        greenGain: 0.96,
        blurMultiplier: 1.12,
        noise: 0.013
      },
      night: {
        description: "Like most hoverflies, this observer is not a low-light specialist.",
        exposure: 0.17,
        contrast: 0.66,
        chroma: 0.07,
        uvGain: 0.22,
        blueGain: 0.28,
        greenGain: 0.47,
        blurMultiplier: 2.25,
        noise: 0.088
      }
    }
  }),
  "sympetrum": createProfile({
    id: "sympetrum",
    commonName: "Dragonfly",
    scientificName: "Dragonfly-inspired",
    summary: "A high-acuity, spectrally rich predatory insect model compressed into three display channels.",
    distinction: "Sharper and more contrast-preserving than the bee profiles, reflecting a visually formidable aerial hunter.",
    activityClass: "Primarily diurnal",
    receptorModel: {
      uvProxy: [0.05, 0.12, 0.83],
      blue: [0.12, 0.20, 0.68],
      green: [0.26, 0.60, 0.14]
    },
    displayModel: {
      redFrom: [0.10, 0.70, 0.20],
      greenFrom: [0.06, 0.16, 0.78],
      blueFrom: [0.78, 0.18, 0.04]
    },
    spatialModel: {
      baseBlurPx: 0.22,
      distanceExponent: 0.68,
      referenceDistanceCm: 60
    },
    modes: {
      sunny: {
        description: "Sharper rendering and strong contrast stand in for the dragonfly’s unusually capable vision.",
        exposure: 1.02,
        contrast: 1.10,
        chroma: 1.02,
        uvGain: 1.05,
        blueGain: 1.00,
        greenGain: 1.00,
        blurMultiplier: 0.78,
        noise: 0.004
      },
      overcast: {
        description: "Still comparatively sharp, with modest contrast loss under diffuse light.",
        exposure: 0.88,
        contrast: 0.97,
        chroma: 0.86,
        uvGain: 0.98,
        blueGain: 1.00,
        greenGain: 0.98,
        blurMultiplier: 0.96,
        noise: 0.010
      },
      night: {
        description: "Not a nocturnal model, but the base acuity remains higher than the bee-inspired profiles.",
        exposure: 0.15,
        contrast: 0.64,
        chroma: 0.06,
        uvGain: 0.18,
        blueGain: 0.24,
        greenGain: 0.42,
        blurMultiplier: 1.55,
        noise: 0.075
      }
    }
  }),
  "deilephila-elpenor": createProfile({
    id: "deilephila-elpenor",
    commonName: "Hawk moth",
    scientificName: "Deilephila elpenor-inspired",
    summary: "A crepuscular pollinator model that retains more usable signal under very low light than a bee.",
    distinction: "The night view remains far more interpretable, representing a low-light-adapted pollinating insect.",
    activityClass: "Crepuscular to nocturnal",
    receptorModel: {
      uvProxy: [-0.10, 0.16, 0.76],
      blue: [0.12, 0.24, 0.64],
      green: [0.22, 0.66, 0.12]
    },
    displayModel: {
      redFrom: [0.14, 0.74, 0.12],
      greenFrom: [0.06, 0.18, 0.76],
      blueFrom: [0.80, 0.16, 0.04]
    },
    spatialModel: {
      baseBlurPx: 0.40,
      distanceExponent: 0.74,
      referenceDistanceCm: 45
    },
    modes: {
      sunny: {
        description: "In bright light the rendering remains pollinator-like, though this profile matters most at dusk and night.",
        exposure: 1.00,
        contrast: 1.00,
        chroma: 0.98,
        uvGain: 1.00,
        blueGain: 1.00,
        greenGain: 1.00,
        blurMultiplier: 0.96,
        noise: 0.006
      },
      overcast: {
        description: "Diffuse light remains usable, with moderate colour preservation.",
        exposure: 0.88,
        contrast: 0.94,
        chroma: 0.84,
        uvGain: 0.97,
        blueGain: 1.00,
        greenGain: 0.96,
        blurMultiplier: 1.06,
        noise: 0.012
      },
      night: {
        description: "Compared with the bee profiles, the scene remains brighter, less noisy and more interpretable under very low light.",
        exposure: 0.42,
        contrast: 0.79,
        chroma: 0.28,
        uvGain: 0.44,
        blueGain: 0.48,
        greenGain: 0.70,
        blurMultiplier: 1.55,
        noise: 0.045
      }
    }
  }),
  "canis-familiaris": createProfile({
    id: "canis-familiaris",
    commonName: "Dog",
    scientificName: "Canis familiaris",
    summary: "A blue-and-yellow dichromatic approximation with reduced red–green separation and lower spatial detail than human vision.",
    distinction: "Reds and greens become much harder to distinguish, while blue–yellow differences remain more useful; fine detail is softened.",
    activityClass: "Day and low-light adapted",
    modelFamily: "mammal-dichromat",
    dichromatModel: {
      short: [0.04, 0.16, 0.80],
      long: [0.46, 0.49, 0.05],
      displayRed: [0.05, 0.90, 0.05],
      displayGreen: [0.14, 0.76, 0.10],
      displayBlue: [0.86, 0.08, 0.06]
    },
    receptorModel: {
      uvProxy: [0.00, 0.00, 1.00],
      blue: [0.04, 0.16, 0.80],
      green: [0.46, 0.49, 0.05]
    },
    displayModel: {
      redFrom: [0.00, 0.05, 0.95],
      greenFrom: [0.00, 0.16, 0.84],
      blueFrom: [0.00, 0.90, 0.10]
    },
    spatialModel: {
      baseBlurPx: 0.92,
      distanceExponent: 0.76,
      referenceDistanceCm: 50
    },
    modes: {
      sunny: {
        description: "Blue–yellow colour differences remain visible, red and green separate poorly, and fine detail is softened.",
        exposure: 1.00,
        contrast: 0.98,
        chroma: 0.58,
        uvGain: 0.00,
        blueGain: 1.00,
        greenGain: 1.00,
        blurMultiplier: 1.00,
        noise: 0.004
      },
      overcast: {
        description: "A slightly flatter, less saturated dog-view approximation under diffuse light.",
        exposure: 0.90,
        contrast: 0.91,
        chroma: 0.44,
        uvGain: 0.00,
        blueGain: 0.98,
        greenGain: 0.98,
        blurMultiplier: 1.08,
        noise: 0.010
      },
      night: {
        description: "Colour falls away, but the scene remains more usable than a human daylight-style view because dogs are comparatively effective in dim light.",
        exposure: 0.50,
        contrast: 0.82,
        chroma: 0.14,
        uvGain: 0.00,
        blueGain: 0.70,
        greenGain: 0.78,
        blurMultiplier: 1.22,
        noise: 0.040
      }
    }
  }),
  "felis-catus": createProfile({
    id: "felis-catus",
    commonName: "Cat",
    scientificName: "Felis catus",
    summary: "A muted blue–green dichromatic approximation with strong low-light emphasis, limited red discrimination and softened fine detail.",
    distinction: "Colours are subdued, red detail is weak, and the night view stays brighter than the dog or human-style views.",
    activityClass: "Crepuscular and low-light adapted",
    modelFamily: "mammal-dichromat",
    dichromatModel: {
      short: [0.05, 0.20, 0.75],
      long: [0.18, 0.72, 0.10],
      displayRed: [0.10, 0.66, 0.24],
      displayGreen: [0.18, 0.72, 0.10],
      displayBlue: [0.76, 0.16, 0.08]
    },
    receptorModel: {
      uvProxy: [0.00, 0.00, 1.00],
      blue: [0.05, 0.20, 0.75],
      green: [0.18, 0.72, 0.10]
    },
    displayModel: {
      redFrom: [0.00, 0.10, 0.90],
      greenFrom: [0.00, 0.22, 0.78],
      blueFrom: [0.00, 0.84, 0.16]
    },
    spatialModel: {
      baseBlurPx: 1.02,
      distanceExponent: 0.74,
      referenceDistanceCm: 50
    },
    modes: {
      sunny: {
        description: "A muted blue–green view with weak red separation and less fine detail than human vision.",
        exposure: 0.98,
        contrast: 0.96,
        chroma: 0.48,
        uvGain: 0.00,
        blueGain: 1.00,
        greenGain: 1.00,
        blurMultiplier: 1.00,
        noise: 0.004
      },
      overcast: {
        description: "Colours flatten further, while broad shapes and movement-relevant contrast remain clear.",
        exposure: 0.92,
        contrast: 0.91,
        chroma: 0.34,
        uvGain: 0.00,
        blueGain: 0.99,
        greenGain: 0.99,
        blurMultiplier: 1.06,
        noise: 0.008
      },
      night: {
        description: "A brighter, mostly achromatic low-light impression reflecting the cat eye’s strong rod and tapetal adaptations.",
        exposure: 0.68,
        contrast: 0.88,
        chroma: 0.09,
        uvGain: 0.00,
        blueGain: 0.78,
        greenGain: 0.84,
        blurMultiplier: 1.16,
        noise: 0.026
      }
    }
  })

});

export const DEFAULT_PROFILE_ID = "apis-mellifera";
