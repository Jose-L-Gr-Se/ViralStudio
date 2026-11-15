import { z } from "zod";
import {
  ThemeIdSchema,
  ThemeSchema,
  type ThemeId,
  type VisualTheme,
} from "./schema";

export const THEME_CATALOG = {
  "forest-editorial": {
    colors: {
      brand: "#2f5d41",
      accent: "#a65f3f",
      accentSecondary: "#9bae85",
      cream: "#f7f6f1",
      ink: "#1d211c",
      muted: "#73786f",
      earth: "#a65f3f",
    },
    typography: {
      display: {
        family: '"Georgia", "Times New Roman", serif',
        weight: 700,
        letterSpacing: -2,
      },
      headline: {
        family: '"Georgia", "Times New Roman", serif',
        weight: 700,
        letterSpacing: -1,
      },
      body: {
        family: '"Arial", "Helvetica Neue", sans-serif',
        weight: 400,
        letterSpacing: 0,
      },
      data: {
        family: '"Arial", "Helvetica Neue", sans-serif',
        weight: 700,
        letterSpacing: -0.5,
      },
      caption: {
        family: '"Arial", "Helvetica Neue", sans-serif',
        weight: 600,
        letterSpacing: 1.5,
      },
    },
    typeScale: {
      display: 128,
      headline: 88,
      title: 60,
      body: 32,
      data: 64,
      caption: 20,
    },
    spacing: { xs: 8, sm: 16, md: 24, lg: 40, xl: 64, xxl: 96 },
    radii: { none: 0, sm: 8, md: 20, lg: 36, pill: 999 },
    backgrounds: {
      canvas: "#f7f6f1",
      surface: "#eeece4",
      elevated: "#ffffff",
      overlay: "#1d211c",
    },
    finishes: { grain: 0.12, vignette: 0.08, shadow: "soft", edge: "soft" },
  },
  "cinematic-dark": {
    colors: {
      brand: "#49654e",
      accent: "#d0a16c",
      accentSecondary: "#a6b59b",
      cream: "#e9e3d8",
      ink: "#10130f",
      muted: "#a39e92",
      earth: "#805c43",
    },
    typography: {
      display: {
        family: '"Georgia", "Times New Roman", serif',
        weight: 700,
        letterSpacing: -1.5,
      },
      headline: {
        family: '"Georgia", "Times New Roman", serif',
        weight: 700,
        letterSpacing: -0.5,
      },
      body: {
        family: '"Arial", "Helvetica Neue", sans-serif',
        weight: 400,
        letterSpacing: 0.2,
      },
      data: {
        family: '"Arial", "Helvetica Neue", sans-serif',
        weight: 700,
        letterSpacing: 0,
      },
      caption: {
        family: '"Arial", "Helvetica Neue", sans-serif',
        weight: 600,
        letterSpacing: 2,
      },
    },
    typeScale: {
      display: 136,
      headline: 92,
      title: 62,
      body: 30,
      data: 68,
      caption: 18,
    },
    spacing: { xs: 8, sm: 16, md: 28, lg: 44, xl: 72, xxl: 104 },
    radii: { none: 0, sm: 4, md: 12, lg: 24, pill: 999 },
    backgrounds: {
      canvas: "#10130f",
      surface: "#1b201a",
      elevated: "#282c24",
      overlay: "#080a08",
    },
    finishes: {
      grain: 0.32,
      vignette: 0.72,
      shadow: "cinematic",
      edge: "soft",
    },
  },
  scientific: {
    colors: {
      brand: "#2f5d41",
      accent: "#247c78",
      accentSecondary: "#83b8a4",
      cream: "#f4f7f3",
      ink: "#162521",
      muted: "#637570",
      earth: "#99704c",
    },
    typography: {
      display: {
        family: '"Arial", "Helvetica Neue", sans-serif',
        weight: 800,
        letterSpacing: -2,
      },
      headline: {
        family: '"Arial", "Helvetica Neue", sans-serif',
        weight: 700,
        letterSpacing: -1,
      },
      body: {
        family: '"Arial", "Helvetica Neue", sans-serif',
        weight: 400,
        letterSpacing: 0,
      },
      data: {
        family: '"Arial", "Helvetica Neue", sans-serif',
        weight: 700,
        letterSpacing: -0.5,
      },
      caption: {
        family: '"Arial", "Helvetica Neue", sans-serif',
        weight: 600,
        letterSpacing: 1,
      },
    },
    typeScale: {
      display: 120,
      headline: 80,
      title: 56,
      body: 30,
      data: 76,
      caption: 19,
    },
    spacing: { xs: 8, sm: 16, md: 24, lg: 36, xl: 56, xxl: 88 },
    radii: { none: 0, sm: 6, md: 14, lg: 22, pill: 999 },
    backgrounds: {
      canvas: "#f4f7f3",
      surface: "#e7eeea",
      elevated: "#ffffff",
      overlay: "#162521",
    },
    finishes: { grain: 0.02, vignette: 0.05, shadow: "soft", edge: "crisp" },
  },
  "natural-product": {
    colors: {
      brand: "#2f5d41",
      accent: "#b47a45",
      accentSecondary: "#b1bd91",
      cream: "#f7f3e9",
      ink: "#28241d",
      muted: "#82796b",
      earth: "#8e6444",
    },
    typography: {
      display: {
        family: '"Georgia", "Times New Roman", serif',
        weight: 700,
        letterSpacing: -2,
      },
      headline: {
        family: '"Georgia", "Times New Roman", serif',
        weight: 700,
        letterSpacing: -0.8,
      },
      body: {
        family: '"Arial", "Helvetica Neue", sans-serif',
        weight: 400,
        letterSpacing: 0,
      },
      data: {
        family: '"Arial", "Helvetica Neue", sans-serif',
        weight: 700,
        letterSpacing: 0,
      },
      caption: {
        family: '"Arial", "Helvetica Neue", sans-serif',
        weight: 600,
        letterSpacing: 1.8,
      },
    },
    typeScale: {
      display: 124,
      headline: 84,
      title: 58,
      body: 31,
      data: 66,
      caption: 19,
    },
    spacing: { xs: 8, sm: 18, md: 26, lg: 42, xl: 68, xxl: 100 },
    radii: { none: 0, sm: 10, md: 24, lg: 42, pill: 999 },
    backgrounds: {
      canvas: "#f7f3e9",
      surface: "#eee7d9",
      elevated: "#fffdf7",
      overlay: "#28241d",
    },
    finishes: { grain: 0.18, vignette: 0.12, shadow: "soft", edge: "soft" },
  },
} satisfies Record<ThemeId, VisualTheme>;

export const ThemeCatalogSchema = z
  .record(ThemeIdSchema, ThemeSchema)
  .superRefine((catalog, context) => {
    for (const id of ThemeIdSchema.options) {
      if (!catalog[id]) {
        context.addIssue({
          code: "custom",
          path: [id],
          message: `Missing theme "${id}".`,
        });
      }
    }
  });

export type ThemeCatalog = z.infer<typeof ThemeCatalogSchema>;

export const parseThemeCatalog = (input: unknown): ThemeCatalog =>
  ThemeCatalogSchema.parse(input);

export const getTheme = (id: string): VisualTheme =>
  THEME_CATALOG[ThemeIdSchema.parse(id)];
