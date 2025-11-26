import React, { useState } from 'react';
import { Lead, LeadSource } from '../types';
import { ExternalLink, MapPin, MessageCircle, AlertCircle, Copy, ChevronDown, ChevronUp } from 'lucide-react';

interface LeadFeedProps {
  leads: Lead[];
  onSendAlert: (lead: Lead) => void;
}

export const LeadFeed: React.FC<LeadFeedProps> = ({ leads, onSendAlert }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-600 mt-20">
        <div className="animate-pulse mb-4 text-4xl">📡</div>
        <p>Awaiting Signal...</p>
        <p className="text-xs mt-2">Configure scrapers to begin ingestion.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {leads.map((lead) => (
        <div
          key={lead.id}
          className={`relative group bg-gray-900/50 border ${
            lead.score > 80 ? 'border-green-800/50' : 'border-gray-800'
          } rounded-lg p-4 hover:bg-gray-900 transition-all hover:border-green-700`}
        >
          {lead.isNew && (
            <span className="absolute top-2 right-2 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
          )}

          <div className="flex justify-between items-start mb-2">
            <div>
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                  lead.source === LeadSource.REDDIT
                    ? 'bg-orange-900/30 text-orange-400'
                    : lead.source === LeadSource.UPWORK
                    ? 'bg-green-900/30 text-green-400'
                    : 'bg-blue-900/30 text-blue-400'
                }`}
              >
                {lead.source}
              </span>
              <span className="text-gray-500 text-xs ml-2">{lead.postedAt}</span>
            </div>
            <div className="flex items-center gap-1">
                <span className={`text-xs font-mono font-bold ${lead.score > 80 ? 'text-green-500' : 'text-yellow-500'}`}>
                    SCORE: {lead.score}
                </span>
            </div>
          </div>

          <h3 className="text-lg font-bold text-gray-200 mb-2 leading-tight group-hover:text-green-400 transition-colors">
            {lead.title}
          </h3>
          <p className="text-gray-400 text-sm mb-4 line-clamp-2">{lead.description}</p>

          <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
            {lead.metadata?.location && (
                <div className="flex items-center gap-1">
                    <MapPin size={12} /> {lead.metadata.location}
                </div>
            )}
            {lead.metadata?.website === null && lead.source === LeadSource.MAPS && (
                <div className="flex items-center gap-1 text-red-400 font-bold">
                    <AlertCircle size={12} /> NO WEBSITE
                </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 pt-3">
            {lead.url && (
              <a
                href={lead.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded text-xs transition-colors"
              >
                <ExternalLink size={14} /> Source
              </a>
            )}
            
            <button
                onClick={() => toggleExpand(lead.id)}
                className="flex items-center gap-2 bg-blue-900/20 hover:bg-blue-900/40 text-blue-400 border border-blue-900/50 hover:border-blue-500 px-3 py-1.5 rounded text-xs transition-all"
            >
                {expandedId === lead.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {expandedId === lead.id ? 'Hide Pitch' : 'View Pitch'}
            </button>

            <button
              onClick={() => onSendAlert(lead)}
              className="flex items-center gap-2 bg-green-900/20 hover:bg-green-900/40 text-green-400 border border-green-900/50 hover:border-green-500 px-3 py-1.5 rounded text-xs transition-all ml-auto"
            >
              <MessageCircle size={14} /> WhatsApp
            </button>
          </div>

          {/* Expanded AI Pitch */}
          {expandedId === lead.id && lead.suggestedReply && (
            <div className="mt-3 p-3 bg-black rounded border border-gray-700 relative animation-fade-in">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">AI Generated Response</span>
                    <button 
                        onClick={() => copyToClipboard(lead.suggestedReply!)}
                        className="text-gray-500 hover:text-white transition-colors"
                        title="Copy to Clipboard"
                    >
                        <Copy size={12} />
                    </button>
                </div>
                <p className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                    {lead.suggestedReply}
                </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};