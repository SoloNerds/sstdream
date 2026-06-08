import { describe, it, expect } from 'vitest';
import { estimateCost } from './estimate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { AI_PROCESSING_APP } from '@/lib/templates/ai-processing-app';

const NOW = '2026-06-08T00:00:00.000Z';
const estimate = estimateCost(
  draftBlueprint(AI_PROCESSING_APP.snapshot, 'aws-sst-v4', AI_PROCESSING_APP.app, NOW),
);

describe('AWS cost estimation — AI Processing App', () => {
  it('produces a positive, deterministic total (snapshot)', () => {
    expect(estimate.totalMonthlyUsd).toBeGreaterThan(0);
    expect(estimate.perResource.map((r) => [r.name, r.monthlyUsd])).toMatchSnapshot();
  });

  it('estimates every resource', () => {
    expect(estimate.perResource.map((r) => r.name).sort()).toEqual(
      ['AppTable', 'Jobs', 'ProcessJob', 'Uploads', 'Web'].sort(),
    );
  });

  it('models the Next.js node as Lambda + S3 + CloudFront', () => {
    const web = estimate.perResource.find((r) => r.name === 'Web')!;
    const labels = web.lines.map((l) => l.label);
    expect(labels).toContain('Lambda requests');
    expect(labels.some((l) => l.startsWith('S3'))).toBe(true);
    expect(labels.some((l) => l.startsWith('CloudFront'))).toBe(true);
  });

  it('the total equals the sum of per-resource costs', () => {
    const sum = estimate.perResource.reduce((s, r) => s + r.monthlyUsd, 0);
    expect(Math.round(sum * 100) / 100).toBe(estimate.totalMonthlyUsd);
  });

  it('exposes assumptions and a disclaimer', () => {
    expect(estimate.assumptions.length).toBeGreaterThan(0);
    expect(estimate.disclaimer).toContain('Not a billing forecast');
  });
});
