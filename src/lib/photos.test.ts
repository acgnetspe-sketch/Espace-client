import { describe, expect, it } from 'vitest';
import { dimensionsReduites } from './photos';

describe('réduction des photos', () => {
  it('ramène le plus grand côté à 2000 px en gardant les proportions', () => {
    expect(dimensionsReduites(4032, 3024)).toEqual({ largeur: 2000, hauteur: 1500 });
    expect(dimensionsReduites(3024, 4032)).toEqual({ largeur: 1500, hauteur: 2000 });
  });
  it('n’agrandit jamais une petite photo', () => {
    expect(dimensionsReduites(1200, 800)).toEqual({ largeur: 1200, hauteur: 800 });
  });
});
