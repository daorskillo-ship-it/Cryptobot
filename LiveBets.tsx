import React from 'react';
import { History, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function LiveBets({ bets }: { bets: any[] }) {
  return (
    <div className="glass-card rounded-3xl flex flex-col h-full min-h-[400px] overflow-hidden">
      <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <History className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="font-display font-bold text-white text-sm uppercase tracking-widest">Live Activity</h3>
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 bg-white/5 px-2 py-1 rounded-md border border-white/5">
          {bets?.length || 0} Events
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
        {!bets || bets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-700 italic text-sm">
            <History className="w-12 h-12 mb-3 opacity-10" />
            <p className="tracking-widest uppercase text-[9px] font-bold">Awaiting first spin...</p>
          </div>
        ) : (
          bets.map((bet, i) => (
            <div key={bet.id || i} className="group flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all duration-300 border border-white/5 hover:border-white/10 hover:scale-[1.01]">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                  bet.outcome === 'WIN' 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                }`}>
                  {bet.outcome === 'WIN' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2 mb-0.5">
                    <span className="font-display tracking-wide">STRAT {bet.strat}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-slate-400 font-mono">#{bet.roll}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{bet.time}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-display font-bold ${bet.outcome === 'WIN' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {bet.profit > 0 ? '+' : ''}{bet.profit.toFixed(8)}
                </div>
                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                  Bet: {bet.bet.toFixed(8)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
