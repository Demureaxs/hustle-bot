import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface TerminalLogProps {
  logs: LogEntry[];
}

export const TerminalLog: React.FC<TerminalLogProps> = ({ logs }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="bg-black border border-gray-800 rounded-lg p-4 h-64 overflow-y-auto font-mono text-xs shadow-inner shadow-gray-900/50">
      <div className="text-green-500 mb-2 font-bold">root@hustlebot:~# tail -f /var/log/hustle.log</div>
      {logs.length === 0 && <div className="text-gray-600 italic">Waiting for system init...</div>}
      {logs.map((log) => (
        <div key={log.id} className="mb-1">
          <span className="text-gray-500">[{log.timestamp}]</span>{' '}
          <span
            className={`${
              log.type === 'error'
                ? 'text-red-500'
                : log.type === 'success'
                ? 'text-green-400'
                : log.type === 'warning'
                ? 'text-yellow-400'
                : 'text-blue-300'
            }`}
          >
            {log.type.toUpperCase()}:
          </span>{' '}
          <span className="text-gray-300">{log.message}</span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
};