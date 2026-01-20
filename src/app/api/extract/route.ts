import { NextRequest } from 'next/server';
import { parseExcelToBronze } from '@/lib/excel-parser';
import { extractBatch } from '@/lib/extractor';
import { SilverCall, ExtractionStats } from '@/types/call';

export const maxDuration = 300; // 5 minute timeout

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
        const apiKey = formData.get('apiKey') as string;
        const aiModel = (formData.get('model') as 'claude' | 'openai') || 'claude';

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

        // Step 1: Parse to Bronze
        send({ type: 'status', message: 'Parsing Excel file...' });
        const buffer = await file.arrayBuffer();
        const bronzeCalls = parseExcelToBronze(buffer);

        if (bronzeCalls.length === 0) {
          send({ type: 'error', message: 'No calls found in file' });
          controller.close();
          return;
        }

        send({
          type: 'bronze_complete',
          count: bronzeCalls.length,
          message: `Found ${bronzeCalls.length} calls in Excel file`,
        });

        // Step 2: Extract to Silver (with progress updates)
        send({ type: 'status', message: 'Extracting contact information...' });

        const silverCalls: SilverCall[] = await extractBatch(
          bronzeCalls,
          apiKey,
          aiModel,
          (processed, total, call) => {
            send({
              type: 'extract_progress',
              processed,
              total,
              call: {
                id: call.bronze.id,
                classification: call.triage.classification,
                repName: call.rep.name,
                callerName: call.caller.name,
                needSummary: call.callContext.needSummary,
                confidence: call.validation.confidence,
              },
            });
          }
        );

        // Step 3: Calculate stats
        const stats = calculateExtractionStats(silverCalls);

        send({
          type: 'extract_complete',
          stats,
          message: `Extraction complete: ${stats.validSales} valid sales calls, ${stats.uniqueReps.length} reps identified`,
        });

        // Send final result
        send({
          type: 'complete',
          result: {
            calls: silverCalls,
            stats,
          },
        });

        controller.close();
      } catch (error) {
        console.error('Extraction error:', error);
        send({
          type: 'error',
          message: 'Extraction failed',
          details: String(error),
        });
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

function calculateExtractionStats(calls: SilverCall[]): ExtractionStats {
  const validSales = calls.filter(c => c.triage.classification === 'valid_sales').length;
  const ivrOnly = calls.filter(c => c.triage.classification === 'ivr_only').length;
  const spam = calls.filter(c => c.triage.classification === 'spam').length;
  const incomplete = calls.filter(c => c.triage.classification === 'incomplete').length;

  // Get unique rep names (excluding nulls)
  const uniqueReps = [...new Set(
    calls
      .map(c => c.rep.name)
      .filter((name): name is string => name !== null)
  )].sort();

  // Calculate extraction success rate (calls with rep name identified)
  const callsWithRep = calls.filter(c => c.rep.name !== null).length;
  const humanCalls = calls.filter(c => c.triage.shouldAnalyze).length;
  const extractionSuccessRate = humanCalls > 0
    ? Math.round((callsWithRep / humanCalls) * 100)
    : 0;

  // Average confidence
  const avgConfidence = calls.length > 0
    ? Math.round(
        (calls.reduce((sum, c) => sum + c.validation.confidence, 0) / calls.length) * 100
      ) / 100
    : 0;

  return {
    totalCalls: calls.length,
    validSales,
    ivrOnly,
    spam,
    incomplete,
    extractionSuccessRate,
    uniqueReps,
    avgConfidence,
  };
}
