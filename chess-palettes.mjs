// Bambu colours: manufacturer's PLA Basic hex table. TECBEARS pastels:
// visual matches to the user's product photographs, not measured swatches.
export const PALETTES = {
  graphite: {
    tiles: [0x222724, 0x68685f], opponent: 0x323835, opponentDim: 0x202622,
    robot: 0xa6aba3, robotDim: 0x92988f,
    poster: 'assets/chess/poster.webp',
  },
  original: {
    tiles: [0x57cedb, 0xf29bbf], opponent: 0x754322, opponentDim: 0x60391f,
    robot: 0xff6a13, robotDim: 0xc25319,
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
