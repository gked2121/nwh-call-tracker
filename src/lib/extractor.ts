import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import {
  BronzeCall,
  SilverCall,
  TriageResult,
  ExtractedRep,
  ExtractedCaller,
  ExtractedCallContext,
  ExtractionValidation,
  CallClassification,
} from '@/types/call';

type AIModel = 'claude' | 'openai';

// =============================================================================
// PROMPTS
// =============================================================================

const TRIAGE_PROMPT = `Classify this call transcript into one of these categories:

CATEGORIES:
- valid_sales: A real sales conversation between a human agent and potential customer
- ivr_only: Only automated messages, no human agent interaction
- spam: Robocall, telemarketer, or clearly irrelevant call
- incomplete: Call too short or dropped before meaningful conversation
- wrong_number: Caller reached wrong number, no sales opportunity

TRANSCRIPT:
{TRANSCRIPT}

Return ONLY valid JSON:
{
  "classification": "valid_sales|ivr_only|spam|incomplete|wrong_number",
  "confidence": 0.0-1.0,
  "reason": "Brief explanation"
}`;

const EXTRACTION_PROMPT = `Extract contact information from this sales call transcript for a trucking/trailer company.

TRANSCRIPT:
{TRANSCRIPT}

INSTRUCTIONS:
1. REP NAME: Look for patterns like "Nationwide, [name]", "This is [name] with Nationwide", "My name is [name]"
   - The company is "Nationwide Haul" or "Nationwide Hall" (speech-to-text variations)
   - Extract ONLY the first name of the sales rep
   - NH Sales reps: Jake, Matt, Vanessa, Brian, Pablo
   - Service & Repair reps: Dustin, Rocco, Sean, Erika, Katrina
   - Road Ready Insurance reps: Nikita, Sladana, Jennine, Adam, Rossy, Herb, Luis

2. CALLER INFO: Extract if mentioned during the call
   - Name: Full name if given
   - Company: Business name if mentioned
   - Location: City, State
   - Phone: If caller provides their callback number
   - Role: Their job title or role (owner, manager, driver, etc.)

3. CALL CONTEXT:
   - Type: inbound (customer called in), outbound (rep called out), follow-up
   - Need: What are they looking for? (5-15 word summary)
   - Products: What specific products? (dump trailer, reefer, flatbed, etc.)
   - Urgency: How soon do they need it?

Return ONLY valid JSON:
{
  "rep": {
    "name": "First name or null",
    "introducedProperly": true/false,
    "introPattern": "Exact intro phrase or null"
  },
  "caller": {
    "name": "Full name or null",
    "company": "Company name or null",
    "location": "City, State or null",
    "phone": "Phone number or null",
    "role": "Role/title or null"
  },
  "callContext": {
    "type": "inbound|outbound|follow-up|unknown",
    "needSummary": "Brief summary of what they want",
    "productInterest": ["product1", "product2"],
    "urgency": "immediate|near-term|exploring|unknown"
  }
}`;

// =============================================================================
// VALIDATION RULES
// =============================================================================

const INVALID_REP_NAMES = new Set([
  'thank', 'hello', 'hi', 'hey', 'good', 'morning', 'afternoon', 'evening',
  'nationwide', 'hall', 'haul', 'truck', 'trailer', 'sales', 'this', 'the',
  'call', 'calling', 'can', 'may', 'for', 'recorded', 'quality', 'insurance',
  'yes', 'no', 'sir', 'maam', 'okay', 'ok', 'well', 'so', 'um', 'uh',
]);

const KNOWN_REPS = new Set([
  // NH Sales
  'jake', 'matt', 'vanessa', 'brian', 'pablo',
  // Service & Repair
  'dustin', 'rocco', 'sean', 'erika', 'katrina',
  // Road Ready Insurance
  'nikita', 'sladana', 'jennine', 'adam', 'rossy', 'herb', 'luis',
  // Legacy/Other (keep for backward compatibility)
  'mark', 'paul', 'michelle', 'audrey', 'jessica', 'tyler', 'george',
  'joshua', 'victor', 'justin', 'james', 'larry', 'jose', 'hans', 'cruz', 'carolina',
]);

function validateExtraction(
  extracted: { rep: ExtractedRep; caller: ExtractedCaller; callContext: ExtractedCallContext },
  transcript: string
): ExtractionValidation {
  const issues: string[] = [];
  let confidence = 1.0;

  // Validate rep name
  if (!extracted.rep.name) {
    issues.push('NO_REP_NAME');
    confidence -= 0.2;
  } else {
    const repNameLower = extracted.rep.name.toLowerCase();
    if (INVALID_REP_NAMES.has(repNameLower)) {
      issues.push('INVALID_REP_NAME');
      extracted.rep.name = null;
      confidence -= 0.3;
    } else if (!KNOWN_REPS.has(repNameLower)) {
      // Unknown but possibly valid - flag for review
      issues.push('UNKNOWN_REP_NAME');
      confidence -= 0.1;
    }
  }

  // Validate need summary for inbound calls
  if (extracted.callContext.type === 'inbound') {
    if (!extracted.callContext.needSummary || extracted.callContext.needSummary.length < 5) {
      issues.push('MISSING_NEED_SUMMARY');
      confidence -= 0.1;
    }
  }

  // Check if transcript is too short for reliable extraction
  if (transcript.length < 200) {
    issues.push('SHORT_TRANSCRIPT');
    confidence -= 0.2;
  }

  // Validate caller location format
  if (extracted.caller.location) {
    const locationPattern = /^[A-Za-z\s]+,\s*[A-Z]{2}$/;
    if (!locationPattern.test(extracted.caller.location)) {
      // Try to fix common issues
      const parts = extracted.caller.location.split(/[,\s]+/);
      if (parts.length >= 2) {
        // Keep as-is but note it might need review
        issues.push('LOCATION_FORMAT');
        confidence -= 0.05;
      }
    }
  }

  // Validate phone number format
  if (extracted.caller.phone) {
    const phoneDigits = extracted.caller.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      issues.push('INVALID_PHONE_FORMAT');
      confidence -= 0.05;
    }
  }

  const needsReview = confidence < 0.7 || issues.includes('UNKNOWN_REP_NAME');

  return {
    isValid: issues.length === 0,
    issues,
    confidence: Math.max(0, Math.min(1, confidence)),
    needsReview,
  };
}

// =============================================================================
// EXTRACTION SERVICE
// =============================================================================

export async function triageCall(
  transcript: string,
  apiKey: string,
  model: AIModel = 'claude'
): Promise<TriageResult> {
  // Quick heuristics first
  if (!transcript || transcript.trim().length < 50) {
    return {
      classification: 'incomplete',
      confidence: 0.95,
      reason: 'Transcript too short for meaningful analysis',
      shouldAnalyze: false,
    };
  }

  // Check for IVR-only patterns
  const ivrPatterns = [
    /thank you for calling.*for a full list of inventory/i,
    /please visit www\./i,
    /press \d for/i,
    /leave a message after the/i,
  ];

  const hasOnlyIvr = ivrPatterns.some(p => p.test(transcript)) &&
    !transcript.match(/Caller:/i);

  if (hasOnlyIvr) {
    return {
      classification: 'ivr_only',
      confidence: 0.9,
      reason: 'Only automated IVR message detected, no customer interaction',
      shouldAnalyze: false,
    };
  }

  const prompt = TRIAGE_PROMPT.replace('{TRANSCRIPT}', transcript.slice(0, 2000));

  try {
    let resultText: string;

    if (model === 'openai') {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });
      resultText = response.choices[0].message.content || '{}';
    } else {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 200,
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: '{' },
        ],
      });
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }
      resultText = '{' + content.text;
    }

    const result = JSON.parse(resultText) as {
      classification: CallClassification;
      confidence: number;
      reason: string;
    };

    return {
      ...result,
      shouldAnalyze: result.classification === 'valid_sales',
    };
  } catch (error) {
    console.error('Triage error:', error);
    // Default to valid_sales if triage fails - better to over-analyze
    return {
      classification: 'valid_sales',
      confidence: 0.5,
      reason: 'Triage failed, defaulting to analysis',
      shouldAnalyze: true,
    };
  }
}

export async function extractCallData(
  transcript: string,
  apiKey: string,
  model: AIModel = 'claude'
): Promise<{ rep: ExtractedRep; caller: ExtractedCaller; callContext: ExtractedCallContext }> {
  // Optimize transcript - keep intro and key parts
  let optimizedTranscript = transcript;
  if (transcript.length > 6000) {
    const start = transcript.slice(0, 2500);
    const end = transcript.slice(-2500);
    optimizedTranscript = `${start}\n\n[...middle of conversation...]\n\n${end}`;
  }

  const prompt = EXTRACTION_PROMPT.replace('{TRANSCRIPT}', optimizedTranscript);

  try {
    let resultText: string;

    if (model === 'openai') {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });
      resultText = response.choices[0].message.content || '{}';
    } else {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 500,
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: '{' },
        ],
      });
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }
      resultText = '{' + content.text;
    }

    const result = JSON.parse(resultText);

    // Normalize rep name
    if (result.rep?.name) {
      result.rep.name = result.rep.name.charAt(0).toUpperCase() +
        result.rep.name.slice(1).toLowerCase();
    }

    return {
      rep: {
        name: result.rep?.name || null,
        introducedProperly: result.rep?.introducedProperly ?? false,
        introPattern: result.rep?.introPattern || null,
      },
      caller: {
        name: result.caller?.name || null,
        company: result.caller?.company || null,
        location: result.caller?.location || null,
        phone: result.caller?.phone || null,
        role: result.caller?.role || null,
      },
      callContext: {
        type: result.callContext?.type || 'unknown',
        needSummary: result.callContext?.needSummary || '',
        productInterest: result.callContext?.productInterest || [],
        urgency: result.callContext?.urgency || 'unknown',
      },
    };
  } catch (error) {
    console.error('Extraction error:', error);
    // Return empty extraction on failure
    return {
      rep: { name: null, introducedProperly: false, introPattern: null },
      caller: { name: null, company: null, location: null, phone: null, role: null },
      callContext: { type: 'unknown', needSummary: '', productInterest: [], urgency: 'unknown' },
    };
  }
}

export async function processBronzeCall(
  bronze: BronzeCall,
  apiKey: string,
  model: AIModel = 'claude'
): Promise<SilverCall> {
  const transcript = bronze.transcript || '';

  // Step 1: Triage
  const triage = await triageCall(transcript, apiKey, model);

  // Step 2: Extract (only if valid sales call)
  let rep: ExtractedRep = { name: null, introducedProperly: false, introPattern: null };
  let caller: ExtractedCaller = { name: null, company: null, location: null, phone: null, role: null };
  let callContext: ExtractedCallContext = { type: 'unknown', needSummary: '', productInterest: [], urgency: 'unknown' };

  if (triage.shouldAnalyze) {
    const extracted = await extractCallData(transcript, apiKey, model);
    rep = extracted.rep;
    caller = extracted.caller;
    callContext = extracted.callContext;
  }

  // Step 3: Validate
  const validation = validateExtraction({ rep, caller, callContext }, transcript);

  return {
    bronze,
    triage,
    rep,
    caller,
    callContext,
    validation,
    extractedAt: new Date().toISOString(),
    extractionModel: model === 'openai' ? 'gpt-4.1-mini' : 'claude-3-5-haiku-20241022',
  };
}

export async function extractBatch(
  calls: BronzeCall[],
  apiKey: string,
  model: AIModel = 'claude',
  onProgress?: (processed: number, total: number, call: SilverCall) => void
): Promise<SilverCall[]> {
  const results: SilverCall[] = [];
  const BATCH_SIZE = 10; // Process 10 calls at a time

  for (let i = 0; i < calls.length; i += BATCH_SIZE) {
    const batch = calls.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(call => processBronzeCall(call, apiKey, model))
    );

    for (const result of batchResults) {
      results.push(result);
      onProgress?.(results.length, calls.length, result);
    }
  }

  return results;
}
