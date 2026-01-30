import { NextRequest } from 'next/server';
import { parseExcelToBronze } from '@/lib/excel-parser';
import { extractBatch } from '@/lib/extractor';
import { analyzeWithSilverData } from '@/lib/ai-analyzer';
import { AnalyzedCall, RepSummary, SilverCall, CallRecord } from '@/types/call';

export const maxDuration = 300; // 5 minute timeout for long analyses

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const aiModel = (formData.get('model') as 'claude' | 'openai') || 'claude';
        const apiKey = formData.get('apiKey') as string;

        if (!file) {
          send({ type: 'error', message: 'No file provided' });
          controller.close();
          return;
        }

        if (!apiKey) {
          send({ type: 'error', message: 'API key is required' });
          controller.close();
          return;
        }

        // =================================================================
        // BRONZE LAYER: Parse Excel
        // =================================================================
        send({ type: 'status', phase: 'bronze', message: 'Parsing Excel file...' });
        const buffer = await file.arrayBuffer();
        const allBronzeCalls = parseExcelToBronze(buffer);

        // Filter out very short calls (hangups, <5 seconds)
        const MIN_CALL_DURATION = 5;
        const bronzeCalls = allBronzeCalls.filter(call => call.durationSeconds >= MIN_CALL_DURATION);
        const skippedShortCalls = allBronzeCalls.length - bronzeCalls.length;

        if (bronzeCalls.length === 0) {
          send({ type: 'error', message: 'No calls found in file (or all calls were under 5 seconds)' });
          controller.close();
          return;
        }

        send({
          type: 'bronze_complete',
          count: bronzeCalls.length,
          skippedShortCalls,
        });

        // =================================================================
        // SILVER LAYER: Extract with Haiku
        // =================================================================
        send({
          type: 'status',
          phase: 'silver',
          message: `Extracting contact info from ${bronzeCalls.length} calls...`,
        });

        const silverCalls = await extractBatch(
          bronzeCalls,
          apiKey,
          aiModel,
          (processed, total, call) => {
            send({
              type: 'extract_progress',
              processed,
              total,
              repName: call.rep.name,
              classification: call.triage.classification,
            });
          }
        );

        // Count valid sales calls
        const validSalesCalls = silverCalls.filter(c => c.triage.shouldAnalyze);
        const uniqueReps = [...new Set(silverCalls.map(c => c.rep.name).filter(Boolean))];

        send({
          type: 'silver_complete',
          totalCalls: silverCalls.length,
          validSales: validSalesCalls.length,
          skipped: silverCalls.length - validSalesCalls.length,
          uniqueReps,
        });

        if (validSalesCalls.length === 0) {
          send({ type: 'error', message: 'No valid sales calls found to analyze' });
          controller.close();
          return;
        }

        // =================================================================
        // GOLD LAYER: Analyze with Sonnet
        // =================================================================
        send({
          type: 'status',
          phase: 'gold',
          message: `Analyzing ${validSalesCalls.length} sales calls with ${aiModel}...`,
        });
        send({ type: 'start', totalCalls: validSalesCalls.length });

        const BATCH_SIZE = 10;
        const analyzedCalls: AnalyzedCall[] = [];
        let processedCount = 0;

        for (let i = 0; i < validSalesCalls.length; i += BATCH_SIZE) {
          const batch = validSalesCalls.slice(i, i + BATCH_SIZE);
          const batchResults = await Promise.allSettled(
            batch.map(async (silverCall) => {
              const { score, model } = await analyzeWithSilverData(silverCall, aiModel, apiKey);

              // Convert Silver to CallRecord for backward compatibility
              const record = silverToCallRecord(silverCall);

              return {
                record,
                score,
                aiModel: model,
                analyzedAt: new Date().toISOString(),
              } as AnalyzedCall;
            })
          );

          for (const result of batchResults) {
            processedCount++;
            if (result.status === 'fulfilled') {
              analyzedCalls.push(result.value);
              send({
                type: 'call_complete',
                call: result.value,
                processed: processedCount,
                total: validSalesCalls.length,
              });
            } else {
              console.error('Error analyzing call:', result.reason);
              send({
                type: 'call_error',
                error: String(result.reason),
                processed: processedCount,
                total: validSalesCalls.length,
              });
            }
          }
        }

        if (analyzedCalls.length === 0) {
          send({ type: 'error', message: 'Failed to analyze any calls. Please check your API key.' });
          controller.close();
          return;
        }

        // =================================================================
        // SUMMARIES & STATS
        // =================================================================
        const repSummaries = generateRepSummaries(analyzedCalls);
        const overallStats = calculateOverallStats(analyzedCalls, repSummaries, silverCalls);

        send({
          type: 'complete',
          result: {
            calls: analyzedCalls,
            repSummaries,
            overallStats,
          },
        });

        controller.close();
      } catch (error) {
        console.error('Analysis error:', error);
        send({ type: 'error', message: 'Failed to analyze calls', details: String(error) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// Convert Silver layer data to CallRecord for backward compatibility
function silverToCallRecord(silver: SilverCall): CallRecord {
  const bronze = silver.bronze;
  const durationMinutes = Math.floor(bronze.durationSeconds / 60);
  const durationSecs = bronze.durationSeconds % 60;

  return {
    id: bronze.id,
    // Use extracted rep name, fallback to raw agent name
    repName: silver.rep.name || bronze.rawAgentName || 'Unknown',
    callDate: bronze.startTime,
    callDuration: `${durationMinutes}:${String(durationSecs).padStart(2, '0')}`,
    durationSeconds: bronze.durationSeconds,
    customerName: silver.caller.name || undefined,
    phoneNumber: bronze.trackingNumber,
    transcript: bronze.transcript,
    notes: bronze.note as string || undefined,
    outcome: bronze.callStatus,
    direction: silver.callContext.type,
    source: bronze.source,
    recordingUrl: bronze.recordingUrl || undefined,
    // Additional extracted data for display
    callerCompany: silver.caller.company || undefined,
    callerLocation: silver.caller.location || undefined,
    callerPhone: silver.caller.phone || undefined,
    needSummary: silver.callContext.needSummary || undefined,
  };
}

function generateRepSummaries(calls: AnalyzedCall[]): RepSummary[] {
  const repMap = new Map<string, AnalyzedCall[]>();

  for (const call of calls) {
    // Use the AI-extracted rep name from score, fallback to record
    const repName = call.score.repInfo?.name || call.record.repName;
    if (!repMap.has(repName)) {
      repMap.set(repName, []);
    }
    repMap.get(repName)!.push(call);
  }

  const summaries: RepSummary[] = [];

  for (const [repName, repCalls] of repMap.entries()) {
    const scores = repCalls.map(c => c.score.overallScore);
    const leadScores = repCalls.map(c => c.score.leadQuality?.score || 0);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const averageLeadScore = leadScores.reduce((a, b) => a + b, 0) / leadScores.length;

    const qualifiedLeads = leadScores.filter(s => s >= 7).length;

    const strengthCounts = new Map<string, number>();
    const weaknessCounts = new Map<string, number>();
    const insightCounts = new Map<string, number>();

    for (const call of repCalls) {
      for (const strength of call.score.strengths || []) {
        strengthCounts.set(strength, (strengthCounts.get(strength) || 0) + 1);
      }
      for (const weakness of call.score.weaknesses || []) {
        weaknessCounts.set(weakness, (weaknessCounts.get(weakness) || 0) + 1);
      }
      for (const insight of call.score.coachingInsights || []) {
        insightCounts.set(insight, (insightCounts.get(insight) || 0) + 1);
      }
    }

    const topStrengths = [...strengthCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([s]) => s);

    const topWeaknesses = [...weaknessCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([w]) => w);

    const topInsights = [...insightCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([i]) => i);

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (scores.length >= 4) {
      const mid = Math.floor(scores.length / 2);
      const firstHalf = scores.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
      const secondHalf = scores.slice(mid).reduce((a, b) => a + b, 0) / (scores.length - mid);
      if (secondHalf - firstHalf > 0.5) trend = 'improving';
      else if (firstHalf - secondHalf > 0.5) trend = 'declining';
    }

    summaries.push({
      repName,
      totalCalls: repCalls.length,
      averageScore: Math.round(averageScore * 10) / 10,
      averageLeadScore: Math.round(averageLeadScore * 10) / 10,
      strengths: topStrengths,
      weaknesses: topWeaknesses,
      coachingInsights: topInsights,
      callScores: scores,
      leadScores: leadScores,
      trend,
      qualifiedLeads,
    });
  }

  return summaries.sort((a, b) => b.averageScore - a.averageScore);
}

function calculateOverallStats(
  calls: AnalyzedCall[],
  summaries: RepSummary[],
  allSilverCalls: SilverCall[]
): {
  totalCalls: number;
  averageScore: number;
  averageLeadScore: number;
  topPerformer: string;
  needsImprovement: string;
  qualifiedLeads: number;
  redFlagCalls: number;
  // New stats from extraction
  totalInFile: number;
  ivrCalls: number;
  spamCalls: number;
} {
  const allScores = calls.map(c => c.score.overallScore);
  const allLeadScores = calls.map(c => c.score.leadQuality?.score || 0);

  const averageScore = allScores.length > 0
    ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
    : 0;

  const averageLeadScore = allLeadScores.length > 0
    ? Math.round((allLeadScores.reduce((a, b) => a + b, 0) / allLeadScores.length) * 10) / 10
    : 0;

  const topPerformer = summaries.length > 0 ? summaries[0].repName : 'N/A';
  const needsImprovement = summaries.length > 0 ? summaries[summaries.length - 1].repName : 'N/A';

  const qualifiedLeads = allLeadScores.filter(s => s >= 7).length;
  const redFlagCalls = calls.filter(c => (c.score.leadQuality?.redFlags?.length || 0) > 0).length;

  // Extraction stats
  const ivrCalls = allSilverCalls.filter(c => c.triage.classification === 'ivr_only').length;
  const spamCalls = allSilverCalls.filter(c =>
    c.triage.classification === 'spam' || c.triage.classification === 'wrong_number'
  ).length;

  return {
    totalCalls: calls.length,
    averageScore,
    averageLeadScore,
    topPerformer,
    needsImprovement,
    qualifiedLeads,
    redFlagCalls,
    totalInFile: allSilverCalls.length,
    ivrCalls,
    spamCalls,
  };
}
