import { computeBoundsFromParts } from '../tools/build-executor.js';

describe('computeBoundsFromParts', () => {
  it('returns zero bounds for no parts', () => {
    expect(computeBoundsFromParts([])).toEqual([0, 0, 0]);
  });

  it('computes full extents from offset plus half-size, rounded to 0.1', () => {
    // part = [x, y, z, sizeX, sizeY, sizeZ, ...]
    const parts = [[5, 0, 0, 4, 2, 2]];
    expect(computeBoundsFromParts(parts)).toEqual([14, 2, 2]);
  });

  it('uses absolute offsets and takes the max across parts', () => {
    const parts = [
      [-5, 0, 0, 2, 2, 2],
      [3, 10, 0, 2, 2, 6],
    ];
    expect(computeBoundsFromParts(parts)).toEqual([12, 22, 6]);
  });
});
