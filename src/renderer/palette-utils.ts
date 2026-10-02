export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export const TRUSTED_PALETTES: Record<string, [RgbColor, RgbColor, RgbColor]> = {
  neon_violet: [
    { r: 0.39, g: 0.25, b: 0.96 }, // #6340F5
    { r: 0.02, g: 0.85, b: 0.98 }, // #05D8FA
    { r: 0.98, g: 0.15, b: 0.65 }, // #FA26A6
  ],
  oceanic_azure: [
    { r: 0.47, g: 0.32, b: 0.96 }, // Violet
    { r: 0.02, g: 0.71, b: 0.83 }, // Cyan #06B6D4
    { r: 0.23, g: 0.51, b: 0.96 }, // Blue #3B82F6
  ],
  deep_cosmos: [
    { r: 0.55, g: 0.36, b: 0.96 }, // Violet #8B5CF6
    { r: 0.02, g: 0.71, b: 0.83 }, // Cyan #06B6D4
    { r: 0.93, g: 0.28, b: 0.60 }, // Pink #EC4899
  ],
  synthwave: [
    { r: 0.96, g: 0.25, b: 0.37 }, // Magenta/Coral #F43F5E
    { r: 0.02, g: 0.71, b: 0.83 }, // Cyan #06B6D4
    { r: 0.85, g: 0.27, b: 0.94 }, // Hot Magenta #D946EF
  ],
  boreal_glow: [
    { r: 0.06, g: 0.73, b: 0.51 }, // Emerald Green #10B981
    { r: 0.55, g: 0.36, b: 0.96 }, // Violet #8B5CF6
    { r: 0.20, g: 0.83, b: 0.60 }, // Mint/Aqua #34D399
  ],
  monochrome_silver: [
    { r: 0.23, g: 0.51, b: 0.96 }, // Blue #3B82F6
    { r: 0.02, g: 0.71, b: 0.83 }, // Cyan #06B6D4
    { r: 0.58, g: 0.64, b: 0.72 }, // Silver Slate #94A3B8
  ],
  chromatic_prism: [
    { r: 0.55, g: 0.36, b: 0.96 }, // Violet #8B5CF6
    { r: 0.96, g: 0.62, b: 0.04 }, // Gold #F59E0B
    { r: 0.98, g: 0.75, b: 0.14 }, // Amber #FBBF24
  ],
  solar_flare: [
    { r: 0.98, g: 0.45, b: 0.09 }, // Coral/Orange #F97316
    { r: 0.55, g: 0.36, b: 0.96 }, // Violet #8B5CF6
    { r: 0.98, g: 0.44, b: 0.52 }, // Rose #FB7185
  ],
};

export function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 6) {
    const num = parseInt(clean, 16);
    return {
      r: ((num >> 16) & 255) / 255,
      g: ((num >> 8) & 255) / 255,
      b: (num & 255) / 255,
    };
  }
  return { r: 0.5, g: 0.5, b: 0.5 };
}

export function resolvePalette(paletteIdOrHex: string): [RgbColor, RgbColor, RgbColor] {
  if (TRUSTED_PALETTES[paletteIdOrHex]) {
    return TRUSTED_PALETTES[paletteIdOrHex];
  }
  if (paletteIdOrHex.startsWith("#")) {
    const c = hexToRgb(paletteIdOrHex);
    return [c, c, c];
  }
  return TRUSTED_PALETTES.neon_violet;
}

