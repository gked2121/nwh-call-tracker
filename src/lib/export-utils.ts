import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { AnalysisResult } from '@/types/call';

export function exportToPDF(result: AnalysisResult, filename: string = 'call-analysis-report.pdf') {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Title
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('NWH Call Analysis Report', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  // Subtitle
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('AI-Powered Sales Performance & Lead Quality Analysis', pageWidth / 2, yPos, { align: 'center' });
  doc.setTextColor(0);
  yPos += 6;

  // Date
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;

  // Executive Summary Box
  doc.setFillColor(59, 130, 246);
  doc.rect(14, yPos, pageWidth - 28, 28, 'F');
  doc.setTextColor(255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', 20, yPos + 8);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${result.overallStats.totalCalls} Calls Analyzed  |  Rep Avg: ${result.overallStats.averageScore}/10  |  Lead Avg: ${result.overallStats.averageLeadScore || 0}/10`, 20, yPos + 16);
  doc.text(`Hot Leads: ${result.overallStats.hotLeads || 0}  |  Qualified: ${result.overallStats.qualifiedLeads || 0}  |  Red Flags: ${result.overallStats.redFlagCalls || 0}`, 20, yPos + 23);
  doc.setTextColor(0);
  yPos += 36;

  // Overall Stats
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Performance Overview', 14, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const stats = [
    `Total Calls Analyzed: ${result.overallStats.totalCalls}`,
    `Average Rep Performance Score: ${result.overallStats.averageScore}/10`,
    `Average Lead Quality Score: ${result.overallStats.averageLeadScore || 0}/10`,
    `Hot Leads (9-10): ${result.overallStats.hotLeads || 0}`,
    `Qualified Leads (7-8): ${result.overallStats.qualifiedLeads || 0}`,
    `Red Flag Calls: ${result.overallStats.redFlagCalls || 0}`,
    `Top Performer: ${result.overallStats.topPerformer}`,
    `Needs Improvement: ${result.overallStats.needsImprovement}`,
  ];
  stats.forEach(stat => {
    doc.text(stat, 14, yPos);
    yPos += 5;
  });
  yPos += 8;

  // Rep Summary Table
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Rep Performance Summary', 14, yPos);
  yPos += 5;

  autoTable(doc, {
    startY: yPos,
    head: [['Rep Name', 'Calls', 'Rep Score', 'Lead Score', 'Hot Leads', 'Qualified', 'Trend']],
    body: result.repSummaries.map(rep => [
      rep.repName,
      rep.totalCalls.toString(),
      `${rep.averageScore}/10`,
      `${rep.averageLeadScore || 0}/10`,
      (rep.hotLeads || 0).toString(),
      (rep.qualifiedLeads || 0).toString(),
      rep.trend,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  // @ts-expect-error - autoTable adds this property
  yPos = doc.lastAutoTable.finalY + 12;

  // Coaching Insights Section
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Coaching Insights by Rep', 14, yPos);
  yPos += 8;

  result.repSummaries.forEach(rep => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Rep header with score
    doc.setFillColor(240, 240, 240);
    doc.rect(14, yPos - 4, pageWidth - 28, 8, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`${rep.repName}`, 16, yPos + 1);
    doc.setFont('helvetica', 'normal');
    doc.text(`Rep: ${rep.averageScore}/10  |  Lead: ${rep.averageLeadScore || 0}/10  |  ${rep.trend}`, pageWidth - 80, yPos + 1);
    yPos += 10;

    doc.setFontSize(9);

    // Strengths
    if (rep.strengths.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 139, 34);
      doc.text('Strengths:', 16, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
      yPos += 4;
      rep.strengths.forEach(s => {
        const lines = doc.splitTextToSize(`• ${s}`, pageWidth - 36);
        lines.forEach((line: string) => {
          doc.text(line, 20, yPos);
          yPos += 4;
        });
      });
      yPos += 2;
    }

    // Weaknesses
    if (rep.weaknesses.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(220, 53, 69);
      doc.text('Areas to Improve:', 16, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
      yPos += 4;
      rep.weaknesses.forEach(w => {
        const lines = doc.splitTextToSize(`• ${w}`, pageWidth - 36);
        lines.forEach((line: string) => {
          doc.text(line, 20, yPos);
          yPos += 4;
        });
      });
      yPos += 2;
    }

    // Coaching insights
    if (rep.coachingInsights.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(128, 0, 128);
      doc.text('Coaching Recommendations:', 16, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
      yPos += 4;
      rep.coachingInsights.forEach(insight => {
        const lines = doc.splitTextToSize(`→ ${insight}`, pageWidth - 36);
        lines.forEach((line: string) => {
          if (yPos > 280) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(line, 20, yPos);
          yPos += 4;
        });
      });
    }
    yPos += 6;
  });

  // Individual Call Analysis
  doc.addPage();
  yPos = 20;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Individual Call Analysis', 14, yPos);
  yPos += 5;

  autoTable(doc, {
    startY: yPos,
    head: [['Rep', 'Date', 'Duration', 'Rep Score', 'Lead Score', 'Action', 'Type']],
    body: result.calls.map(call => [
      call.record.repName,
      call.record.callDate,
      call.record.callDuration,
      `${call.score.overallScore}/10`,
      `${call.score.leadQuality?.score || '-'}/10`,
      call.score.leadQuality?.recommendedAction?.replace(/-/g, ' ') || '-',
      call.score.callContext?.type || '-',
    ]),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  // Save the PDF
  doc.save(filename);
}

export function exportToExcel(result: AnalysisResult, filename: string = 'call-analysis-report.xlsx') {
  const workbook = XLSX.utils.book_new();

  // Summary Sheet
  const summaryData = [
    ['NWH Call Analysis Report'],
    [`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`],
    [],
    ['EXECUTIVE SUMMARY'],
    ['Total Calls Analyzed', result.overallStats.totalCalls],
    ['Average Rep Performance Score', result.overallStats.averageScore],
    ['Average Lead Quality Score', result.overallStats.averageLeadScore || 0],
    [],
    ['LEAD QUALITY BREAKDOWN'],
    ['Hot Leads (9-10)', result.overallStats.hotLeads || 0],
    ['Qualified Leads (7-8)', result.overallStats.qualifiedLeads || 0],
    ['Red Flag Calls', result.overallStats.redFlagCalls || 0],
    [],
    ['TOP PERFORMERS'],
    ['Top Performer', result.overallStats.topPerformer],
    ['Needs Improvement', result.overallStats.needsImprovement],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Rep Performance Sheet
  const repHeaders = ['Rep Name', 'Total Calls', 'Rep Score', 'Lead Score', 'Hot Leads', 'Qualified', 'Trend', 'Strengths', 'Weaknesses', 'Coaching Insights'];
  const repData = result.repSummaries.map(rep => [
    rep.repName,
    rep.totalCalls,
    rep.averageScore,
    rep.averageLeadScore || 0,
    rep.hotLeads || 0,
    rep.qualifiedLeads || 0,
    rep.trend,
    rep.strengths.join('; '),
    rep.weaknesses.join('; '),
    rep.coachingInsights.join('; '),
  ]);
  const repSheet = XLSX.utils.aoa_to_sheet([repHeaders, ...repData]);
  XLSX.utils.book_append_sheet(workbook, repSheet, 'Rep Performance');

  // Individual Calls Sheet
  const callHeaders = [
    'Rep Name',
    'Date',
    'Duration',
    'Overall Rep Score',
    'Lead Quality Score',
    'Lead Timeline',
    'Has Authority',
    'Need Identified',
    'Service Fit',
    'Recommended Action',
    'Red Flags',
    'Call Type',
    'Objective Clarity',
    'Info Gathering',
    'Info Quality',
    'Tone',
    'Listening Ratio',
    'Conversation Guidance',
    'Objection Handling',
    'Next Steps',
    'Call Closing',
    'Strengths',
    'Weaknesses',
    'Coaching Insights',
    'Internal Alerts',
  ];
  const callData = result.calls.map(call => [
    call.record.repName,
    call.record.callDate,
    call.record.callDuration,
    call.score.overallScore,
    call.score.leadQuality?.score || '',
    call.score.leadQuality?.timeline || '',
    call.score.leadQuality?.hasAuthority ? 'Yes' : 'No',
    call.score.leadQuality?.needIdentified ? 'Yes' : 'No',
    call.score.leadQuality?.serviceFit || '',
    call.score.leadQuality?.recommendedAction || '',
    (call.score.leadQuality?.redFlags || []).join('; '),
    call.score.callContext?.type || '',
    call.score.objectiveClarity?.score || '',
    call.score.informationGathering?.score || '',
    call.score.informationQuality?.score || '',
    call.score.toneProfessionalism?.score || '',
    call.score.listeningRatio?.score || '',
    call.score.conversationGuidance?.score || '',
    call.score.objectionHandling?.score || '',
    call.score.nextSteps?.score || '',
    call.score.callClosing?.score || '',
    (call.score.strengths || []).join('; '),
    (call.score.weaknesses || []).join('; '),
    (call.score.coachingInsights || []).join('; '),
    (call.score.internalAlerts || []).join('; '),
  ]);
  const callSheet = XLSX.utils.aoa_to_sheet([callHeaders, ...callData]);
  XLSX.utils.book_append_sheet(workbook, callSheet, 'Individual Calls');

  // Hot Leads Sheet - Priority follow-ups
  const hotLeadHeaders = ['Rep', 'Date', 'Lead Score', 'Timeline', 'Has Authority', 'Need', 'Service Fit', 'Action', 'Notes'];
  const hotLeadData = result.calls
    .filter(c => (c.score.leadQuality?.score || 0) >= 7)
    .sort((a, b) => (b.score.leadQuality?.score || 0) - (a.score.leadQuality?.score || 0))
    .map(call => [
      call.record.repName,
      call.record.callDate,
      call.score.leadQuality?.score || '',
      call.score.leadQuality?.timeline || '',
      call.score.leadQuality?.hasAuthority ? 'Yes' : 'No',
      call.score.leadQuality?.needIdentified ? 'Yes' : 'No',
      call.score.leadQuality?.serviceFit || '',
      call.score.leadQuality?.recommendedAction || '',
      call.score.leadQuality?.notes || '',
    ]);
  const hotLeadSheet = XLSX.utils.aoa_to_sheet([hotLeadHeaders, ...hotLeadData]);
  XLSX.utils.book_append_sheet(workbook, hotLeadSheet, 'Hot & Qualified Leads');

  // Red Flags Sheet
  const redFlagHeaders = ['Rep', 'Date', 'Lead Score', 'Red Flags', 'Notes'];
  const redFlagData = result.calls
    .filter(c => (c.score.leadQuality?.redFlags?.length || 0) > 0)
    .map(call => [
      call.record.repName,
      call.record.callDate,
      call.score.leadQuality?.score || '',
      (call.score.leadQuality?.redFlags || []).join('; '),
      call.score.leadQuality?.notes || '',
    ]);
  if (redFlagData.length > 0) {
    const redFlagSheet = XLSX.utils.aoa_to_sheet([redFlagHeaders, ...redFlagData]);
    XLSX.utils.book_append_sheet(workbook, redFlagSheet, 'Red Flag Calls');
  }

  // Detailed Notes Sheet
  const notesHeaders = ['Rep Name', 'Date', 'Category', 'Score', 'Notes'];
  const notesData: (string | number)[][] = [];
  result.calls.forEach(call => {
    const categories = [
      { name: 'Lead Quality', score: call.score.leadQuality?.score || '', notes: call.score.leadQuality?.notes || '' },
      { name: 'Call Context', score: call.score.callContext?.score || '', notes: call.score.callContext?.notes || '' },
      { name: 'Objective Clarity', score: call.score.objectiveClarity?.score || '', notes: call.score.objectiveClarity?.notes || '' },
      { name: 'Information Gathering', score: call.score.informationGathering?.score || '', notes: call.score.informationGathering?.notes || '' },
      { name: 'Information Quality', score: call.score.informationQuality?.score || '', notes: call.score.informationQuality?.notes || '' },
      { name: 'Tone & Professionalism', score: call.score.toneProfessionalism?.score || '', notes: call.score.toneProfessionalism?.notes || '' },
      { name: 'Listening Ratio', score: call.score.listeningRatio?.score || '', notes: `${call.score.listeningRatio?.estimatedRatio || ''} - ${call.score.listeningRatio?.notes || ''}` },
      { name: 'Conversation Guidance', score: call.score.conversationGuidance?.score || '', notes: call.score.conversationGuidance?.notes || '' },
      { name: 'Objection Handling', score: call.score.objectionHandling?.score || '', notes: call.score.objectionHandling?.notes || '' },
      { name: 'Next Steps', score: call.score.nextSteps?.score || '', notes: call.score.nextSteps?.notes || '' },
      { name: 'Call Closing', score: call.score.callClosing?.score || '', notes: call.score.callClosing?.notes || '' },
    ];
    categories.forEach(cat => {
      notesData.push([call.record.repName, call.record.callDate, cat.name, cat.score, cat.notes]);
    });
  });
  const notesSheet = XLSX.utils.aoa_to_sheet([notesHeaders, ...notesData]);
  XLSX.utils.book_append_sheet(workbook, notesSheet, 'Detailed Notes');

  // Save the workbook
  XLSX.writeFile(workbook, filename);
}
