import { z } from "zod";

const HexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);

const FontRoleSchema = z
  .object({
    family: z.string().trim().min(1),
    weight: z.number().int().min(100).max(900),
    letterSpacing: z.number().finite(),
  })
  .strict();

export const ThemeSchema = z
  .object({
    colors: z
      .object({
        brand: HexColorSchema,
        accent: HexColorSchema,
        accentSecondary: HexColorSchema,
        cream: HexColorSchema,
        ink: HexColorSchema,
        muted: HexColorSchema,
        earth: HexColorSchema,
      })
      .strict(),
    typography: z
      .object({
        display: FontRoleSchema,
        headline: FontRoleSchema,
        body: FontRoleSchema,
        data: FontRoleSchema,
        caption: FontRoleSchema,
      })
      .strict(),
    typeScale: z
      .object({
        display: z.number().finite().positive(),
        headline: z.number().finite().positive(),
        title: z.number().finite().positive(),
        body: z.number().finite().positive(),
        data: z.number().finite().positive(),
        caption: z.number().finite().positive(),
      })
      .strict(),
    spacing: z
      .object({
        xs: z.number().finite().nonnegative(),
        sm: z.number().finite().nonnegative(),
        md: z.number().finite().nonnegative(),
        lg: z.number().finite().nonnegative(),
        xl: z.number().finite().nonnegative(),
        xxl: z.number().finite().nonnegative(),
      })
      .strict(),
    radii: z
      .object({
        none: z.number().finite().nonnegative(),
        sm: z.number().finite().nonnegative(),
        md: z.number().finite().nonnegative(),
        lg: z.number().finite().nonnegative(),
        pill: z.number().finite().nonnegative(),
      })
      .strict(),
    backgrounds: z
      .object({
        canvas: HexColorSchema,
        surface: HexColorSchema,
        elevated: HexColorSchema,
        overlay: HexColorSchema,
      })
      .strict(),
    finishes: z
      .object({
        grain: z.number().finite().min(0).max(1),
        vignette: z.number().finite().min(0).max(1),
        shadow: z.enum(["none", "soft", "cinematic"]),
        edge: z.enum(["crisp", "soft"]),
      })
      .strict(),
  })
  .strict();

export type VisualTheme = z.infer<typeof ThemeSchema>;

export const ThemeIdSchema = z.enum([
  "forest-editorial",
  "cinematic-dark",
  "scientific",
  "natural-product",
]);

export type ThemeId = z.infer<typeof ThemeIdSchema>;
