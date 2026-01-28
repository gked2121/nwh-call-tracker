# NWH Call Tracker - Scaling to 250 Calls

## Executive Summary

**Goal:** Scale from current ~50 call limit to 250+ calls per batch

**Recommended Solution:** Inngest (event-driven background jobs)

**Estimated Implementation:** 3 phases

---

## Current Architecture Analysis

### Processing Pipeline
```
Bronze (Excel Parse) → Silver (Haiku: Triage + Extract) → Gold (Opus: Score + Coach)
```

### Current Bottlenecks

| Component | Current State | Problem at 250 Calls |
|-----------|--------------|---------------------|
| API Timeout | 5 min (maxDuration=300) | Will timeout at ~150+ calls |
| Batch Size | 5 parallel | 50 batches = 250-500 sec |
| AI Model | Claude Opus 4.5 | ~$0.15-0.30/call = $37-75 total |
| Storage | Browser memory | Lost on refresh |
| Progress | SSE streaming | Lost if connection drops |

### Current Cost Per Call
- **Silver Layer (Haiku):** ~$0.002/call (triage + extraction)
- **Gold Layer (Opus 4.5):** ~$0.15-0.30/call (analysis)
- **Total for 250 calls:** ~$40-80

---

## Research Summary

### Options Evaluated

| Solution | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Inngest** | Native Vercel, event-driven, step retries, free tier | Learning curve | **RECOMMENDED** |
| **Trigger.dev** | Great DX, popular (13k stars) | Separate infra, more complex | Good alternative |
| **Vercel Fluid Compute** | Native, up to 14 min | Still has limits, no retry | Partial solution |
| **BullMQ + Redis** | Full control, proven | Requires Redis hosting | Overkill |
| **AWS SQS/Lambda** | Infinitely scalable | Complex, leaves Vercel | Last resort |

### Why Inngest Wins

1. **Native Vercel Integration** - Listed in Vercel Marketplace
2. **Step-Based Execution** - Each call is a retryable step
3. **No Timeout Issues** - Steps resume after interruption
4. **Built-in Observability** - Dashboard shows progress, failures
5. **Free Tier** - 25,000 steps/month (enough for ~8,000 calls)
6. **Your Code Stays on Vercel** - No infrastructure to manage

---

## Implementation Plan

### Phase 1: Quick Wins (No Architecture Change)

**Goal:** Get to ~100-150 calls without major refactor

1. **Increase batch size** from 5 → 10-15
2. **Switch Gold layer model** from Opus 4.5 to Sonnet 4
   - Cost reduction: ~60-70%
   - Speed improvement: ~2x faster
   - Quality: Still excellent for this use case
3. **Add call deduplication** - Skip already-analyzed calls
4. **Optimize transcript truncation** - Reduce token usage

**Estimated result:** ~150 calls, ~$15-25 cost

### Phase 2: Inngest Integration (Core Change)

**Goal:** Reliable 250+ call processing with progress tracking

#### Architecture Change
```
Current:  Upload → API Route (sync) → Stream Results
New:      Upload → Trigger Event → Inngest Functions → Poll/Subscribe Results
```

#### New Components

1. **Inngest Client** (`src/lib/inngest.ts`)
```typescript
import { Inngest } from 'inngest';
export const inngest = new Inngest({ id: 'nwh-call-tracker' });
```

2. **Background Functions** (`src/inngest/functions.ts`)
```typescript
export const analyzeCallBatch = inngest.createFunction(
  { id: 'analyze-call-batch', concurrency: 10 },
  { event: 'calls/batch.uploaded' },
  async ({ event, step }) => {
    const { calls, apiKey, model, jobId } = event.data;

    // Step 1: Process Silver layer (can be parallelized)
    const silverCalls = await step.run('extract-batch', async () => {
      return extractBatch(calls, apiKey, model);
    });

    // Step 2: Process Gold layer (each call is a step = retryable)
    const results = [];
    for (const silver of silverCalls) {
      if (silver.triage.shouldAnalyze) {
        const analyzed = await step.run(`analyze-${silver.bronze.id}`, async () => {
          return analyzeWithSilverData(silver, model, apiKey);
        });
        results.push(analyzed);

        // Update progress in database
        await step.run(`progress-${silver.bronze.id}`, async () => {
          await updateJobProgress(jobId, results.length, silverCalls.length);
        });
      }
    }

    return { results, jobId };
  }
);
```

3. **API Route Update** (`src/app/api/inngest/route.ts`)
```typescript
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { analyzeCallBatch } from '@/inngest/functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [analyzeCallBatch],
});
```

4. **Job Status Storage** (Supabase or Vercel KV)
```typescript
interface AnalysisJob {
  id: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  totalCalls: number;
  processedCalls: number;
  results: AnalyzedCall[];
  createdAt: string;
  updatedAt: string;
}
```

#### UI Changes
- Upload triggers event, returns job ID immediately
- Poll `/api/jobs/[id]` for progress
- Results persist and can be retrieved later

### Phase 3: Database & Polish

**Goal:** Production-ready with persistence

1. **Add Supabase** for job storage
   - Jobs table (tracks analysis batches)
   - Results table (stores analyzed calls)
   - Enable real-time subscriptions for progress

2. **Add Result Caching**
   - Hash transcript content
   - Skip re-analysis of identical calls
   - ~30-50% cost savings on repeat uploads

3. **Add Retry/Resume**
   - If job fails mid-way, resume from last successful call
   - Manual retry button in UI

4. **Add Export History**
   - View past analysis jobs
   - Re-download PDFs

---

## Cost Optimization

### Model Selection Strategy

| Layer | Current | Recommended | Savings |
|-------|---------|-------------|---------|
| Triage | Haiku | Haiku (keep) | - |
| Extract | Haiku | Haiku (keep) | - |
| **Analyze** | **Opus 4.5** | **Sonnet 4** | **~65%** |

### Estimated Costs at 250 Calls

| Approach | Cost | Time |
|----------|------|------|
| Current (Opus 4.5) | $40-80 | Timeout |
| Phase 1 (Sonnet 4) | $12-25 | ~8 min |
| Phase 2 (Inngest + Sonnet) | $12-25 | ~10-15 min (but reliable) |

---

## Implementation Order

```
Week 1: Phase 1 - Quick Wins
├── Switch to Sonnet 4
├── Increase batch size to 10
└── Test with 100 calls

Week 2: Phase 2 - Inngest Core
├── Install & configure Inngest
├── Create background function
├── Add job status API
└── Update UI for async flow

Week 3: Phase 3 - Persistence
├── Add Supabase
├── Store results
├── Add job history UI
└── Test at 250 calls
```

---

## Files to Modify/Create

### Phase 1
- `src/lib/ai-analyzer.ts` - Change model from opus to sonnet
- `src/lib/extractor.ts` - Increase BATCH_SIZE
- `src/app/api/analyze/route.ts` - Increase BATCH_SIZE

### Phase 2
- `src/lib/inngest.ts` (new) - Inngest client
- `src/inngest/functions.ts` (new) - Background functions
- `src/app/api/inngest/route.ts` (new) - Inngest serve endpoint
- `src/app/api/jobs/[id]/route.ts` (new) - Job status endpoint
- `src/app/page.tsx` - Update to async flow with polling

### Phase 3
- `src/lib/supabase.ts` (new) - Supabase client
- `src/lib/jobs.ts` (new) - Job CRUD operations
- Database migrations

---

## Decision Points

Before starting, confirm:

1. **Model choice:** Sonnet 4 vs keep Opus 4.5?
   - Sonnet: Faster, cheaper, 90% quality
   - Opus: Best quality, slower, expensive

2. **Storage:** Supabase (recommended) vs Vercel KV vs other?

3. **Timeline:** Start with Phase 1 only, or jump to Phase 2?

---

## Sources

- [Inngest + Vercel Integration](https://vercel.com/marketplace/inngest)
- [Inngest Next.js Quick Start](https://www.inngest.com/docs/getting-started/nextjs-quick-start)
- [Long-running functions on Vercel](https://www.inngest.com/blog/vercel-long-running-background-functions)
- [Vercel Function Timeouts](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out)
- [Inngest vs Trigger.dev Comparison](https://openalternative.co/compare/inngest/vs/trigger)
