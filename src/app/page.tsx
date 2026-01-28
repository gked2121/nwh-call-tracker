"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AnalysisResult, AnalyzedCall, RepSummary } from "@/types/call";
import { Sidebar, DashboardHeader, MetricCard, DataTable, ScoreBadge, StatusBadge } from "@/components/layout";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";
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
        return result ? <DashboardView result={result} /> : <NoDataView onUpload={() => setActiveTab("upload")} />;
      case "calls":
        return result ? <CallsView result={result} expandedCall={expandedCall} setExpandedCall={setExpandedCall} /> : <NoDataView onUpload={() => setActiveTab("upload")} />;
      case "reps":
        return result ? <RepsView result={result} /> : <NoDataView onUpload={() => setActiveTab("upload")} />;
      case "leads":
        return result ? <LeadsView result={result} /> : <NoDataView onUpload={() => setActiveTab("upload")} />;
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
      <main className="ml-[280px] min-h-screen transition-all duration-300">
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
        <div className="bg-gradient-to-r from-[#7551FF] to-[#422AFB] p-8 text-white">
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
                { icon: Key, label: "1. Add API Key", color: "bg-[#E9E3FF] text-[#422AFB]" },
                { icon: Upload, label: "2. Upload File", color: "bg-[#E9E3FF] text-[#422AFB]" },
                { icon: Brain, label: "3. AI Analyzes", color: "bg-[#E9E3FF] text-[#422AFB]" },
                { icon: Download, label: "4. Export Report", color: "bg-[#E9E3FF] text-[#422AFB]" },
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
                    <Zap className="w-3 h-3 text-[#422AFB]" />
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
            <Shield className="w-4 h-4 text-[#422AFB] mt-0.5" />
            <p className="text-sm text-[#718096]">
              <span className="font-medium text-[#1B254B]">Your data stays secure.</span> API keys are stored locally in your browser and sent directly to AI providers. We never store or access your data.
            </p>
          </div>

          {/* CTA Button */}
          <Button
            onClick={onDismiss}
            className="w-full h-12 font-semibold bg-gradient-to-r from-[#7551FF] to-[#422AFB] hover:from-[#422AFB] hover:to-[#3311DB] rounded-xl text-base shadow-lg shadow-[#422AFB]/25"
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
      <div className="w-20 h-20 rounded-full bg-[#E9E3FF] flex items-center justify-center mb-6">
        <FileSpreadsheet className="w-10 h-10 text-[#422AFB]" />
      </div>
      <h3 className="text-xl font-semibold text-[#1B254B] mb-2">No Data Yet</h3>
      <p className="text-[#718096] mb-6">Upload and analyze a call log to see results</p>
      <Button onClick={onUpload} className="bg-[#422AFB] hover:bg-[#3311DB]">
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
          file ? "border-[#422AFB] bg-[#E9E3FF]/30" : "border-[#e2e8f0] hover:border-[#422AFB] hover:bg-[#F4F7FE]"
        }`}>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} className="hidden" disabled={loading} />
          <div className="w-16 h-16 rounded-2xl bg-[#E9E3FF] flex items-center justify-center mx-auto mb-4">
            {file ? <CheckCircle className="w-8 h-8 text-[#422AFB]" /> : <Upload className="w-8 h-8 text-[#422AFB]" />}
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
                ? "border-[#422AFB] bg-[#E9E3FF]"
                : "border-[#e2e8f0] hover:border-[#cbd5e0]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${aiModel === "claude" ? "bg-[#422AFB]" : "bg-[#F4F7FE]"}`}>
                <Zap className={`w-5 h-5 ${aiModel === "claude" ? "text-white" : "text-[#718096]"}`} />
              </div>
              <div className="text-left">
                <p className={`font-semibold ${aiModel === "claude" ? "text-[#422AFB]" : "text-[#1B254B]"}`}>Claude Sonnet 4.5</p>
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
                  currentPhase === 'silver' ? 'bg-slate-400' : 'bg-[#422AFB]'
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
          className="w-full mt-6 h-12 bg-gradient-to-r from-[#7551FF] to-[#422AFB] hover:from-[#422AFB] hover:to-[#3311DB] text-white font-semibold rounded-xl shadow-lg shadow-[#422AFB]/25"
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
            { icon: Zap, color: "bg-[#E9E3FF] text-[#422AFB]", label: "AI Extraction", desc: "Identify reps, callers, and context" },
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

function DashboardView({ result }: { result: AnalysisResult }) {
  const { overallStats, repSummaries, calls } = result;
  const hotLeads = calls.filter(c => (c.score.leadQuality?.score || 0) >= 9);
  const priorityCalls = calls.filter(c => c.score.leadQuality?.recommendedAction === "priority-1hr");

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Calls"
          value={overallStats.totalCalls}
          subtitle="Analyzed"
          icon={Phone}
          iconBg="bg-[#E9E3FF]"
          iconColor="text-[#422AFB]"
        />
        <MetricCard
          title="Avg Score"
          value={overallStats.averageScore.toFixed(1)}
          subtitle="Rep performance"
          icon={Star}
          iconBg="bg-[#FFF6E5]"
          iconColor="text-[#FFB547]"
          trend={overallStats.averageScore >= 7 ? "up" : overallStats.averageScore >= 5 ? "neutral" : "down"}
          trendValue={overallStats.averageScore >= 7 ? "Good" : overallStats.averageScore >= 5 ? "Fair" : "Needs work"}
        />
        <MetricCard
          title="Hot Leads"
          value={overallStats.hotLeads}
          subtitle="Score 9+"
          icon={Flame}
          iconBg="bg-[#FFE5E5]"
          iconColor="text-[#E31A1A]"
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
            <Award className="w-5 h-5 text-[#422AFB]" />
          </div>
          <div className="space-y-4">
            {repSummaries.slice(0, 5).map((rep, i) => (
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
                  rep.averageScore >= 6 ? "bg-[#E9E3FF] text-[#422AFB]" :
                  "bg-[#FFF6E5] text-[#FFB547]"
                }`}>
                  {rep.averageScore.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hot Leads */}
        <div className="bg-white rounded-[20px] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-[#1B254B]">Hot Leads</h3>
            <Flame className="w-5 h-5 text-[#E31A1A]" />
          </div>
          {hotLeads.length > 0 ? (
            <div className="space-y-4">
              {hotLeads.slice(0, 5).map((call) => (
                <div key={call.record.id} className="flex items-center gap-4 p-3 bg-[#F4F7FE] rounded-xl">
                  <div className="w-10 h-10 rounded-xl bg-[#FFE5E5] flex items-center justify-center">
                    <Flame className="w-5 h-5 text-[#E31A1A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1B254B] truncate">
                      {call.score.callerInfo?.name || call.score.callerInfo?.company || "Unknown"}
                    </p>
                    <p className="text-sm text-[#718096] truncate">
                      {call.score.callerInfo?.needSummary || "No details"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#E31A1A]">{call.score.leadQuality?.score || 0}</p>
                    <p className="text-xs text-[#718096]">Lead Score</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[#718096]">No hot leads found</div>
          )}
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
            {[...new Set(result.repSummaries.flatMap(r => r.strengths))].slice(0, 5).map((s, i) => (
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
            {[...new Set(result.repSummaries.flatMap(r => r.weaknesses))].slice(0, 5).map((w, i) => (
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

function CallsView({ result, expandedCall, setExpandedCall }: {
  result: AnalysisResult;
  expandedCall: string | null;
  setExpandedCall: (id: string | null) => void;
}) {
  return (
    <div className="bg-white rounded-[20px] shadow-sm overflow-hidden">
      <div className="p-6 border-b border-[#edf2f7]">
        <h3 className="font-bold text-[#1B254B]">All Calls ({result.calls.length})</h3>
      </div>
      <div className="divide-y divide-[#edf2f7]">
        {result.calls.map((call) => (
          <div key={call.record.id} className="p-6">
            <div
              className="flex items-center gap-4 cursor-pointer"
              onClick={() => setExpandedCall(expandedCall === call.record.id ? null : call.record.id)}
            >
              <ScoreBadge score={call.score.overallScore} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#1B254B]">
                  {call.score.repInfo?.name || call.record.repName}
                </p>
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
                          (item.score || 0) >= 6 ? "text-[#422AFB]" :
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
                    <div className="p-4 bg-[#E9E3FF] rounded-xl border border-[#422AFB]/20">
                      <p className="text-sm font-medium text-[#422AFB] mb-2 flex items-center gap-1">
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
                    <summary className="cursor-pointer text-sm font-medium text-[#718096] hover:text-[#422AFB] flex items-center gap-2 p-3 bg-[#F4F7FE] rounded-xl">
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
  );
}

function RepsView({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-6">
      {result.repSummaries.map((rep) => (
        <div key={rep.repName} className="bg-white rounded-[20px] p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7551FF] to-[#422AFB] flex items-center justify-center">
              <span className="text-white font-bold text-xl">{rep.repName.charAt(0)}</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-[#1B254B]">{rep.repName}</h3>
              <p className="text-[#718096]">{rep.totalCalls} calls analyzed</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-[#1B254B]">{rep.averageScore.toFixed(1)}</p>
              <p className="text-sm text-[#718096]">Avg Score</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-[#F4F7FE] rounded-xl">
              <p className="text-sm text-[#718096]">Lead Score Avg</p>
              <p className="text-2xl font-bold text-[#1B254B]">{rep.averageLeadScore.toFixed(1)}</p>
            </div>
            <div className="p-4 bg-[#E6FAF5] rounded-xl">
              <p className="text-sm text-[#718096]">Hot Leads</p>
              <p className="text-2xl font-bold text-[#01B574]">{rep.hotLeads}</p>
            </div>
            <div className="p-4 bg-[#E9E3FF] rounded-xl">
              <p className="text-sm text-[#718096]">Qualified</p>
              <p className="text-2xl font-bold text-[#422AFB]">{rep.qualifiedLeads}</p>
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
      ))}
    </div>
  );
}

function LeadsView({ result }: { result: AnalysisResult }) {
  const sortedCalls = [...result.calls].sort((a, b) =>
    (b.score.leadQuality?.score || 0) - (a.score.leadQuality?.score || 0)
  );

  return (
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
                score >= 7 ? "bg-gradient-to-br from-[#7551FF] to-[#422AFB] text-white" :
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
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 bg-[#E9E3FF] text-[#422AFB] rounded-lg hover:bg-[#422AFB] hover:text-white transition-colors font-medium"
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
              className="w-full h-12 px-4 pr-12 bg-white text-[#1B254B] border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#422AFB]/20 focus:border-[#422AFB] placeholder:text-[#a0aec0]"
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
              className="w-full h-12 px-4 pr-12 bg-white text-[#1B254B] border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#422AFB]/20 focus:border-[#422AFB] placeholder:text-[#a0aec0]"
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

        <Button onClick={onSave} className="w-full h-12 bg-gradient-to-r from-[#7551FF] to-[#422AFB] hover:from-[#422AFB] hover:to-[#3311DB]">
          <CheckCircle className="w-5 h-5 mr-2" /> Save Settings
        </Button>
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
          <Shield className="w-5 h-5 text-[#422AFB] mt-0.5" />
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
