"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AnalysisResult, AnalyzedCall } from "@/types/call";
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
  Bot,
  Download,
  FileText,
  Table,
  Key,
  Settings,
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
  LayoutDashboard,
  List,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Award,
  Calendar,
  Filter,
  HelpCircle,
  Layers,
  Brain,
  MessageSquare,
  ThumbsUp,
  XCircle,
  Info,
} from "lucide-react";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";
import { RepSummary } from "@/types/call";

// Helper function to build result from collected calls (fallback if complete event fails to parse)
function buildResultFromCalls(calls: AnalyzedCall[]): AnalysisResult {
  // Generate rep summaries
  const repMap = new Map<string, AnalyzedCall[]>();
  for (const call of calls) {
    const repName = call.score.repInfo?.name || call.record.repName;
    if (!repMap.has(repName)) {
      repMap.set(repName, []);
    }
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
      for (const s of call.score.strengths || []) {
        strengthCounts.set(s, (strengthCounts.get(s) || 0) + 1);
      }
      for (const w of call.score.weaknesses || []) {
        weaknessCounts.set(w, (weaknessCounts.get(w) || 0) + 1);
      }
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

  // Calculate overall stats
  const allScores = calls.map(c => c.score.overallScore);
  const allLeadScores = calls.map(c => c.score.leadQuality?.score || 0);
  const overallStats = {
    totalCalls: calls.length,
    averageScore: allScores.length > 0 ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10 : 0,
    averageLeadScore: allLeadScores.length > 0 ? Math.round((allLeadScores.reduce((a, b) => a + b, 0) / allLeadScores.length) * 10) / 10 : 0,
    topPerformer: repSummaries[0]?.repName || 'N/A',
    needsImprovement: repSummaries[repSummaries.length - 1]?.repName || 'N/A',
    hotLeads: allLeadScores.filter(s => s >= 9).length,
    qualifiedLeads: allLeadScores.filter(s => s >= 7 && s < 9).length,
    redFlagCalls: calls.filter(c => (c.score.leadQuality?.redFlags?.length || 0) > 0).length,
    totalInFile: calls.length,
    ivrCalls: 0,
    spamCalls: 0,
  };

  return { calls, repSummaries, overallStats };
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [aiModel, setAiModel] = useState<"claude" | "openai">("claude");
  const [expandedCall, setExpandedCall] = useState<string | null>(null);

  // API Keys
  const [showSettings, setShowSettings] = useState(false);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);

  // Live streaming progress
  const [processedCalls, setProcessedCalls] = useState<number>(0);
  const [totalCalls, setTotalCalls] = useState<number>(0);
  const [liveResults, setLiveResults] = useState<AnalyzedCall[]>([]);

  // Dashboard view state
  const [activeView, setActiveView] = useState<'dashboard' | 'calls'>('dashboard');

  // Welcome modal state
  const [showWelcome, setShowWelcome] = useState(false);

  // Multi-layer progress
  const [currentPhase, setCurrentPhase] = useState<'bronze' | 'silver' | 'gold' | null>(null);
  const [extractionStats, setExtractionStats] = useState<{
    totalCalls: number;
    validSales: number;
    skipped: number;
    uniqueReps: string[];
  } | null>(null);

  // Load saved keys from localStorage
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
      setShowSettings(true);
    }
  };

  const saveApiKeys = () => {
    localStorage.setItem("anthropic_api_key", anthropicKey);
    localStorage.setItem("openai_api_key", openaiKey);
    setShowSettings(false);
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
      setShowSettings(true);
      return;
    }

    setLoading(true);
    setProgress(5);
    setProgressMessage("Parsing Excel file...");
    setError(null);
    setProcessedCalls(0);
    setTotalCalls(0);
    setLiveResults([]);
    setCurrentPhase('bronze');
    setExtractionStats(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", aiModel);
      formData.append("apiKey", currentKey);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Analysis failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult: AnalysisResult | null = null;
      let serverError: string | null = null;
      const collectedCalls: AnalyzedCall[] = [];

      const processLine = (line: string) => {
        if (!line.startsWith("data: ")) return;

        try {
          const data = JSON.parse(line.slice(6));

          // Multi-layer progress events
          if (data.type === "status") {
            setCurrentPhase(data.phase);
            setProgressMessage(data.message);
          } else if (data.type === "bronze_complete") {
            setProgress(10);
            setProgressMessage(`Found ${data.count} calls in file`);
          } else if (data.type === "extract_progress") {
            const pct = Math.round(10 + (data.processed / data.total) * 30);
            setProgress(pct);
            setProgressMessage(`Extracting: ${data.processed}/${data.total} (${data.repName || 'Unknown rep'})`);
          } else if (data.type === "silver_complete") {
            setExtractionStats({
              totalCalls: data.totalCalls,
              validSales: data.validSales,
              skipped: data.skipped,
              uniqueReps: data.uniqueReps,
            });
            setProgress(40);
            setProgressMessage(`Extraction complete: ${data.validSales} sales calls, ${data.uniqueReps?.length || 0} reps`);
          } else if (data.type === "start") {
            setCurrentPhase('gold');
            setTotalCalls(data.totalCalls);
            setProgressMessage(`Analyzing ${data.totalCalls} calls with AI...`);
            setProgress(45);
          } else if (data.type === "call_complete") {
            setProcessedCalls(data.processed);
            // Collect calls for fallback result building
            collectedCalls.push(data.call);
            setLiveResults((prev) => [...prev, data.call]);
            const pct = Math.round(45 + (data.processed / data.total) * 50);
            setProgress(pct);
            setProgressMessage(`Analyzing ${data.processed}/${data.total} calls...`);
          } else if (data.type === "call_error") {
            setProcessedCalls(data.processed);
            const pct = Math.round(45 + (data.processed / data.total) * 50);
            setProgress(pct);
            setProgressMessage(`Analyzing ${data.processed}/${data.total} calls (1 error)...`);
          } else if (data.type === "complete") {
            console.log('Received complete event, result:', data.result ? 'present' : 'missing');
            finalResult = data.result;
            setProgress(100);
            setProgressMessage("Complete!");
          } else if (data.type === "error") {
            serverError = data.message;
          }
        } catch (parseErr) {
          console.error('Failed to parse SSE message:', line.substring(0, 200), parseErr);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          processLine(line);
        }
      }

      // Process any remaining data in buffer after stream ends
      if (buffer.trim()) {
        const remainingLines = buffer.split("\n\n");
        for (const line of remainingLines) {
          processLine(line);
        }
      }

      // Check for server error
      if (serverError) {
        throw new Error(serverError);
      }

      // Set result - use finalResult if available, otherwise build from collected calls
      if (finalResult) {
        console.log('Setting result from complete event');
        setResult(finalResult);
      } else if (collectedCalls.length > 0) {
        // Fallback: build result from collected call_complete events
        console.log('Building result from collected calls (fallback)');
        const fallbackResult = buildResultFromCalls(collectedCalls);
        setResult(fallbackResult);
      } else {
        throw new Error("Analysis completed but no results received");
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setLiveResults([]);
      setCurrentPhase(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-emerald-600";
    if (score >= 6) return "text-amber-600";
    return "text-red-600";
  };

  const getScoreBg = (score: number) => {
    if (score >= 8) return "bg-emerald-500";
    if (score >= 6) return "bg-amber-500";
    return "bg-red-500";
  };

  const getActionStyles = (action: string | undefined) => {
    switch (action) {
      case "priority-1hr":
        return "bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/30";
      case "follow-24hr":
        return "bg-gradient-to-r from-orange-400 to-amber-400 text-white";
      case "nurture-48-72hr":
        return "bg-gradient-to-r from-yellow-400 to-lime-400 text-slate-800";
      case "email-only":
        return "bg-slate-200 text-slate-600";
      default:
        return "bg-slate-100 text-slate-500";
    }
  };

  const getActionLabel = (action: string | undefined) => {
    switch (action) {
      case "priority-1hr": return "Call Now";
      case "follow-24hr": return "Follow Up 24hr";
      case "nurture-48-72hr": return "Nurture";
      case "email-only": return "Email Only";
      case "no-follow-up": return "No Follow-up";
      default: return "—";
    }
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "improving") return <TrendingUp className="w-4 h-4 text-emerald-500" />;
    if (trend === "declining") return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  const hasApiKey = aiModel === "claude" ? !!anthropicKey : !!openaiKey;
  const priorityCalls = result?.calls.filter(c => c.score.leadQuality?.recommendedAction === "priority-1hr") || [];

  // Compute dashboard stats
  const getLeadDistribution = () => {
    if (!result) return { hot: 0, qualified: 0, nurture: 0, low: 0 };
    const calls = result.calls;
    return {
      hot: calls.filter(c => (c.score.leadQuality?.score || 0) >= 9).length,
      qualified: calls.filter(c => (c.score.leadQuality?.score || 0) >= 7 && (c.score.leadQuality?.score || 0) < 9).length,
      nurture: calls.filter(c => (c.score.leadQuality?.score || 0) >= 5 && (c.score.leadQuality?.score || 0) < 7).length,
      low: calls.filter(c => (c.score.leadQuality?.score || 0) < 5).length,
    };
  };

  const getActionDistribution = () => {
    if (!result) return {};
    const dist: Record<string, number> = {};
    result.calls.forEach(c => {
      const action = c.score.leadQuality?.recommendedAction || 'unknown';
      dist[action] = (dist[action] || 0) + 1;
    });
    return dist;
  };

  const getScoreDistribution = () => {
    if (!result) return { excellent: 0, good: 0, average: 0, poor: 0 };
    const calls = result.calls;
    return {
      excellent: calls.filter(c => c.score.overallScore >= 8).length,
      good: calls.filter(c => c.score.overallScore >= 6 && c.score.overallScore < 8).length,
      average: calls.filter(c => c.score.overallScore >= 4 && c.score.overallScore < 6).length,
      poor: calls.filter(c => c.score.overallScore < 4).length,
    };
  };

  const leadDist = getLeadDistribution();
  const actionDist = getActionDistribution();
  const scoreDist = getScoreDistribution();

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Welcome Modal */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden my-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white border-b-4 border-blue-500">
              <div className="flex items-center gap-4 mb-3">
                <div className="p-3 bg-blue-500 rounded-xl">
                  <BarChart3 className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">NWH Call Analysis</h1>
                  <p className="text-blue-200 text-sm">AI-Powered Sales Intelligence</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* How it works steps */}
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                  How It Works
                </h2>
                <div className="grid grid-cols-4 gap-3">
                  <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <Key className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-xs font-medium text-slate-700">1. Add Key</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <Upload className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-xs font-medium text-slate-700">2. Upload</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <Brain className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-xs font-medium text-slate-700">3. Analyze</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <Download className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-xs font-medium text-slate-700">4. Export</p>
                  </div>
                </div>
              </div>

              {/* API Key info */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Key className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800 mb-1">API Key Required</p>
                    <p className="text-sm text-slate-600 mb-2">
                      You&apos;ll need an Anthropic or OpenAI API key.
                      {(anthropicKey || openaiKey) && (
                        <span className="text-emerald-600 font-medium ml-1">✓ Key saved</span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <a
                        href="https://platform.claude.com/settings/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                      >
                        Anthropic Console
                        <ArrowUpRight className="w-3 h-3" />
                      </a>
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                      >
                        OpenAI Platform
                        <ArrowUpRight className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="text-xs text-amber-700 bg-amber-100/50 rounded-lg p-2.5 space-y-1">
                      <p className="font-medium">💡 Quick Start Tips:</p>
                      <ul className="space-y-0.5 text-amber-600">
                        <li>• Add <span className="font-semibold">$5-10</span> credits to your account to get started</li>
                        <li>• Analyzing 50 calls typically costs <span className="font-semibold">~$1-2</span></li>
                        <li>• API keys won&apos;t work without credits added to billing</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Privacy note */}
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                <p className="text-sm text-slate-600">
                  Your data stays in your browser. API keys are stored locally and sent directly to AI providers.
                </p>
              </div>

              {/* CTA Button */}
              <Button
                onClick={dismissWelcome}
                className="w-full h-12 font-semibold bg-blue-600 hover:bg-blue-700 rounded-xl text-base"
              >
                {(anthropicKey || openaiKey) ? "Continue to Dashboard" : "Get Started"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Professional Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 text-white sticky top-0 z-20 shadow-lg">
        <div className="h-1 bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500" />
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-blue-500 rounded-xl shadow-lg shadow-blue-500/25">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  NWH Call Analysis
                </h1>
                <p className="text-sm text-blue-200">Sales Performance Analytics</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {result && (
                <span className="text-sm px-4 py-2 bg-white/10 rounded-full text-slate-300 backdrop-blur">
                  {result.calls[0]?.aiModel === "claude" ? "Claude Opus 4.5" : "GPT-4.1"}
                </span>
              )}
              <Button
                variant="ghost"
                onClick={() => setShowSettings(!showSettings)}
                className={`text-white hover:bg-white/10 gap-2 ${!hasApiKey ? "ring-2 ring-amber-400" : ""}`}
              >
                <Settings className="w-5 h-5" />
                {!hasApiKey && <span className="text-amber-400">Setup</span>}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Settings Panel */}
        <div className={`transition-all duration-300 ${showSettings ? "max-h-[800px] overflow-y-auto opacity-100 mb-6" : "max-h-0 overflow-hidden opacity-0 mb-0"}`}>
          <Card className="border-0 shadow-xl bg-white overflow-hidden rounded-2xl">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-blue-400" />
            <CardHeader className="pb-4 bg-slate-50 border-b border-slate-100">
              <CardTitle className="flex items-center gap-3 text-lg font-semibold text-slate-800">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Key className="w-5 h-5 text-blue-600" />
                </div>
                API Configuration
              </CardTitle>
              <CardDescription className="text-slate-600">
                Keys are stored locally in your browser and sent directly to AI providers.
              </CardDescription>
              <div className="flex flex-wrap gap-2 mt-3">
                <a
                  href="https://platform.claude.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                >
                  Anthropic Console
                  <ArrowUpRight className="w-3 h-3" />
                </a>
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors font-medium"
                >
                  OpenAI Platform
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Anthropic API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showAnthropicKey ? "text" : "password"}
                      value={anthropicKey}
                      onChange={(e) => setAnthropicKey(e.target.value)}
                      placeholder="sk-ant-..."
                      className="w-full px-3 py-2 pr-10 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showAnthropicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {anthropicKey && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Saved
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    OpenAI API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showOpenaiKey ? "text" : "password"}
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full px-3 py-2 pr-10 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {openaiKey && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Saved
                    </p>
                  )}
                </div>
              </div>

              {/* Cost Estimate */}
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-sm font-semibold text-slate-700 mb-2">Estimated Cost</p>
                <div className="flex flex-wrap items-center gap-4 text-sm mb-3">
                  <span className="text-slate-600">~$0.001/call extraction</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-600">~$0.02/call analysis</span>
                  <span className="text-slate-300">•</span>
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-semibold">~$1-2 for 50 calls</span>
                </div>
                <div className="text-xs text-blue-700 bg-blue-100/50 rounded-lg p-2.5">
                  <p className="font-medium mb-1">💡 Getting Started:</p>
                  <p className="text-blue-600">Add <span className="font-semibold">$5-10</span> credits to your API account. This covers analyzing <span className="font-semibold">200-500 calls</span> and will last for weeks of typical use. Your API key won&apos;t work until billing is set up.</p>
                </div>
              </div>

              {/* How It Works */}
              <details className="group pt-4 border-t border-slate-200">
                <summary className="text-sm font-medium cursor-pointer text-slate-600 hover:text-slate-800 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-500" />
                  <span>Processing Pipeline</span>
                  <ChevronDown className="w-4 h-4 ml-auto transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-4 space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="p-1.5 bg-amber-100 rounded-lg">
                      <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">1. Parse Excel</p>
                      <p className="text-sm text-slate-600">Extract transcripts and metadata from CallRail export</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="p-1.5 bg-blue-100 rounded-lg">
                      <Zap className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">2. Extract Contacts</p>
                      <p className="text-sm text-slate-600">AI identifies rep names, caller info, and filters IVR/spam</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-xl border border-purple-100">
                    <div className="p-1.5 bg-purple-100 rounded-lg">
                      <Brain className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">3. Deep Analysis</p>
                      <p className="text-sm text-slate-600">Score performance, qualify leads, generate coaching insights</p>
                    </div>
                  </div>
                </div>
              </details>

              {/* Scoring Methodology */}
              <details className="group pt-4 border-t border-slate-200">
                <summary className="text-sm font-medium cursor-pointer text-slate-600 hover:text-slate-800 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  <span>Scoring Methodology</span>
                  <ChevronDown className="w-4 h-4 ml-auto transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-4 space-y-4 max-h-[400px] overflow-y-auto">
                  {/* Lead Score */}
                  <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="w-5 h-5 text-orange-500" />
                      <p className="font-semibold text-slate-800">Lead Quality Score (1-10)</p>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">Measures how likely the caller is to become a paying customer:</p>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Clock className="w-4 h-4 text-orange-500" />
                        <span>Timeline to purchase</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <User className="w-4 h-4 text-orange-500" />
                        <span>Decision-maker status</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Target className="w-4 h-4 text-orange-500" />
                        <span>Specific need identified</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <MapPin className="w-4 h-4 text-orange-500" />
                        <span>Geographic/service fit</span>
                      </div>
                    </div>
                    <div className="space-y-2 pt-3 border-t border-orange-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/30" />
                          <span className="text-sm font-medium text-red-600">9-10: Hot Lead</span>
                        </div>
                        <span className="text-xs text-slate-500">Call within 1 hour</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-orange-500" />
                          <span className="text-sm font-medium text-orange-600">7-8: Qualified</span>
                        </div>
                        <span className="text-xs text-slate-500">Follow up in 24 hours</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-amber-500" />
                          <span className="text-sm font-medium text-amber-600">5-6: Nurture</span>
                        </div>
                        <span className="text-xs text-slate-500">Follow up in 48-72 hours</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-slate-400" />
                          <span className="text-sm font-medium text-slate-500">1-4: Low Priority</span>
                        </div>
                        <span className="text-xs text-slate-500">Email only or no follow-up</span>
                      </div>
                    </div>
                  </div>

                  {/* Rep Score */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
                    <div className="flex items-center gap-2 mb-4">
                      <Target className="w-5 h-5 text-blue-500" />
                      <p className="font-semibold text-slate-800">Rep Performance Score (1-10)</p>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">Weighted average of sales skills demonstrated on the call:</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 bg-white/70 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-blue-500" />
                          <span className="text-sm text-slate-700">Information Gathering</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{width: '15%'}} />
                          </div>
                          <span className="text-xs text-slate-500 w-8">15%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-white/70 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-2">
                          <ThumbsUp className="w-4 h-4 text-blue-500" />
                          <span className="text-sm text-slate-700">Next Steps & Closing</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{width: '20%'}} />
                          </div>
                          <span className="text-xs text-slate-500 w-8">20%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-white/70 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-blue-500" />
                          <span className="text-sm text-slate-700">Tone & Professionalism</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{width: '15%'}} />
                          </div>
                          <span className="text-xs text-slate-500 w-8">15%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-white/70 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-blue-500" />
                          <span className="text-sm text-slate-700">Listening Ratio</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{width: '15%'}} />
                          </div>
                          <span className="text-xs text-slate-500 w-8">15%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-white/70 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-blue-500" />
                          <span className="text-sm text-slate-700">Objection Handling</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{width: '15%'}} />
                          </div>
                          <span className="text-xs text-slate-500 w-8">15%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-white/70 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4 text-blue-500" />
                          <span className="text-sm text-slate-700">Conversation Guidance</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{width: '20%'}} />
                          </div>
                          <span className="text-xs text-slate-500 w-8">20%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </details>

              <div className="flex justify-end pt-2">
                <Button onClick={saveApiKeys} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 gap-2 px-6 shadow-lg shadow-blue-500/25">
                  <CheckCircle className="w-4 h-4" />
                  Save & Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upload Section */}
        {!result && (
          <div className="max-w-4xl mx-auto">
            <Card className="shadow-2xl border-0 overflow-hidden">
              {/* Header */}
              <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 text-white overflow-hidden">
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 left-0 w-40 h-40 bg-blue-500 rounded-full blur-3xl" />
                  <div className="absolute bottom-0 right-0 w-60 h-60 bg-purple-500 rounded-full blur-3xl" />
                </div>

                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-blue-500 rounded-xl">
                      <BarChart3 className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold">Analyze Your Calls</h2>
                      <p className="text-slate-400">AI-powered sales intelligence in minutes</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                    <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
                      <Target className="w-6 h-6 text-blue-400 mb-2" />
                      <p className="font-semibold">Score Reps</p>
                      <p className="text-xs text-slate-400 mt-1">1-10 performance rating</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
                      <Star className="w-6 h-6 text-orange-400 mb-2" />
                      <p className="font-semibold">Find Hot Leads</p>
                      <p className="text-xs text-slate-400 mt-1">Prioritized follow-ups</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
                      <Users className="w-6 h-6 text-emerald-400 mb-2" />
                      <p className="font-semibold">Rank Team</p>
                      <p className="text-xs text-slate-400 mt-1">Leaderboard insights</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
                      <MessageSquare className="w-6 h-6 text-purple-400 mb-2" />
                      <p className="font-semibold">AI Coaching</p>
                      <p className="text-xs text-slate-400 mt-1">Personalized tips</p>
                    </div>
                  </div>
                </div>
              </div>

              <CardContent className="p-8 space-y-8 bg-gradient-to-b from-slate-50 to-white">
                {/* Upload Area */}
                <div
                  className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 ${
                    file
                      ? "border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg shadow-blue-500/10"
                      : "border-slate-300 hover:border-blue-400 hover:bg-slate-50 hover:shadow-lg"
                  }`}
                >
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer block">
                    <div className={`mx-auto w-24 h-24 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300 ${
                      file
                        ? "bg-blue-500 shadow-lg shadow-blue-500/30"
                        : "bg-slate-100 group-hover:bg-slate-200"
                    }`}>
                      <FileSpreadsheet className={`w-12 h-12 transition-colors ${file ? "text-white" : "text-slate-400"}`} />
                    </div>
                    {file ? (
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-semibold">{file.name}</span>
                        </div>
                        <p className="text-slate-500 text-sm">Click to change file</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-2xl font-bold text-slate-800 mb-2">Drop your CallRail export</p>
                        <p className="text-slate-500">or click to browse • Excel files (.xlsx, .xls)</p>
                      </div>
                    )}
                  </label>
                </div>

                {/* Two Column Layout */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Model Selection */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Bot className="w-4 h-4 text-slate-400" />
                      AI Model
                    </label>
                    <div className="space-y-3">
                      <button
                        onClick={() => setAiModel("claude")}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                          aiModel === "claude"
                            ? "border-purple-500 bg-purple-50 shadow-md"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${aiModel === "claude" ? "bg-purple-100" : "bg-slate-100"}`}>
                              <Zap className={`w-5 h-5 ${aiModel === "claude" ? "text-purple-600" : "text-slate-400"}`} />
                            </div>
                            <div>
                              <p className={`font-semibold ${aiModel === "claude" ? "text-purple-700" : "text-slate-700"}`}>
                                Claude Opus 4.5
                              </p>
                              <p className="text-xs text-slate-500">Best quality • Recommended</p>
                            </div>
                          </div>
                          {aiModel === "claude" && (
                            <CheckCircle className="w-5 h-5 text-purple-500" />
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => setAiModel("openai")}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                          aiModel === "openai"
                            ? "border-emerald-500 bg-emerald-50 shadow-md"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${aiModel === "openai" ? "bg-emerald-100" : "bg-slate-100"}`}>
                              <Bot className={`w-5 h-5 ${aiModel === "openai" ? "text-emerald-600" : "text-slate-400"}`} />
                            </div>
                            <div>
                              <p className={`font-semibold ${aiModel === "openai" ? "text-emerald-700" : "text-slate-700"}`}>
                                GPT-4.1
                              </p>
                              <p className="text-xs text-slate-500">Fast • 1M context window</p>
                            </div>
                          </div>
                          {aiModel === "openai" && (
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                          )}
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* File format info */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Info className="w-4 h-4 text-slate-400" />
                      File Requirements
                    </label>
                    <div className="p-4 bg-slate-100 rounded-xl border border-slate-200">
                      <ul className="space-y-2 text-sm text-slate-600">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span>CallRail Excel export (.xlsx or .xls)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span>Include &quot;Full Transcription&quot; column</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span>Auto-filters IVR, spam, and short calls</span>
                        </li>
                      </ul>
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="text-xs font-medium text-slate-500 mb-2">Upload Limits</p>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200 font-semibold">50-75 calls</span>
                            <span className="text-slate-500">recommended</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-md border border-amber-200 font-semibold">100 calls</span>
                            <span className="text-slate-500">max (may timeout)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-white text-slate-600 rounded-md border border-slate-200 font-semibold">&lt;10MB</span>
                            <span className="text-slate-500">file size</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">More calls? Export by week or rep</p>
                      </div>
                    </div>
                  </div>
                </div>

                {loading && (
                  <div className="space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-slate-200">
                    {/* Pipeline Indicator */}
                    <div className="flex items-center justify-center gap-2">
                      {/* Bronze Step */}
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                        currentPhase === 'bronze'
                          ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400 ring-offset-2'
                          : currentPhase === 'silver' || currentPhase === 'gold'
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-200 text-slate-500'
                      }`}>
                        <FileSpreadsheet className="w-4 h-4" />
                        <span className="text-sm font-semibold">Parse</span>
                        {(currentPhase === 'silver' || currentPhase === 'gold') && (
                          <CheckCircle className="w-4 h-4" />
                        )}
                      </div>

                      <div className={`w-8 h-0.5 ${currentPhase === 'silver' || currentPhase === 'gold' ? 'bg-blue-400' : 'bg-slate-300'}`} />

                      {/* Silver Step */}
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                        currentPhase === 'silver'
                          ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400 ring-offset-2'
                          : currentPhase === 'gold'
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-200 text-slate-500'
                      }`}>
                        <Zap className="w-4 h-4" />
                        <span className="text-sm font-semibold">Extract</span>
                        {currentPhase === 'gold' && (
                          <CheckCircle className="w-4 h-4" />
                        )}
                      </div>

                      <div className={`w-8 h-0.5 ${currentPhase === 'gold' ? 'bg-purple-400' : 'bg-slate-300'}`} />

                      {/* Gold Step */}
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                        currentPhase === 'gold'
                          ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-400 ring-offset-2'
                          : 'bg-slate-200 text-slate-500'
                      }`}>
                        <Bot className="w-4 h-4" />
                        <span className="text-sm font-semibold">Analyze</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 font-medium">{progressMessage}</span>
                        <span className="font-bold text-slate-900">{progress}%</span>
                      </div>
                      <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 progress-premium ${
                            currentPhase === 'bronze' ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
                            currentPhase === 'silver' ? 'bg-gradient-to-r from-blue-400 to-blue-500' :
                            'bg-gradient-to-r from-purple-400 to-purple-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Extraction Stats */}
                    {extractionStats && (
                      <div className="animate-slide-up grid grid-cols-4 gap-3 p-4 bg-white rounded-xl border border-slate-200">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-slate-900">{extractionStats.totalCalls}</p>
                          <p className="text-xs text-slate-500">Total</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-emerald-600">{extractionStats.validSales}</p>
                          <p className="text-xs text-slate-500">Valid Sales</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-slate-400">{extractionStats.skipped}</p>
                          <p className="text-xs text-slate-500">Filtered</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-purple-600">{extractionStats.uniqueReps.length}</p>
                          <p className="text-xs text-slate-500">Reps Found</p>
                        </div>
                      </div>
                    )}

                    {/* Live Results Feed */}
                    {liveResults.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Live Analysis</p>
                          <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            {processedCalls}/{totalCalls} complete
                          </span>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-2">
                          {liveResults.slice(-5).map((call, idx) => (
                            <div
                              key={idx}
                              className="animate-slide-up flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-sm"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg ${getScoreBg(call.score.leadQuality?.score || 0)} text-white shadow-lg`}>
                                  {call.score.leadQuality?.score || "-"}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-800">
                                    {call.score.callerInfo?.name || "Unknown Caller"}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {call.score.callerInfo?.location || call.record.callDate}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${getActionStyles(call.score.leadQuality?.recommendedAction)}`}>
                                  {getActionLabel(call.score.leadQuality?.recommendedAction)}
                                </span>
                                <CheckCircle className="w-5 h-5 text-emerald-500" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-4 text-red-700 bg-red-50 p-5 rounded-2xl border border-red-200">
                    <AlertCircle className="w-6 h-6 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  onClick={handleAnalyze}
                  disabled={!file || loading || !hasApiKey}
                  className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl shadow-blue-500/25 rounded-xl"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin mr-3" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <BarChart3 className="w-6 h-6 mr-3" />
                      Analyze Calls
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results Dashboard */}
        {result && (
          <div className="space-y-8">
            {/* Top Bar with Tabs and Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-2 rounded-2xl shadow-lg">
              {/* Tab Navigation */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  onClick={() => setActiveView('dashboard')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${
                    activeView === 'dashboard'
                      ? 'bg-white text-slate-900 shadow-md'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveView('calls')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${
                    activeView === 'calls'
                      ? 'bg-white text-slate-900 shadow-md'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <List className="w-4 h-4" />
                  Call Details
                  <span className="text-xs px-2 py-0.5 bg-slate-200 rounded-full">{result.calls.length}</span>
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    const date = new Date().toISOString().split("T")[0];
                    exportToPDF(result, `NWH-Analysis-${date}.pdf`);
                  }}
                  className="gap-2 rounded-xl"
                >
                  <FileText className="w-4 h-4" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const date = new Date().toISOString().split("T")[0];
                    exportToExcel(result, `NWH-Analysis-${date}.xlsx`);
                  }}
                  className="gap-2 rounded-xl"
                >
                  <Table className="w-4 h-4" />
                  Excel
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setResult(null);
                    setFile(null);
                    setActiveView('dashboard');
                  }}
                  className="rounded-xl"
                >
                  New Analysis
                </Button>
              </div>
            </div>

            {/* ============================================== */}
            {/* DASHBOARD VIEW */}
            {/* ============================================== */}
            {activeView === 'dashboard' && (
              <div className="space-y-8 animate-slide-up">
                {/* Hero Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50 overflow-hidden group hover:shadow-2xl transition-shadow">
                <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500 mb-1">Total Calls</p>
                      <p className="text-4xl font-bold text-slate-900">{result.overallStats.totalCalls}</p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-xl group-hover:scale-110 transition-transform">
                      <Phone className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50 overflow-hidden group hover:shadow-2xl transition-shadow">
                <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500 mb-1">Rep Average</p>
                      <p className="text-4xl font-bold text-slate-900">{result.overallStats.averageScore}<span className="text-lg text-slate-400">/10</span></p>
                    </div>
                    <div className="p-3 bg-emerald-100 rounded-xl group-hover:scale-110 transition-transform">
                      <Target className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl bg-gradient-to-br from-orange-50 to-red-50 overflow-hidden group hover:shadow-2xl transition-shadow">
                <div className="h-1 bg-gradient-to-r from-orange-500 to-red-500" />
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-600 mb-1">Hot Leads</p>
                      <p className="text-4xl font-bold text-orange-700">{result.overallStats.hotLeads || 0}</p>
                    </div>
                    <div className="p-3 bg-orange-100 rounded-xl group-hover:scale-110 transition-transform">
                      <Star className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50 overflow-hidden group hover:shadow-2xl transition-shadow">
                <div className="h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500 mb-1">Sales Reps</p>
                      <p className="text-4xl font-bold text-slate-900">{result.repSummaries.length}</p>
                    </div>
                    <div className="p-3 bg-purple-100 rounded-xl group-hover:scale-110 transition-transform">
                      <Users className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Priority Actions Banner */}
            {priorityCalls.length > 0 && (
              <div className="bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 rounded-2xl p-6 text-white shadow-xl shadow-orange-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur">
                      <Star className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{priorityCalls.length} calls need immediate follow-up</h3>
                      <p className="text-white/80">Hot leads identified - contact within 1 hour for best results</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setActiveView('calls')}
                    className="bg-white text-orange-600 hover:bg-orange-50 font-semibold rounded-xl shadow-lg gap-2 px-6"
                  >
                    <Star className="w-4 h-4" />
                    View Hot Leads
                    <ArrowUpRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Lead Quality Distribution */}
                  <Card className="border-0 shadow-xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <PieChart className="w-5 h-5 text-orange-500" />
                        Lead Quality Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <span className="text-sm text-slate-600">Hot (9-10)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{leadDist.hot}</span>
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-red-500 rounded-full" style={{ width: `${result.calls.length ? (leadDist.hot / result.calls.length) * 100 : 0}%` }} />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-orange-500" />
                            <span className="text-sm text-slate-600">Qualified (7-8)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{leadDist.qualified}</span>
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-orange-500 rounded-full" style={{ width: `${result.calls.length ? (leadDist.qualified / result.calls.length) * 100 : 0}%` }} />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-amber-500" />
                            <span className="text-sm text-slate-600">Nurture (5-6)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{leadDist.nurture}</span>
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${result.calls.length ? (leadDist.nurture / result.calls.length) * 100 : 0}%` }} />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-slate-400" />
                            <span className="text-sm text-slate-600">Low (1-4)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{leadDist.low}</span>
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-slate-400 rounded-full" style={{ width: `${result.calls.length ? (leadDist.low / result.calls.length) * 100 : 0}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Rep Performance Distribution */}
                  <Card className="border-0 shadow-xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Target className="w-5 h-5 text-blue-500" />
                        Rep Performance Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500" />
                            <span className="text-sm text-slate-600">Excellent (8+)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{scoreDist.excellent}</span>
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${result.calls.length ? (scoreDist.excellent / result.calls.length) * 100 : 0}%` }} />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500" />
                            <span className="text-sm text-slate-600">Good (6-7)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{scoreDist.good}</span>
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${result.calls.length ? (scoreDist.good / result.calls.length) * 100 : 0}%` }} />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-amber-500" />
                            <span className="text-sm text-slate-600">Average (4-5)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{scoreDist.average}</span>
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${result.calls.length ? (scoreDist.average / result.calls.length) * 100 : 0}%` }} />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <span className="text-sm text-slate-600">Needs Work (&lt;4)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{scoreDist.poor}</span>
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-red-500 rounded-full" style={{ width: `${result.calls.length ? (scoreDist.poor / result.calls.length) * 100 : 0}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recommended Actions */}
                  <Card className="border-0 shadow-xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Zap className="w-5 h-5 text-purple-500" />
                        Follow-up Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-200">
                          <span className="text-sm font-medium text-red-700">Call Now (1hr)</span>
                          <span className="text-xl font-bold text-red-700">{actionDist['priority-1hr'] || 0}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-200">
                          <span className="text-sm font-medium text-orange-700">Follow-up 24hr</span>
                          <span className="text-xl font-bold text-orange-700">{actionDist['follow-24hr'] || 0}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-200">
                          <span className="text-sm font-medium text-amber-700">Nurture 48-72hr</span>
                          <span className="text-xl font-bold text-amber-700">{actionDist['nurture-48-72hr'] || 0}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-sm font-medium text-slate-600">Email Only / None</span>
                          <span className="text-xl font-bold text-slate-600">{(actionDist['email-only'] || 0) + (actionDist['no-follow-up'] || 0)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Rep Performance Comparison */}
                <Card className="border-0 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-500" />
                      Sales Rep Performance Comparison
                    </CardTitle>
                    <CardDescription>Compare rep metrics side-by-side</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-3 px-4 font-semibold text-slate-600">Rep</th>
                            <th className="text-center py-3 px-4 font-semibold text-slate-600">Calls</th>
                            <th className="text-center py-3 px-4 font-semibold text-slate-600">Avg Score</th>
                            <th className="text-center py-3 px-4 font-semibold text-slate-600">Lead Avg</th>
                            <th className="text-center py-3 px-4 font-semibold text-slate-600">Hot Leads</th>
                            <th className="text-center py-3 px-4 font-semibold text-slate-600">Qualified</th>
                            <th className="text-center py-3 px-4 font-semibold text-slate-600">Trend</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.repSummaries.map((rep, idx) => (
                            <tr key={rep.repName} className={`border-b border-slate-100 hover:bg-slate-50 ${idx === 0 ? 'bg-amber-50' : ''}`}>
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                    idx === 0 ? 'bg-amber-200 text-amber-800' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {idx + 1}
                                  </div>
                                  <span className="font-semibold text-slate-900">{rep.repName}</span>
                                  {idx === 0 && <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full">Top</span>}
                                </div>
                              </td>
                              <td className="text-center py-4 px-4 font-medium">{rep.totalCalls}</td>
                              <td className="text-center py-4 px-4">
                                <span className={`font-bold ${getScoreColor(rep.averageScore)}`}>{rep.averageScore}</span>
                              </td>
                              <td className="text-center py-4 px-4">
                                <span className={`font-bold ${getScoreColor(rep.averageLeadScore)}`}>{rep.averageLeadScore}</span>
                              </td>
                              <td className="text-center py-4 px-4">
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                                  <Star className="w-3 h-3" /> {rep.hotLeads}
                                </span>
                              </td>
                              <td className="text-center py-4 px-4">
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                                  {rep.qualifiedLeads}
                                </span>
                              </td>
                              <td className="text-center py-4 px-4">
                                <div className="flex items-center justify-center gap-1">
                                  {getTrendIcon(rep.trend)}
                                  <span className={`text-sm font-medium ${
                                    rep.trend === 'improving' ? 'text-emerald-600' :
                                    rep.trend === 'declining' ? 'text-red-600' : 'text-slate-500'
                                  }`}>
                                    {rep.trend}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Coaching Insights */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-emerald-50 to-teal-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-emerald-700">
                        <CheckCircle className="w-5 h-5" />
                        Team Strengths
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {[...new Set(result.repSummaries.flatMap(r => r.strengths))].slice(0, 5).map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-slate-700">
                            <span className="mt-1 w-5 h-5 bg-emerald-200 text-emerald-700 rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-xl bg-gradient-to-br from-red-50 to-orange-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-red-700">
                        <AlertCircle className="w-5 h-5" />
                        Areas to Improve
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {[...new Set(result.repSummaries.flatMap(r => r.weaknesses))].slice(0, 5).map((w, i) => (
                          <li key={i} className="flex items-start gap-2 text-slate-700">
                            <span className="mt-1 w-5 h-5 bg-red-200 text-red-700 rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                            {w}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Access to Calls */}
                <Card className="border-0 shadow-xl">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-red-500" />
                        Hot Leads Requiring Action
                      </CardTitle>
                      <CardDescription>Highest priority calls that need immediate follow-up</CardDescription>
                    </div>
                    <Button onClick={() => setActiveView('calls')} className="gap-2 rounded-xl bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white">
                      <List className="w-4 h-4" />
                      View All Calls
                      <ArrowUpRight className="w-4 h-4" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {priorityCalls.length > 0 ? (
                      <div className="space-y-3">
                        {priorityCalls.slice(0, 5).map((call) => (
                          <div key={call.record.id} className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-200 hover:bg-red-100 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-red-500 text-white flex items-center justify-center font-bold text-lg">
                                {call.score.leadQuality?.score}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900">{call.score.callerInfo?.name || 'Unknown Caller'}</p>
                                <p className="text-sm text-slate-600">{call.score.callerInfo?.company || call.score.callerInfo?.location || call.record.callDate}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {call.score.callerInfo?.phone && (
                                <span className="text-sm text-slate-600 bg-white px-3 py-1 rounded-lg">{call.score.callerInfo.phone}</span>
                              )}
                              <Button size="sm" className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 rounded-lg gap-2 shadow-lg shadow-red-500/30 font-semibold">
                                <PhoneCall className="w-4 h-4" />
                                Call Now
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-slate-500 py-8">No hot leads requiring immediate action</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ============================================== */}
            {/* CALLS DETAIL VIEW */}
            {/* ============================================== */}
            {activeView === 'calls' && (
              <div className="space-y-6 animate-slide-up">
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Rep Leaderboard Sidebar */}
              <div className="lg:col-span-1">
                <Card className="border-0 shadow-xl sticky top-24">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="w-5 h-5 text-purple-600" />
                      Rep Leaderboard
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {result.repSummaries.map((rep, index) => (
                      <div
                        key={rep.repName}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? "bg-amber-100 text-amber-700" :
                          index === 1 ? "bg-slate-200 text-slate-600" :
                          index === 2 ? "bg-orange-100 text-orange-700" :
                          "bg-slate-100 text-slate-500"
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 truncate">{rep.repName}</p>
                          <p className="text-xs text-slate-500">{rep.totalCalls} calls</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${getScoreColor(rep.averageScore)}`}>
                            {rep.averageScore}
                          </span>
                          {getTrendIcon(rep.trend)}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Calls List */}
              <div className="lg:col-span-3 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold text-slate-900">Call Analysis</h2>
                  <p className="text-sm text-slate-500">{result.calls.length} calls analyzed</p>
                </div>

                {result.calls.map((call) => (
                  <Card
                    key={call.record.id}
                    className="border-0 shadow-lg hover:shadow-xl transition-all overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedCall(expandedCall === call.record.id ? null : call.record.id)}
                      className="w-full text-left"
                    >
                      <div className="p-5">
                        <div className="flex items-start gap-5">
                          {/* Caller Info - Hero */}
                          <div className="flex-1">
                            <div className="flex items-start gap-4">
                              <div className="p-3 bg-slate-100 rounded-xl">
                                <User className="w-6 h-6 text-slate-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-bold text-slate-900">
                                  {call.score.callerInfo?.name || "Unknown Caller"}
                                </h3>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-slate-500">
                                  {call.score.callerInfo?.location && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3.5 h-3.5" />
                                      {call.score.callerInfo.location}
                                    </span>
                                  )}
                                  {call.score.callerInfo?.company && (
                                    <span className="flex items-center gap-1">
                                      <Building className="w-3.5 h-3.5" />
                                      {call.score.callerInfo.company}
                                    </span>
                                  )}
                                  {call.score.callerInfo?.phone && (
                                    <span className="flex items-center gap-1">
                                      <PhoneCall className="w-3.5 h-3.5" />
                                      {call.score.callerInfo.phone}
                                    </span>
                                  )}
                                </div>
                                {call.score.callerInfo?.needSummary && (
                                  <p className="mt-2 text-sm text-slate-700 bg-slate-50 px-3 py-2 rounded-lg inline-block">
                                    <span className="font-medium">Need:</span> {call.score.callerInfo.needSummary}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Scores */}
                          <div className="flex items-center gap-3">
                            <div className="text-center">
                              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold ${getScoreBg(call.score.overallScore)} text-white`}>
                                {call.score.overallScore}
                              </div>
                              <p className="text-xs text-slate-500 mt-1">Rep</p>
                            </div>
                            <div className="text-center">
                              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold ${getScoreBg(call.score.leadQuality?.score || 0)} text-white`}>
                                {call.score.leadQuality?.score || "-"}
                              </div>
                              <p className="text-xs text-slate-500 mt-1">Lead</p>
                            </div>
                            <div className={`px-4 py-2 rounded-xl text-sm font-semibold ${getActionStyles(call.score.leadQuality?.recommendedAction)}`}>
                              {getActionLabel(call.score.leadQuality?.recommendedAction)}
                            </div>
                          </div>

                          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expandedCall === call.record.id ? "rotate-180" : ""}`} />
                        </div>

                        {/* Footer Row */}
                        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            Rep: {call.score.repInfo?.name || call.record.repName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {call.record.callDate}
                          </span>
                          <span>{call.record.callDuration}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            call.score.callContext?.type === "inbound"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {call.score.callContext?.type || "unknown"}
                          </span>
                        </div>
                      </div>
                    </button>

                    {/* Expanded Details */}
                    {expandedCall === call.record.id && (
                      <div className="px-5 pb-5 border-t border-slate-100 bg-slate-50">
                        <div className="pt-5 space-y-5">
                          {/* Score Breakdown */}
                          <div>
                            <h4 className="font-semibold text-slate-700 mb-3">Performance Breakdown</h4>
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
                                <div key={item.label} className="bg-white p-3 rounded-xl text-center">
                                  <p className={`text-xl font-bold ${getScoreColor(item.score || 0)}`}>{item.score || "-"}</p>
                                  <p className="text-xs text-slate-500">{item.label}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Insights Grid */}
                          <div className="grid grid-cols-3 gap-4">
                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                              <h5 className="font-semibold text-emerald-700 mb-2 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" /> Strengths
                              </h5>
                              <ul className="space-y-1 text-sm text-slate-600">
                                {(call.score.strengths || []).map((s, i) => (
                                  <li key={i}>• {s}</li>
                                ))}
                              </ul>
                            </div>
                            <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                              <h5 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" /> Improve
                              </h5>
                              <ul className="space-y-1 text-sm text-slate-600">
                                {(call.score.weaknesses || []).map((w, i) => (
                                  <li key={i}>• {w}</li>
                                ))}
                              </ul>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                              <h5 className="font-semibold text-purple-700 mb-2 flex items-center gap-2">
                                <Bot className="w-4 h-4" /> Coaching
                              </h5>
                              <ul className="space-y-1 text-sm text-slate-600">
                                {(call.score.coachingInsights || []).map((c, i) => (
                                  <li key={i}>• {c}</li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {/* Transcript */}
                          {call.record.transcript && (
                            <details className="group">
                              <summary className="cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                View Transcript
                              </summary>
                              <div className="mt-3 p-4 bg-white rounded-xl border text-sm text-slate-600 max-h-64 overflow-y-auto font-mono text-xs whitespace-pre-wrap">
                                {call.record.transcript}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
