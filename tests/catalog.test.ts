import { describe, expect, it } from 'vitest';
import { buildCart } from '../lib/catalog';

describe('catálogo protegido pelo servidor', () => {
  it('mantém R$ 22,90 sem bump', () => {
    expect(buildCart([])).toMatchObject({ bumpIds: [], amountCents: 2290 });
  });

  it('aceita somente o bump 5 e totaliza R$ 32,80', () => {
    expect(buildCart([5, 2, 5, 99])).toMatchObject({ bumpIds: [5], amountCents: 3280 });
  });
});
