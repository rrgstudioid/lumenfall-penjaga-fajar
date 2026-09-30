export type HSV = { h: number; s: number; v: number };
export const clampColor = (n: number, max: number) =>
  Math.max(0, Math.min(max, n));
export function hsvToHex({ h, s, v }: HSV): string {
  const hue = (((h % 360) + 360) % 360) / 60;
  const c = ((clampColor(v, 100) / 100) * clampColor(s, 100)) / 100;
  const x = c * (1 - Math.abs((hue % 2) - 1)),
    m = clampColor(v, 100) / 100 - c;
  const rgb =
    hue < 1
      ? [c, x, 0]
      : hue < 2
        ? [x, c, 0]
        : hue < 3
          ? [0, c, x]
          : hue < 4
            ? [0, x, c]
            : hue < 5
              ? [x, 0, c]
              : [c, 0, x];
  return (
    '#' +
    rgb
      .map((n) =>
        Math.round((n + m) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export function hexToHSV(hex: string, fallbackHue = 0): HSV {
  const [r, g, b] = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  const h = !d
    ? fallbackHue
    : (60 *
        (max === r
          ? ((g - b) / d) % 6
          : max === g
            ? (b - r) / d + 2
            : (r - g) / d + 4) +
        360) %
      360;
  return { h, s: max ? (d / max) * 100 : 0, v: max * 100 };
}
