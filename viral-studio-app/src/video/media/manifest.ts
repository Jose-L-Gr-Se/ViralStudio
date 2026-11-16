import type { MediaManifest } from "./schema";

export const MEDIA_MANIFEST = {
  schemaVersion: 1,
  assets: [
    {
      id: "usda-strawberry-farmer-impact",
      kind: "image",
      path: "documentary-proof/impact-strawberry-farmer.jpg",
      provenance: {
        type: "public-domain",
        source:
          "https://commons.wikimedia.org/wiki/File:Lewis_Taylor_Farms_seven_months_after_Hurricane_Michael_(20190507-OSEC-LSC-0321).jpg",
      },
      license: "Public domain - U.S. federal government work (USDA)",
      credits: "USDAgov; photo by Lance Cheung.",
      altText:
        "A farmer holding freshly harvested strawberries in a cultivated field.",
      focalPoint: { x: 0.5, y: 0.42 },
    },
    {
      id: "usda-water-wise-strawberries",
      kind: "image",
      path: "documentary-proof/water-wise-berries.jpg",
      provenance: {
        type: "public-domain",
        source:
          "https://commons.wikimedia.org/wiki/File:Fruits_and_Vegetables_(20150827-NRCS-LSC-0054).jpg",
      },
      license: "Public domain - U.S. federal government work (USDA)",
      credits: "USDAgov; photo by Lance Cheung.",
      altText: "A ripe strawberry surrounded by leaves at Reiter Berry Farms.",
      focalPoint: { x: 0.5, y: 0.55 },
    },
    {
      id: "usda-heirloom-tomatoes-conclusion",
      kind: "image",
      path: "documentary-proof/closing-heirloom-tomatoes.jpg",
      provenance: {
        type: "public-domain",
        source:
          "https://commons.wikimedia.org/wiki/File:2012_USDA_Farmers_Market_Opening_(20120601-DM-LSC-0343).jpg",
      },
      license: "Public domain - U.S. federal government work (USDA)",
      credits: "USDAgov; photo by Lance Cheung.",
      altText:
        "A farmer presenting organic heirloom tomatoes at a local farmers market.",
      focalPoint: { x: 0.68, y: 0.5 },
    },
  ],
} satisfies MediaManifest;
