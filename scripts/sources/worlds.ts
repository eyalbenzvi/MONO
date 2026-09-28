/** The worlds of the content waves (docs/content/waves.md §5): keywords the metadata filter looks for. */
import type { World } from "./_pipeline";

export const WORLDS: Record<number, World> = {
  1: {
    wave: 1,
    name: "Ocean",
    keywords: [
      "octopus", "cephalopod", "squid", "nautilus", "whale", "beluga", "cetacean", "shark", "ray", "fish", "school of fish",
      "jellyfish", "medusa", "siphonophore", "coral", "anemone", "starfish", "sea star", "echinoderm", "sea urchin", "plankton",
      "radiolaria", "diatom", "foraminifera", "crustacean", "crab", "lobster", "shrimp", "deep sea", "abyssal", "penguin", "marine", "oceanography",
      "mollusc", "mollusk", "shell", "seaweed", "algae", "seal", "walrus", "dolphin", "porpoise", "eel",
    ],
    // What the sources are searched for (their own search engines; the filter then reads every keyword above).
    queries: ["octopus", "squid", "nautilus", "whale", "shark", "fish", "jellyfish", "medusa", "coral", "anemone", "starfish", "sea urchin", "radiolaria", "diatom", "plankton", "crab", "lobster", "shrimp", "penguin", "seal", "dolphin", "shell", "seaweed", "marine"],
  },
};
