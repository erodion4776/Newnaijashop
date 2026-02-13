import React, { useState, useEffect } from 'react';
import RelayService from '../services/RelayService';

const LiveIndicator: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsConnected(RelayService.isConnected());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 border rounded-full mr-2 shadow-sm animate-in fade-in zoom-in">
      <div className={`w-2 h-2 rounded-full transition-all duration-500 ${
        isConnected ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-slate-300'
      }`}></div>
      <span className={`text-[8px] font-black uppercase tracking-widest ${
        isConnected ? 'text-emerald-600' : 'text-slate-400'
      }`}>
        {isConnected ? 'Live Link' : 'Offline'}
      </span>
    </div>
  );
};

export default LiveIndicator;