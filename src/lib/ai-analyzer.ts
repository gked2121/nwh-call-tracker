import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { CallRecord, CallScore, SilverCall } from '@/types/call';

const ANALYSIS_PROMPT = `You are analyzing a sales call for NWH (a trucking/hauling company). Score the call on BOTH lead quality AND sales rep performance.

CALL DATA:
{CALL_DATA}

SCORING INSTRUCTIONS:

## LEAD QUALITY SCORE (1-10)
Rate the lead based on:
- Timeline to Purchase (immediate=high, vague/someday=low)
- Budget/Authority (decision maker on call=high, no authority=low)
- Specific Need Identified (clear hauling needs=high, vague=low)
- Service & Geographic Fit (matches NWH services/routes=high)
- Business Legitimacy (established, verifiable=high)

Score Guide:
- 9-10 EXCEPTIONAL: Decision maker, immediate need (2 weeks), perfect fit, engaged, complete info
- 7-8 GOOD: Has authority, near-term (2-4 weeks), good fit, responsive
- 5-6 MODERATE: Some influence, 1-3 month timeline, decent fit, passive
- 3-4 LOW: Limited authority, vague timeline (3+ months), poor fit
- 1-2 NOT WORTH PURSUING: No authority, no need, mismatch, disinterested

RED FLAGS (reduce score significantly):
- Spam/robocall
- Wants services NWH doesn't provide and won't accept alternatives
- Competitor intelligence gathering
- Requests illegal/unethical services

## SALES REP PERFORMANCE SCORES (1-10 each)

1. callContext: Identify call type (inbound/outbound/follow-up) and initial context
2. objectiveClarity: Did rep establish clear purpose early?
3. informationGathering: Did rep identify:
   - Business type
   - Decision maker status
   - Timeline/urgency
   - Budget or buying intent
   - Load details, pickup/delivery, special requirements (for inbound)
4. informationQuality: Completeness and accuracy of info collected
5. toneProfessionalism: Professional from start, no filler words, appropriate language
6. listeningRatio: Good balance of listening vs talking (aim for 60/40 customer/rep)
7. conversationGuidance: Ability to steer conversation productively
8. objectionHandling: How well objections/concerns were addressed
9. nextSteps: Clear follow-up actions established
10. callClosing: Proper close (appointment set, follow-up scheduled, or proper disposition)

## CONTACT EXTRACTION (CRITICAL)
Extract names and info from the transcript:

1. REP INFO: Look for patterns like:
   - "Nationwide, [name]" or "This is [name] with Nationwide"
   - "My name is [name]"
   - Any agent self-introduction

2. CALLER INFO: Extract if mentioned:
   - Name (first and last if given)
   - Company/business name
   - Location (city, state)
   - Phone number (if caller provides it)
   - What they need (brief summary)

Return ONLY valid JSON in this exact format:
{
  "repInfo": {
    "name": "Agent's first name from transcript or null",
    "introducedProperly": true/false
  },
  "callerInfo": {
    "name": "Caller's name if mentioned or null",
    "company": "Company name if mentioned or null",
    "location": "City, State if mentioned or null",
    "phone": "Phone if caller gives it or null",
    "needSummary": "Brief 5-10 word summary of what they want"
  },
  "leadQuality": {
    "score": N,
    "timeline": "immediate|near-term|1-3months|vague|none",
    "hasAuthority": true/false,
    "needIdentified": true/false,
    "serviceFit": "perfect|good|decent|poor|mismatch",
    "redFlags": ["flag1", "flag2"] or [],
    "recommendedAction": "priority-1hr|follow-24hr|nurture-48-72hr|email-only|no-follow-up",
    "notes": ""
  },
  "callContext": {"type": "inbound|outbound|follow-up|unknown", "score": N, "notes": ""},
  "objectiveClarity": {"score": N, "notes": ""},
  "informationGathering": {
    "businessType": true/false,
    "decisionMaker": true/false,
    "timeline": true/false,
    "budgetIntent": true/false,
    "loadDetails": true/false,
    "score": N,
    "notes": ""
  },
  "informationQuality": {"score": N, "notes": ""},
  "toneProfessionalism": {"score": N, "fillerWords": true/false, "unprofessionalLanguage": true/false, "notes": ""},
  "listeningRatio": {"score": N, "estimatedRatio": "X/Y", "notes": ""},
  "conversationGuidance": {"score": N, "notes": ""},
  "objectionHandling": {"score": N, "objectionsRaised": [], "notes": ""},
  "nextSteps": {"score": N, "stepsSet": [], "notes": ""},
  "callClosing": {"outcome": "appointment|follow-up|disposition|none", "score": N, "notes": ""},
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2"],
  "coachingInsights": ["specific actionable tip 1", "specific actionable tip 2", "specific actionable tip 3"],
  "internalAlerts": ["alert1"] or []
}`;

// Smart transcript truncation - keeps beginning (intro), end (closing), and samples middle
function optimizeCallData(call: CallRecord): string {
  const entries = Object.entries(call).filter(([key, v]) => v && key !== 'transcript');
  let result = entries.map(([k, v]) => `${k}: ${v}`).join('\n');

  if (call.transcript) {
    const transcript = call.transcript;
    const maxLength = 10000; // Increased for better context

    if (transcript.length > maxLength) {
      const start = transcript.slice(0, 4000);
      const end = transcript.slice(-4000);
      const middle = transcript.slice(4000, -4000);

      // Sample key exchanges from middle
      const middleSamples = middle
        .split(/(?=Agent:|Caller:|Rep:|Customer:)/gi)
        .filter((_, i) => i % 2 === 0)
        .slice(0, 15)
        .join('\n');

      result += `\n\nTRANSCRIPT START:\n${start}\n\n[...KEY EXCHANGES...]\n${middleSamples}\n\nTRANSCRIPT END:\n${end}`;
    } else {
      result += `\n\nTRANSCRIPT:\n${transcript}`;
    }
  }

  return result;
}

async function analyzeWithClaudeKey(call: CallRecord, apiKey: string): Promise<CallScore> {
  const anthropic = new Anthropic({ apiKey });
  const callDataString = optimizeCallData(call);
  const prompt = ANALYSIS_PROMPT.replace('{CALL_DATA}', callDataString);

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 2000,
    messages: [
      { role: 'user', content: prompt },
      { role: 'assistant', content: '{' }
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const result = JSON.parse('{' + content.text);
  return {
    ...result,
    overallScore: calculateOverallScore(result),
  };
}

async function analyzeWithOpenAIKey(call: CallRecord, apiKey: string): Promise<CallScore> {
  const openai = new OpenAI({ apiKey });
  const callDataString = optimizeCallData(call);
  const prompt = ANALYSIS_PROMPT.replace('{CALL_DATA}', callDataString);

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const result = JSON.parse(content);
  return {
    ...result,
    overallScore: calculateOverallScore(result),
  };
}

function calculateOverallScore(scores: Partial<CallScore>): number {
  // Weighted average of rep performance scores
  const weights = {
    callContext: 0.05,
    objectiveClarity: 0.1,
    informationGathering: 0.15,
    informationQuality: 0.1,
    toneProfessionalism: 0.1,
    listeningRatio: 0.1,
    conversationGuidance: 0.1,
    objectionHandling: 0.1,
    nextSteps: 0.1,
    callClosing: 0.1,
  };

  let totalScore = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const category = scores[key as keyof typeof weights];
    if (category && typeof category === 'object' && 'score' in category) {
      totalScore += (category.score as number) * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 10) / 10 : 0;
}

export async function analyzeCallWithKey(
  call: CallRecord,
  preferredModel: 'claude' | 'openai',
  apiKey: string
): Promise<{ score: CallScore; model: 'claude' | 'openai' }> {
  try {
    if (preferredModel === 'claude') {
      const score = await analyzeWithClaudeKey(call, apiKey);
      return { score, model: 'claude' };
    } else {
      const score = await analyzeWithOpenAIKey(call, apiKey);
      return { score, model: 'openai' };
    }
  } catch (error) {
    console.error(`Error with ${preferredModel}:`, error);
    throw error;
  }
}


// =============================================================================
// SILVER-LAYER AWARE ANALYSIS (Gold Layer)
// Uses pre-extracted contact info, focuses on scoring and coaching
// =============================================================================

const GOLD_LAYER_PROMPT = `You are analyzing a sales call for NWH (Nationwide Haul - trucking/trailer company).
The contact info has already been extracted. Focus on SCORING and COACHING INSIGHTS.

## PRE-EXTRACTED DATA (from Silver layer)
Rep: {REP_NAME}
Caller: {CALLER_NAME}
Company: {CALLER_COMPANY}
Location: {CALLER_LOCATION}
Need: {NEED_SUMMARY}
Urgency: {URGENCY}
Products: {PRODUCTS}

## TRANSCRIPT
{TRANSCRIPT}

## SCORING INSTRUCTIONS

### LEAD QUALITY (1-10)
Based on the pre-extracted data and transcript:
- 9-10: Decision maker, immediate need, perfect fit, complete info
- 7-8: Has authority, near-term need, good fit
- 5-6: Some influence, 1-3 month timeline, decent fit
- 3-4: Limited authority, vague timeline, poor fit
- 1-2: No authority, no need, mismatch

### REP PERFORMANCE (1-10 each)
Score each category with specific evidence:
1. objectiveClarity - Did rep establish purpose early?
2. informationGathering - Did rep identify business type, decision maker, timeline, budget, load details?
3. informationQuality - Completeness of info collected
4. toneProfessionalism - Professional tone, no filler words?
5. listeningRatio - Good balance (aim for 60/40 customer/rep)?
6. conversationGuidance - Steered conversation productively?
7. objectionHandling - Addressed concerns well?
8. nextSteps - Clear follow-up actions set?
9. callClosing - Proper close (appointment, follow-up, disposition)?

Return ONLY valid JSON:
{
  "repInfo": {
    "name": "{REP_NAME}",
    "introducedProperly": true/false
  },
  "callerInfo": {
    "name": "{CALLER_NAME}",
    "company": "{CALLER_COMPANY}",
    "location": "{CALLER_LOCATION}",
    "phone": null,
    "needSummary": "{NEED_SUMMARY}"
  },
  "leadQuality": {
    "score": N,
    "timeline": "immediate|near-term|1-3months|vague|none",
    "hasAuthority": true/false,
    "needIdentified": true/false,
    "serviceFit": "perfect|good|decent|poor|mismatch",
    "redFlags": [],
    "recommendedAction": "priority-1hr|follow-24hr|nurture-48-72hr|email-only|no-follow-up",
    "notes": "Brief explanation"
  },
  "callContext": {"type": "inbound|outbound|follow-up|unknown", "score": N, "notes": ""},
  "objectiveClarity": {"score": N, "notes": ""},
  "informationGathering": {
    "businessType": true/false,
    "decisionMaker": true/false,
    "timeline": true/false,
    "budgetIntent": true/false,
    "loadDetails": true/false,
    "score": N,
    "notes": ""
  },
  "informationQuality": {"score": N, "notes": ""},
  "toneProfessionalism": {"score": N, "fillerWords": true/false, "unprofessionalLanguage": true/false, "notes": ""},
  "listeningRatio": {"score": N, "estimatedRatio": "X/Y", "notes": ""},
  "conversationGuidance": {"score": N, "notes": ""},
  "objectionHandling": {"score": N, "objectionsRaised": [], "notes": ""},
  "nextSteps": {"score": N, "stepsSet": [], "notes": ""},
  "callClosing": {"outcome": "appointment|follow-up|disposition|none", "score": N, "notes": ""},
  "strengths": ["Be specific - quote from transcript"],
  "weaknesses": ["Be specific - reference actual moments"],
  "coachingInsights": ["Actionable tip 1", "Actionable tip 2", "Actionable tip 3"],
  "internalAlerts": []
}`;

function buildGoldPrompt(silver: SilverCall): string {
  const transcript = silver.bronze.transcript || '';

  // Optimize transcript for context
  let optimizedTranscript = transcript;
  if (transcript.length > 8000) {
    const start = transcript.slice(0, 3000);
    const end = transcript.slice(-3000);
    optimizedTranscript = `${start}\n\n[...middle of conversation...]\n\n${end}`;
  }

  return GOLD_LAYER_PROMPT
    .replace(/{REP_NAME}/g, silver.rep.name || 'Unknown')
    .replace(/{CALLER_NAME}/g, silver.caller.name || 'Unknown')
    .replace(/{CALLER_COMPANY}/g, silver.caller.company || 'Not mentioned')
    .replace(/{CALLER_LOCATION}/g, silver.caller.location || 'Not mentioned')
    .replace(/{NEED_SUMMARY}/g, silver.callContext.needSummary || 'Not identified')
    .replace(/{URGENCY}/g, silver.callContext.urgency || 'unknown')
    .replace(/{PRODUCTS}/g, silver.callContext.productInterest.join(', ') || 'Not specified')
    .replace('{TRANSCRIPT}', optimizedTranscript);
}

async function analyzeWithClaudeSilver(silver: SilverCall, apiKey: string): Promise<CallScore> {
  const anthropic = new Anthropic({ apiKey });
  const prompt = buildGoldPrompt(silver);

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 2000,
    messages: [
      { role: 'user', content: prompt },
      { role: 'assistant', content: '{' },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const result = JSON.parse('{' + content.text);

  // Ensure extracted data is preserved
  result.repInfo = {
    name: silver.rep.name || result.repInfo?.name || null,
    introducedProperly: silver.rep.introducedProperly || result.repInfo?.introducedProperly || false,
  };
  result.callerInfo = {
    name: silver.caller.name || result.callerInfo?.name || null,
    company: silver.caller.company || result.callerInfo?.company || null,
    location: silver.caller.location || result.callerInfo?.location || null,
    phone: silver.caller.phone || result.callerInfo?.phone || null,
    needSummary: silver.callContext.needSummary || result.callerInfo?.needSummary || '',
  };

  return {
    ...result,
    overallScore: calculateOverallScore(result),
  };
}

async function analyzeWithOpenAISilver(silver: SilverCall, apiKey: string): Promise<CallScore> {
  const openai = new OpenAI({ apiKey });
  const prompt = buildGoldPrompt(silver);

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const result = JSON.parse(content);

  // Ensure extracted data is preserved
  result.repInfo = {
    name: silver.rep.name || result.repInfo?.name || null,
    introducedProperly: silver.rep.introducedProperly || result.repInfo?.introducedProperly || false,
  };
  result.callerInfo = {
    name: silver.caller.name || result.callerInfo?.name || null,
    company: silver.caller.company || result.callerInfo?.company || null,
    location: silver.caller.location || result.callerInfo?.location || null,
    phone: silver.caller.phone || result.callerInfo?.phone || null,
    needSummary: silver.callContext.needSummary || result.callerInfo?.needSummary || '',
  };

  return {
    ...result,
    overallScore: calculateOverallScore(result),
  };
}

export async function analyzeWithSilverData(
  silver: SilverCall,
  preferredModel: 'claude' | 'openai',
  apiKey: string
): Promise<{ score: CallScore; model: 'claude' | 'openai' }> {
  try {
    if (preferredModel === 'claude') {
      const score = await analyzeWithClaudeSilver(silver, apiKey);
      return { score, model: 'claude' };
    } else {
      const score = await analyzeWithOpenAISilver(silver, apiKey);
      return { score, model: 'openai' };
    }
  } catch (error) {
    console.error(`Error with ${preferredModel}:`, error);
    throw error;
  }
}
