export type AttributionTouch = {
  id: string;
  channel: string;
  occurredAt: string;
};

export type AttributionCredit = AttributionTouch & { credit: number };

export function allocateAttribution(touches: AttributionTouch[], model: 'first_touch' | 'last_touch' | 'position_based'): AttributionCredit[] {
  const ordered = touches
    .filter((touch) => Number.isFinite(Date.parse(touch.occurredAt)))
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  if (ordered.length === 0) return [];

  if (model === 'first_touch') return ordered.map((touch, index) => ({ ...touch, credit: index === 0 ? 1 : 0 }));
  if (model === 'last_touch') return ordered.map((touch, index) => ({ ...touch, credit: index === ordered.length - 1 ? 1 : 0 }));
  if (ordered.length === 1) return [{ ...ordered[0], credit: 1 }];
  if (ordered.length === 2) return ordered.map((touch) => ({ ...touch, credit: 0.5 }));

  const middleCredit = 0.2 / (ordered.length - 2);
  return ordered.map((touch, index) => ({
    ...touch,
    credit: index === 0 || index === ordered.length - 1 ? 0.4 : middleCredit,
  }));
}
