import * as XLSX from 'xlsx';
import { CallRecord, BronzeCall } from '@/types/call';

// =============================================================================
// BRONZE LAYER PARSING - Raw data extraction
// =============================================================================

export function parseExcelToBronze(buffer: ArrayBuffer): BronzeCall[] {
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Try to find the "Calls" sheet, otherwise use the first sheet
  const sheetName = workbook.SheetNames.includes('Calls')
    ? 'Calls'
    : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
  });

  return rawData.map((row, index) => {
    // Parse duration
    const durationSeconds = Number(row['Duration (seconds)']) || 0;

    // Parse date from Excel serial number or string
    let startTime = '';
    const rawStartTime = row['Start Time'];
    if (typeof rawStartTime === 'number') {
      const date = XLSX.SSF.parse_date_code(rawStartTime);
      startTime = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')} ${String(date.H).padStart(2, '0')}:${String(date.M).padStart(2, '0')}`;
    } else if (rawStartTime) {
      startTime = String(rawStartTime);
    }

    return {
      id: `bronze-${index + 1}-${Date.now()}`,
      rawAgentName: String(row['Agent Name'] || ''),
      rawAgentNumber: String(row['Agent Number'] || ''),
      callStatus: String(row['Call Status'] || ''),
      startTime,
      durationSeconds,
      trackingNumber: String(row['Tracking Number'] || ''),
      source: String(row['Source'] || ''),
      transcript: String(row['Full Transcription'] || ''),
      recordingUrl: String(row['Recording Url'] || '') || undefined,
      sentiment: String(row['Sentiment'] || '') || undefined,
      // Preserve all original fields
      numberName: String(row['Number Name'] || ''),
      medium: String(row['Medium'] || ''),
      campaign: String(row['Campaign'] || ''),
      note: String(row['Note'] || ''),
      attribution: String(row['Reported Attribution'] || ''),
    } as BronzeCall;
  });
}

// =============================================================================
// LEGACY PARSING - For backward compatibility
// =============================================================================

export function parseExcelFile(buffer: ArrayBuffer): CallRecord[] {
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Try to find the "Calls" sheet, otherwise use the first sheet
  const sheetName = workbook.SheetNames.includes('Calls')
    ? 'Calls'
    : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to JSON with header row
  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
  });

  // Map the CallRail export columns to our CallRecord structure
  const calls: CallRecord[] = rawData
    .filter(row => {
      // Filter out abandoned calls without transcripts
      const status = String(row['Call Status'] || '');
      const transcript = String(row['Full Transcription'] || '');
      return status !== 'Abandoned Call' && transcript.trim().length > 0;
    })
    .map((row, index) => {
      // Parse duration from seconds
      const durationSeconds = Number(row['Duration (seconds)']) || 0;
      const minutes = Math.floor(durationSeconds / 60);
      const seconds = durationSeconds % 60;
      const durationFormatted = `${minutes}:${String(seconds).padStart(2, '0')}`;

      // Parse date from Excel serial number or string
      let callDate = '';
      const startTime = row['Start Time'];
      if (typeof startTime === 'number') {
        // Excel serial date
        const date = XLSX.SSF.parse_date_code(startTime);
        callDate = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')} ${String(date.H).padStart(2, '0')}:${String(date.M).padStart(2, '0')}`;
      } else if (startTime) {
        callDate = String(startTime);
      }

      // Extract rep name from the transcript or agent number
      let repName = String(row['Agent Name'] || row['Agent Number'] || 'Unknown');
      const transcript = String(row['Full Transcription'] || '');

      // Try to extract the agent's name from the first "Agent:" line
      const agentNameMatch = transcript.match(/Agent:\s*(?:Nationwide,?\s*)?(\w+)/i);
      if (agentNameMatch) {
        repName = agentNameMatch[1].charAt(0).toUpperCase() + agentNameMatch[1].slice(1).toLowerCase();
      }

      const record: CallRecord = {
        id: `call-${index + 1}-${Date.now()}`,
        repName,
        callDate,
        callDuration: durationFormatted,
        customerName: undefined,
        phoneNumber: String(row['Tracking Number'] || ''),
        transcript,
        notes: String(row['Note'] || ''),
        outcome: String(row['Call Status'] || ''),
        // Additional fields from CallRail
        source: String(row['Source'] || ''),
        sentiment: String(row['Sentiment'] || ''),
        attribution: String(row['Reported Attribution'] || ''),
        recordingUrl: String(row['Recording Url'] || ''),
        medium: String(row['Medium'] || ''),
        campaign: String(row['Campaign'] || ''),
      };

      return record;
    });

  return calls;
}

export function getColumnHeaders(buffer: ArrayBuffer): string[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames.includes('Calls')
    ? 'Calls'
    : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const headers: string[] = [];

  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    const cell = worksheet[cellAddress];
    headers.push(cell ? String(cell.v) : `Column ${col + 1}`);
  }

  return headers;
}

export function getSheetNames(buffer: ArrayBuffer): string[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  return workbook.SheetNames;
}
