import type { Blueprint, Resource } from '@/lib/core/blueprint/types';
import type { CostBreakdown, CostEstimate, CostLine } from '@/lib/core/cost/types';

// AWS cost model — rough monthly estimates for a single "moderate traffic" profile,
// us-east-1 on-demand. Numbers are illustrative ballparks for design-time guidance,
// NOT a billing forecast. Single source of truth for prices + assumptions.

const PRICES = {
  lambdaRequestPer1M: 0.2,
  lambdaGbSecond: 0.0000166667,
  s3StorageGbMonth: 0.023,
  s3PutPer1k: 0.005,
  s3GetPer1k: 0.0004,
  dynamoWritePer1M: 1.25,
  dynamoReadPer1M: 0.25,
  dynamoStorageGbMonth: 0.25,
  sqsPer1M: 0.4,
  cfTransferGbOut: 0.085,
  cfRequestPer10k: 0.0075,
};

const PROFILE = {
  requestsPerMonth: 1_000_000,
  lambdaDurationMs: 200,
  lambdaMemoryMb: 1024,
  workerInvocationsPerMonth: 1_000_000,
  bucketStorageGb: 5,
  bucketPutPerMonth: 100_000,
  bucketGetPerMonth: 1_000_000,
  dynamoWritesPerMonth: 1_000_000,
  dynamoReadsPerMonth: 1_000_000,
  dynamoStorageGb: 5,
  queueRequestsPerMonth: 1_000_000,
  cdnTransferGb: 50,
  cdnRequestsPerMonth: 1_000_000,
  nextjsAssetsGb: 1,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function lambdaLines(invocations: number, durationMs: number, memoryMb: number): CostLine[] {
  const requestCost = (invocations / 1_000_000) * PRICES.lambdaRequestPer1M;
  const gbSeconds = invocations * (durationMs / 1000) * (memoryMb / 1024);
  const computeCost = gbSeconds * PRICES.lambdaGbSecond;
  return [
    { label: 'Lambda requests', usd: round2(requestCost) },
    { label: 'Lambda compute', usd: round2(computeCost) },
  ];
}

function s3Lines(storageGb: number, puts: number, gets: number): CostLine[] {
  return [
    { label: 'S3 storage', usd: round2(storageGb * PRICES.s3StorageGbMonth) },
    { label: 'S3 PUT', usd: round2((puts / 1000) * PRICES.s3PutPer1k) },
    { label: 'S3 GET', usd: round2((gets / 1000) * PRICES.s3GetPer1k) },
  ];
}

function cloudfrontLines(transferGb: number, requests: number): CostLine[] {
  return [
    { label: 'CloudFront transfer', usd: round2(transferGb * PRICES.cfTransferGbOut) },
    { label: 'CloudFront requests', usd: round2((requests / 10_000) * PRICES.cfRequestPer10k) },
  ];
}

function breakdownFor(r: Resource): CostBreakdown {
  let lines: CostLine[] = [];
  switch (r.kind) {
    case 'nextjs':
      lines = [
        ...lambdaLines(PROFILE.requestsPerMonth, PROFILE.lambdaDurationMs, PROFILE.lambdaMemoryMb),
        { label: 'S3 (assets)', usd: round2(PROFILE.nextjsAssetsGb * PRICES.s3StorageGbMonth) },
        ...cloudfrontLines(PROFILE.cdnTransferGb, PROFILE.cdnRequestsPerMonth),
      ];
      break;
    case 'bucket':
      lines = s3Lines(
        PROFILE.bucketStorageGb,
        PROFILE.bucketPutPerMonth,
        PROFILE.bucketGetPerMonth,
      );
      break;
    case 'dynamo':
      lines = [
        {
          label: 'Writes',
          usd: round2((PROFILE.dynamoWritesPerMonth / 1e6) * PRICES.dynamoWritePer1M),
        },
        {
          label: 'Reads',
          usd: round2((PROFILE.dynamoReadsPerMonth / 1e6) * PRICES.dynamoReadPer1M),
        },
        { label: 'Storage', usd: round2(PROFILE.dynamoStorageGb * PRICES.dynamoStorageGbMonth) },
      ];
      break;
    case 'queue':
      lines = [
        {
          label: 'SQS requests',
          usd: round2((PROFILE.queueRequestsPerMonth / 1e6) * PRICES.sqsPer1M),
        },
      ];
      break;
    case 'worker':
      lines = lambdaLines(
        PROFILE.workerInvocationsPerMonth,
        PROFILE.lambdaDurationMs,
        PROFILE.lambdaMemoryMb,
      );
      break;
    case 'cron':
      lines = [{ label: 'EventBridge schedule', usd: 0 }];
      break;
    case 'secret':
      lines = [{ label: 'SSM (free tier)', usd: 0 }];
      break;
    case 'ai':
      lines = [{ label: 'Anthropic API (usage-based)', usd: 0 }];
      break;
    case 'email':
      lines = [{ label: 'SES (~10k emails)', usd: 1 }];
      break;
    case 'postgres': {
      // SST VPCs have NO NAT by default; the only standing VPC cost is CloudMap DNS.
      lines = [
        { label: 'RDS Postgres (db.t4g.micro)', usd: 11.5 },
        { label: 'Storage (20GB gp3)', usd: 2.3 },
        { label: 'VPC (CloudMap DNS)', usd: 0.5 },
      ];
      const nat = r.props.nat;
      if (nat === 'ec2') lines.push({ label: 'fck-nat EC2 (t4g.nano)', usd: 4 });
      else if (nat === 'managed') lines.push({ label: 'NAT Gateway', usd: 32 });
      break;
    }
    case 'cognito':
      lines = [{ label: 'Cognito (free ≤ 50k MAU)', usd: 0 }];
      break;
    case 'clerk':
      lines = [{ label: 'Clerk (external / free tier)', usd: 0 }];
      break;
    case 'stripe':
    case 'mongodb':
    case 'externalApi':
      lines = [{ label: 'External / usage-based', usd: 0 }];
      break;
    default:
      lines = [];
  }
  const monthlyUsd = round2(lines.reduce((sum, l) => sum + l.usd, 0));
  return { resourceId: r.id, name: r.name, kind: r.kind, monthlyUsd, lines };
}

export function estimateAwsCost(bp: Blueprint): CostEstimate {
  const perResource = bp.resources.map(breakdownFor);
  const totalMonthlyUsd = round2(perResource.reduce((sum, r) => sum + r.monthlyUsd, 0));
  return {
    perResource,
    totalMonthlyUsd,
    region: bp.app.region,
    assumptions: [
      '~1M requests/month, 200ms avg @ 1024MB Lambda',
      'S3: 5GB storage, 100k PUT, 1M GET',
      'DynamoDB on-demand: 1M writes, 1M reads, 5GB',
      'SQS: 1M requests; CloudFront: 50GB out, 1M requests',
      'VPCs have NO NAT by default; fck-nat (ec2) ≈ $4/mo, managed gateway ≈ $32/mo/AZ',
    ],
    disclaimer:
      'Rough design-time ballpark (us-east-1 on-demand). Not a billing forecast — your real costs depend on actual traffic, region, and free-tier usage.',
  };
}
