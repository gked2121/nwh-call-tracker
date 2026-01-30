"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AnalysisResult, AnalyzedCall, RepSummary } from "@/types/call";
import { Sidebar, DashboardHeader, MetricCard, DataTable, ScoreBadge, StatusBadge } from "@/components/layout";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";
import { Division, DIVISIONS, getRepDivisionInfo, repMatchesDivision, getDivisionOptions } from "@/lib/divisions";
import {
  Upload,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Minus,
  Phone,
  Users,
  Target,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Table,
  Key,
  Eye,
  EyeOff,
  Zap,
  BarChart3,
  MapPin,
  User,
  Building,
  Clock,
  PhoneCall,
  Star,
  Award,
  Flame,
  Bot,
  Brain,
  ArrowUpRight,
  X,
  Shield,
  HelpCircle,
  ExternalLink,
  Filter,
} from "lucide-react";

// Helper function to build result from collected calls
function buildResultFromCalls(calls: AnalyzedCall[]): AnalysisResult {
  const repMap = new Map<string, AnalyzedCall[]>();
  for (const call of calls) {
    const repName = call.score.repInfo?.name || call.record.repName;
    if (!repMap.has(repName)) repMap.set(repName, []);
    repMap.get(repName)!.push(call);
  }

  const repSummaries: RepSummary[] = [];
  for (const [repName, repCalls] of repMap.entries()) {
    const scores = repCalls.map(c => c.score.overallScore);
    const leadScores = repCalls.map(c => c.score.leadQuality?.score || 0);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const averageLeadScore = leadScores.reduce((a, b) => a + b, 0) / leadScores.length;

    const strengthCounts = new Map<string, number>();
    const weaknessCounts = new Map<string, number>();
    for (const call of repCalls) {
      for (const s of call.score.strengths || []) strengthCounts.set(s, (strengthCounts.get(s) || 0) + 1);
      for (const w of call.score.weaknesses || []) weaknessCounts.set(w, (weaknessCounts.get(w) || 0) + 1);
    }

    repSummaries.push({
      repName,
      totalCalls: repCalls.length,
      averageScore: Math.round(averageScore * 10) / 10,
      averageLeadScore: Math.round(averageLeadScore * 10) / 10,
      strengths: [...strengthCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s),
      weaknesses: [...weaknessCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w),
      coachingInsights: [],
      callScores: scores,
      leadScores: leadScores,
      trend: 'stable' as const,
      hotLeads: leadScores.filter(s => s >= 9).length,
      qualifiedLeads: leadScores.filter(s => s >= 7 && s < 9).length,
    });
  }
  repSummaries.sort((a, b) => b.averageScore - a.averageScore);

  const allScores = calls.map(c => c.score.overallScore);
  const allLeadScores = calls.map(c => c.score.leadQuality?.score || 0);

  return {
    calls,
    repSummaries,
    overallStats: {
      totalCalls: calls.length,
      averageScore: allScores.length > 0 ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10 : 0,
      averageLeadScore: allLeadScores.length > 0 ? Math.round((allLeadScores.reduce((a, b) => a + b, 0) / allLeadScores.length) * 10) / 10 : 0,
      topPerformer: repSummaries[0]?.repName || 'N/A',
      needsImprovement: repSummaries[repSummaries.length - 1]?.repName || 'N/A',
      hotLeads: allLeadScores.filter(s => s >= 9).length,
      qualifiedLeads: allLeadScores.filter(s => s >= 7 && s < 9).length,
      redFlagCalls: calls.filter(c => (c.score.leadQuality?.redFlags?.length || 0) > 0).length,
    },
  };
}

export default function Home() {
  // State
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [aiModel, setAiModel] = useState<"claude" | "openai">("claude");
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("upload");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [processedCalls, setProcessedCalls] = useState(0);
  const [totalCalls, setTotalCalls] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<'bronze' | 'silver' | 'gold' | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState<Division>('all');

  // Load saved keys and check for first visit
  useEffect(() => {
    const savedAnthropicKey = localStorage.getItem("anthropic_api_key") || "";
    const savedOpenaiKey = localStorage.getItem("openai_api_key") || "";
    const hasSeenWelcome = localStorage.getItem("nwh_seen_welcome");

    setAnthropicKey(savedAnthropicKey);
    setOpenaiKey(savedOpenaiKey);

    // Show welcome modal on first visit or if no API keys
    if (!hasSeenWelcome || (!savedAnthropicKey && !savedOpenaiKey)) {
      setShowWelcome(true);
    }
  }, []);

  const dismissWelcome = () => {
    localStorage.setItem("nwh_seen_welcome", "true");
    setShowWelcome(false);
    if (!anthropicKey && !openaiKey) {
      setActiveTab("settings");
    }
  };

  const saveApiKeys = () => {
    localStorage.setItem("anthropic_api_key", anthropicKey);
    localStorage.setItem("openai_api_key", openaiKey);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    const currentKey = aiModel === "claude" ? anthropicKey : openaiKey;
    if (!currentKey) {
      setError(`Please enter your ${aiModel === "claude" ? "Anthropic" : "OpenAI"} API key in settings`);
      setActiveTab("settings");
      return;
    }

    setLoading(true);
    setProgress(5);
    setProgressMessage("Parsing Excel file...");
    setError(null);
    setProcessedCalls(0);
    setCurrentPhase('bronze');

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", aiModel);
      formData.append("apiKey", currentKey);

      const response = await fetch("/api/analyze", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Analysis failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult: AnalysisResult | null = null;
      const collectedCalls: AnalyzedCall[] = [];

      const processLine = (line: string) => {
        if (!line.startsWith("data: ")) return;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === "status") {
            setCurrentPhase(data.phase);
            setProgressMessage(data.message);
          } else if (data.type === "bronze_complete") {
            setProgress(10);
            setProgressMessage(`Found ${data.count} calls`);
          } else if (data.type === "extract_progress") {
            setProgress(Math.round(10 + (data.processed / data.total) * 30));
            setProgressMessage(`Extracting: ${data.processed}/${data.total}`);
          } else if (data.type === "silver_complete") {
            setProgress(40);
            setProgressMessage(`${data.validSales} sales calls found`);
          } else if (data.type === "start") {
            setCurrentPhase('gold');
            setTotalCalls(data.totalCalls);
            setProgress(45);
          } else if (data.type === "call_complete") {
            setProcessedCalls(data.processed);
            collectedCalls.push(data.call);
            setProgress(Math.round(45 + (data.processed / data.total) * 50));
            setProgressMessage(`Analyzing ${data.processed}/${data.total}`);
          } else if (data.type === "complete") {
            finalResult = data.result;
            setProgress(100);
          } else if (data.type === "error") {
            throw new Error(data.message);
          }
        } catch (e) {
          console.error('Parse error:', e);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        lines.forEach(processLine);
      }
      if (buffer.trim()) buffer.split("\n\n").forEach(processLine);

      if (finalResult) {
        setResult(finalResult);
        setActiveTab("dashboard");
      } else if (collectedCalls.length > 0) {
        setResult(buildResultFromCalls(collectedCalls));
        setActiveTab("dashboard");
      } else {
        throw new Error("No results received");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setCurrentPhase(null);
    }
  };

  const hasApiKey = aiModel === "claude" ? !!anthropicKey : !!openaiKey;

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case "upload":
        return <UploadView
          file={file}
          loading={loading}
          progress={progress}
          progressMessage={progressMessage}
          currentPhase={currentPhase}
          error={error}
          aiModel={aiModel}
          setAiModel={setAiModel}
          hasApiKey={hasApiKey}
          onFileChange={handleFileChange}
          onAnalyze={handleAnalyze}
          onOpenSettings={() => setActiveTab("settings")}
        />;
      case "dashboard":
        return result ? <DashboardView result={result} selectedDivision={selectedDivision} setSelectedDivision={setSelectedDivision} /> : <NoDataView onUpload={() => setActiveTab("upload")} />;
      case "calls":
        return result ? <CallsView result={result} expandedCall={expandedCall} setExpandedCall={setExpandedCall} selectedDivision={selectedDivision} setSelectedDivision={setSelectedDivision} /> : <NoDataView onUpload={() => setActiveTab("upload")} />;
      case "reps":
        return result ? <RepsView result={result} selectedDivision={selectedDivision} setSelectedDivision={setSelectedDivision} /> : <NoDataView onUpload={() => setActiveTab("upload")} />;
      case "leads":
        return result ? <LeadsView result={result} selectedDivision={selectedDivision} setSelectedDivision={setSelectedDivision} /> : <NoDataView onUpload={() => setActiveTab("upload")} />;
      case "sources":
        return result ? <SourcesView result={result} /> : <NoDataView onUpload={() => setActiveTab("upload")} />;
      case "settings":
        return <SettingsView
          aiModel={aiModel}
          setAiModel={setAiModel}
          anthropicKey={anthropicKey}
          setAnthropicKey={setAnthropicKey}
          openaiKey={openaiKey}
          setOpenaiKey={setOpenaiKey}
          showAnthropicKey={showAnthropicKey}
          setShowAnthropicKey={setShowAnthropicKey}
          showOpenaiKey={showOpenaiKey}
          setShowOpenaiKey={setShowOpenaiKey}
          onSave={saveApiKeys}
        />;
      default:
        return <UploadView
          file={file}
          loading={loading}
          progress={progress}
          progressMessage={progressMessage}
          currentPhase={currentPhase}
          error={error}
          aiModel={aiModel}
          setAiModel={setAiModel}
          hasApiKey={hasApiKey}
          onFileChange={handleFileChange}
          onAnalyze={handleAnalyze}
          onOpenSettings={() => setActiveTab("settings")}
        />;
    }
  };

  const getHeaderTitle = () => {
    switch (activeTab) {
      case "upload": return "Upload & Analyze";
      case "dashboard": return "Dashboard";
      case "calls": return "Call Details";
      case "reps": return "Rep Performance";
      case "leads": return "Lead Scores";
      case "sources": return "Lead Sources";
      case "settings": return "Settings";
      default: return "Dashboard";
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FE]">
      {/* Welcome Modal */}
      {showWelcome && (
        <WelcomeModal
          anthropicKey={anthropicKey}
          openaiKey={openaiKey}
          onDismiss={dismissWelcome}
        />
      )}

      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} hasResults={!!result} />
      <main className="ml-[260px] min-h-screen transition-all duration-300">
        <DashboardHeader
          title={getHeaderTitle()}
          subtitle={result ? `${result.overallStats.totalCalls} calls analyzed` : undefined}
          aiModel={result ? aiModel : undefined}
        />
        <div className="p-8">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// WELCOME MODAL
// ============================================================================

function WelcomeModal({ anthropicKey, openaiKey, onDismiss }: {
  anthropicKey: string;
  openaiKey: string;
  onDismiss: () => void;
}) {
  const hasKey = !!(anthropicKey || openaiKey);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1B254B]/80 backdrop-blur-sm">
      <div className="bg-white rounded-[20px] shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0f172a] to-[#1e293b] p-8 text-white">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">NWH Call Analytics</h1>
              <p className="text-white/80 text-sm">AI-Powered Sales Intelligence</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* How it works */}
          <div>
            <h2 className="text-sm font-semibold text-[#718096] uppercase tracking-wide mb-3">
              How It Works
            </h2>
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: Key, label: "1. Add API Key", color: "bg-[#f1f5f9] text-[#0f172a]" },
                { icon: Upload, label: "2. Upload File", color: "bg-[#f1f5f9] text-[#0f172a]" },
                { icon: Brain, label: "3. AI Analyzes", color: "bg-[#f1f5f9] text-[#0f172a]" },
                { icon: Download, label: "4. Export Report", color: "bg-[#f1f5f9] text-[#0f172a]" },
              ].map((step, i) => (
                <div key={i} className="text-center p-4 bg-[#F4F7FE] rounded-xl">
                  <div className={`w-10 h-10 ${step.color} rounded-xl flex items-center justify-center mx-auto mb-2`}>
                    <step.icon className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-medium text-[#1B254B]">{step.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* API Key info */}
          <div className="bg-[#FFF6E5] border border-[#FFB547]/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Key className="w-5 h-5 text-[#FFB547] mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-[#1B254B] mb-1">API Key Required</p>
                <p className="text-sm text-[#718096] mb-3">
                  You&apos;ll need an Anthropic or OpenAI API key to analyze calls.
                  {hasKey && <span className="text-[#01B574] font-medium ml-1">&#x2713; Key saved</span>}
                </p>

                {/* API Console Links */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-2 bg-white border border-[#e2e8f0] text-[#1B254B] rounded-lg hover:bg-[#F4F7FE] transition-colors font-medium"
                  >
                    <Zap className="w-3 h-3 text-[#0f172a]" />
                    Anthropic Console
                    <ArrowUpRight className="w-3 h-3" />
                  </a>
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-2 bg-white border border-[#e2e8f0] text-[#1B254B] rounded-lg hover:bg-[#F4F7FE] transition-colors font-medium"
                  >
                    <Bot className="w-3 h-3 text-[#10a37f]" />
                    OpenAI Platform
                    <ArrowUpRight className="w-3 h-3" />
                  </a>
                </div>

                {/* Quick tips */}
                <div className="text-xs text-[#996B00] bg-[#FFB547]/10 rounded-lg p-3 space-y-1">
                  <p className="font-medium flex items-center gap-1"><HelpCircle className="w-3 h-3" /> Quick Start Tips:</p>
                  <ul className="space-y-0.5 text-[#996B00]/80">
                    <li>&#x2022; Add <span className="font-semibold">$5-10</span> credits to your account to get started</li>
                    <li>&#x2022; Analyzing 50 calls typically costs <span className="font-semibold">~$0.50-1</span></li>
                    <li>&#x2022; API keys won&apos;t work without credits added to billing</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Privacy note */}
          <div className="flex items-start gap-3 p-4 bg-[#F4F7FE] rounded-xl">
            <Shield className="w-4 h-4 text-[#0f172a] mt-0.5" />
            <p className="text-sm text-[#718096]">
              <span className="font-medium text-[#1B254B]">Your data stays secure.</span> API keys are stored locally in your browser and sent directly to AI providers. We never store or access your data.
            </p>
          </div>

          {/* CTA Button */}
          <Button
            onClick={onDismiss}
            className="w-full h-12 font-semibold bg-gradient-to-r from-[#0f172a] to-[#1e293b] hover:from-[#0f172a] hover:to-[#334155] rounded-xl text-base shadow-lg shadow-[#0f172a]/25"
          >
            {hasKey ? "Continue to Dashboard" : "Get Started"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// VIEW COMPONENTS
// ============================================================================

function NoDataView({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-20 h-20 rounded-full bg-[#f1f5f9] flex items-center justify-center mb-6">
        <FileSpreadsheet className="w-10 h-10 text-[#0f172a]" />
      </div>
      <h3 className="text-xl font-semibold text-[#1B254B] mb-2">No Data Yet</h3>
      <p className="text-[#718096] mb-6">Upload and analyze a call log to see results</p>
      <Button onClick={onUpload} className="bg-[#0f172a] hover:bg-[#334155]">
        <Upload className="w-4 h-4 mr-2" /> Upload Calls
      </Button>
    </div>
  );
}

function UploadView({
  file, loading, progress, progressMessage, currentPhase, error, aiModel, setAiModel, hasApiKey,
  onFileChange, onAnalyze, onOpenSettings
}: {
  file: File | null;
  loading: boolean;
  progress: number;
  progressMessage: string;
  currentPhase: 'bronze' | 'silver' | 'gold' | null;
  error: string | null;
  aiModel: "claude" | "openai";
  setAiModel: (m: "claude" | "openai") => void;
  hasApiKey: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAnalyze: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Upload Card */}
      <div className="bg-white rounded-[20px] p-8 shadow-sm mb-6">
        <h2 className="text-xl font-bold text-[#1B254B] mb-6">Upload Call Log</h2>

        {/* File Input */}
        <label className={`block border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          file ? "border-[#0f172a] bg-[#f1f5f9]/30" : "border-[#e2e8f0] hover:border-[#0f172a] hover:bg-[#F4F7FE]"
        }`}>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} className="hidden" disabled={loading} />
          <div className="w-16 h-16 rounded-2xl bg-[#f1f5f9] flex items-center justify-center mx-auto mb-4">
            {file ? <CheckCircle className="w-8 h-8 text-[#0f172a]" /> : <Upload className="w-8 h-8 text-[#0f172a]" />}
          </div>
          {file ? (
            <>
              <p className="font-semibold text-[#1B254B]">{file.name}</p>
              <p className="text-sm text-[#718096] mt-1">{(file.size / 1024).toFixed(1)} KB</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-[#1B254B]">Drop your CallRail export here</p>
              <p className="text-sm text-[#718096] mt-1">or click to browse (.xlsx, .xls, .csv)</p>
            </>
          )}
        </label>

        {/* AI Model Selection */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <button
            onClick={() => setAiModel("claude")}
            className={`p-4 rounded-xl border-2 transition-all ${
              aiModel === "claude"
                ? "border-[#0f172a] bg-[#f1f5f9]"
                : "border-[#e2e8f0] hover:border-[#cbd5e0]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${aiModel === "claude" ? "bg-[#0f172a]" : "bg-[#F4F7FE]"}`}>
                <Zap className={`w-5 h-5 ${aiModel === "claude" ? "text-white" : "text-[#718096]"}`} />
              </div>
              <div className="text-left">
                <p className={`font-semibold ${aiModel === "claude" ? "text-[#0f172a]" : "text-[#1B254B]"}`}>Claude Sonnet 4.5</p>
                <p className="text-xs text-[#718096]">Fast & accurate</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setAiModel("openai")}
            className={`p-4 rounded-xl border-2 transition-all ${
              aiModel === "openai"
                ? "border-[#10a37f] bg-[#E6FAF5]"
                : "border-[#e2e8f0] hover:border-[#cbd5e0]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${aiModel === "openai" ? "bg-[#10a37f]" : "bg-[#F4F7FE]"}`}>
                <Bot className={`w-5 h-5 ${aiModel === "openai" ? "text-white" : "text-[#718096]"}`} />
              </div>
              <div className="text-left">
                <p className={`font-semibold ${aiModel === "openai" ? "text-[#10a37f]" : "text-[#1B254B]"}`}>GPT-4.1</p>
                <p className="text-xs text-[#718096]">Alternative model</p>
              </div>
            </div>
          </button>
        </div>

        {/* API Key Warning */}
        {!hasApiKey && (
          <div className="mt-4 p-4 bg-[#FFF6E5] rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-[#FFB547]" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[#1B254B]">API key required</p>
              <p className="text-xs text-[#718096]">Add your {aiModel === "claude" ? "Anthropic" : "OpenAI"} key in settings</p>
            </div>
            <Button variant="outline" size="sm" onClick={onOpenSettings}>
              <Key className="w-4 h-4 mr-1" /> Add Key
            </Button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 bg-[#FFE5E5] rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-[#E31A1A]" />
            <p className="text-sm text-[#E31A1A]">{error}</p>
          </div>
        )}

        {/* Progress */}
        {loading && (
          <div className="mt-6 p-6 bg-[#F4F7FE] rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${
                  currentPhase === 'bronze' ? 'bg-amber-500' :
                  currentPhase === 'silver' ? 'bg-slate-400' : 'bg-[#0f172a]'
                }`} />
                <span className="text-sm font-medium text-[#1B254B]">
                  {currentPhase === 'bronze' ? 'Parsing File' : currentPhase === 'silver' ? 'Extracting Data' : 'AI Analysis'}
                </span>
              </div>
              <span className="text-sm text-[#718096]">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 mb-2" />
            <p className="text-sm text-[#718096]">{progressMessage}</p>
          </div>
        )}

        {/* Analyze Button */}
        <Button
          onClick={onAnalyze}
          disabled={!file || loading || !hasApiKey}
          className="w-full mt-6 h-12 bg-gradient-to-r from-[#0f172a] to-[#1e293b] hover:from-[#0f172a] hover:to-[#334155] text-white font-semibold rounded-xl shadow-lg shadow-[#0f172a]/25"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              Analyzing...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 mr-2" /> Analyze Calls
            </>
          )}
        </Button>
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-[20px] p-6 shadow-sm">
        <h3 className="font-semibold text-[#1B254B] mb-4">How It Works</h3>
        <div className="space-y-4">
          {[
            { icon: FileSpreadsheet, color: "bg-amber-100 text-amber-600", label: "Upload CallRail Export", desc: "Excel file with call transcripts" },
            { icon: Zap, color: "bg-[#f1f5f9] text-[#0f172a]", label: "AI Extraction", desc: "Identify reps, callers, and context" },
            { icon: Target, color: "bg-[#E6FAF5] text-[#01B574]", label: "Score & Analyze", desc: "Lead quality and rep performance" },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl ${step.color} flex items-center justify-center`}>
                <step.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-[#1B254B]">{step.label}</p>
                <p className="text-sm text-[#718096]">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DIVISION FILTER COMPONENT
// ============================================================================

function DivisionFilter({
  selectedDivision,
  setSelectedDivision
}: {
  selectedDivision: Division;
  setSelectedDivision: (d: Division) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const currentDivision = DIVISIONS[selectedDivision];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
          selectedDivision === 'all'
            ? 'border-[#e2e8f0] bg-white hover:bg-[#F4F7FE]'
            : `border-transparent ${currentDivision.bgColor}`
        }`}
      >
        <Filter className={`w-4 h-4 ${selectedDivision === 'all' ? 'text-[#718096]' : currentDivision.color}`} />
        <span className={`font-medium ${selectedDivision === 'all' ? 'text-[#1B254B]' : currentDivision.color}`}>
          {currentDivision.shortName}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''} ${selectedDivision === 'all' ? 'text-[#718096]' : currentDivision.color}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-[#edf2f7] z-40 overflow-hidden">
            {getDivisionOptions().map((div) => (
              <button
                key={div.id}
                onClick={() => {
                  setSelectedDivision(div.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F4F7FE] transition-colors ${
                  selectedDivision === div.id ? 'bg-[#F4F7FE]' : ''
                }`}
              >
                <div className={`w-3 h-3 rounded-full ${div.bgColor}`} />
                <span className="flex-1 text-left font-medium text-[#1B254B]">{div.name}</span>
                {selectedDivision === div.id && (
                  <CheckCircle className="w-4 h-4 text-[#01B574]" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DashboardView({ result, selectedDivision, setSelectedDivision }: {
  result: AnalysisResult;
  selectedDivision: Division;
  setSelectedDivision: (d: Division) => void;
}) {
  // Filter data by division
  const filteredCalls = result.calls.filter(c =>
    repMatchesDivision(c.score.repInfo?.name || c.record.repName, selectedDivision)
  );
  const filteredRepSummaries = result.repSummaries.filter(r =>
    repMatchesDivision(r.repName, selectedDivision)
  );

  // Recalculate stats for filtered data
  const filteredStats = {
    totalCalls: filteredCalls.length,
    averageScore: filteredCalls.length > 0
      ? Math.round((filteredCalls.reduce((sum, c) => sum + c.score.overallScore, 0) / filteredCalls.length) * 10) / 10
      : 0,
    averageLeadScore: filteredCalls.length > 0
      ? Math.round((filteredCalls.reduce((sum, c) => sum + (c.score.leadQuality?.score || 0), 0) / filteredCalls.length) * 10) / 10
      : 0,
    qualifiedLeads: filteredCalls.filter(c => (c.score.leadQuality?.score || 0) >= 7).length,
  };

  const priorityCalls = filteredCalls.filter(c => c.score.leadQuality?.recommendedAction === "priority-1hr");

  return (
    <div className="space-y-6">
      {/* Division Filter */}
      <div className="flex items-center justify-between">
        <DivisionFilter selectedDivision={selectedDivision} setSelectedDivision={setSelectedDivision} />
        {selectedDivision !== 'all' && (
          <p className="text-sm text-[#718096]">
            Showing {filteredCalls.length} of {result.calls.length} calls
          </p>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Calls"
          value={filteredStats.totalCalls}
          subtitle="Analyzed"
          icon={Phone}
          iconBg="bg-[#f1f5f9]"
          iconColor="text-[#0f172a]"
        />
        <MetricCard
          title="Avg Score"
          value={filteredStats.averageScore.toFixed(1)}
          subtitle="Rep performance"
          icon={Star}
          iconBg="bg-[#FFF6E5]"
          iconColor="text-[#FFB547]"
          trend={filteredStats.averageScore >= 7 ? "up" : filteredStats.averageScore >= 5 ? "neutral" : "down"}
          trendValue={filteredStats.averageScore >= 7 ? "Good" : filteredStats.averageScore >= 5 ? "Fair" : "Needs work"}
        />
        <MetricCard
          title="Qualified Leads"
          value={filteredStats.qualifiedLeads}
          subtitle="Score 7+"
          icon={Target}
          iconBg="bg-[#E6FAF5]"
          iconColor="text-[#01B574]"
        />
        <MetricCard
          title="Priority Actions"
          value={priorityCalls.length}
          subtitle="Call within 1hr"
          icon={AlertCircle}
          iconBg="bg-[#E6FAF5]"
          iconColor="text-[#01B574]"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        <div className="bg-white rounded-[20px] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-[#1B254B]">Top Performers</h3>
            <Award className="w-5 h-5 text-[#0f172a]" />
          </div>
          <div className="space-y-4">
            {filteredRepSummaries.slice(0, 5).map((rep, i) => (
              <div key={rep.repName} className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                  i === 0 ? "bg-[#FFF6E5] text-[#FFB547]" : "bg-[#F4F7FE] text-[#718096]"
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[#1B254B]">{rep.repName}</p>
                  <p className="text-sm text-[#718096]">{rep.totalCalls} calls</p>
                </div>
                <div className={`px-3 py-1 rounded-lg font-semibold text-sm ${
                  rep.averageScore >= 8 ? "bg-[#E6FAF5] text-[#01B574]" :
                  rep.averageScore >= 6 ? "bg-[#f1f5f9] text-[#0f172a]" :
                  "bg-[#FFF6E5] text-[#FFB547]"
                }`}>
                  {rep.averageScore.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Needs Coaching */}
        <div className="bg-white rounded-[20px] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-[#1B254B]">Needs Coaching</h3>
            <Brain className="w-5 h-5 text-[#FFB547]" />
          </div>
          <div className="space-y-4">
            {filteredRepSummaries.slice(-5).reverse().filter(rep => rep.averageScore < 7).map((rep, i) => (
              <div key={rep.repName} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm bg-[#FFF6E5] text-[#FFB547]">
                  {rep.repName.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[#1B254B]">{rep.repName}</p>
                  <p className="text-sm text-[#718096]">{rep.weaknesses[0] || "Review calls"}</p>
                </div>
                <div className={`px-3 py-1 rounded-lg font-semibold text-sm ${
                  rep.averageScore >= 5 ? "bg-[#FFF6E5] text-[#FFB547]" : "bg-[#FFE5E5] text-[#E31A1A]"
                }`}>
                  {rep.averageScore.toFixed(1)}
                </div>
              </div>
            ))}
            {filteredRepSummaries.filter(rep => rep.averageScore < 7).length === 0 && (
              <div className="text-center py-8 text-[#718096]">All reps performing well!</div>
            )}
          </div>
        </div>
      </div>

      {/* Team Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[20px] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-[#01B574]" />
            <h3 className="font-bold text-[#1B254B]">Team Strengths</h3>
          </div>
          <ul className="space-y-2">
            {[...new Set(filteredRepSummaries.flatMap(r => r.strengths))].slice(0, 5).map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-[#718096]">
                <span className="mt-0.5 w-5 h-5 bg-[#E6FAF5] text-[#01B574] rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                <span className="text-sm">{s}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-[20px] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-[#FFB547]" />
            <h3 className="font-bold text-[#1B254B]">Areas to Improve</h3>
          </div>
          <ul className="space-y-2">
            {[...new Set(filteredRepSummaries.flatMap(r => r.weaknesses))].slice(0, 5).map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-[#718096]">
                <span className="mt-0.5 w-5 h-5 bg-[#FFF6E5] text-[#FFB547] rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                <span className="text-sm">{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="flex gap-4">
        <Button
          onClick={() => exportToPDF(result)}
          className="bg-white text-[#1B254B] border border-[#e2e8f0] hover:bg-[#F4F7FE]"
        >
          <FileText className="w-4 h-4 mr-2" /> Export PDF
        </Button>
        <Button
          onClick={() => exportToExcel(result)}
          className="bg-white text-[#1B254B] border border-[#e2e8f0] hover:bg-[#F4F7FE]"
        >
          <Table className="w-4 h-4 mr-2" /> Export Excel
        </Button>
      </div>
    </div>
  );
}

function CallsView({ result, expandedCall, setExpandedCall, selectedDivision, setSelectedDivision }: {
  result: AnalysisResult;
  expandedCall: string | null;
  setExpandedCall: (id: string | null) => void;
  selectedDivision: Division;
  setSelectedDivision: (d: Division) => void;
}) {
  const filteredCalls = result.calls.filter(c =>
    repMatchesDivision(c.score.repInfo?.name || c.record.repName, selectedDivision)
  );

  return (
    <div className="space-y-6">
      {/* Division Filter */}
      <div className="flex items-center justify-between">
        <DivisionFilter selectedDivision={selectedDivision} setSelectedDivision={setSelectedDivision} />
        {selectedDivision !== 'all' && (
          <p className="text-sm text-[#718096]">
            Showing {filteredCalls.length} of {result.calls.length} calls
          </p>
        )}
      </div>

      <div className="bg-white rounded-[20px] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#edf2f7]">
          <h3 className="font-bold text-[#1B254B]">All Calls ({filteredCalls.length})</h3>
        </div>
        <div className="divide-y divide-[#edf2f7]">
          {filteredCalls.map((call) => (
          <div key={call.record.id} className="p-6">
            <div
              className="flex items-center gap-4 cursor-pointer"
              onClick={() => setExpandedCall(expandedCall === call.record.id ? null : call.record.id)}
            >
              <ScoreBadge score={call.score.overallScore} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-[#1B254B]">
                    {call.score.repInfo?.name || call.record.repName}
                  </p>
                  <span className="text-xs text-[#a0aec0]">
                    {call.record.callDate ? new Date(call.record.callDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <p className="text-sm text-[#718096] truncate">
                  {call.score.callerInfo?.name || "Unknown caller"} &#x2022; {call.score.callerInfo?.company || "No company"}
                </p>
              </div>
              <div className="text-right">
                <StatusBadge
                  status={call.score.leadQuality?.recommendedAction?.replace(/-/g, ' ') || "N/A"}
                  variant={
                    call.score.leadQuality?.recommendedAction === "priority-1hr" ? "error" :
                    call.score.leadQuality?.recommendedAction === "follow-24hr" ? "warning" :
                    "info"
                  }
                />
                <p className="text-xs text-[#a0aec0] mt-1">{call.record.callDuration}</p>
              </div>
              {expandedCall === call.record.id ? (
                <ChevronUp className="w-5 h-5 text-[#718096]" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[#718096]" />
              )}
            </div>

            {/* Expanded Details */}
            {expandedCall === call.record.id && (
              <div className="mt-4 pt-4 border-t border-[#edf2f7]">
                {/* Call Info Bar */}
                <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-[#F4F7FE] rounded-xl">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#718096]" />
                    <span className="text-sm text-[#1B254B]">{call.record.callDate || "No date"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#718096]" />
                    <span className="text-sm text-[#1B254B]">{call.record.source || "Unknown source"}</span>
                  </div>
                  {call.record.recordingUrl && (
                    <a
                      href={call.record.recordingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-[#0f172a] hover:underline ml-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <PhoneCall className="w-4 h-4" />
                      Listen to Recording
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Score Breakdown Grid */}
                <div className="mb-4">
                  <p className="text-sm font-medium text-[#718096] mb-3">Performance Breakdown</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Info Gathering", score: call.score.informationGathering?.score },
                      { label: "Tone", score: call.score.toneProfessionalism?.score },
                      { label: "Listening", score: call.score.listeningRatio?.score },
                      { label: "Objections", score: call.score.objectionHandling?.score },
                      { label: "Guidance", score: call.score.conversationGuidance?.score },
                      { label: "Next Steps", score: call.score.nextSteps?.score },
                      { label: "Closing", score: call.score.callClosing?.score },
                      { label: "Clarity", score: call.score.objectiveClarity?.score },
                    ].map((item) => (
                      <div key={item.label} className="bg-[#F4F7FE] p-3 rounded-xl text-center">
                        <p className={`text-xl font-bold ${
                          (item.score || 0) >= 8 ? "text-[#01B574]" :
                          (item.score || 0) >= 6 ? "text-[#0f172a]" :
                          (item.score || 0) >= 4 ? "text-[#FFB547]" : "text-[#E31A1A]"
                        }`}>{item.score || "-"}</p>
                        <p className="text-xs text-[#718096]">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Basic Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-[#718096]">Lead Score</p>
                    <p className="font-semibold text-[#1B254B]">{call.score.leadQuality?.score || 0}/10</p>
                  </div>
                  <div>
                    <p className="text-sm text-[#718096]">Timeline</p>
                    <p className="font-semibold text-[#1B254B]">{call.score.leadQuality?.timeline || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-[#718096]">Location</p>
                    <p className="font-semibold text-[#1B254B]">{call.score.callerInfo?.location || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-[#718096]">Phone</p>
                    <p className="font-semibold text-[#1B254B]">{call.score.callerInfo?.phone || "N/A"}</p>
                  </div>
                </div>

                {/* Need Summary */}
                {call.score.callerInfo?.needSummary && (
                  <div className="mb-4 p-3 bg-[#F4F7FE] rounded-xl">
                    <p className="text-sm text-[#718096]">Need</p>
                    <p className="font-medium text-[#1B254B]">{call.score.callerInfo.needSummary}</p>
                  </div>
                )}

                {/* Insights Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {call.score.strengths && call.score.strengths.length > 0 && (
                    <div className="p-4 bg-[#E6FAF5] rounded-xl border border-[#01B574]/20">
                      <p className="text-sm font-medium text-[#01B574] mb-2 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Strengths
                      </p>
                      <ul className="text-sm text-[#1B254B] space-y-1">
                        {call.score.strengths.map((s, i) => <li key={i}>&#x2022; {s}</li>)}
                      </ul>
                    </div>
                  )}
                  {call.score.weaknesses && call.score.weaknesses.length > 0 && (
                    <div className="p-4 bg-[#FFE5E5] rounded-xl border border-[#E31A1A]/20">
                      <p className="text-sm font-medium text-[#E31A1A] mb-2 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> Improve
                      </p>
                      <ul className="text-sm text-[#1B254B] space-y-1">
                        {call.score.weaknesses.map((w, i) => <li key={i}>&#x2022; {w}</li>)}
                      </ul>
                    </div>
                  )}
                  {call.score.coachingInsights && call.score.coachingInsights.length > 0 && (
                    <div className="p-4 bg-[#f1f5f9] rounded-xl border border-[#0f172a]/20">
                      <p className="text-sm font-medium text-[#0f172a] mb-2 flex items-center gap-1">
                        <Brain className="w-4 h-4" /> Coaching
                      </p>
                      <ul className="text-sm text-[#1B254B] space-y-1">
                        {call.score.coachingInsights.map((c, i) => <li key={i}>&#x2022; {c}</li>)}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Transcript */}
                {call.record.transcript && (
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-[#718096] hover:text-[#0f172a] flex items-center gap-2 p-3 bg-[#F4F7FE] rounded-xl">
                      <FileText className="w-4 h-4" />
                      View Transcript
                    </summary>
                    <div className="mt-3 p-4 bg-white rounded-xl border border-[#edf2f7] text-sm text-[#718096] max-h-64 overflow-y-auto font-mono text-xs whitespace-pre-wrap">
                      {call.record.transcript}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}

function RepsView({ result, selectedDivision, setSelectedDivision }: {
  result: AnalysisResult;
  selectedDivision: Division;
  setSelectedDivision: (d: Division) => void;
}) {
  const filteredRepSummaries = result.repSummaries.filter(r =>
    repMatchesDivision(r.repName, selectedDivision)
  );

  return (
    <div className="space-y-6">
      {/* Division Filter */}
      <div className="flex items-center justify-between">
        <DivisionFilter selectedDivision={selectedDivision} setSelectedDivision={setSelectedDivision} />
        {selectedDivision !== 'all' && (
          <p className="text-sm text-[#718096]">
            Showing {filteredRepSummaries.length} of {result.repSummaries.length} reps
          </p>
        )}
      </div>

      {filteredRepSummaries.map((rep) => {
        const divisionInfo = getRepDivisionInfo(rep.repName);
        return (
        <div key={rep.repName} className="bg-white rounded-[20px] p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0f172a] to-[#1e293b] flex items-center justify-center">
              <span className="text-white font-bold text-xl">{rep.repName.charAt(0)}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-bold text-[#1B254B]">{rep.repName}</h3>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${divisionInfo.bgColor} ${divisionInfo.color}`}>
                  {divisionInfo.shortName}
                </span>
              </div>
              <p className="text-[#718096]">{rep.totalCalls} calls analyzed</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-[#1B254B]">{rep.averageScore.toFixed(1)}</p>
              <p className="text-sm text-[#718096]">Avg Score</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-[#F4F7FE] rounded-xl">
              <p className="text-sm text-[#718096]">Lead Score Avg</p>
              <p className="text-2xl font-bold text-[#1B254B]">{rep.averageLeadScore.toFixed(1)}</p>
            </div>
            <div className="p-4 bg-[#f1f5f9] rounded-xl">
              <p className="text-sm text-[#718096]">Qualified Leads</p>
              <p className="text-2xl font-bold text-[#0f172a]">{rep.qualifiedLeads}</p>
            </div>
          </div>
          {rep.strengths.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-[#718096] mb-2">Key Strengths</p>
              <div className="flex flex-wrap gap-2">
                {rep.strengths.map((s, i) => (
                  <span key={i} className="px-3 py-1 bg-[#E6FAF5] text-[#01B574] text-sm rounded-lg">{s}</span>
                ))}
              </div>
            </div>
          )}
          {rep.weaknesses.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-[#718096] mb-2">Areas to Improve</p>
              <div className="flex flex-wrap gap-2">
                {rep.weaknesses.map((w, i) => (
                  <span key={i} className="px-3 py-1 bg-[#FFF6E5] text-[#FFB547] text-sm rounded-lg">{w}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      );
      })}
    </div>
  );
}

function LeadsView({ result, selectedDivision, setSelectedDivision }: {
  result: AnalysisResult;
  selectedDivision: Division;
  setSelectedDivision: (d: Division) => void;
}) {
  const filteredCalls = result.calls.filter(c =>
    repMatchesDivision(c.score.repInfo?.name || c.record.repName, selectedDivision)
  );
  const sortedCalls = [...filteredCalls].sort((a, b) =>
    (b.score.leadQuality?.score || 0) - (a.score.leadQuality?.score || 0)
  );

  return (
    <div className="space-y-6">
      {/* Division Filter */}
      <div className="flex items-center justify-between">
        <DivisionFilter selectedDivision={selectedDivision} setSelectedDivision={setSelectedDivision} />
        {selectedDivision !== 'all' && (
          <p className="text-sm text-[#718096]">
            Showing {filteredCalls.length} of {result.calls.length} leads
          </p>
        )}
      </div>

      <div className="bg-white rounded-[20px] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#edf2f7]">
          <h3 className="font-bold text-[#1B254B]">Lead Scores (Highest First)</h3>
        </div>
        <div className="divide-y divide-[#edf2f7]">
          {sortedCalls.map((call) => {
          const score = call.score.leadQuality?.score || 0;
          return (
            <div key={call.record.id} className="p-6 flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl ${
                score >= 9 ? "bg-gradient-to-br from-[#E31A1A] to-[#FF6B6B] text-white" :
                score >= 7 ? "bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white" :
                score >= 5 ? "bg-[#FFF6E5] text-[#FFB547]" :
                "bg-[#F4F7FE] text-[#718096]"
              }`}>
                {score}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#1B254B]">
                  {call.score.callerInfo?.name || call.score.callerInfo?.company || "Unknown"}
                </p>
                <p className="text-sm text-[#718096] truncate">
                  {call.score.callerInfo?.needSummary || "No details"}
                </p>
                <p className="text-xs text-[#a0aec0]">
                  Rep: {call.score.repInfo?.name || call.record.repName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-[#718096]">{call.score.leadQuality?.timeline || "Unknown"}</p>
                <StatusBadge
                  status={call.score.leadQuality?.serviceFit || "Unknown"}
                  variant={
                    call.score.leadQuality?.serviceFit === "perfect" ? "success" :
                    call.score.leadQuality?.serviceFit === "good" ? "info" :
                    "warning"
                  }
                />
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SOURCES VIEW - Lead Source Quality Scoring
// ============================================================================

interface SourceStats {
  source: string;
  totalCalls: number;
  avgLeadScore: number;
  avgRepScore: number;
  qualifiedLeads: number;
  spamCalls: number;
  avgDuration: number;
  topReps: string[];
}

function SourcesView({ result }: { result: AnalysisResult }) {
  // Aggregate calls by source
  const sourceMap = new Map<string, AnalyzedCall[]>();
  for (const call of result.calls) {
    const source = call.record.source || "Unknown";
    if (!sourceMap.has(source)) sourceMap.set(source, []);
    sourceMap.get(source)!.push(call);
  }

  // Calculate stats for each source
  const sourceStats: SourceStats[] = [];
  for (const [source, calls] of sourceMap.entries()) {
    const leadScores = calls.map(c => c.score.leadQuality?.score || 0);
    const repScores = calls.map(c => c.score.overallScore);
    const avgLeadScore = leadScores.length > 0 ? leadScores.reduce((a, b) => a + b, 0) / leadScores.length : 0;
    const avgRepScore = repScores.length > 0 ? repScores.reduce((a, b) => a + b, 0) / repScores.length : 0;
    const qualifiedLeads = leadScores.filter(s => s >= 7).length;
    const spamCalls = calls.filter(c =>
      c.score.leadQuality?.redFlags?.some(f => f.toLowerCase().includes('spam')) ||
      c.score.leadQuality?.serviceFit === 'mismatch'
    ).length;

    // Get avg duration from record
    const durations = calls.map(c => {
      const parts = (c.record.callDuration || "0:00").split(":");
      return parseInt(parts[0]) * 60 + parseInt(parts[1] || "0");
    });
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    // Top reps for this source
    const repCounts = new Map<string, number>();
    for (const call of calls) {
      const rep = call.score.repInfo?.name || call.record.repName;
      repCounts.set(rep, (repCounts.get(rep) || 0) + 1);
    }
    const topReps = [...repCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    sourceStats.push({
      source,
      totalCalls: calls.length,
      avgLeadScore: Math.round(avgLeadScore * 10) / 10,
      avgRepScore: Math.round(avgRepScore * 10) / 10,
      qualifiedLeads,
      spamCalls,
      avgDuration: Math.round(avgDuration),
      topReps,
    });
  }

  // Sort by avg lead score descending
  sourceStats.sort((a, b) => b.avgLeadScore - a.avgLeadScore);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-[20px] p-6 shadow-sm">
          <p className="text-sm text-[#718096]">Total Sources</p>
          <p className="text-3xl font-bold text-[#1B254B]">{sourceStats.length}</p>
        </div>
        <div className="bg-white rounded-[20px] p-6 shadow-sm">
          <p className="text-sm text-[#718096]">Best Source</p>
          <p className="text-xl font-bold text-[#01B574]">{sourceStats[0]?.source || "N/A"}</p>
          <p className="text-sm text-[#718096]">Avg Lead Score: {sourceStats[0]?.avgLeadScore || 0}</p>
        </div>
        <div className="bg-white rounded-[20px] p-6 shadow-sm">
          <p className="text-sm text-[#718096]">Needs Review</p>
          <p className="text-xl font-bold text-[#FFB547]">{sourceStats[sourceStats.length - 1]?.source || "N/A"}</p>
          <p className="text-sm text-[#718096]">Avg Lead Score: {sourceStats[sourceStats.length - 1]?.avgLeadScore || 0}</p>
        </div>
      </div>

      {/* Source Table */}
      <div className="bg-white rounded-[20px] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#edf2f7]">
          <h3 className="font-bold text-[#1B254B]">Lead Source Performance</h3>
          <p className="text-sm text-[#718096]">Quality metrics by marketing channel</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F4F7FE]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#718096] uppercase">Source</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-[#718096] uppercase">Calls</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-[#718096] uppercase">Lead Score</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-[#718096] uppercase">Qualified</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-[#718096] uppercase">Spam/Bad</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-[#718096] uppercase">Avg Duration</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#718096] uppercase">Top Reps</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf2f7]">
              {sourceStats.map((stat) => (
                <tr key={stat.source} className="hover:bg-[#F4F7FE]/50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-[#1B254B]">{stat.source}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-semibold text-[#1B254B]">{stat.totalCalls}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex px-3 py-1 rounded-lg font-bold text-sm ${
                      stat.avgLeadScore >= 7 ? "bg-[#E6FAF5] text-[#01B574]" :
                      stat.avgLeadScore >= 5 ? "bg-[#f1f5f9] text-[#0f172a]" :
                      stat.avgLeadScore >= 3 ? "bg-[#FFF6E5] text-[#FFB547]" :
                      "bg-[#FFE5E5] text-[#E31A1A]"
                    }`}>
                      {stat.avgLeadScore}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[#01B574] font-semibold">{stat.qualifiedLeads}</span>
                    <span className="text-[#a0aec0] text-sm ml-1">({Math.round(stat.qualifiedLeads / stat.totalCalls * 100)}%)</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[#E31A1A] font-semibold">{stat.spamCalls}</span>
                    <span className="text-[#a0aec0] text-sm ml-1">({Math.round(stat.spamCalls / stat.totalCalls * 100)}%)</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[#718096]">{formatDuration(stat.avgDuration)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {stat.topReps.map((rep, i) => (
                        <span key={i} className="text-xs px-2 py-1 bg-[#F4F7FE] text-[#718096] rounded">
                          {rep}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Source Quality Guide */}
      <div className="bg-white rounded-[20px] p-6 shadow-sm">
        <h3 className="font-bold text-[#1B254B] mb-4">Understanding Source Quality</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-[#E6FAF5] rounded-xl">
            <p className="font-semibold text-[#01B574] mb-2">Good Sources (7+ Lead Score)</p>
            <ul className="text-sm text-[#718096] space-y-1">
              <li>&#x2022; High percentage of qualified leads</li>
              <li>&#x2022; Low spam/wrong service calls</li>
              <li>&#x2022; Longer average call duration</li>
            </ul>
          </div>
          <div className="p-4 bg-[#FFE5E5] rounded-xl">
            <p className="font-semibold text-[#E31A1A] mb-2">Poor Sources (Below 4 Lead Score)</p>
            <ul className="text-sm text-[#718096] space-y-1">
              <li>&#x2022; High spam or wrong number rate</li>
              <li>&#x2022; Short call durations (hangups)</li>
              <li>&#x2022; Callers looking for other services</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsView({
  aiModel, setAiModel, anthropicKey, setAnthropicKey, openaiKey, setOpenaiKey,
  showAnthropicKey, setShowAnthropicKey, showOpenaiKey, setShowOpenaiKey, onSave
}: {
  aiModel: "claude" | "openai";
  setAiModel: (m: "claude" | "openai") => void;
  anthropicKey: string;
  setAnthropicKey: (k: string) => void;
  openaiKey: string;
  setOpenaiKey: (k: string) => void;
  showAnthropicKey: boolean;
  setShowAnthropicKey: (s: boolean) => void;
  showOpenaiKey: boolean;
  setShowOpenaiKey: (s: boolean) => void;
  onSave: () => void;
}) {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* API Keys Card */}
      <div className="bg-white rounded-[20px] p-6 shadow-sm">
        <h3 className="font-bold text-[#1B254B] mb-2">API Configuration</h3>
        <p className="text-sm text-[#718096] mb-4">
          Keys are stored locally in your browser and sent directly to AI providers.
        </p>

        {/* Quick Links */}
        <div className="flex flex-wrap gap-2 mb-6">
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 bg-[#f1f5f9] text-[#0f172a] rounded-lg hover:bg-[#0f172a] hover:text-white transition-colors font-medium"
          >
            <Zap className="w-3 h-3" />
            Anthropic Console
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 bg-[#E6FAF5] text-[#10a37f] rounded-lg hover:bg-[#10a37f] hover:text-white transition-colors font-medium"
          >
            <Bot className="w-3 h-3" />
            OpenAI Platform
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Anthropic Key */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#1B254B] mb-2">
            Anthropic API Key (for Claude)
          </label>
          <div className="relative">
            <input
              type={showAnthropicKey ? "text" : "password"}
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full h-12 px-4 pr-12 bg-white text-[#1B254B] border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 focus:border-[#0f172a] placeholder:text-[#a0aec0]"
            />
            <button
              onClick={() => setShowAnthropicKey(!showAnthropicKey)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#718096] hover:text-[#1B254B]"
            >
              {showAnthropicKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {anthropicKey && (
            <p className="text-xs text-[#01B574] flex items-center gap-1 mt-1">
              <CheckCircle className="w-3 h-3" /> Saved locally
            </p>
          )}
        </div>

        {/* OpenAI Key */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#1B254B] mb-2">
            OpenAI API Key (for GPT-4)
          </label>
          <div className="relative">
            <input
              type={showOpenaiKey ? "text" : "password"}
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full h-12 px-4 pr-12 bg-white text-[#1B254B] border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 focus:border-[#0f172a] placeholder:text-[#a0aec0]"
            />
            <button
              onClick={() => setShowOpenaiKey(!showOpenaiKey)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#718096] hover:text-[#1B254B]"
            >
              {showOpenaiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {openaiKey && (
            <p className="text-xs text-[#01B574] flex items-center gap-1 mt-1">
              <CheckCircle className="w-3 h-3" /> Saved locally
            </p>
          )}
        </div>

        <Button onClick={handleSave} className="w-full h-12 bg-gradient-to-r from-[#0f172a] to-[#1e293b] hover:from-[#0f172a] hover:to-[#334155]">
          <CheckCircle className="w-5 h-5 mr-2" /> Save Settings
        </Button>

        {/* Success Message */}
        {saved && (
          <div className="mt-4 p-4 bg-[#E6FAF5] border border-[#01B574]/30 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <CheckCircle className="w-5 h-5 text-[#01B574]" />
            <p className="text-sm font-medium text-[#01B574]">Settings saved successfully!</p>
          </div>
        )}
      </div>

      {/* Cost & Tips Card */}
      <div className="bg-white rounded-[20px] p-6 shadow-sm">
        <h3 className="font-bold text-[#1B254B] mb-4">Pricing & Tips</h3>

        {/* Pricing table */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between py-2">
            <span className="text-[#718096]">Extraction (per call)</span>
            <span className="font-medium text-[#1B254B]">~$0.001</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-[#718096]">Analysis (per call)</span>
            <span className="font-medium text-[#1B254B]">~$0.01</span>
          </div>
          <div className="flex justify-between pt-3 border-t border-[#edf2f7]">
            <span className="font-medium text-[#1B254B]">50 calls total</span>
            <span className="font-bold text-[#01B574]">~$0.50-1</span>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-[#FFF6E5] rounded-xl p-4">
          <p className="text-sm font-medium text-[#996B00] mb-2 flex items-center gap-1">
            <HelpCircle className="w-4 h-4" /> Quick Tips
          </p>
          <ul className="text-sm text-[#996B00]/80 space-y-1">
            <li>&#x2022; Add <span className="font-semibold">$5-10</span> credits to get started</li>
            <li>&#x2022; API keys don&apos;t work without billing credits</li>
            <li>&#x2022; Claude Sonnet 4.5 is recommended (faster, cheaper)</li>
            <li>&#x2022; Keep uploads under 100 calls to avoid timeouts</li>
          </ul>
        </div>
      </div>

      {/* Privacy Card */}
      <div className="bg-white rounded-[20px] p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-[#0f172a] mt-0.5" />
          <div>
            <h3 className="font-bold text-[#1B254B] mb-1">Privacy & Security</h3>
            <p className="text-sm text-[#718096]">
              Your data stays secure. API keys are stored locally in your browser and sent directly to AI providers. We never store, log, or access your call data or API keys on any server.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
