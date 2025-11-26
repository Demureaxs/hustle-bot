import React, { useState, useCallback, useEffect } from 'react';
import { Terminal, Activity, Zap, Play, RefreshCw } from 'lucide-react';
import { ConfigPanel } from './components/ConfigPanel';
import { LeadFeed } from './components/LeadFeed';
import { TerminalLog } from './components/TerminalLog';
import { AppConfig, Lead, LogEntry } from './types';
import { findSocialLeads, findMapsLeads } from './services/geminiService';

const INITIAL_CONFIG: AppConfig = {
  targetNumber: '15551234567',
  keywords: ['web design', 'landing page', 'shopify', 'webflow'],
  mapsQuery: 'Plumbers',
  mapsLocation: 'London',
  autoRefresh: false,
  userName: 'Alex Dev',
  userPortfolio: 'alexdev.studio',
  userSkills: 'React, Tailwind, High-Converting Landing Pages'
};

function App() {
  const [config, setConfig] = useState<AppConfig>(INITIAL_CONFIG);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'logs'>('dashboard');

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        message,
        type,
      },
    ]);
  };

  const handleConfigUpdate = (newConfig: AppConfig) => {
    setConfig(newConfig);
    addLog('Configuration updated successfully.', 'success');
  };

  const runScrapers = useCallback(async () => {
    if (!process.env.API_KEY) {
      addLog('Error: API Key is missing in environment variables. Halting sequence.', 'error');
      setIsRunning(false);
      return;
    }

    setIsRunning(true);
    addLog('Initiating scrape sequence...', 'info');

    try {
      // 1. Social Scrape
      addLog(`Scanning Reddit (r/forhire, etc.) for: ${config.keywords.join(', ')}...`, 'info');
      const socialLeads = await findSocialLeads(config.keywords, {
        userName: config.userName,
        userPortfolio: config.userPortfolio,
        userSkills: config.userSkills
      });
      addLog(`Found ${socialLeads.length} potential leads from social sources.`, 'success');
      
      // 2. Maps Scrape
      addLog(`Scanning Google Maps for: ${config.mapsQuery} in ${config.mapsLocation}...`, 'info');
      const mapsLeads = await findMapsLeads(
          config.mapsQuery, 
          config.mapsLocation,
          {
            userName: config.userName,
            userPortfolio: config.userPortfolio,
            userSkills: config.userSkills
          }
      );
      addLog(`Found ${mapsLeads.length} businesses. Filtering for "No Website" targets.`, 'success');

      const newLeads = [...socialLeads, ...mapsLeads];
      
      // Sort by score
      newLeads.sort((a, b) => b.score - a.score);

      setLeads((prev) => {
        // Simple deduplication by Title
        const existingTitles = new Set(prev.map(l => l.title));
        const filtered = newLeads.filter(l => !existingTitles.has(l.title));
        if (filtered.length > 0) {
             addLog(`${filtered.length} new unique leads added to the dashboard.`, 'success');
        } else {
             addLog(`No new unique leads found in this cycle.`, 'warning');
        }
        return [...filtered, ...prev];
      });

    } catch (error: any) {
      addLog(`Scrape sequence failed: ${error.message}`, 'error');
    } finally {
      setIsRunning(false);
      addLog('Cycle complete. Waiting for next trigger.', 'info');
    }
  }, [config]);

  const handleAlert = (lead: Lead) => {
    // Strip non-numeric characters for the API
    const cleanNumber = config.targetNumber.replace(/\D/g, '');

    if (cleanNumber.length < 7) {
      addLog(`Error: Target phone number "${config.targetNumber}" appears invalid.`, 'error');
      alert("Please check the phone number in settings. Format: CountryCode + Number (e.g., 15551234567)");
      return;
    }

    addLog(`Opening WhatsApp session for ${cleanNumber}...`, 'info');
    
    const message = `🚨 *HustleBot Alert*\n\n` +
      `*Lead:* ${lead.title}\n` +
      `*Source:* ${lead.source}\n` +
      `*Score:* ${lead.score}/100\n` +
      `*Link:* ${lead.url || 'No Link'}\n\n` +
      `*Suggested Reply:* \n_${lead.suggestedReply?.substring(0, 50)}..._`;

    const waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
    
    // Open in new tab
    window.open(waUrl, '_blank');
    addLog(`WhatsApp redirected successfully.`, 'success');
  };

  // Auto-runner effect (mocking cron)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (config.autoRefresh && !isRunning) {
        interval = setInterval(() => {
            runScrapers();
        }, 60000); // Every minute in demo mode
    }
    return () => clearInterval(interval);
  }, [config.autoRefresh, isRunning, runScrapers]);

  return (
    <div className="min-h-screen bg-black text-gray-200 p-4 md:p-8 font-mono selection:bg-green-900 selection:text-white">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Header */}
        <div className="lg:col-span-12 flex justify-between items-center border-b border-gray-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="bg-green-500/10 p-2 rounded border border-green-500/20">
              <Zap className="text-green-500" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tighter text-white">HUSTLEBOT<span className="text-green-500">_V2</span></h1>
              <p className="text-xs text-gray-500 uppercase tracking-widest">Automated Lead Acquisition System</p>
            </div>
          </div>
          <div className="flex gap-2">
             <button 
                onClick={() => setConfig(p => ({...p, autoRefresh: !p.autoRefresh}))}
                className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold border transition-all ${config.autoRefresh ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-gray-900 text-gray-500 border-gray-800'}`}
             >
                <RefreshCw size={14} className={config.autoRefresh ? "animate-spin" : ""} />
                AUTO_PILOT: {config.autoRefresh ? 'ON' : 'OFF'}
             </button>
          </div>
        </div>

        {/* Left Col: Config & Control */}
        <div className="lg:col-span-4 space-y-6">
          <ConfigPanel config={config} onUpdate={handleConfigUpdate} isProcessing={isRunning} />
          
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-4 text-blue-400">
               <Activity size={20} />
               <h2 className="text-lg font-bold tracking-wider">MANUAL_OVERRIDE</h2>
            </div>
            <button
                onClick={runScrapers}
                disabled={isRunning}
                className={`w-full py-4 rounded font-bold text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2
                    ${isRunning 
                        ? 'bg-yellow-900/20 text-yellow-500 border border-yellow-900/50 cursor-wait' 
                        : 'bg-green-600 hover:bg-green-500 text-black border border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                    }`}
            >
                {isRunning ? (
                    <><RefreshCw className="animate-spin" size={16}/> Execution In Progress...</>
                ) : (
                    <><Play size={16}/> Run Scrapers Now</>
                )}
            </button>
          </div>

          <TerminalLog logs={logs} />
        </div>

        {/* Right Col: Feed */}
        <div className="lg:col-span-8 flex flex-col h-[800px]">
          <div className="flex items-center gap-4 mb-4 border-b border-gray-800">
            <button 
                onClick={() => setActiveTab('dashboard')}
                className={`pb-2 px-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'dashboard' ? 'text-green-500 border-green-500' : 'text-gray-600 border-transparent hover:text-gray-400'}`}
            >
                Live Feed ({leads.length})
            </button>
            <button 
                onClick={() => setActiveTab('logs')}
                className={`pb-2 px-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'logs' ? 'text-green-500 border-green-500' : 'text-gray-600 border-transparent hover:text-gray-400'}`}
            >
                System Status
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {activeTab === 'dashboard' ? (
                <LeadFeed leads={leads} onSendAlert={handleAlert} />
            ) : (
                <div className="p-4 bg-gray-900/50 rounded border border-gray-800 h-full">
                    <h3 className="text-green-500 font-bold mb-4 flex items-center gap-2"><Terminal size={16}/> System Architecture</h3>
                    <div className="text-xs text-gray-400 space-y-4">
                        <p>RUNTIME: React 18 (Browser)</p>
                        <p>INTELLIGENCE: Google Gemini 2.5 Flash</p>
                        <p>MODULES:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Reddit Scanner (Simulated via Search Grounding)</li>
                            <li>Upwork Scanner (Simulated via Search Grounding)</li>
                            <li>Maps Business Extractor (Simulated via Maps Grounding)</li>
                            <li>WhatsApp Bridge (Direct "Click to Chat" Integration)</li>
                        </ul>
                        <div className="mt-8 p-3 bg-blue-900/20 border border-blue-900/50 text-blue-200 rounded">
                            <p className="font-bold">NOTE TO OPERATOR:</p>
                            <p className="mt-1 opacity-80">
                                This dashboard runs entirely in your browser. 
                                It uses Gemini AI to find leads dynamically.
                                WhatsApp alerts work by opening a pre-filled chat window.
                            </p>
                        </div>
                    </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;