// Bambu colours: manufacturer's PLA Basic hex table. TECBEARS pastels:
// visual matches to the user's product photographs, not measured swatches.
export const PALETTES = {
  graphite: {
    tiles: [0x222724, 0x68685f], opponent: 0x323835, opponentDim: 0x202622,
    robot: 0xa6aba3, robotDim: 0x727b75, robotBase: 0x383e3a,
    poster: 'assets/chess/poster.webp',
  },
  original: {
    tiles: [0xa4dbe8, 0xf2d6df], opponent: 0x9d432c, opponentDim: 0x602e20,
    robot: 0xff6a13, robotDim: 0xc25319, robotBase: 0x754322,
    poster: 'assets/chess/poster-original.webp',
  },
};
export const paletteFromSearch = search => new URLSearchParams(search).get('palette') === 'original' ? 'original' : 'graphite';

export function paletteURL(href, key) {
  const url = new URL(href);
  if (key === 'original') url.searchParams.set('palette', 'original');
  else url.searchParams.delete('palette');
  return url;
}
