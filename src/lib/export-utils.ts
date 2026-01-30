import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { AnalysisResult } from '@/types/call';

// Color constants - Professional slate/blue scheme
const COLORS = {
  primary: [15, 23, 42] as [number, number, number],        // Slate-900
  secondary: [14, 165, 233] as [number, number, number],    // Sky-500
  success: [16, 185, 129] as [number, number, number],      // Emerald-500
  warning: [245, 158, 11] as [number, number, number],      // Amber-500
  danger: [239, 68, 68] as [number, number, number],        // Red-500
  dark: [15, 23, 42] as [number, number, number],           // Slate-900
  light: [248, 250, 252] as [number, number, number],       // Slate-50
  muted: [148, 163, 184] as [number, number, number],       // Slate-400
};

function getScoreColor(score: number): [number, number, number] {
  if (score >= 8) return COLORS.success;
  if (score >= 6) return COLORS.warning;
  return COLORS.danger;
}

function getActionColor(action: string | undefined): [number, number, number] {
  switch (action) {
    case 'priority-1hr': return COLORS.danger;
    case 'follow-24hr': return COLORS.warning;
    case 'nurture-48-72hr': return [234, 179, 8]; // Yellow
    default: return COLORS.muted;
  }
}

export function exportToPDF(result: AnalysisResult, filename: string = 'call-analysis-report.pdf') {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 0;

  // Helper to add page numbers
  const addPageNumber = () => {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.muted);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 25, pageHeight - 10);
      doc.text('NWH Call Analysis Report', 14, pageHeight - 10);
    }
  };

  // ============================================
  // COVER PAGE
  // ============================================

  // Dark header bar
  doc.setFillColor(...COLORS.dark);
  doc.rect(0, 0, pageWidth, 60, 'F');

  // Gradient accent
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 60, pageWidth, 4, 'F');

  // Title
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('NWH Call Analysis', pageWidth / 2, 30, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('AI-Powered Sales Performance Report', pageWidth / 2, 42, { align: 'center' });

  // Date
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  yPos = 75;
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // ============================================
  // EXECUTIVE SUMMARY CARDS
  // ============================================
  doc.setTextColor(0, 0, 0);

  // Summary box
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(14, yPos, pageWidth - 28, 50, 3, 3, 'F');

  // Stats row
  const cardWidth = (pageWidth - 42) / 4;
  const cards = [
    { label: 'Total Calls', value: result.overallStats.totalCalls.toString(), color: COLORS.primary },
    { label: 'Avg Rep Score', value: `${result.overallStats.averageScore}/10`, color: COLORS.success },
    { label: 'Avg Lead Score', value: `${result.overallStats.averageLeadScore || 0}/10`, color: COLORS.secondary },
    { label: 'Qualified (7+)', value: (result.overallStats.qualifiedLeads || 0).toString(), color: COLORS.warning },
  ];

  cards.forEach((card, i) => {
    const x = 21 + i * cardWidth;
    doc.setFillColor(...card.color);
    doc.roundedRect(x, yPos + 8, cardWidth - 8, 34, 2, 2, 'F');

    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(card.value, x + (cardWidth - 8) / 2, yPos + 24, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(card.label, x + (cardWidth - 8) / 2, yPos + 34, { align: 'center' });
  });

  doc.setTextColor(0, 0, 0);
  yPos += 60;

  // Top/Bottom performers
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Top Performer:', 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.success);
  doc.text(result.overallStats.topPerformer, 55, yPos);

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('Needs Coaching:', pageWidth / 2, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.warning);
  doc.text(result.overallStats.needsImprovement, pageWidth / 2 + 45, yPos);

  doc.setTextColor(0, 0, 0);
  yPos += 15;

  // ============================================
  // REP PERFORMANCE TABLE
  // ============================================
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Rep Performance Rankings', 14, yPos);
  yPos += 3;

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Rep Name', 'Calls', 'Rep Score', 'Lead Score', 'Qualified (7+)', 'Trend']],
    body: result.repSummaries.map((rep, i) => [
      (i + 1).toString(),
      rep.repName,
      rep.totalCalls.toString(),
      `${rep.averageScore}/10`,
      `${rep.averageLeadScore || 0}/10`,
      (rep.qualifiedLeads || 0).toString(),
      rep.trend.charAt(0).toUpperCase() + rep.trend.slice(1),
    ]),
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
    headStyles: {
      fillColor: COLORS.dark,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: COLORS.light,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'center' },
    },
    didParseCell: (data) => {
      // Color code scores
      if (data.section === 'body') {
        if (data.column.index === 3 || data.column.index === 4) {
          const score = parseFloat(data.cell.text[0]);
          if (score >= 8) data.cell.styles.textColor = COLORS.success;
          else if (score >= 6) data.cell.styles.textColor = COLORS.warning;
          else data.cell.styles.textColor = COLORS.danger;
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 6) {
          const trend = data.cell.text[0].toLowerCase();
          if (trend === 'improving') data.cell.styles.textColor = COLORS.success;
          else if (trend === 'declining') data.cell.styles.textColor = COLORS.danger;
          else data.cell.styles.textColor = COLORS.muted;
        }
      }
    },
  });

  // @ts-expect-error - autoTable adds this property
  yPos = doc.lastAutoTable.finalY + 15;

  // ============================================
  // COACHING INSIGHTS
  // ============================================
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Coaching Insights by Rep', 14, yPos);
  yPos += 10;

  result.repSummaries.forEach(rep => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Rep header
    doc.setFillColor(...COLORS.dark);
    doc.roundedRect(14, yPos - 5, pageWidth - 28, 12, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(rep.repName, 18, yPos + 3);

    // Score badges
    const repScoreColor = getScoreColor(rep.averageScore);
    const leadScoreColor = getScoreColor(rep.averageLeadScore || 0);

    doc.setFillColor(...repScoreColor);
    doc.roundedRect(pageWidth - 85, yPos - 4, 30, 10, 2, 2, 'F');
    doc.setFontSize(9);
    doc.text(`Rep: ${rep.averageScore}`, pageWidth - 78, yPos + 3);

    doc.setFillColor(...leadScoreColor);
    doc.roundedRect(pageWidth - 50, yPos - 4, 35, 10, 2, 2, 'F');
    doc.text(`Lead: ${rep.averageLeadScore || 0}`, pageWidth - 45, yPos + 3);

    yPos += 12;
    doc.setTextColor(0, 0, 0);

    // Three columns: Strengths, Weaknesses, Coaching
    const colWidth = (pageWidth - 38) / 3;
    const startY = yPos;

    // Strengths column
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.success);
    doc.text('Strengths', 16, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    yPos += 5;
    rep.strengths.slice(0, 3).forEach(s => {
      const lines = doc.splitTextToSize(`• ${s}`, colWidth - 4);
      lines.forEach((line: string) => {
        if (yPos < 280) {
          doc.text(line, 16, yPos);
          yPos += 4;
        }
      });
    });

    // Weaknesses column
    yPos = startY;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.danger);
    doc.text('Areas to Improve', 16 + colWidth, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    yPos += 5;
    rep.weaknesses.slice(0, 3).forEach(w => {
      const lines = doc.splitTextToSize(`• ${w}`, colWidth - 4);
      lines.forEach((line: string) => {
        if (yPos < 280) {
          doc.text(line, 16 + colWidth, yPos);
          yPos += 4;
        }
      });
    });

    // Coaching column
    yPos = startY;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.secondary);
    doc.text('Coaching Tips', 16 + colWidth * 2, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    yPos += 5;
    rep.coachingInsights.slice(0, 3).forEach(c => {
      const lines = doc.splitTextToSize(`→ ${c}`, colWidth - 4);
      lines.forEach((line: string) => {
        if (yPos < 280) {
          doc.text(line, 16 + colWidth * 2, yPos);
          yPos += 4;
        }
      });
    });

    yPos = Math.max(yPos, startY + 25) + 8;
  });

  // ============================================
  // QUALIFIED LEADS PAGE
  // ============================================
  doc.addPage();
  yPos = 20;

  // Header
  doc.setFillColor(...COLORS.warning);
  doc.rect(0, 0, pageWidth, 25, 'F');
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Qualified Leads - Follow-Up Required', pageWidth / 2, 16, { align: 'center' });

  yPos = 35;
  doc.setTextColor(0, 0, 0);

  const qualifiedLeads = result.calls
    .filter(c => (c.score.leadQuality?.score || 0) >= 7)
    .sort((a, b) => (b.score.leadQuality?.score || 0) - (a.score.leadQuality?.score || 0));

  if (qualifiedLeads.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Score', 'Caller', 'Company/Location', 'Rep', 'Need Summary', 'Action']],
      body: qualifiedLeads.map(call => [
        `${call.score.leadQuality?.score || '-'}/10`,
        call.score.callerInfo?.name || 'Unknown',
        call.score.callerInfo?.company || call.score.callerInfo?.location || '-',
        call.score.repInfo?.name || call.record.repName,
        call.score.callerInfo?.needSummary || '-',
        (call.score.leadQuality?.recommendedAction || '-').replace(/-/g, ' '),
      ]),
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: COLORS.dark,
        textColor: [255, 255, 255],
      },
      columnStyles: {
        0: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
        4: { cellWidth: 50 },
        5: { cellWidth: 25 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const score = parseFloat(data.cell.text[0]);
          if (score >= 9) {
            data.cell.styles.textColor = COLORS.success;
          } else {
            data.cell.styles.textColor = COLORS.warning;
          }
        }
        if (data.section === 'body' && data.column.index === 5) {
          const action = data.cell.text[0].toLowerCase();
          if (action.includes('priority') || action.includes('1hr')) {
            data.cell.styles.textColor = COLORS.danger;
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });
  } else {
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.muted);
    doc.text('No qualified leads (score 7+) found in this analysis.', pageWidth / 2, yPos + 20, { align: 'center' });
  }

  // ============================================
  // LEAD SOURCES PAGE
  // ============================================
  doc.addPage();
  yPos = 20;

  // Header
  doc.setFillColor(...COLORS.secondary);
  doc.rect(0, 0, pageWidth, 25, 'F');
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Lead Source Analysis', pageWidth / 2, 16, { align: 'center' });

  yPos = 35;
  doc.setTextColor(0, 0, 0);

  // Aggregate source data
  const sourceMap = new Map<string, typeof result.calls>();
  for (const call of result.calls) {
    const source = call.record.source || 'Unknown';
    if (!sourceMap.has(source)) sourceMap.set(source, []);
    sourceMap.get(source)!.push(call);
  }

  const sourceTableData = [...sourceMap.entries()]
    .map(([source, calls]) => {
      const leadScores = calls.map(c => c.score.leadQuality?.score || 0);
      const avgLead = leadScores.length > 0 ? leadScores.reduce((a, b) => a + b, 0) / leadScores.length : 0;
      const qualified = leadScores.filter(s => s >= 7).length;
      const durations = calls.map(c => c.record.durationSeconds || 0);
      const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
      const mins = Math.floor(avgDuration / 60);
      const secs = Math.round(avgDuration % 60);
      return {
        source,
        count: calls.length,
        avgLead: Math.round(avgLead * 10) / 10,
        qualified,
        qualifiedPct: Math.round(qualified / calls.length * 100),
        avgDuration: `${mins}:${String(secs).padStart(2, '0')}`,
      };
    })
    .sort((a, b) => b.avgLead - a.avgLead);

  autoTable(doc, {
    startY: yPos,
    head: [['Source', 'Calls', 'Avg Lead Score', 'Qualified (7+)', 'Qualified %', 'Avg Duration']],
    body: sourceTableData.map(s => [
      s.source,
      s.count.toString(),
      `${s.avgLead}/10`,
      s.qualified.toString(),
      `${s.qualifiedPct}%`,
      s.avgDuration,
    ]),
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
    headStyles: {
      fillColor: COLORS.dark,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: COLORS.light,
    },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const score = parseFloat(data.cell.text[0]);
        if (score >= 8) data.cell.styles.textColor = COLORS.success;
        else if (score >= 6) data.cell.styles.textColor = COLORS.warning;
        else data.cell.styles.textColor = COLORS.danger;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // ============================================
  // ALL CALLS DETAIL
  // ============================================
  doc.addPage();
  yPos = 20;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Complete Call Analysis', 14, yPos);
  yPos += 8;

  autoTable(doc, {
    startY: yPos,
    head: [['Rep', 'Caller', 'Date', 'Duration', 'Rep Score', 'Lead Score', 'Action', 'Type']],
    body: result.calls.map(call => [
      call.score.repInfo?.name || call.record.repName,
      call.score.callerInfo?.name || 'Unknown',
      call.record.callDate,
      call.record.callDuration,
      `${call.score.overallScore}/10`,
      `${call.score.leadQuality?.score || '-'}/10`,
      (call.score.leadQuality?.recommendedAction || '-').replace(/-/g, ' '),
      call.score.callContext?.type || '-',
    ]),
    styles: {
      fontSize: 7,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: COLORS.dark,
      textColor: [255, 255, 255],
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: COLORS.light,
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        if (data.column.index === 4 || data.column.index === 5) {
          const score = parseFloat(data.cell.text[0]);
          if (score >= 8) data.cell.styles.textColor = COLORS.success;
          else if (score >= 6) data.cell.styles.textColor = COLORS.warning;
          else if (!isNaN(score)) data.cell.styles.textColor = COLORS.danger;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // Add page numbers
  addPageNumber();

  // Save the PDF
  doc.save(filename);
}

export function exportToExcel(result: AnalysisResult, filename: string = 'call-analysis-report.xlsx') {
  const workbook = XLSX.utils.book_new();

  // ============================================
  // DASHBOARD SHEET
  // ============================================
  const dashboardData = [
    ['NWH CALL ANALYSIS REPORT'],
    [''],
    ['Generated:', new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })],
    [''],
    ['═══════════════════════════════════════'],
    ['EXECUTIVE SUMMARY'],
    ['═══════════════════════════════════════'],
    [''],
    ['Metric', 'Value'],
    ['Total Calls Analyzed', result.overallStats.totalCalls],
    ['Average Rep Performance', `${result.overallStats.averageScore}/10`],
    ['Average Lead Quality', `${result.overallStats.averageLeadScore || 0}/10`],
    [''],
    ['═══════════════════════════════════════'],
    ['LEAD BREAKDOWN'],
    ['═══════════════════════════════════════'],
    [''],
    ['Category', 'Count', 'Description'],
    ['Qualified Leads (7+)', result.overallStats.qualifiedLeads || 0, 'Follow up within 24-48 hours'],
    ['Red Flag Calls', result.overallStats.redFlagCalls || 0, 'Requires attention'],
    [''],
    ['═══════════════════════════════════════'],
    ['TOP PERFORMERS'],
    ['═══════════════════════════════════════'],
    [''],
    ['Best Rep', result.overallStats.topPerformer],
    ['Needs Coaching', result.overallStats.needsImprovement],
  ];

  const dashboardSheet = XLSX.utils.aoa_to_sheet(dashboardData);

  // Set column widths
  dashboardSheet['!cols'] = [
    { wch: 25 },
    { wch: 20 },
    { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(workbook, dashboardSheet, 'Dashboard');

  // ============================================
  // REP LEADERBOARD SHEET
  // ============================================
  const repHeaders = [
    'Rank',
    'Rep Name',
    'Total Calls',
    'Rep Score',
    'Lead Score',
    'Qualified (7+)',
    'Trend',
    'Top Strengths',
    'Key Improvements',
    'Coaching Focus',
  ];

  const repData = result.repSummaries.map((rep, i) => [
    i + 1,
    rep.repName,
    rep.totalCalls,
    rep.averageScore,
    rep.averageLeadScore || 0,
    rep.qualifiedLeads || 0,
    rep.trend.charAt(0).toUpperCase() + rep.trend.slice(1),
    rep.strengths.slice(0, 2).join(' | '),
    rep.weaknesses.slice(0, 2).join(' | '),
    rep.coachingInsights.slice(0, 2).join(' | '),
  ]);

  const repSheet = XLSX.utils.aoa_to_sheet([repHeaders, ...repData]);

  repSheet['!cols'] = [
    { wch: 6 },   // Rank
    { wch: 15 },  // Name
    { wch: 10 },  // Calls
    { wch: 10 },  // Rep Score
    { wch: 10 },  // Lead Score
    { wch: 12 },  // Qualified
    { wch: 12 },  // Trend
    { wch: 40 },  // Strengths
    { wch: 40 },  // Improvements
    { wch: 40 },  // Coaching
  ];

  XLSX.utils.book_append_sheet(workbook, repSheet, 'Rep Leaderboard');

  // ============================================
  // QUALIFIED LEADS SHEET
  // ============================================
  const qualifiedLeadHeaders = [
    'Priority',
    'Lead Score',
    'Caller Name',
    'Company',
    'Location',
    'Phone',
    'Need Summary',
    'Rep',
    'Date',
    'Recommended Action',
    'Timeline',
  ];

  const qualifiedLeadData = result.calls
    .filter(c => (c.score.leadQuality?.score || 0) >= 7)
    .sort((a, b) => (b.score.leadQuality?.score || 0) - (a.score.leadQuality?.score || 0))
    .map((call, i) => [
      i + 1,
      call.score.leadQuality?.score || 0,
      call.score.callerInfo?.name || 'Unknown',
      call.score.callerInfo?.company || '',
      call.score.callerInfo?.location || '',
      call.score.callerInfo?.phone || call.record.phoneNumber || '',
      call.score.callerInfo?.needSummary || '',
      call.score.repInfo?.name || call.record.repName,
      call.record.callDate,
      (call.score.leadQuality?.recommendedAction || '').replace(/-/g, ' '),
      call.score.leadQuality?.timeline || '',
    ]);

  const qualifiedLeadSheet = XLSX.utils.aoa_to_sheet([qualifiedLeadHeaders, ...qualifiedLeadData]);

  qualifiedLeadSheet['!cols'] = [
    { wch: 8 },   // Priority
    { wch: 10 },  // Score
    { wch: 20 },  // Name
    { wch: 25 },  // Company
    { wch: 20 },  // Location
    { wch: 15 },  // Phone
    { wch: 40 },  // Need
    { wch: 12 },  // Rep
    { wch: 18 },  // Date
    { wch: 18 },  // Action
    { wch: 15 },  // Timeline
  ];

  XLSX.utils.book_append_sheet(workbook, qualifiedLeadSheet, 'Qualified Leads');

  // ============================================
  // ALL CALLS SHEET
  // ============================================
  const callHeaders = [
    'Rep Name',
    'Caller Name',
    'Company',
    'Location',
    'Caller Phone',
    'Need Summary',
    'Date',
    'Duration',
    'Source',
    'Call Type',
    'Rep Score',
    'Lead Score',
    'Recommended Action',
    'Timeline',
    'Has Authority',
    'Need Identified',
    'Service Fit',
    'Strengths',
    'Weaknesses',
    'Coaching Insights',
    'Red Flags',
    'Recording URL',
  ];

  const callData = result.calls.map(call => [
    call.score.repInfo?.name || call.record.repName,
    call.score.callerInfo?.name || 'Unknown',
    call.score.callerInfo?.company || '',
    call.score.callerInfo?.location || '',
    call.score.callerInfo?.phone || call.record.phoneNumber || '',
    call.score.callerInfo?.needSummary || '',
    call.record.callDate,
    call.record.callDuration,
    call.record.source || '',
    call.score.callContext?.type || '',
    call.score.overallScore,
    call.score.leadQuality?.score || '',
    (call.score.leadQuality?.recommendedAction || '').replace(/-/g, ' '),
    call.score.leadQuality?.timeline || '',
    call.score.leadQuality?.hasAuthority ? 'Yes' : 'No',
    call.score.leadQuality?.needIdentified ? 'Yes' : 'No',
    call.score.leadQuality?.serviceFit || '',
    (call.score.strengths || []).join(' | '),
    (call.score.weaknesses || []).join(' | '),
    (call.score.coachingInsights || []).join(' | '),
    (call.score.leadQuality?.redFlags || []).join(' | '),
    call.record.recordingUrl || '',
  ]);

  const callSheet = XLSX.utils.aoa_to_sheet([callHeaders, ...callData]);

  callSheet['!cols'] = [
    { wch: 12 },  // Rep
    { wch: 18 },  // Caller
    { wch: 20 },  // Company
    { wch: 18 },  // Location
    { wch: 15 },  // Phone
    { wch: 35 },  // Need
    { wch: 18 },  // Date
    { wch: 10 },  // Duration
    { wch: 18 },  // Source
    { wch: 10 },  // Type
    { wch: 10 },  // Rep Score
    { wch: 10 },  // Lead Score
    { wch: 18 },  // Action
    { wch: 15 },  // Timeline
    { wch: 12 },  // Authority
    { wch: 12 },  // Need ID
    { wch: 12 },  // Fit
    { wch: 40 },  // Strengths
    { wch: 40 },  // Weaknesses
    { wch: 40 },  // Coaching
    { wch: 30 },  // Red Flags
    { wch: 50 },  // Recording URL
  ];

  // Freeze header row
  callSheet['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(workbook, callSheet, 'All Calls');

  // ============================================
  // SCORE BREAKDOWN SHEET
  // ============================================
  const scoreHeaders = [
    'Rep',
    'Caller',
    'Date',
    'Overall',
    'Lead Quality',
    'Objective Clarity',
    'Info Gathering',
    'Info Quality',
    'Tone',
    'Listening',
    'Guidance',
    'Objection Handling',
    'Next Steps',
    'Closing',
  ];

  const scoreData = result.calls.map(call => [
    call.score.repInfo?.name || call.record.repName,
    call.score.callerInfo?.name || 'Unknown',
    call.record.callDate,
    call.score.overallScore,
    call.score.leadQuality?.score || '',
    call.score.objectiveClarity?.score || '',
    call.score.informationGathering?.score || '',
    call.score.informationQuality?.score || '',
    call.score.toneProfessionalism?.score || '',
    call.score.listeningRatio?.score || '',
    call.score.conversationGuidance?.score || '',
    call.score.objectionHandling?.score || '',
    call.score.nextSteps?.score || '',
    call.score.callClosing?.score || '',
  ]);

  const scoreSheet = XLSX.utils.aoa_to_sheet([scoreHeaders, ...scoreData]);

  scoreSheet['!cols'] = [
    { wch: 12 },  // Rep
    { wch: 18 },  // Caller
    { wch: 18 },  // Date
    { wch: 8 },   // Overall
    { wch: 12 },  // Lead
    { wch: 14 },  // Clarity
    { wch: 14 },  // Gathering
    { wch: 12 },  // Quality
    { wch: 8 },   // Tone
    { wch: 10 },  // Listening
    { wch: 10 },  // Guidance
    { wch: 16 },  // Objection
    { wch: 12 },  // Next Steps
    { wch: 10 },  // Closing
  ];

  XLSX.utils.book_append_sheet(workbook, scoreSheet, 'Score Breakdown');

  // ============================================
  // LEAD SOURCES SHEET
  // ============================================
  const sourceMap = new Map<string, typeof result.calls>();
  for (const call of result.calls) {
    const source = call.record.source || 'Unknown';
    if (!sourceMap.has(source)) sourceMap.set(source, []);
    sourceMap.get(source)!.push(call);
  }

  const sourceHeaders = [
    'Source',
    'Total Calls',
    'Avg Lead Score',
    'Avg Rep Score',
    'Qualified (7+)',
    'Qualified %',
    'Avg Duration',
  ];

  const sourceData = [...sourceMap.entries()]
    .map(([source, calls]) => {
      const leadScores = calls.map(c => c.score.leadQuality?.score || 0);
      const repScores = calls.map(c => c.score.overallScore);
      const avgLead = leadScores.length > 0 ? leadScores.reduce((a, b) => a + b, 0) / leadScores.length : 0;
      const avgRep = repScores.length > 0 ? repScores.reduce((a, b) => a + b, 0) / repScores.length : 0;
      const qualified = leadScores.filter(s => s >= 7).length;
      const durations = calls.map(c => c.record.durationSeconds || 0);
      const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
      const mins = Math.floor(avgDuration / 60);
      const secs = Math.round(avgDuration % 60);
      return [
        source,
        calls.length,
        Math.round(avgLead * 10) / 10,
        Math.round(avgRep * 10) / 10,
        qualified,
        `${Math.round(qualified / calls.length * 100)}%`,
        `${mins}:${String(secs).padStart(2, '0')}`,
      ];
    })
    .sort((a, b) => (b[2] as number) - (a[2] as number)); // Sort by lead score

  const sourceSheet = XLSX.utils.aoa_to_sheet([sourceHeaders, ...sourceData]);
  sourceSheet['!cols'] = [
    { wch: 25 },  // Source
    { wch: 12 },  // Calls
    { wch: 14 },  // Avg Lead
    { wch: 14 },  // Avg Rep
    { wch: 12 },  // Qualified
    { wch: 12 },  // %
    { wch: 12 },  // Duration
  ];
  XLSX.utils.book_append_sheet(workbook, sourceSheet, 'Lead Sources');

  // ============================================
  // RED FLAGS SHEET (if any)
  // ============================================
  const redFlagCalls = result.calls.filter(c => (c.score.leadQuality?.redFlags?.length || 0) > 0);

  if (redFlagCalls.length > 0) {
    const redFlagHeaders = ['Rep', 'Caller', 'Date', 'Lead Score', 'Red Flags', 'Notes'];
    const redFlagData = redFlagCalls.map(call => [
      call.score.repInfo?.name || call.record.repName,
      call.score.callerInfo?.name || 'Unknown',
      call.record.callDate,
      call.score.leadQuality?.score || '',
      (call.score.leadQuality?.redFlags || []).join(' | '),
      call.score.leadQuality?.notes || '',
    ]);

    const redFlagSheet = XLSX.utils.aoa_to_sheet([redFlagHeaders, ...redFlagData]);

    redFlagSheet['!cols'] = [
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 10 },
      { wch: 50 },
      { wch: 40 },
    ];

    XLSX.utils.book_append_sheet(workbook, redFlagSheet, 'Red Flags');
  }

  // Save the workbook
  XLSX.writeFile(workbook, filename);
}
