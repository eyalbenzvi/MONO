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
};
