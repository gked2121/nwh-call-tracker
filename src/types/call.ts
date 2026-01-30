// =============================================================================
// BRONZE LAYER - Raw data from Excel
// =============================================================================

export interface BronzeCall {
  id: string;
  rawAgentName: string;        // Phone number from CallRail (not useful)
  rawAgentNumber: string;
  callStatus: string;          // "Answered Call", "Abandoned Call", etc.
  startTime: string;
  durationSeconds: number;
  trackingNumber: string;
  source: string;
  transcript: string;
  recordingUrl?: string;
  sentiment?: string;
  // Keep original for backward compat
  [key: string]: string | number | undefined;
}

// =============================================================================
// SILVER LAYER - Extracted & Enriched data
// =============================================================================

export type CallClassification = 'valid_sales' | 'ivr_only' | 'spam' | 'incomplete' | 'wrong_number';

export interface TriageResult {
  classification: CallClassification;
  confidence: number;
  reason: string;
  shouldAnalyze: boolean;
}

export interface ExtractedRep {
  name: string | null;
  introducedProperly: boolean;
  introPattern: string | null;    // e.g., "Nationwide, brian"
}

export interface ExtractedCaller {
  name: string | null;
  company: string | null;
  location: string | null;
  phone: string | null;
  role: string | null;            // e.g., "owner", "fleet manager"
}

export interface ExtractedCallContext {
  type: 'inbound' | 'outbound' | 'follow-up' | 'unknown';
  needSummary: string;
  productInterest: string[];      // e.g., ["dump trailer", "reefer"]
  urgency: 'immediate' | 'near-term' | 'exploring' | 'unknown';
}

export interface ExtractionValidation {
  isValid: boolean;
  issues: string[];
  confidence: number;
  needsReview: boolean;
}

export interface SilverCall {
  // Bronze data (preserved)
  bronze: BronzeCall;

  // Triage results
  triage: TriageResult;

  // Extracted data
  rep: ExtractedRep;
  caller: ExtractedCaller;
  callContext: ExtractedCallContext;

  // Validation
  validation: ExtractionValidation;

  // Metadata
  extractedAt: string;
  extractionModel: string;
}

// =============================================================================
// GOLD LAYER - Analysis & Scoring (existing types, preserved for compatibility)
// =============================================================================

export interface CallRecord {
  id: string;
  repName: string;
  callDate: string;
  callDuration: string;
  durationSeconds?: number;
  customerName?: string;
  phoneNumber?: string;
  transcript?: string;
  notes?: string;
  outcome?: string;
  direction?: string;
  source?: string;
  recordingUrl?: string;
  // Additional extracted data for display
  callerCompany?: string;
  callerLocation?: string;
  callerPhone?: string;
  needSummary?: string;
  [key: string]: string | number | undefined;
}

export interface RepInfo {
  name: string | null;
  introducedProperly: boolean;
}

export interface CallerInfo {
  name: string | null;
  company: string | null;
  location: string | null;
  phone: string | null;
  needSummary: string;
}

export interface LeadQuality {
  score: number;
  timeline: 'immediate' | 'near-term' | '1-3months' | 'vague' | 'none';
  hasAuthority: boolean;
  needIdentified: boolean;
  serviceFit: 'perfect' | 'good' | 'decent' | 'poor' | 'mismatch';
  redFlags: string[];
  recommendedAction: 'priority-1hr' | 'follow-24hr' | 'nurture-48-72hr' | 'email-only' | 'no-follow-up';
  notes: string;
}

export interface CallScore {
  repInfo: RepInfo;
  callerInfo: CallerInfo;
  leadQuality: LeadQuality;
  callContext: {
    type: 'inbound' | 'outbound' | 'follow-up' | 'unknown';
    score: number;
    notes: string;
  };
  objectiveClarity: {
    score: number;
    notes: string;
  };
  informationGathering: {
    businessType: boolean;
    decisionMaker: boolean;
    timeline: boolean;
    budgetIntent: boolean;
    loadDetails: boolean;
    score: number;
    notes: string;
  };
  informationQuality: {
    score: number;
    notes: string;
  };
  toneProfessionalism: {
    score: number;
    fillerWords: boolean;
    unprofessionalLanguage: boolean;
    notes: string;
  };
  listeningRatio: {
    score: number;
    estimatedRatio: string;
    notes: string;
  };
  conversationGuidance: {
    score: number;
    notes: string;
  };
  objectionHandling: {
    score: number;
    objectionsRaised: string[];
    notes: string;
  };
  nextSteps: {
    score: number;
    stepsSet: string[];
    notes: string;
  };
  callClosing: {
    outcome: 'appointment' | 'follow-up' | 'disposition' | 'none';
    score: number;
    notes: string;
  };
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  coachingInsights: string[];
  internalAlerts: string[];
}

export interface AnalyzedCall {
  record: CallRecord;
  score: CallScore;
  aiModel: 'claude' | 'openai';
  analyzedAt: string;
}

export interface RepSummary {
  repName: string;
  totalCalls: number;
  averageScore: number;
  averageLeadScore: number;
  strengths: string[];
  weaknesses: string[];
  coachingInsights: string[];
  callScores: number[];
  leadScores: number[];
  trend: 'improving' | 'declining' | 'stable';
  qualifiedLeads: number;
}

export interface AnalysisResult {
  calls: AnalyzedCall[];
  repSummaries: RepSummary[];
  overallStats: {
    totalCalls: number;
    averageScore: number;
    averageLeadScore: number;
    topPerformer: string;
    needsImprovement: string;
    qualifiedLeads: number;
    redFlagCalls: number;
  };
}

// =============================================================================
// EXTRACTION API TYPES
// =============================================================================

export interface ExtractionStats {
  totalCalls: number;
  validSales: number;
  ivrOnly: number;
  spam: number;
  incomplete: number;
  extractionSuccessRate: number;
  uniqueReps: string[];
  avgConfidence: number;
}

export interface ExtractionResult {
  calls: SilverCall[];
  stats: ExtractionStats;
}
