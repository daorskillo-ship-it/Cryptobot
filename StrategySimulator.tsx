import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Play, RotateCcw, TrendingUp, ShieldAlert, Target, Activity } from 'lucide-react';

export default function StrategySimulator() {
  const [params, setParams] = useState({
    strategy: 'MARTINGALE',
    initialBalance: 100,
    baseBet: 0.1,
    spins: 1000,
    winProb: 48.6,
    payout: 2,
    sequence: '1,2,3'
  });

  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runSimulation = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          sequence: params.sequence.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
        })
      });
      const data = await res.json();
      setResults(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const setLabSequence = (seq: string) => {
    setParams({ ...params, sequence: seq, strategy: 'LABOUCHERE' });
  };

  return (
    <div className="space-y-8">
      <div className="glass-card rounded-3xl p-6 lg:p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
            <Activity className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-display font-bold text-white">Simulation Parameters</h3>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Configure your test run</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Strategy</label>
            <select 
              value={params.strategy}
              onChange={(e) => setParams({ ...params, strategy: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50 appearance-none transition-all hover:bg-white/10"
            >
              <option value="MARTINGALE" className="bg-card-dark">Martingale</option>
              <option value="LABOUCHERE" className="bg-card-dark">Labouchere</option>
              <option value="FIBONACCI" className="bg-card-dark">Fibonacci</option>
              <option value="KELLY" className="bg-card-dark">Kelly Criterion</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Initial Balance</label>
            <input 
              type="number"
              value={params.initialBalance}
              onChange={(e) => setParams({ ...params, initialBalance: parseFloat(e.target.value) })}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Base Bet</label>
            <input 
              type="number"
              value={params.baseBet}
              onChange={(e) => setParams({ ...params, baseBet: parseFloat(e.target.value) })}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Spins</label>
            <input 
              type="number"
              value={params.spins}
              onChange={(e) => setParams({ ...params, spins: parseInt(e.target.value) })}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Win Prob (%)</label>
            <input 
              type="number"
              value={params.winProb}
              onChange={(e) => setParams({ ...params, winProb: parseFloat(e.target.value) })}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Payout (x)</label>
            <input 
              type="number"
              value={params.payout}
              onChange={(e) => setParams({ ...params, payout: parseFloat(e.target.value) })}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          {params.strategy === 'LABOUCHERE' && (
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Sequence</label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={params.sequence}
                  onChange={(e) => setParams({ ...params, sequence: e.target.value })}
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50"
                  placeholder="e.g. 1,2,3"
                />
              </div>
              <div className="flex gap-2 mt-2 overflow-x-auto pb-2 scrollbar-hide">
                {['1,1,1', '1,2,3', '1,1,2,2,3,3', '1,2,3,4,5'].map(s => (
                  <button 
                    key={s}
                    onClick={() => setLabSequence(s)}
                    className="whitespace-nowrap px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold text-slate-400 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8">
          <button 
            onClick={runSimulation}
            disabled={loading}
            className="w-full group relative flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl shadow-2xl shadow-indigo-600/40 transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            {loading ? <RotateCcw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
            <span className="font-display font-bold tracking-widest uppercase text-sm">Execute Simulation</span>
          </button>
        </div>
      </div>

      {results && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card rounded-3xl p-6 border-emerald-500/20">
              <div className="flex items-center gap-3 text-emerald-400 mb-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <TrendingUp size={16} />
                </div>
                <span className="text-[10px] uppercase tracking-widest font-bold">Final Balance</span>
              </div>
              <div className="text-3xl font-display font-bold text-white tracking-tight">{results.finalBalance.toFixed(8)}</div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">End of Run</p>
            </div>
            
            <div className="glass-card rounded-3xl p-6 border-rose-500/20">
              <div className="flex items-center gap-3 text-rose-400 mb-4">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                  <ShieldAlert size={16} />
                </div>
                <span className="text-[10px] uppercase tracking-widest font-bold">Max Drawdown</span>
              </div>
              <div className="text-3xl font-display font-bold text-white tracking-tight">{results.maxDrawdown.toFixed(8)}</div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Risk Exposure</p>
            </div>

            <div className="glass-card rounded-3xl p-6 border-indigo-500/20">
              <div className="flex items-center gap-3 text-indigo-400 mb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                  <Target size={16} />
                </div>
                <span className="text-[10px] uppercase tracking-widest font-bold">Win Rate</span>
              </div>
              <div className="text-3xl font-display font-bold text-white tracking-tight">
                {((results.wins / (results.wins + results.losses)) * 100).toFixed(1)}%
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Statistical Edge</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 glass-card rounded-3xl p-6 lg:p-8 h-[450px]">
              <div className="flex items-center gap-2 mb-8">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <h3 className="font-display font-bold text-white">Simulation Trajectory</h3>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={results.history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis dataKey="spin" hide />
                  <YAxis 
                    stroke="#ffffff20" 
                    fontSize={10} 
                    tickFormatter={(val) => val.toFixed(2)}
                    domain={['auto', 'auto']}
                    tick={{ fill: '#64748b' }}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0c0c0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    labelStyle={{ color: '#64748b', fontSize: '10px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                    cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="balance" 
                    stroke="#6366f1" 
                    strokeWidth={3} 
                    dot={false}
                    animationDuration={1500}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card rounded-3xl p-6 lg:p-8 flex flex-col h-[450px]">
              <div className="flex items-center gap-2 mb-6">
                <Activity className="w-4 h-4 text-indigo-400" />
                <h3 className="font-display font-bold text-white">Strategy Telemetry</h3>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {results.labLogs && results.labLogs.length > 0 ? (
                  results.labLogs.map((log: string, idx: number) => (
                    <div key={idx} className="font-mono text-[10px] py-2 px-3 rounded-lg bg-white/5 border border-white/5 text-slate-400">
                      {log.includes('⚠️') ? (
                        <span className="text-amber-400 font-bold">{log}</span>
                      ) : (
                        <>
                          <span className="text-indigo-400/50 mr-2">[{idx.toString().padStart(3, '0')}]</span>
                          {log}
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
                      <Activity className="w-6 h-6 text-slate-600" />
                    </div>
                    <p className="text-xs text-slate-500 font-medium italic">No telemetry data available for this strategy.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
