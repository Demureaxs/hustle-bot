'use client';

import { useState, useEffect } from 'react';
import { Activity, Play, RefreshCw, Terminal } from 'lucide-react';

interface Stats {
  totalProspects: number;
  activeCampaigns: number;
  pendingOutreach: number;
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [autoPilot, setAutoPilot] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'logs'>('dashboard');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/scheduler/housekeeping');
        const data = await response.json();
        if (response.ok) setStats(data.stats);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const handleRunScrapers = () => {
    setIsRunning(true);
    // TODO: Implement actual scraper trigger
    setTimeout(() => setIsRunning(false), 3000);
  };

  return (
    <div className='p-8 text-gray-200 font-mono'>
      {/* Header Actions */}
      <div className='flex justify-between items-center mb-8 border-b border-gray-800 pb-6'>
        <div>
          <h2 className='text-2xl font-bold text-white tracking-tight'>MISSION CONTROL</h2>
          <p className='text-xs text-gray-500 uppercase tracking-widest mt-1'>System Status: ONLINE</p>
        </div>
        <button
          onClick={() => setAutoPilot(!autoPilot)}
          className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold border transition-all ${
            autoPilot ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-zinc-900 text-zinc-500 border-zinc-800'
          }`}
        >
          <RefreshCw size={14} className={autoPilot ? 'animate-spin' : ''} />
          AUTO_PILOT: {autoPilot ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>
        {/* Left Col: Controls & Stats */}
        <div className='lg:col-span-4 space-y-6'>
          {/* Manual Override */}
          <div className='bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 shadow-2xl'>
            <div className='flex items-center gap-2 mb-4 text-blue-400'>
              <Activity size={20} />
              <h2 className='text-sm font-bold tracking-wider uppercase'>Manual Override</h2>
            </div>
            <button
              onClick={handleRunScrapers}
              disabled={isRunning}
              className={`w-full py-4 rounded font-bold text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2
                    ${
                      isRunning
                        ? 'bg-yellow-900/20 text-yellow-500 border border-yellow-900/50 cursor-wait'
                        : 'bg-green-600 hover:bg-green-500 text-black border border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                    }`}
            >
              {isRunning ? (
                <>
                  <RefreshCw className='animate-spin' size={16} /> Execution In Progress...
                </>
              ) : (
                <>
                  <Play size={16} /> Run Scrapers Now
                </>
              )}
            </button>
          </div>

          {/* Quick Stats */}
          <div className='grid grid-cols-2 gap-4'>
            <div className='bg-zinc-900/50 border border-zinc-800 p-4 rounded-lg'>
              <div className='text-xs text-zinc-500 uppercase'>Total Prospects</div>
              <div className='text-2xl font-bold text-white mt-1'>{loading ? '-' : stats?.totalProspects ?? 0}</div>
            </div>
            <div className='bg-zinc-900/50 border border-zinc-800 p-4 rounded-lg'>
              <div className='text-xs text-zinc-500 uppercase'>Pending Outreach</div>
              <div className='text-2xl font-bold text-orange-500 mt-1'>{loading ? '-' : stats?.pendingOutreach ?? 0}</div>
            </div>
          </div>
        </div>

        {/* Right Col: Feed */}
        <div className='lg:col-span-8 flex flex-col h-[600px]'>
          <div className='flex items-center gap-4 mb-4 border-b border-zinc-800'>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`pb-2 px-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${
                activeTab === 'dashboard' ? 'text-green-500 border-green-500' : 'text-zinc-600 border-transparent hover:text-zinc-400'
              }`}
            >
              Live Feed
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`pb-2 px-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${
                activeTab === 'logs' ? 'text-green-500 border-green-500' : 'text-zinc-600 border-transparent hover:text-zinc-400'
              }`}
            >
              System Logs
            </button>
          </div>

          <div className='flex-1 bg-zinc-900/30 border border-zinc-800 rounded-lg p-4 overflow-y-auto'>
            {activeTab === 'dashboard' ? (
              <div className='text-center text-zinc-500 py-12'>
                <Terminal className='mx-auto mb-4 opacity-50' size={48} />
                <p>No active leads in feed. Run scraper to populate.</p>
              </div>
            ) : (
              <div className='font-mono text-xs space-y-2'>
                <div className='text-green-500'>[SYSTEM] Dashboard initialized successfully.</div>
                <div className='text-zinc-400'>[INFO] Connected to database: dev.db</div>
                <div className='text-zinc-400'>[INFO] Waiting for user command...</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
