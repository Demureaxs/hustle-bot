import React, { useState } from 'react';
import { AppConfig } from '../types';
import { Settings, MapPin, Hash, Phone, User, Briefcase, Code } from 'lucide-react';

interface ConfigPanelProps {
  config: AppConfig;
  onUpdate: (newConfig: AppConfig) => void;
  isProcessing: boolean;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onUpdate, isProcessing }) => {
  const [localConfig, setLocalConfig] = useState<AppConfig>(config);

  const handleChange = (field: keyof AppConfig, value: any) => {
    const updated = { ...localConfig, [field]: value };
    setLocalConfig(updated);
  };

  const handleSave = () => {
    onUpdate(localConfig);
  };

  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalConfig({ ...localConfig, keywords: val.split(',').map(s => s.trim()) });
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-2xl space-y-6">
      
      {/* SECTION 1: SYSTEM CONFIG */}
      <div>
        <div className="flex items-center gap-2 mb-4 text-green-400 border-b border-gray-800 pb-2">
            <Settings size={20} />
            <h2 className="text-lg font-bold tracking-wider">SYSTEM_CONFIG</h2>
        </div>

        <div className="space-y-4">
            {/* WhatsApp Target */}
            <div>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-1 uppercase">
                <Phone size={12} /> Target WhatsApp
            </label>
            <input
                type="text"
                value={localConfig.targetNumber}
                onChange={(e) => handleChange('targetNumber', e.target.value)}
                className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-green-500 focus:outline-none"
                placeholder="e.g. 15551234567 (Country Code + Number)"
            />
            </div>

            {/* Keywords */}
            <div>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-1 uppercase">
                <Hash size={12} /> Search Keywords (Comma separated)
            </label>
            <input
                type="text"
                value={localConfig.keywords.join(', ')}
                onChange={handleKeywordChange}
                className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-green-500 focus:outline-none"
                placeholder="web design, shopify, react"
            />
            </div>

            {/* Maps Config */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-1 uppercase">
                    <MapPin size={12} /> Map Business Query
                </label>
                <input
                    type="text"
                    value={localConfig.mapsQuery}
                    onChange={(e) => handleChange('mapsQuery', e.target.value)}
                    className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-green-500 focus:outline-none"
                    placeholder="Plumbers, Dentists"
                />
                </div>
                <div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-1 uppercase">
                    <MapPin size={12} /> Map Location
                </label>
                <input
                    type="text"
                    value={localConfig.mapsLocation}
                    onChange={(e) => handleChange('mapsLocation', e.target.value)}
                    className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-green-500 focus:outline-none"
                    placeholder="London, UK"
                />
                </div>
            </div>
        </div>
      </div>

      {/* SECTION 2: MY PROFILE (For AI Replies) */}
      <div>
        <div className="flex items-center gap-2 mb-4 text-blue-400 border-b border-gray-800 pb-2">
            <User size={20} />
            <h2 className="text-lg font-bold tracking-wider">MY_PROFILE (For AI Pitches)</h2>
        </div>

        <div className="space-y-4">
            <div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-1 uppercase">
                    <User size={12} /> My Name / Agency
                </label>
                <input
                    type="text"
                    value={localConfig.userName}
                    onChange={(e) => handleChange('userName', e.target.value)}
                    className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-blue-500 focus:outline-none"
                    placeholder="John Doe"
                />
            </div>
            <div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-1 uppercase">
                    <Briefcase size={12} /> Portfolio URL
                </label>
                <input
                    type="text"
                    value={localConfig.userPortfolio}
                    onChange={(e) => handleChange('userPortfolio', e.target.value)}
                    className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-blue-500 focus:outline-none"
                    placeholder="https://myportfolio.com"
                />
            </div>
            <div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-1 uppercase">
                    <Code size={12} /> Key Skills
                </label>
                <input
                    type="text"
                    value={localConfig.userSkills}
                    onChange={(e) => handleChange('userSkills', e.target.value)}
                    className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-blue-500 focus:outline-none"
                    placeholder="Next.js, Tailwind, SEO"
                />
            </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isProcessing}
        className="w-full bg-green-900/30 hover:bg-green-800/50 border border-green-700 text-green-400 font-bold py-2 px-4 rounded transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs mt-4"
      >
          {isProcessing ? 'System Busy...' : 'Initialize & Save Config'}
      </button>
    </div>
  );
};