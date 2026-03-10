import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Play, 
  Square, 
  Activity, 
  TrendingUp, 
  History, 
  Settings, 
  Brain, 
  Zap, 
  ShieldAlert,
  BarChart3,
  Terminal,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import LiveBets from './components/LiveBets';
import StrategySimulator from './components/StrategySimulator';
import MultiSelect from './components/MultiSelect';

interface Toast {
  id: number;
  msg: string;
  type: 'success' | 'info' | 'error';
}

interface BotUpdate {
  balance: number;
  profit: number;
  activeStrat: string;
  historyCount: number;
  chartData: { time: string; profit: number; sma?: number }[];
  stats: {
    winRate: string;
    currentStreak: number;
    maxStreak: number;
    maxDrawdown: string;
    totalBets: number;
  };
  aiWeights: Record<string, number>;
  aiConfidence: number;
  aiSectorBias: string;
  marketPhase: string;
  marketVolatility: number;
  betHistory: any[];
}

interface LogEntry {
  msg: string;
  color: string;
  time: string;
}

const STRATEGIES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"];
const STRAT_LABELS: Record<string, string> = {
  A: "Dozens",
  B: "Lottery",
  C: "Even Ch.",
  D: "6-Lines",
  E: "Splits",
  F: "Corners",
  G: "AI Lot.",
  H: "Fibonacci",
  I: "Kelly",
  J: "D'Alembert",
  K: "Paroli",
  L: "Oscar's Grind",
  M: "James Bond",
  N: "Reverse Lab.",
  O: "Tier 2 Neural"
};

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [botData, setBotData] = useState<BotUpdate | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [config, setConfig] = useState({
    token: '',
    currency: 'POL',
    baseBet: 0.00000001,
    activeStrats: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
    bets: STRATEGIES.reduce((acc, s) => ({ ...acc, [s]: 0.00000001 }), {}),
    playG: true,
    betG: 0.00000001,
    stopLoss: 0.00000001,
    takeProfit: 0.00000001,
    resetOnProfit: false,
    seedInterval: 10,
    rescueLimit: 10,
    tgToken: '',
    tgChat: '',
    aiMode: true,
    riskTolerance: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH'
  });

  const [baseBetInput, setBaseBetInput] = useState('0.00000001');
  const [stopLossInput, setStopLossInput] = useState('0.00000001');
  const [takeProfitInput, setTakeProfitInput] = useState('0.00000001');

  const [activeTab, setActiveTab] = useState<'ENGINE' | 'SIMULATOR'>('ENGINE');
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (msg: string, type: 'success' | 'info' | 'error' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('bot:status', (status) => setIsRunning(status.running));
    newSocket.on('bot:update', (data) => setBotData(data));
    newSocket.on('bot:log', (log) => {
      setLogs(prev => [log, ...prev].slice(0, 100));
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const startBot = async () => {
    try {
      const res = await fetch('/api/bot/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const stopBot = async () => {
    try {
      await fetch('/api/bot/stop', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfigChange = (field: string, value: any) => {
    if (field === 'activeStrats') {
      const added = value.filter((s: string) => !config.activeStrats.includes(s));
      const removed = config.activeStrats.filter(s => !value.includes(s));
      if (added.length) addToast(`Strategy ${STRAT_LABELS[added[0]] || added[0]} enabled`, 'success');
      if (removed.length) addToast(`Strategy ${STRAT_LABELS[removed[0]] || removed[0]} disabled`, 'info');
    }
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleBetChange = (strat: string, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setConfig(prev => ({
        ...prev,
        bets: { ...prev.bets, [strat]: num }
      }));
    }
  };

  const toggleStrat = (strat: string) => {
    setConfig(prev => {
      const active = prev.activeStrats.includes(strat)
        ? prev.activeStrats.filter(s => s !== strat)
        : [...prev.activeStrats, strat];
      return { ...prev, activeStrats: active };
    });
  };

  return (
    <div className="min-h-screen bg-bg-dark text-slate-300 font-sans selection:bg-indigo-500/30 hardware-grid">
      {/* Top Navigation */}
      <nav className="border-b border-white/5 bg-card-dark/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
              <Zap className="w-6 h-6 text-white fill-white/20" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-display font-bold tracking-tight text-white leading-none">TRINITY <span className="text-indigo-400">OS</span></h1>
              <p className="text-[9px] uppercase tracking-[0.3em] text-slate-500 font-bold mt-1">Neural Betting Engine v4.2</p>
            </div>
          </div>

          <div className="flex items-center gap-6 ml-12">
            <button 
              onClick={() => setActiveTab('ENGINE')}
              className={`text-[10px] font-bold tracking-[0.2em] relative py-5 transition-colors uppercase ${activeTab === 'ENGINE' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Bot Engine
              {activeTab === 'ENGINE' && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
              )}
            </button>
            <button 
              onClick={() => setActiveTab('SIMULATOR')}
              className={`text-[10px] font-bold tracking-[0.2em] relative py-5 transition-colors uppercase ${activeTab === 'SIMULATOR' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Simulator
              {activeTab === 'SIMULATOR' && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-4 sm:gap-8">
            <div className="hidden md:flex items-center gap-6">
              <div className="flex flex-col items-end">
                <span className="text-[9px] uppercase tracking-widest font-bold text-slate-500">System Status</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${isRunning ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {isRunning ? 'Active' : 'Standby'}
                  </span>
                </div>
              </div>
              <div className="w-px h-8 bg-white/5" />
              <div className="flex flex-col items-end">
                <span className="text-[9px] uppercase tracking-widest font-bold text-slate-500">Market Pulse</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div 
                      key={i} 
                      className={`w-1 h-3 rounded-full transition-all duration-500 ${
                        isRunning 
                          ? (i <= (botData?.marketVolatility || 0) * 5 ? 'bg-indigo-500' : 'bg-white/10') 
                          : 'bg-white/5'
                      }`} 
                    />
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              <button className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400">
                <Settings className="w-5 h-5" />
              </button>
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                <div className="w-4 h-4 bg-indigo-500/50 rounded-full blur-sm" />
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1800px] mx-auto p-4 sm:p-6 lg:p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'ENGINE' ? (
            <motion.div
              key="engine"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8"
            >
          {/* Left Column: Stats & Performance */}
          <div className="xl:col-span-8 space-y-6 lg:space-y-8">
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
              <StatCard 
                label="Total Profit" 
                value={botData?.profit.toFixed(8) || "0.00000000"} 
                subValue={`${botData?.balance.toFixed(8) || "0.00000000"} ${config.currency}`}
                icon={TrendingUp}
                color="indigo"
                trend={botData?.profit && botData.profit > 0 ? 'up' : 'down'}
              />
              <StatCard 
                label="Win Rate" 
                value={`${botData?.stats.winRate || "0.00"}%`} 
                subValue={`${botData?.stats.totalBets || 0} Total Bets`}
                icon={Activity}
                color="emerald"
              />
              <StatCard 
                label="Current Streak" 
                value={botData?.stats.currentStreak || 0} 
                subValue={`Max: ${botData?.stats.maxStreak || 0}`}
                icon={Zap}
                color="amber"
              />
              <StatCard 
                label="Max Drawdown" 
                value={botData?.stats.maxDrawdown || "0.00000000"} 
                subValue="Safety Buffer"
                icon={ShieldAlert}
                color="rose"
              />
            </div>

            {/* Performance Chart */}
            <div className="glass-card rounded-3xl p-6 lg:p-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <BarChart3 className="w-32 h-32" />
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <h3 className="font-display font-bold text-white text-lg">Performance Analytics</h3>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Real-time profit trajectory and SMA analysis</p>
                </div>
                <div className="flex items-center gap-4 bg-white/5 p-1.5 rounded-xl border border-white/5">
                  <button className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white bg-white/10 rounded-lg">Profit</button>
                  <button className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors">Drawdown</button>
                </div>
              </div>

              <div className="h-[300px] sm:h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={botData?.chartData || []}>
                    <defs>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      stroke="#ffffff20" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      minTickGap={40}
                      tick={{ fill: '#64748b' }}
                    />
                    <YAxis 
                      stroke="#ffffff20" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(val) => val.toFixed(4)}
                      tick={{ fill: '#64748b' }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0c0c0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
                      itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                      labelStyle={{ color: '#64748b', fontSize: '10px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                      cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="profit" 
                      stroke="#6366f1" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorProfit)" 
                      animationDuration={1500}
                    />
                    {botData?.chartData[0]?.sma !== undefined && (
                      <Line 
                        type="monotone" 
                        dataKey="sma" 
                        stroke="#a855f7" 
                        strokeWidth={1.5} 
                        strokeDasharray="6 6"
                        dot={false}
                        opacity={0.5}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* AI & Strategy Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {/* AI Analysis */}
              <div className="glass-card rounded-3xl p-6 lg:p-8 flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                      <Brain className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-white">Neural Analysis</h3>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Market Intelligence</p>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full">
                    <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">v2.0 Core</span>
                  </div>
                </div>

                <div className="space-y-6 flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                      <p className="text-[10px] text-slate-500 uppercase font-bold mb-1 tracking-widest">Market Phase</p>
                      <p className={`text-sm font-bold ${
                        botData?.marketPhase === 'TRENDING' ? 'text-emerald-400' :
                        botData?.marketPhase === 'CHAOTIC' ? 'text-rose-400' :
                        botData?.marketPhase === 'REVERSAL' ? 'text-amber-400' :
                        'text-indigo-400'
                      }`}>
                        {botData?.marketPhase || 'ANALYZING...'}
                      </p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                      <p className="text-[10px] text-slate-500 uppercase font-bold mb-1 tracking-widest">Sector Bias</p>
                      <p className="text-sm font-bold text-white">{botData?.aiSectorBias || 'NEUTRAL'}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold">
                      <span className="text-slate-500">Confidence Index</span>
                      <span className="text-violet-400">{botData?.aiConfidence || 0}%</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                      <motion.div 
                        className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${botData?.aiConfidence || 0}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        AI has detected a <span className="text-indigo-300 font-bold">{(botData?.marketVolatility || 0).toFixed(2)}x</span> volatility spike. 
                        Adjusting strategy weights to prioritize capital preservation.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Strategy Weights */}
              <div className="glass-card rounded-3xl p-6 lg:p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                      <Zap className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-white">Strategy Weights</h3>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Dynamic Allocation</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {STRATEGIES.filter(s => config.activeStrats.includes(s) || botData?.aiWeights[s]).map(s => {
                    const isActive = botData?.activeStrat === s;
                    const isSelected = config.activeStrats.includes(s);
                    
                    return (
                      <div key={s} className={`p-3 rounded-2xl border transition-all duration-500 group relative overflow-hidden ${
                        isActive 
                          ? 'bg-indigo-500/10 border-indigo-500/40 ring-1 ring-indigo-500/20' 
                          : isSelected
                            ? 'bg-white/5 border-white/10 hover:border-white/20'
                            : 'bg-white/5 border-white/5 opacity-40 grayscale'
                      }`}>
                        {isActive && (
                          <div className="absolute top-0 right-0 p-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse" />
                          </div>
                        )}
                        <div className="flex justify-between items-center mb-2">
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${
                            isActive ? 'text-indigo-400' : isSelected ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            {STRAT_LABELS[s]}
                          </span>
                          {isActive && (
                            <span className="text-[8px] font-black text-indigo-500/50 uppercase tracking-tighter">ACTIVE</span>
                          )}
                        </div>
                        <div className={`text-sm font-display font-bold ${isActive ? 'text-white' : 'text-slate-500'}`}>
                          {(botData?.aiWeights[s] || 1.0).toFixed(1)}<span className="text-[10px] opacity-50 ml-0.5">x</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex items-center gap-2 text-[10px] text-slate-500 font-medium italic">
                  <ChevronRight className="w-3 h-3" />
                  Weights are recalculated every 10 spins based on PnL momentum.
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Controls & Logs */}
          <div className="xl:col-span-4 space-y-6 lg:space-y-8">
            
            {/* Control Panel */}
            <div className="glass-card rounded-3xl p-6 lg:p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center border border-slate-500/20">
                    <Settings className="w-5 h-5 text-slate-400" />
                  </div>
                  <h3 className="font-display font-bold text-white">Engine Controls</h3>
                </div>
                <div className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest ${isRunning ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>
                  {isRunning ? 'Running' : 'Ready'}
                </div>
              </div>

              <div className="space-y-8">
                {/* API & Currency */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Authentication & Strategy</h4>
                  </div>
                  <div className="space-y-4">
                    <div className="relative group">
                      <input 
                        type="password" 
                        value={config.token}
                        onChange={(e) => handleConfigChange('token', e.target.value)}
                        placeholder="Casino API Token"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50 transition-all group-hover:bg-white/10"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                    </div>

                    <MultiSelect 
                      label="Active Strategies"
                      options={STRATEGIES.map(s => ({ id: s, label: STRAT_LABELS[s] }))}
                      selected={config.activeStrats}
                      onChange={(selected) => handleConfigChange('activeStrats', selected)}
                      placeholder="Select active strategies..."
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Currency</label>
                        <select 
                          value={config.currency}
                          onChange={(e) => handleConfigChange('currency', e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50 appearance-none transition-all hover:bg-white/10"
                        >
                          {["POL", "BTC", "ETH", "LTC", "DOGE", "TRX", "USDT", "USDC", "SHIB", "BNB", "SOL"].map(c => (
                            <option key={c} value={c} className="bg-card-dark">{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Base Bet</label>
                        <input 
                          type="text" 
                          inputMode="decimal"
                          value={baseBetInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                              setBaseBetInput(val);
                              const num = parseFloat(val);
                              if (!isNaN(num)) {
                                setConfig(prev => ({ ...prev, baseBet: num }));
                              }
                            }
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Risk Management */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3 bg-rose-500 rounded-full" />
                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Risk Management</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                      <label className="text-[9px] uppercase tracking-widest font-bold text-slate-500 block mb-2">Stop Loss</label>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={stopLossInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                            setStopLossInput(val);
                            const num = parseFloat(val);
                            if (!isNaN(num)) {
                              setConfig(prev => ({ ...prev, stopLoss: num }));
                            }
                          }
                        }}
                        className="w-full bg-transparent text-lg font-display font-bold text-white focus:outline-none"
                      />
                    </div>
                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                      <label className="text-[9px] uppercase tracking-widest font-bold text-slate-500 block mb-2">Take Profit</label>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={takeProfitInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                            setTakeProfitInput(val);
                            const num = parseFloat(val);
                            if (!isNaN(num)) {
                              setConfig(prev => ({ ...prev, takeProfit: num }));
                            }
                          }
                        }}
                        className="w-full bg-transparent text-lg font-display font-bold text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* AI Toggles */}
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => handleConfigChange('aiMode', !config.aiMode)}
                    className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${
                      config.aiMode ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-500'
                    }`}
                  >
                    <Brain className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">AI Mode</span>
                  </button>
                  <button 
                    onClick={() => handleConfigChange('resetOnProfit', !config.resetOnProfit)}
                    className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${
                      config.resetOnProfit ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : 'bg-white/5 border-white/10 text-slate-500'
                    }`}
                  >
                    <RotateCcw className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Auto Reset</span>
                  </button>
                </div>

                {/* Main Action Button */}
                <div className="pt-4">
                  {isRunning ? (
                    <button 
                      onClick={stopBot}
                      className="w-full group relative flex items-center justify-center gap-3 px-6 py-5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-2xl border border-rose-500/20 transition-all overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-rose-500/0 via-rose-500/10 to-rose-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                      <Square className="w-5 h-5 fill-current" />
                      <span className="font-display font-bold tracking-widest uppercase text-sm">Emergency Stop</span>
                    </button>
                  ) : (
                    <button 
                      onClick={startBot}
                      className="w-full group relative flex items-center justify-center gap-3 px-6 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-2xl shadow-indigo-600/40 transition-all overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                      <Play className="w-5 h-5 fill-current" />
                      <span className="font-display font-bold tracking-widest uppercase text-sm">Initialize Engine</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Live Activity & Logs */}
            <div className="space-y-6">
              <div className="h-[400px]">
                <LiveBets bets={botData?.betHistory || []} />
              </div>

              <div className="glass-card rounded-3xl flex flex-col h-[400px]">
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                      <Terminal className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h3 className="font-display font-bold text-white text-sm uppercase tracking-widest">System Console</h3>
                  </div>
                  <button 
                    onClick={() => setLogs([])}
                    className="text-[10px] text-slate-500 hover:text-white uppercase font-bold tracking-widest transition-colors"
                  >
                    Flush
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 font-mono text-[10px] space-y-2.5 scrollbar-hide">
                  {logs.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-700 italic">
                      <Terminal className="w-12 h-12 mb-3 opacity-10" />
                      <p className="tracking-widest uppercase text-[9px] font-bold">Awaiting telemetry...</p>
                    </div>
                  )}
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-4 animate-in fade-in slide-in-from-left-2 duration-500">
                      <span className="text-slate-600 shrink-0 font-bold">[{log.time}]</span>
                      <span style={{ color: log.color }} className="leading-relaxed">{log.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
            </motion.div>
          ) : (
            <motion.div
              key="simulator"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <StrategySimulator />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Toast Notifications */}
      <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className={`pointer-events-auto px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-center gap-3 min-w-[240px] ${
                toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                toast.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${
                toast.type === 'success' ? 'bg-emerald-500' :
                toast.type === 'error' ? 'bg-rose-500' :
                'bg-indigo-500'
              }`} />
              <span className="text-xs font-bold tracking-wide">{toast.msg}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatCard({ label, value, subValue, icon: Icon, color, trend }: any) {
  const colors: any = {
    indigo: 'from-indigo-500/20 to-indigo-500/5 text-indigo-400 border-indigo-500/20 ring-indigo-500/10',
    emerald: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/20 ring-emerald-500/10',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/20 ring-amber-500/10',
    rose: 'from-rose-500/20 to-rose-500/5 text-rose-400 border-rose-500/20 ring-rose-500/10',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border ring-1 rounded-3xl p-5 lg:p-6 relative overflow-hidden group transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl`}>
      <div className="absolute -right-6 -bottom-6 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 group-hover:scale-110 group-hover:-rotate-12">
        <Icon className="w-32 h-32" />
      </div>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[9px] uppercase tracking-[0.25em] font-bold opacity-60">{label}</p>
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
            <Icon className="w-4 h-4 opacity-70" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <h4 className="text-lg lg:text-2xl font-display font-bold text-white tracking-tight">{value}</h4>
          {trend && (
            <div className={`flex items-center text-[10px] font-bold ${trend === 'up' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {trend === 'up' ? <ChevronRight className="w-3 h-3 -rotate-90" /> : <ChevronRight className="w-3 h-3 rotate-90" />}
            </div>
          )}
        </div>
        <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-widest">{subValue}</p>
      </div>
    </div>
  );
}
