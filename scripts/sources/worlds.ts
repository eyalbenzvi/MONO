/** The worlds of the content waves (docs/content/waves.md §5): keywords the metadata filter looks for. */
import type { World } from "./_pipeline";

export const WORLDS: Record<number, World> = {
  1: {
    wave: 1,
    name: "Ocean",
    keywords: [
      "octopus", "cephalopod", "squid", "nautilus", "whale", "beluga", "cetacean", "shark", "ray", "fish", "school of fish",
      "jellyfish", "siphonophore", "coral", "sea anemone", "starfish", "sea star", "echinoderm", "sea urchin", "plankton",
      "radiolaria", "diatom", "foraminifera", "crustacean", "crab", "lobster", "shrimp", "deep sea", "abyssal", "penguin", "oceanography",
      "mollusc", "mollusk", "shell", "seashell", "seaweed", "algae", "walrus", "dolphin", "porpoise", "eel",
      // The Latin of the plates' own titles (Haeckel, the Challenger reports).
      "medusae", "hydromedusae", "discomedusae", "siphonophorae", "radiolarien", "radiolarian", "cephalopoda", "echinodermata", "crustacea", "actiniae", "ascidiae", "ctenophora", "ctenophorae", "polycystina", "acanthometra", "mollusca", "gastropoda", "porifera", "sponge", "copepoda", "pisces", "teleostei", "thalamophora", "bryozoa", "holothuria", "ophiuroidea", "asteroidea", "crinoidea", "nudibranch", "plankton",
    ],
    // What the sources are searched for (their own search engines; the filter then reads every keyword above).
    queries: ["octopus", "squid", "nautilus", "whale", "shark", "fish", "jellyfish", "coral", "sea anemone", "starfish", "sea urchin", "radiolaria", "diatom", "plankton", "crab", "lobster", "shrimp", "penguin", "dolphin", "shell", "seaweed"],
  },
  2: {
    wave: 2,
    name: "Seafaring and navigation",
    keywords: [
      "lighthouse", "light station", "lightship", "ship", "sailing ship", "schooner", "clipper", "yacht", "fishing boat", "cargo ship", "steamship", "steamboat",
      "harbor", "harbour", "port", "dock", "wharf", "pier", "rigging", "sail plan", "hull", "lines plan", "half model", "propeller", "sextant", "octant",
      "compass", "binnacle", "chronometer", "nautical chart", "coast survey", "sounding", "bathymetry", "tide", "buoy", "frigate", "brig", "sloop", "ketch",
      "galleon", "man-of-war", "vessel", "boat", "navigation", "navire", "vaisseau", "architectura navalis", "shipbuilding", "anchor", "mast", "sail",
    ],
    queries: ["lighthouse", "light station", "lightship", "ship", "schooner", "sailing ship", "yacht", "fishing boat", "steamship", "harbor", "wharf", "pier", "sextant", "compass", "nautical chart", "frigate", "anchor"],
  },
  3: {
    wave: 3,
    name: "Maps, charts and the sky; architecture and type",
    keywords: [
      // Maps and charts (and their names in the languages of the old atlases).
      "map", "chart", "nautical chart", "sea chart", "coast survey", "coast chart", "harbor chart", "atlas", "plan of the harbour", "plan of the harbor", "plan of the port", "plan of the city", "plan of the town",
      "survey", "soundings", "carte", "karte", "kaart", "carta", "mappa", "plan de", "plan von", "hydrographic", "topographic",
      // The sky.
      "celestial", "constellation", "planisphere", "star chart", "star map", "star atlas", "uranometria", "atlas coelestis", "coelestis", "firmament", "hemisphere", "zodiac", "astronomical", "astronomy",
      "selenographia", "armillary", "orrery",
      // Architecture in line work.
      "elevation", "elevations", "ground plan", "floor plan", "facade", "façade", "architectural", "architecture", "cornice", "entablature", "order of architecture", "doric", "ionic", "corinthian", "observatory",
      // Type and lettering.
      "alphabet", "alfabet", "specimen of printing types", "printing types", "typeface", "lettering", "letters", "ornamental letters", "initials",
      // Knots and signals.
      "knot", "knots", "splice", "hitch", "signal flags", "signal code", "code of signals",
    ],
    // What every source's own search is asked for (a source's own list below replaces it).
    // A museum's moon, comet or "section" is a scene's (a Hiroshige full moon, "The Hundred Guilder Print, central section"): those words are the libraries' only.
    queries: ["map", "chart", "nautical chart", "celestial", "constellation", "planisphere", "architectural elevation", "elevation", "ground plan", "facade", "alphabet", "lettering", "type specimen", "knot"],
    signalFlags: true,
    // Line work only: a photograph of a façade is a Photograph, and its people can't be read from a title.
    inkOnly: true,
    sources: {
      // The Geography and Map Division's charts and sky maps; and HABS/HAER sheets of buildings whose names are the world's (an observatory, a capitol's dome, a bridge).
      loc: {
        queries: ["observatory", "capitol", "cathedral", "bridge", "windmill"],
        maps: ["nautical chart", "chart of the coast", "coast survey", "harbor chart", "celestial", "constellations", "star chart", "planisphere", "moon"],
        keywords: ["capitol", "cathedral", "bridge", "windmill", "dome", "moon", "lunar", "section"],
      },
      wikimedia: { keywords: ["moon", "lunar", "eclipse", "comet", "section", "globe"] },
      // The Office of Coast Survey's historical nautical charts, by chart type (its own search).
      noaa: { queries: ["Nautical Chart", "Nautical Chart--Sketch"] },
    },
  },
};
