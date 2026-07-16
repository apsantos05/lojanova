export const PRODUCT = {
  id: 'product',
  name: 'Oração Sagrada de São Bento',
  priceCents: 2290,
} as const;

export const BUMPS = {
  5: {
    id: 5,
    name: 'Áudio Completo da Oração Sagrada de São Bento',
    priceCents: 990,
  },
} as const;

export type BumpId = keyof typeof BUMPS;

export function buildCart(requested: unknown) {
  const raw = Array.isArray(requested) ? requested : [];
  const bumpIds = [...new Set(raw.map(Number))].filter((id): id is BumpId => id === 5);
  const items = [
    { id: PRODUCT.id, name: PRODUCT.name, price_cents: PRODUCT.priceCents },
    ...bumpIds.map((id) => ({ id: `bump${id}`, name: BUMPS[id].name, price_cents: BUMPS[id].priceCents })),
  ];
  return { bumpIds, items, amountCents: items.reduce((sum, item) => sum + item.price_cents, 0) };
}
