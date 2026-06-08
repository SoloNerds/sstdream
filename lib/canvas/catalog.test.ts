import { describe, it, expect } from 'vitest';
import { NODE_CATALOG, PALETTE_ORDER } from './catalog';

describe('node catalog', () => {
  it('matches snapshot', () => {
    expect(NODE_CATALOG).toMatchSnapshot();
  });

  it('palette order covers every catalog kind exactly once', () => {
    expect([...PALETTE_ORDER].sort()).toEqual(Object.keys(NODE_CATALOG).sort());
  });
});
