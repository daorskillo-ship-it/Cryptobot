import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = "https://api.paradice.in/api.php";

const ROULETTE_POCKETS: Record<string, string> = {
  RED: "1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36",
  BLACK: "2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35",
  EVEN: "2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36",
  ODD: "1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35",
  LOW: "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18",
  HIGH: "19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36"
};

interface BotConfig {
  token: string;
  currency: string;
  baseBet: number;
  activeStrats: string[];
  bets: Record<string, number>;
  playG: boolean;
  betG: number;
  stopLoss: number;
  takeProfit: number;
  resetOnProfit: boolean;
  seedInterval: number;
  rescueLimit: number;
  tgToken: string;
  tgChat: string;
  aiMode: boolean;
  riskTolerance: "LOW" | "MEDIUM" | "HIGH";
}

interface StratStats {
  wins: number;
  losses: number;
  streak: number;
  last20: number[]; // Track normalized PnL of last 20 rolls
}

interface BetRecord {
  id: number;
  time: string;
  strat: string;
  bet: number;
  outcome: "WIN" | "LOSS";
  profit: number;
  roll: number;
}

class BotInstance {
  config: BotConfig;
  running: boolean = false;
  profit: number = 0;
  balance: number = 0;
  activeStrat: string = "A";
  history: number[] = [];
  chartData: { time: string; profit: number; sma?: number }[] = [{ time: new Date().toLocaleTimeString(), profit: 0 }];
  logs: { msg: string; color: string; time: string }[] = [];
  io: Server;
  
  // Stats
  totalBets: number = 0;
  wins: number = 0;
  losses: number = 0;
  currentStreak: number = 0;
  maxStreak: number = 0;
  maxDrawdown: number = 0;
  peakProfit: number = 0;

  // AI / Virtual Stats
  virtualStats: Record<string, StratStats> = {};
  aiWeights: Record<string, number> = {};
  aiConfidence: number = 50;
  aiSectorBias: string = "NONE";
  marketPhase: string = "ACCUMULATION";
  lastAIAnalysisRoll: number = 0;
  isAnalyzing: boolean = false;
  marketVolatility: number = 0;
  betHistory: BetRecord[] = [];
  
  // Bot internal state
  rezimA: "TUCET" | "RADA" = "TUCET";
  labSeqA: number[] = [1, 1];
  stratBNums: number[] = [];
  stratBLossCounter: number = 0;
  stratBCurrentBet: number = 0;
  stratGNums: number[] = [];
  stratGLossCounter: number = 0;
  stratGCurrentBet: number = 0;
  
  // Fibonacci Sequences
  fibIdxA: number = 0;
  fibIdxC: number = 0;
  fibIdxD: number = 0;
  fibIdxE: number = 0;
  fibIdxF: number = 0;
  fibSeq: number[] = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

  labSeqC: number[] = [1, 1];
  labSeqD: number[] = [1, 1];
  labSeqE: number[] = [1, 1];
  labSeqF: number[] = [1, 1];
  
  // New strategies state
  dalemUnitsJ: number = 1;
  paroliStepK: number = 0;
  paroliBetK: number = 0;
  oscarUnitsL: number = 1;
  oscarProfitL: number = 0;
  revLabSeqN: number[] = [1, 1];
  neuralWeightsO: Record<number, number> = {};
  
  lastNum: number | null = null;
  sessionStartBal: number | null = null;
  highestBal: number = 0;
  lastSeedTime: number = Date.now();
  dynamicLimit: number = 0;

  allSplits: number[][] = [];
  allCorners: number[][] = [];

  constructor(config: BotConfig, io: Server) {
    this.config = config;
    this.io = io;
    this.dynamicLimit = config.rescueLimit;
    this.activeStrat = config.activeStrats[0] || "A";
    this.stratBCurrentBet = config.bets["B"] || 0;
    this.stratGCurrentBet = config.bets["G"] || 0;
    this.initBoardData();
    this.stratBNums = this.generateRandom8();
    this.stratGNums = [0, ...this.generateSmart6()];
    
    // Initialize Virtual Stats for all strategies
    ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"].forEach(s => {
      this.virtualStats[s] = { wins: 0, losses: 0, streak: 0, last20: [] };
      this.aiWeights[s] = 1.0; // Default weight
    });
  }

  initBoardData() {
    for (let n = 1; n <= 36; n++) {
      if (n % 3 !== 0) this.allSplits.push([n, n + 1]);
      if (n <= 33) this.allSplits.push([n, n + 3]);
    }
    for (let n = 1; n <= 32; n++) {
      if (n % 3 !== 0) this.allCorners.push([n, n + 1, n + 3, n + 4]);
    }
  }

  generateRandom8() {
    const nums = new Set<number>();
    while (nums.size < 8) {
      nums.add(Math.floor(Math.random() * 37));
    }
    return Array.from(nums);
  }

  generateSmart6() {
    const counts: Record<number, number> = {};
    for (let i = 1; i <= 36; i++) counts[i] = 0;
    this.history.forEach(n => {
      if (typeof n === 'number' && n >= 1 && n <= 36) counts[n]++;
    });
    return Object.keys(counts)
      .map(Number)
      .sort((a, b) => counts[a] - counts[b])
      .slice(0, 6);
  }

  log(msg: string, color: string = "white") {
    const time = new Date().toLocaleTimeString();
    const logEntry = { msg, color, time };
    this.logs.push(logEntry);
    if (this.logs.length > 100) this.logs.shift();
    this.io.emit("bot:log", logEntry);
  }

  async sendTg(message: string) {
    if (!this.config.tgToken || !this.config.tgChat) return;
    try {
      await axios.post(`https://api.telegram.org/bot${this.config.tgToken}/sendMessage`, {
        chat_id: this.config.tgChat,
        text: message
      });
    } catch (e) {}
  }

  getLabBet(seq: number[]) {
    if (!seq.length) return 1;
    return seq.length === 1 ? seq[0] : seq[0] + seq[seq.length - 1];
  }

  updateLab(seq: number[], isWin: boolean, units: number) {
    if (isWin) {
      if (seq.length >= 2) {
        seq.shift();
        seq.pop();
      } else if (seq.length === 1) {
        seq.shift();
      }
      return seq.length ? seq : [1, 1];
    } else {
      seq.push(units);
      
      // Improvement: Split sequence if it gets too long (e.g. > 10) to reduce bet sizes
      if (seq.length > 10) {
        const sum = seq.reduce((a, b) => a + b, 0);
        const half = Math.floor(sum / 2);
        const newSeq = [Math.floor(half/2), Math.ceil(half/2)];
        this.log(`⚠️ Labouchere Split: Sequence too long (${seq.length}). Reducing to [${newSeq.join(",")}]`, "#fbbf24");
        return newSeq;
      }
      
      return seq;
    }
  }

  getPatternPrediction(): number | null {
    if (this.history.length < 10) return null;
    
    // Look for repeating sequences of 2 or 3
    const last3 = this.history.slice(-3);
    const last2 = this.history.slice(-2);
    
    // Try to find last3 pattern elsewhere in history
    for (let i = this.history.length - 4; i >= 0; i--) {
      if (this.history[i] === last3[0] && this.history[i+1] === last3[1] && this.history[i+2] === last3[2]) {
        if (i + 3 < this.history.length - 3) {
          return this.history[i+3];
        }
      }
    }
    
    // Try to find last2 pattern
    for (let i = this.history.length - 3; i >= 0; i--) {
      if (this.history[i] === last2[0] && this.history[i+1] === last2[1]) {
        if (i + 2 < this.history.length - 2) {
          return this.history[i+2];
        }
      }
    }
    
    return null;
  }

  getSmartTargets(strat: string): any {
    const prediction = this.getPatternPrediction();
    
    if (this.history.length < 15) {
      if (strat === "A") {
        const ls = this.lastNum && this.lastNum >= 1 && this.lastNum <= 36 ? Math.floor((this.lastNum - 1) / 12) + 1 : 0;
        return [1, 2, 3].filter(t => t !== ls).slice(0, 2);
      } else if (strat === "C") {
        const options = ["RED", "BLACK", "EVEN", "ODD", "LOW", "HIGH"];
        return options[Math.floor(Math.random() * options.length)];
      } else if (strat === "D") {
        return [1, 2, 3, 4, 5, 6].sort(() => 0.5 - Math.random()).slice(0, 3);
      } else if (strat === "E") {
        return this.allSplits.sort(() => 0.5 - Math.random()).slice(0, 8);
      } else if (strat === "F") {
        return this.allCorners.sort(() => 0.5 - Math.random()).slice(0, 4);
      }
    }

    if (strat === "B") {
      const base = this.generateRandom8();
      if (prediction !== null && !base.includes(prediction)) {
        base[Math.floor(Math.random() * base.length)] = prediction;
      }
      return base;
    } else if (strat === "G") {
      const base = [0, ...this.generateSmart6()];
      if (prediction !== null && !base.includes(prediction)) {
        base[Math.floor(Math.random() * base.length)] = prediction;
      }
      return base;
    }

    if (strat === "A") {
      const tucetCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
      const radaCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
      
      this.history.forEach(n => { 
        if (typeof n === 'number' && n >= 1 && n <= 36) {
          tucetCounts[Math.floor((n - 1) / 12) + 1]++; 
          radaCounts[(n - 1) % 3 + 1]++;
        }
      });

      // Evaluate which mode has a stronger trend/pattern
      const tucetVariance = Math.max(...Object.values(tucetCounts)) - Math.min(...Object.values(tucetCounts));
      const radaVariance = Math.max(...Object.values(radaCounts)) - Math.min(...Object.values(radaCounts));
      
      // Switch rezimA if the other mode has significantly better variance (stronger trend)
      if (radaVariance > tucetVariance + 2) this.rezimA = "RADA";
      else if (tucetVariance > radaVariance + 2) this.rezimA = "TUCET";

      const counts = this.rezimA === "TUCET" ? tucetCounts : radaCounts;
      
      // If trending, follow the hot dozens. If reversal, follow the cold ones.
      // In CHAOTIC phase, we prefer a mix or stay conservative.
      let sortOrder = this.marketPhase === "TRENDING" ? -1 : 1;
      if (this.marketPhase === "CHAOTIC") sortOrder = Math.random() > 0.5 ? 1 : -1;

      const sorted = Object.keys(counts).map(Number).sort((a, b) => (counts[a] - counts[b]) * sortOrder);
      
      const dozenOfPrediction = prediction !== null && prediction >= 1 && prediction <= 36 ? Math.floor((prediction - 1) / 12) + 1 : null;
      const colOfPrediction = prediction !== null && prediction >= 1 && prediction <= 36 ? (prediction - 1) % 3 + 1 : null;
      const predTarget = this.rezimA === "TUCET" ? dozenOfPrediction : colOfPrediction;

      if (predTarget !== null && sorted.includes(predTarget)) {
        const idx = sorted.indexOf(predTarget);
        sorted.splice(idx, 1);
        sorted.unshift(predTarget);
      }

      return sorted.slice(0, 2);
    } else if (strat === "C") {
      const c: Record<string, number> = { RED: 0, BLACK: 0, EVEN: 0, ODD: 0, LOW: 0, HIGH: 0 };
      const redNums = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
      this.history.forEach(n => {
        if (typeof n !== 'number' || n < 1 || n > 36) return;
        if (redNums.includes(n)) c.RED++; else c.BLACK++;
        if (n % 2 === 0) c.EVEN++; else c.ODD++;
        if (n <= 18) c.LOW++; else c.HIGH++;
      });
      
      const sortOrder = this.marketPhase === "TRENDING" ? -1 : 1;
      const sorted = Object.keys(c).sort((a, b) => (c[a] - c[b]) * sortOrder);
      
      if (prediction !== null && prediction >= 1 && prediction <= 36) {
        const redNums = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        const isRed = redNums.includes(prediction);
        const isEven = prediction % 2 === 0;
        const isLow = prediction <= 18;
        
        // Find which category the prediction belongs to and prioritize it
        const predCats = [];
        if (isRed) predCats.push("RED"); else predCats.push("BLACK");
        if (isEven) predCats.push("EVEN"); else predCats.push("ODD");
        if (isLow) predCats.push("LOW"); else predCats.push("HIGH");
        
        // For strategy C, we only return one target, so we pick the one that matches prediction AND is in sorted top
        const bestMatch = sorted.find(cat => predCats.includes(cat));
        if (bestMatch) return bestMatch;
      }

      return sorted[0];
    } else if (strat === "D") {
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      this.history.forEach(n => { 
        if (typeof n === 'number' && n >= 1 && n <= 36) {
          counts[Math.floor((n - 1) / 6) + 1]++; 
        }
      });
      const sortOrder = this.marketPhase === "TRENDING" ? -1 : 1;
      const sorted = Object.keys(counts).map(Number).sort((a, b) => (counts[a] - counts[b]) * sortOrder);
      
      if (prediction !== null && prediction >= 1 && prediction <= 36) {
        const lineOfPrediction = Math.floor((prediction - 1) / 6) + 1;
        if (sorted.includes(lineOfPrediction)) {
          const idx = sorted.indexOf(lineOfPrediction);
          sorted.splice(idx, 1);
          sorted.unshift(lineOfPrediction);
        }
      }

      return sorted.slice(0, 3);
    } else if (strat === "E") {
      const scores = this.allSplits.map(s => ({ s, count: this.history.filter(n => s.includes(n)).length }));
      const sortOrder = this.marketPhase === "TRENDING" ? -1 : 1;
      const sorted = scores.sort((a, b) => (a.count - b.count) * sortOrder);
      
      if (prediction !== null) {
        const matchingSplit = sorted.find(x => x.s.includes(prediction));
        if (matchingSplit) {
          const idx = sorted.indexOf(matchingSplit);
          sorted.splice(idx, 1);
          sorted.unshift(matchingSplit);
        }
      }

      return sorted.slice(0, 8).map(x => x.s);
    } else if (strat === "F") {
      const scores = this.allCorners.map(c => ({ c, count: this.history.filter(n => c.includes(n)).length }));
      const sortOrder = this.marketPhase === "TRENDING" ? -1 : 1;
      const sorted = scores.sort((a, b) => (a.count - b.count) * sortOrder);
      
      if (prediction !== null) {
        const matchingCorner = sorted.find(x => x.c.includes(prediction));
        if (matchingCorner) {
          const idx = sorted.indexOf(matchingCorner);
          sorted.splice(idx, 1);
          sorted.unshift(matchingCorner);
        }
      }

      return sorted.slice(0, 4).map(x => x.c);
    } else if (strat === "G") {
      return [0, ...this.generateSmart6()];
    } else if (strat === "J" || strat === "K" || strat === "L" || strat === "N") {
      // Even chances strategies
      const c: Record<string, number> = { RED: 0, BLACK: 0, EVEN: 0, ODD: 0, LOW: 0, HIGH: 0 };
      const redNums = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
      this.history.forEach(n => {
        if (typeof n !== 'number' || n < 1 || n > 36) return;
        if (redNums.includes(n)) c.RED++; else c.BLACK++;
        if (n % 2 === 0) c.EVEN++; else c.ODD++;
        if (n <= 18) c.LOW++; else c.HIGH++;
      });
      const sortOrder = this.marketPhase === "TRENDING" ? -1 : 1;
      const sorted = Object.keys(c).sort((a, b) => (c[a] - c[b]) * sortOrder);
      return sorted[0];
    } else if (strat === "M") {
      // James Bond fixed targets
      return ["HIGH", "LINE_13_18", "ZERO"];
    } else if (strat === "O") {
      // Neural Tier 2: Weighted board based on recent frequency and sector bias
      const counts: Record<number, number> = {};
      for (let i = 0; i <= 36; i++) counts[i] = 0;
      this.history.slice(-50).forEach(n => counts[n]++);
      
      const sorted = Object.keys(counts).map(Number).sort((a, b) => counts[b] - counts[a]);
      return sorted.slice(0, 12); // Top 12 numbers
    }
  }

  getPocketStrA(mode: string, idx: number) {
    if (mode === "TUCET") {
      if (idx === 1) return "1,2,3,4,5,6,7,8,9,10,11,12";
      if (idx === 2) return "13,14,15,16,17,18,19,20,21,22,23,24";
      if (idx === 3) return "25,26,27,28,29,30,31,32,33,34,35,36";
    } else {
      if (idx === 1) return "1,4,7,10,13,16,19,22,25,28,31,34";
      if (idx === 2) return "2,5,8,11,14,17,20,23,26,29,32,35";
      if (idx === 3) return "3,6,9,12,15,18,21,24,27,30,33,36";
    }
    return "";
  }

  async rotateSeed() {
    try {
      const newSeed = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      await axios.post(API_URL, {
        query: `mutation { rotateClientSeed(seed: "${newSeed}") }`
      }, { headers: { "x-access-token": this.config.token } });
      this.log("🎲 SEED RESET", "#d946ef");
      this.lastSeedTime = Date.now();
    } catch (e) {}
  }

  async stop() {
    this.running = false;
    this.log("⏹ Bot was stopped.", "#ef4444");
    this.sendTg("⏹ Bot was stopped.");
    this.io.emit("bot:status", { running: false });
  }

  calculateSMA(data: { profit: number }[], period: number) {
    if (data.length < period) return undefined;
    const slice = data.slice(-period);
    const sum = slice.reduce((acc, val) => acc + val.profit, 0);
    return sum / period;
  }

  async syncBalance() {
    try {
      const response = await axios.post(API_URL, {
        query: "query { user { wallets { currency balance } } }"
      }, { headers: { "x-access-token": this.config.token, "Content-Type": "application/json" }, timeout: 10000 });
      
      const wallets = response.data?.data?.user?.wallets;
      if (wallets) {
        const wallet = wallets.find((w: any) => w.currency === this.config.currency);
        if (wallet) {
          this.balance = wallet.balance;
          if (this.sessionStartBal === null) {
            this.sessionStartBal = this.balance;
            this.highestBal = this.balance;
          }
          this.log(`🏦 Balance Synced: ${this.balance.toFixed(8)} ${this.config.currency}`, "#94a3b8");
        } else {
          const available = wallets.map((w: any) => w.currency).join(", ");
          this.log(`⚠️ Wallet for ${this.config.currency} not found. Available: ${available}`, "#fbbf24");
          // Fallback to first available if only one
          if (wallets.length === 1) {
            this.balance = wallets[0].balance;
            this.log(`🔄 Falling back to ${wallets[0].currency} wallet`, "#94a3b8");
          }
        }
      }
    } catch (e) {
      console.error("Balance sync failed:", e);
    }
  }

  private async startTelegramListener() {
    let lastUpdateId = 0;
    while (this.running) {
      if (!this.config.tgToken || !this.config.tgChat) {
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      try {
        const url = `https://api.telegram.org/bot${this.config.tgToken}/getUpdates?offset=${lastUpdateId}&timeout=5`;
        const res = await axios.get(url, { timeout: 10000 });
        if (res.data.ok) {
          for (const item of res.data.result) {
            lastUpdateId = item.update_id + 1;
            const msg = item.message || {};
            const chat = String(msg.chat?.id || "");
            const text = (msg.text || "").trim().toLowerCase();
            if (chat === this.config.tgChat && text) {
              await this.handleTelegramCommand(text);
            }
          }
        }
      } catch (e) {}
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  private async handleTelegramCommand(fullText: string) {
    const parts = fullText.split(" ");
    const cmd = parts[0];

    if (cmd === "/stop") {
      if (this.running) {
        await this.stop();
        await this.sendTg("🛑 Bot se bezpečně zastavuje.");
      } else {
        await this.sendTg("ℹ️ Bot už je zastavený.");
      }
    } else if (cmd === "/status") {
      const msg = `📊 AKTUALNÍ STATUS:\n💰 Profit: ${this.profit.toFixed(8)}\n🏦 Zůstatek: ${this.balance.toFixed(8)}\n⚙️ Strat: ${this.activeStrat}\n🧠 AI Paměť: ${this.history.length}/100`;
      await this.sendTg(msg);
    } else if (cmd === "/start") {
      if (!this.running) {
        this.start();
        await this.sendTg("🚀 Bot se spouští s aktuálním nastavením!");
      } else {
        await this.sendTg("ℹ️ Bot už běží.");
      }
    } else if (cmd === "/sl" && parts.length > 1) {
      const val = parseFloat(parts[1]);
      if (!isNaN(val)) {
        this.config.stopLoss = val;
        await this.sendTg(`✅ Stop Loss změněn na: ${val}`);
        this.io.emit("bot:config_update", { stopLoss: val });
      }
    } else if (cmd === "/tp" && parts.length > 1) {
      const val = parseFloat(parts[1]);
      if (!isNaN(val)) {
        this.config.takeProfit = val;
        await this.sendTg(`✅ Take Profit změněn na: ${val}`);
        this.io.emit("bot:config_update", { takeProfit: val });
      }
    } else if (cmd === "/help") {
      const helpText = "🤖 Dálkové ovládání bota:\n\n🟢 /start - Spustí sázení\n🔴 /stop - Zastaví sázení\n📊 /status - Výpis profitu\n📉 /sl <číslo> - Stop Loss\n📈 /tp <číslo> - Take Profit";
      await this.sendTg(helpText);
    }
  }

  async start() {
    if (this.running) return;
    this.running = true;
    console.log("BotInstance.start() called");
    this.log("🚀 TRINITY START", "#4ade80");
    
    // Initial balance sync
    await this.syncBalance();
    
    this.sendTg(`🚀 TRINITY SPUŠTĚN\nMěna: ${this.config.currency}\nZůstatek: ${this.balance.toFixed(8)}\nStop Loss: ${this.config.stopLoss}\nTake Profit: ${this.config.takeProfit}`);
    this.io.emit("bot:status", { running: true });

    // Start Telegram Listener
    this.startTelegramListener();

    while (this.running) {
      try {
        const drawdown = Math.max(0, this.highestBal - this.balance);
        // Market Analysis (Always active, even without AI)
        this.calculateVolatility();
        const marketDrawdown = this.peakProfit - this.profit;
        
        const { betMultiplier, skipRoll } = await this.evaluateMarketConditions(marketDrawdown);
        if (skipRoll) continue;

        let { betsPayload, totalBetSpin, infoMsg, isCrisis } = this.generateBetsForStrategy(betMultiplier);

        if (isCrisis) {
          await this.triggerRescuePivot(drawdown);
          continue;
        }

        // Hard Safety Cap: Never bet more than 5% of balance on a single spin
        const maxAllowedBet = this.balance * 0.05;
        if (totalBetSpin > maxAllowedBet && this.balance > 0) {
          this.log(`⚠️ Safety Cap Triggered: Bet ${totalBetSpin.toFixed(8)} exceeds 5% of balance. Scaling down.`, "#fbbf24");
          const scaleFactor = maxAllowedBet / totalBetSpin;
          betsPayload = betsPayload.map(b => ({ ...b, bet: parseFloat((b.bet * scaleFactor).toFixed(8)) }));
          totalBetSpin = maxAllowedBet;
          infoMsg += ` (Scaled x${scaleFactor.toFixed(2)})`;
        }

        // Balance Check
        if (this.balance > 0 && totalBetSpin > this.balance) {
          this.log(`⚠️ Insufficient Funds: Bet ${totalBetSpin.toFixed(8)} > Balance ${this.balance.toFixed(8)}`, "#f87171");
          await this.syncBalance();
          if (totalBetSpin > this.balance) {
            this.log("🛡️ Safety: Skipping roll due to insufficient funds.", "#94a3b8");
            await new Promise(r => setTimeout(r, 10000));
            continue;
          }
        }

        if (betsPayload.length === 0) {
          if (!isCrisis) {
            this.log("⚠️ Logic Error: No bets generated. Forcing fallback.", "#fbbf24");
            const fallbackTarget = this.getSmartTargets("A");
            fallbackTarget.forEach((t: number) => {
              const amt = this.config.baseBet;
              betsPayload.push({ pocket: this.getPocketStrA("TUCET", t), bet: parseFloat(amt.toFixed(8)) });
            });
          } else {
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
        }

        // API Resilience: Retry mechanism
        let response;
        let retries = 0;
        const maxRetries = 3;
        while (retries < maxRetries) {
          try {
            response = await axios.post(API_URL, {
              query: "mutation spinRoulette($bets: [RouletteBetInput]!, $currency: CurrencyEnum!) { spinRoulette(bets: $bets, currency: $currency) { roll winAmount user { wallets { currency balance } } } }",
              variables: { bets: betsPayload, currency: this.config.currency }
            }, { headers: { "x-access-token": this.config.token, "Content-Type": "application/json" }, timeout: 15000 });
            break;
          } catch (e: any) {
            retries++;
            if (retries >= maxRetries) {
              this.log(`❌ API Connection Failed after ${maxRetries} attempts.`, "#ef4444");
              throw e;
            }
            this.log(`🔄 API Retry ${retries}/${maxRetries}...`, "#94a3b8");
            await new Promise(r => setTimeout(r, 2000 * retries));
          }
        }

        const data = response.data;
        if (data.errors) {
          const errMsg = data.errors[0].message;
          this.log(`API Error: ${errMsg}`, "#ef4444");
          if (errMsg === "incorrect_bet") {
            this.log(`🔍 Debug: Strat ${this.activeStrat}, Total: ${totalBetSpin.toFixed(8)}`, "#94a3b8");
            this.log(`📦 Payload: ${JSON.stringify(betsPayload[0])}`, "#94a3b8");
          }
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }

        const res = data.data.spinRoulette;
        const roll = res.roll;
        
        // AI Analysis: Update virtual stats for all strategies based on this roll
        this.updateVirtualStats(roll);
        this.calculateVolatility();

        // Smart AI Analysis Trigger (Longevity & Performance)
        if (this.config.aiMode && !this.isAnalyzing) {
          const rollsSinceLast = this.totalBets - this.lastAIAnalysisRoll;
          const drawdown = this.peakProfit - this.profit;
          const isStruggling = drawdown > this.config.stopLoss * 0.3 || this.currentStreak < -3;
          const isVolatile = this.marketVolatility > 0.6;
          
          // Trigger AI if:
          // 1. We are struggling (every 30 rolls)
          // 2. Market is volatile (every 50 rolls)
          // 3. Normal operation (every 100 rolls)
          const threshold = isStruggling ? 30 : (isVolatile ? 50 : 100);
          
          if (rollsSinceLast >= threshold) {
            this.lastAIAnalysisRoll = this.totalBets;
            this.runAIPatternAnalysis().catch(e => console.error("AI Analysis Error:", e));
          }
        }

        const winTotal = parseFloat(res.winAmount);
        const isWin = winTotal > totalBetSpin;
        const curBal = res.user.wallets.find((w: any) => w.currency === this.config.currency || w.currency === "USDT")?.balance || 0;

        const profit = winTotal - totalBetSpin;
        const record: BetRecord = {
          id: this.totalBets + 1,
          time: new Date().toLocaleTimeString(),
          strat: this.activeStrat,
          bet: totalBetSpin,
          outcome: isWin ? "WIN" : "LOSS",
          profit: profit,
          roll: roll
        };
        this.betHistory.unshift(record);
        if (this.betHistory.length > 50) this.betHistory.pop();

        this.history.push(roll);
        if (this.history.length > 500) this.history.shift();
        
        if (this.sessionStartBal === null) {
          this.sessionStartBal = curBal + totalBetSpin;
          this.highestBal = this.sessionStartBal;
        }
        
        this.profit = curBal - this.sessionStartBal;
        this.balance = curBal;

        // Update Stats
        this.totalBets++;
        if (isWin) {
          this.wins++;
          this.currentStreak = this.currentStreak >= 0 ? this.currentStreak + 1 : 1;
        } else {
          this.losses++;
          this.currentStreak = this.currentStreak <= 0 ? this.currentStreak - 1 : -1;
        }
        if (Math.abs(this.currentStreak) > this.maxStreak) this.maxStreak = Math.abs(this.currentStreak);
        
        if (this.profit > this.peakProfit) this.peakProfit = this.profit;
        const currentDrawdown = this.peakProfit - this.profit;
        if (currentDrawdown > this.maxDrawdown) this.maxDrawdown = currentDrawdown;

        const chartEntry = { 
          time: new Date().toLocaleTimeString(), 
          profit: this.profit,
          sma: this.calculateSMA(this.chartData, 10)
        };
        this.chartData.push(chartEntry);
        if (this.chartData.length > 500) this.chartData.shift();

        // Update strategies
        if (this.activeStrat === "A") {
          const u = this.getLabBet(this.labSeqA);
          this.labSeqA = this.updateLab(this.labSeqA, isWin, !isWin ? u * 2 : u);
          // rezimA is now handled dynamically in getSmartTargets
        } else if (this.activeStrat === "B") {
          if (isWin) {
            this.stratBLossCounter = 0;
            this.stratBCurrentBet = this.config.bets["B"];
          } else {
            this.stratBLossCounter++;
            
            // Dynamic Martingale with AI Confidence and Streak protection
            let multiplier = 2;
            if (this.aiConfidence > 80) multiplier = 2.2; // Aggressive when confident
            if (this.aiConfidence < 30) multiplier = 1.5; // Conservative when unsure
            
            // If streak is very long, slow down to prevent bust
            if (this.stratBLossCounter > 6) multiplier = 1.2;
            if (this.stratBLossCounter > 10) {
               this.log("⚠️ Strategy B: Critical loss streak. Resetting to base.", "#f87171");
               this.stratBCurrentBet = this.config.bets["B"];
               this.stratBLossCounter = 0;
            } else {
               this.stratBCurrentBet *= multiplier;
            }
          }
        } else if (this.activeStrat === "C") {
          const u = this.getLabBet(this.labSeqC);
          this.labSeqC = this.updateLab(this.labSeqC, isWin, u);
        } else if (this.activeStrat === "D") {
          const u = this.getLabBet(this.labSeqD);
          this.labSeqD = this.updateLab(this.labSeqD, isWin, u);
        } else if (this.activeStrat === "E") {
          const u = this.getLabBet(this.labSeqE);
          this.labSeqE = this.updateLab(this.labSeqE, isWin, u);
        } else if (this.activeStrat === "F") {
          const u = this.getLabBet(this.labSeqF);
          this.labSeqF = this.updateLab(this.labSeqF, isWin, u);
        } else if (this.activeStrat === "H") {
          if (isWin) this.fibIdxC = Math.max(0, this.fibIdxC - 2);
          else this.fibIdxC = Math.min(this.fibSeq.length - 1, this.fibIdxC + 1);
        } else if (this.activeStrat === "I") {
          // Kelly is dynamic
        } else if (this.activeStrat === "G") {
          if (isWin) {
            this.stratGLossCounter = 0;
            this.stratGCurrentBet = this.config.bets["G"];
          } else {
            this.stratGLossCounter++;
            
            // Dynamic progression for Strategy G
            let multiplier = 1.5; // G is higher risk, use lower multiplier than B
            if (this.aiConfidence > 70) multiplier = 1.8;
            
            if (this.stratGLossCounter > 8) {
              this.log("⚠️ Strategy G: Safety reset triggered.", "#f87171");
              this.stratGCurrentBet = this.config.bets["G"];
              this.stratGLossCounter = 0;
            } else {
              // Only double every 2 losses to stay in game longer
              if (this.stratGLossCounter % 2 === 0) {
                this.stratGCurrentBet *= multiplier;
              }
            }
          }
        }

        // Profit Lock
        if (curBal > this.highestBal) {
          const diff = curBal - this.highestBal;
          this.highestBal = curBal;
          this.dynamicLimit = this.config.rescueLimit;
          
          this.log(`🔒 LOCK (+${diff.toFixed(8)}) - Preserving sequences for profit lock`, "#22d3ee");
          this.sendTg(`🔒 ZISK UZAMČEN!\nVýdělek: +${diff.toFixed(8)} ${this.config.currency}\nCelkový Profit: ${this.profit.toFixed(8)}\nZůstatek: ${curBal.toFixed(8)}`);
          
          if (!this.config.aiMode) {
            const idx = this.config.activeStrats.indexOf(this.activeStrat);
            this.activeStrat = this.config.activeStrats[(idx + 1) % this.config.activeStrats.length];
          }
        }

        const resultText = isWin ? "✅ VÝHRA" : "❌ PROHRA";
        const resultColor = isWin ? "#4ade80" : "#f87171";
        this.log(`#${roll} | ${infoMsg} | Sáz: ${totalBetSpin.toFixed(8)} | ${resultText}`, resultColor);
        this.lastNum = roll;

        this.io.emit("bot:update", {
          balance: this.balance,
          profit: this.profit,
          activeStrat: this.activeStrat,
          historyCount: this.history.length,
          chartData: this.chartData,
          stats: {
            winRate: (this.wins / this.totalBets * 100).toFixed(2),
            currentStreak: this.currentStreak,
            maxStreak: this.maxStreak,
            maxDrawdown: this.maxDrawdown.toFixed(8),
            totalBets: this.totalBets
          },
          aiWeights: this.aiWeights,
          aiConfidence: this.aiConfidence,
          aiSectorBias: this.aiSectorBias,
          marketPhase: this.marketPhase,
          marketVolatility: this.marketVolatility,
          betHistory: this.betHistory
        });

        if (this.config.takeProfit > 0 && this.profit >= this.config.takeProfit) {
          this.log("🏆 TAKE PROFIT DOSAŽEN", "#fbbf24");
          this.sendTg(`🏆 TAKE PROFIT DOSAŽEN!\nProfit: ${this.profit.toFixed(8)}`);
          
          if (this.config.resetOnProfit) {
            this.log("🔄 Resetting session and continuing...", "#22d3ee");
            this.sessionStartBal = this.balance;
            this.profit = 0;
            this.peakProfit = 0;
            this.highestBal = this.balance;
            // Reset sequences
            this.labSeqA = [1, 2, 3];
            this.labSeqC = [1, 2, 3];
            this.labSeqD = [1, 2, 3];
            this.labSeqE = [1, 2, 3];
            this.labSeqF = [1, 2, 3];
            this.stratBCurrentBet = this.config.bets["B"];
            this.stratGCurrentBet = this.config.bets["G"];
          } else {
            break;
          }
        }
        if (this.config.stopLoss > 0 && (this.sessionStartBal - curBal) >= this.config.stopLoss) {
          this.log("🛑 STOP LOSS DOSAŽEN", "#ef4444");
          this.sendTg(`🛑 STOP LOSS DOSAŽEN!\nZtráta: ${this.profit.toFixed(8)}`);
          break;
        }

        if (Date.now() - this.lastSeedTime > this.config.seedInterval * 3600000) {
          await this.rotateSeed();
        }

        await new Promise(r => setTimeout(r, 1200));
      } catch (e: any) {
        this.log(`Err: ${e.message}`, "#ef4444");
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    this.running = false;
    this.io.emit("bot:status", { running: false });
  }

  async evaluateMarketConditions(marketDrawdown: number): Promise<{ betMultiplier: number, skipRoll: boolean }> {
    let betMultiplier = 1.0;
    let skipRoll = false;

    if (this.config.aiMode) {
      const newStrat = this.pickBestStrategy();
      if (newStrat !== this.activeStrat) {
        this.log(`🧠 AI Strategy Pivot: Switching from ${this.activeStrat} to ${newStrat} for optimal profit probability`, "#a855f7");
        this.activeStrat = newStrat;
        
        // Calculate how many units we lost to try and recover them
        const lostUnits = Math.ceil(marketDrawdown / this.config.baseBet);
        
        if (lostUnits > 0) {
          // Increase the dynamic limit to allow for recovery without immediately triggering a crisis
          this.dynamicLimit = Math.max(this.config.rescueLimit, lostUnits * 2);
          const recoverySeq = this.createRecoverySequence(lostUnits, this.dynamicLimit);
          
          this.log(`🔄 Pivot Recovery: Injecting ${lostUnits} lost units into ${newStrat} sequence.`, "#d946ef");
          
          if (newStrat === "A") this.labSeqA = [...recoverySeq];
          else if (newStrat === "B") { this.stratBLossCounter = 0; this.stratBCurrentBet = Math.max(this.config.bets["B"], marketDrawdown / 4); }
          else if (newStrat === "C") this.labSeqC = [...recoverySeq];
          else if (newStrat === "D") this.labSeqD = [...recoverySeq];
          else if (newStrat === "E") this.labSeqE = [...recoverySeq];
          else if (newStrat === "F") this.labSeqF = [...recoverySeq];
          else if (newStrat === "G") { this.stratGLossCounter = 0; this.stratGCurrentBet = Math.max(this.config.bets["G"], marketDrawdown / 4); }
          else if (newStrat === "H") this.fibIdxC = 0;
        } else {
          // Reset sequences on pivot if there are no losses to recover
          if (newStrat === "A") this.labSeqA = [1, 1];
          else if (newStrat === "B") { this.stratBLossCounter = 0; this.stratBCurrentBet = this.config.bets["B"]; }
          else if (newStrat === "C") this.labSeqC = [1, 1];
          else if (newStrat === "D") this.labSeqD = [1, 1];
          else if (newStrat === "E") this.labSeqE = [1, 1];
          else if (newStrat === "F") this.labSeqF = [1, 1];
          else if (newStrat === "G") { this.stratGLossCounter = 0; this.stratGCurrentBet = this.config.bets["G"]; }
          else if (newStrat === "H") this.fibIdxC = 0;
        }
      }

      if (this.aiConfidence < 20 && this.marketVolatility > 0.7) {
        this.log("🛡️ AI Safety: Confidence too low for current volatility. Skipping roll.", "#94a3b8");
        await new Promise(r => setTimeout(r, 5000));
        skipRoll = true;
        return { betMultiplier, skipRoll };
      }

      betMultiplier = 0.4 + (this.aiConfidence / 100) * 1.4;
      if (this.marketPhase === "CHAOTIC") betMultiplier *= 0.6;
      if (this.marketPhase === "TRENDING") betMultiplier *= 1.2;
      if (marketDrawdown > this.config.stopLoss * 0.5) betMultiplier *= 0.6;

      const profitToTarget = this.config.takeProfit - this.profit;
      if (profitToTarget > 0 && profitToTarget < this.config.takeProfit * 0.2) {
        betMultiplier *= 0.7;
      }
      betMultiplier = Math.min(2.0, Math.max(0.2, betMultiplier));
    } else {
      if (this.marketPhase === "CHAOTIC") betMultiplier *= 0.8;
      if (marketDrawdown > this.config.stopLoss * 0.7) betMultiplier *= 0.7;
    }

    return { betMultiplier, skipRoll };
  }

  generateBetsForStrategy(betMultiplier: number): { betsPayload: any[], totalBetSpin: number, infoMsg: string, isCrisis: boolean } {
    const betsPayload: any[] = [];
    let totalBetSpin = 0;
    let infoMsg = "";
    let isCrisis = false;

    if (this.activeStrat === "A") {
      const u = this.getLabBet(this.labSeqA);
      if (u >= this.dynamicLimit) {
        isCrisis = true;
        this.log("⚠️ Safety: Strategy A reached unit limit. Triggering rescue.", "#f87171");
      } else {
        const targets = this.getSmartTargets("A");
        targets.forEach((t: number) => {
          const amt = this.config.baseBet * u * betMultiplier;
          betsPayload.push({ pocket: this.getPocketStrA(this.rezimA, t), bet: parseFloat(amt.toFixed(8)) });
          totalBetSpin += amt;
        });
        infoMsg = `A-${this.rezimA} (${u}u x${betMultiplier.toFixed(1)})`;
      }
    } else if (this.activeStrat === "B") {
      if (this.stratBCurrentBet >= this.config.baseBet * this.dynamicLimit) {
        isCrisis = true;
        this.log("⚠️ Safety: Strategy B reached unit limit.", "#f87171");
      } else {
        const currentBet = this.stratBCurrentBet * betMultiplier;
        this.stratBNums.forEach(n => {
          betsPayload.push({ pocket: n.toString(), bet: parseFloat(currentBet.toFixed(8)) });
          totalBetSpin += currentBet;
        });
        infoMsg = `B-Lot. (${(currentBet * this.stratBNums.length).toFixed(8)})`;
      }
    } else if (this.activeStrat === "C") {
      const u = this.getLabBet(this.labSeqC);
      if (u >= this.dynamicLimit) {
        isCrisis = true;
      } else {
        const target = this.getSmartTargets("C");
        const amt = this.config.baseBet * u * betMultiplier;
        betsPayload.push({ pocket: ROULETTE_POCKETS[target], bet: parseFloat(amt.toFixed(8)) });
        totalBetSpin += amt;
        infoMsg = `C-${target} (${u}u x${betMultiplier.toFixed(1)})`;
      }
    } else if (this.activeStrat === "D") {
      const u = this.getLabBet(this.labSeqD);
      if (u >= this.dynamicLimit) {
        isCrisis = true;
      } else {
        const lines = this.getSmartTargets("D");
        const amt = this.config.baseBet * u * betMultiplier;
        lines.forEach((l: number) => {
          const p = Array.from({ length: 6 }, (_, i) => (l - 1) * 6 + 1 + i).join(",");
          betsPayload.push({ pocket: p, bet: parseFloat(amt.toFixed(8)) });
          totalBetSpin += amt;
        });
        infoMsg = `D-Šest. (${u}u x${betMultiplier.toFixed(1)})`;
      }
    } else if (this.activeStrat === "E") {
      const u = this.getLabBet(this.labSeqE);
      if (u >= this.dynamicLimit) {
        isCrisis = true;
      } else {
        const splits = this.getSmartTargets("E");
        const amt = this.config.baseBet * u * betMultiplier;
        splits.forEach((s: number[]) => {
          betsPayload.push({ pocket: `${s[0]},${s[1]}`, bet: parseFloat(amt.toFixed(8)) });
          totalBetSpin += amt;
        });
        infoMsg = `E-Splity (${u}u x${betMultiplier.toFixed(1)})`;
      }
    } else if (this.activeStrat === "F") {
      const u = this.getLabBet(this.labSeqF);
      if (u >= this.dynamicLimit) {
        isCrisis = true;
      } else {
        const corners = this.getSmartTargets("F");
        const amt = this.config.baseBet * u * betMultiplier;
        corners.forEach((c: number[]) => {
          betsPayload.push({ pocket: `${c[0]},${c[1]},${c[2]},${c[3]}`, bet: parseFloat(amt.toFixed(8)) });
          totalBetSpin += amt;
        });
        infoMsg = `F-Čtveř. (${u}u x${betMultiplier.toFixed(1)})`;
      }
    } else if (this.activeStrat === "G") {
      if (this.stratGCurrentBet >= this.config.bets["G"] * this.dynamicLimit) {
        isCrisis = true;
      } else {
        this.stratGNums = this.getSmartTargets("G");
        const currentBet = this.stratGCurrentBet * betMultiplier;
        this.stratGNums.forEach(n => {
          betsPayload.push({ pocket: n.toString(), bet: parseFloat(currentBet.toFixed(8)) });
          totalBetSpin += currentBet;
        });
        infoMsg = `G-AI Lot. (${(currentBet * this.stratGNums.length).toFixed(8)})`;
      }
    } else if (this.activeStrat === "H") {
      const u = this.fibSeq[this.fibIdxC];
      if (u >= this.dynamicLimit) {
        isCrisis = true;
      } else {
        const target = this.getSmartTargets("C");
        const amt = this.config.baseBet * u * betMultiplier;
        betsPayload.push({ pocket: ROULETTE_POCKETS[target], bet: parseFloat(amt.toFixed(8)) });
        totalBetSpin += amt;
        infoMsg = `H-Fib(${target}) (${u}u x${betMultiplier.toFixed(1)})`;
      }
    } else if (this.activeStrat === "I") {
      const vStats = this.virtualStats["I"] || this.virtualStats["C"];
      const totalGames = vStats.wins + vStats.losses;
      const winRate = totalGames > 0 ? (vStats.wins / totalGames) : 0.48;
      const b = 1; 
      const p = winRate;
      const q = 1 - p;
      const f = ((b * p - q) / b) * 0.05;
      const safeF = Math.min(0.005, Math.max(0.0001, f));
      const u = Math.max(1, Math.floor((this.balance * safeF) / this.config.baseBet));
      
      const target = this.getSmartTargets("C");
      const amt = this.config.baseBet * u * betMultiplier;
      betsPayload.push({ pocket: ROULETTE_POCKETS[target], bet: parseFloat(amt.toFixed(8)) });
      totalBetSpin += amt;
      infoMsg = `I-Kelly(${target}) (${u}u x${betMultiplier.toFixed(1)})`;
    } else if (this.activeStrat === "J") {
      const u = this.dalemUnitsJ;
      if (u >= this.dynamicLimit) { isCrisis = true; }
      else {
        const target = this.getSmartTargets("J");
        const amt = this.config.baseBet * u * betMultiplier;
        betsPayload.push({ pocket: ROULETTE_POCKETS[target], bet: parseFloat(amt.toFixed(8)) });
        totalBetSpin += amt;
        infoMsg = `J-D'Alembert(${target}) (${u}u)`;
      }
    } else if (this.activeStrat === "K") {
      const u = this.paroliBetK || 1;
      if (u >= this.dynamicLimit) { isCrisis = true; }
      else {
        const target = this.getSmartTargets("K");
        const amt = this.config.baseBet * u * betMultiplier;
        betsPayload.push({ pocket: ROULETTE_POCKETS[target], bet: parseFloat(amt.toFixed(8)) });
        totalBetSpin += amt;
        infoMsg = `K-Paroli(${target}) (${u}u)`;
      }
    } else if (this.activeStrat === "L") {
      const u = this.oscarUnitsL;
      if (u >= this.dynamicLimit) { isCrisis = true; }
      else {
        const target = this.getSmartTargets("L");
        const amt = this.config.baseBet * u * betMultiplier;
        betsPayload.push({ pocket: ROULETTE_POCKETS[target], bet: parseFloat(amt.toFixed(8)) });
        totalBetSpin += amt;
        infoMsg = `L-Oscar(${target}) (${u}u)`;
      }
    } else if (this.activeStrat === "M") {
      const base = this.config.baseBet * betMultiplier;
      // James Bond: 14 units on High, 5 on Line 13-18, 1 on Zero
      betsPayload.push({ pocket: ROULETTE_POCKETS["HIGH"], bet: parseFloat((base * 14).toFixed(8)) });
      betsPayload.push({ pocket: "13,14,15,16,17,18", bet: parseFloat((base * 5).toFixed(8)) });
      betsPayload.push({ pocket: "0", bet: parseFloat(base.toFixed(8)) });
      totalBetSpin = base * 20;
      infoMsg = `M-Bond (${(base * 20).toFixed(8)})`;
    } else if (this.activeStrat === "N") {
      const u = this.getLabBet(this.revLabSeqN);
      if (u >= this.dynamicLimit) { isCrisis = true; }
      else {
        const target = this.getSmartTargets("N");
        const amt = this.config.baseBet * u * betMultiplier;
        betsPayload.push({ pocket: ROULETTE_POCKETS[target], bet: parseFloat(amt.toFixed(8)) });
        totalBetSpin += amt;
        infoMsg = `N-RevLab(${target}) (${u}u)`;
      }
    } else if (this.activeStrat === "O") {
      const targets = this.getSmartTargets("O");
      const amt = this.config.baseBet * betMultiplier;
      targets.forEach((t: number) => {
        betsPayload.push({ pocket: t.toString(), bet: parseFloat(amt.toFixed(8)) });
        totalBetSpin += amt;
      });
      infoMsg = `O-Neural (${totalBetSpin.toFixed(8)})`;
    }

    return { betsPayload, totalBetSpin, infoMsg, isCrisis };
  }

  createRecoverySequence(lostUnits: number, limit: number): number[] {
    if (lostUnits <= 0) return [1, 1];
    const seq: number[] = [];
    // Keep units safe, max 20% of limit to allow room for a few losses without hitting the limit immediately
    const maxUnit = Math.max(1, Math.floor(limit / 5)); 
    let remaining = lostUnits;
    while (remaining > 0) {
      const chunk = Math.min(remaining, maxUnit);
      seq.push(chunk);
      remaining -= chunk;
    }
    if (seq.length === 1) seq.push(1);
    return seq;
  }

  async triggerRescuePivot(drawdown: number) {
    const safeStrats = this.config.activeStrats.filter(s => ["A", "C", "D", "E", "F"].includes(s) && s !== this.activeStrat);
    const candidates = safeStrats.length ? safeStrats : ["A", "C", "D", "E", "F"].filter(s => s !== this.activeStrat);
    
    const newStrat = candidates[Math.floor(Math.random() * candidates.length)];
    
    // Calculate how many units we lost to try and recover them
    const lostUnits = Math.ceil(drawdown / this.config.baseBet);
    
    // Increase the dynamic limit to allow for recovery without immediately triggering another crisis
    this.dynamicLimit = Math.max(this.config.rescueLimit, lostUnits * 2);

    const recoverySeq = this.createRecoverySequence(lostUnits, this.dynamicLimit);

    this.log(`🧠 SAFETY PIVOT! Cíl: ${newStrat}. Injecting ${lostUnits} lost units to recover.`, "#d946ef");
    this.sendTg(`🚑 KRIZE (LIMIT DOSAŽEN)!\nAI nasazuje strategii: ${newStrat}\nPokus o zotavení ztráty (${lostUnits} jednotek).`);

    this.labSeqA = [...recoverySeq]; 
    this.stratBLossCounter = 0; 
    this.stratBCurrentBet = Math.max(this.config.bets["B"], drawdown / 4);
    this.stratGLossCounter = 0; 
    this.stratGCurrentBet = Math.max(this.config.bets["G"], drawdown / 4);
    this.labSeqC = [...recoverySeq]; 
    this.labSeqD = [...recoverySeq]; 
    this.labSeqE = [...recoverySeq]; 
    this.labSeqF = [...recoverySeq];
    this.revLabSeqN = [...recoverySeq];
    this.dalemUnitsJ = 1;
    this.paroliStepK = 0;
    this.paroliBetK = 1;
    this.oscarUnitsL = 1;
    this.oscarProfitL = 0;

    // Do NOT reset highestBal and peakProfit, so the bot knows it's still recovering
    // this.highestBal = this.balance;
    // this.peakProfit = this.profit;

    this.activeStrat = newStrat;
    await this.rotateSeed();
  }

  checkVirtualWin(strat: string, roll: number): boolean {
    // Re-calculate what the strategy WOULD have bet
    // Note: This is an approximation based on the current state logic
    const targets = this.getSmartTargets(strat);
    
    if (strat === "A") {
      // Targets are [1, 2] (dozens/columns indices)
      // Need to check against rezimA (which might toggle, but we use current state)
      // This is a heuristic approximation
      if (this.rezimA === "TUCET") {
        const dozen = Math.floor((roll - 1) / 12) + 1;
        return targets.includes(dozen);
      } else {
        const col = (roll - 1) % 3 + 1;
        return targets.includes(col);
      }
    } else if (strat === "B") {
      return this.stratBNums.includes(roll);
    } else if (strat === "C") {
      // Target is "RED", "BLACK", etc.
      const pockets: any = {
        RED: [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36],
        BLACK: [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35],
        EVEN: [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36],
        ODD: [1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35],
        LOW: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18],
        HIGH: [19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36]
      };
      return pockets[targets]?.includes(roll) || false;
    } else if (strat === "D") {
      // Targets are line indices [1..6]
      const line = Math.floor((roll - 1) / 6) + 1;
      return targets.includes(line);
    } else if (strat === "E") {
      // Targets are splits (arrays of 2 nums)
      return targets.some((s: number[]) => s.includes(roll));
    } else if (strat === "F") {
      // Targets are corners (arrays of 4 nums)
      return targets.some((c: number[]) => c.includes(roll));
    } else if (strat === "G") {
      return this.stratGNums.includes(roll);
    } else if (strat === "J" || strat === "K" || strat === "L" || strat === "N") {
      const target = this.getSmartTargets(strat);
      const pockets: any = {
        RED: [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36],
        BLACK: [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35],
        EVEN: [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36],
        ODD: [1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35],
        LOW: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18],
        HIGH: [19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36]
      };
      return pockets[target]?.includes(roll) || false;
    } else if (strat === "M") {
      return roll === 0 || (roll >= 13 && roll <= 18) || (roll >= 19 && roll <= 36);
    } else if (strat === "O") {
      const targets = this.getSmartTargets("O");
      return targets.includes(roll);
    } else if (strat === "H" || strat === "I") {
      const target = this.getSmartTargets("C");
      const pockets: any = {
        RED: [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36],
        BLACK: [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35],
        EVEN: [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36],
        ODD: [1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35],
        LOW: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18],
        HIGH: [19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36]
      };
      return pockets[target]?.includes(roll) || false;
    }
    return false;
  }

  updateVirtualStats(roll: number) {
    const PNL_MAP: Record<string, { win: number, loss: number }> = {
      "A": { win: 0.5, loss: -1 },
      "B": { win: 3.5, loss: -1 },
      "C": { win: 1, loss: -1 },
      "D": { win: 1, loss: -1 },
      "E": { win: 1.25, loss: -1 },
      "F": { win: 1.25, loss: -1 },
      "G": { win: 5, loss: -1 },
      "J": { win: 1, loss: -1 },
      "K": { win: 1, loss: -1 },
      "L": { win: 1, loss: -1 },
      "M": { win: 0.8, loss: -1 },
      "N": { win: 1, loss: -1 },
      "O": { win: 2, loss: -1 }
    };

    ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"].forEach(s => {
      const isWin = this.checkVirtualWin(s, roll);
      const stats = this.virtualStats[s];
      if (!stats) {
        this.virtualStats[s] = { wins: 0, losses: 0, streak: 0, last20: [] };
      }
      const pnl = isWin ? (PNL_MAP[s] || PNL_MAP["C"]).win : (PNL_MAP[s] || PNL_MAP["C"]).loss;
      
      if (isWin) {
        stats.wins++;
        stats.streak = stats.streak >= 0 ? stats.streak + 1 : 1;
      } else {
        stats.losses++;
        stats.streak = stats.streak <= 0 ? stats.streak - 1 : -1;
      }
      
      stats.last20.push(pnl);
      if (stats.last20.length > 20) stats.last20.shift();

      // Update internal state for all strategies to keep them "warm"
      if (s === "J") {
        if (isWin) this.dalemUnitsJ = Math.max(1, this.dalemUnitsJ - 1);
        else this.dalemUnitsJ++;
      } else if (s === "K") {
        if (isWin) {
          this.paroliStepK++;
          if (this.paroliStepK >= 3) { this.paroliStepK = 0; this.paroliBetK = 1; }
          else { this.paroliBetK *= 2; }
        } else {
          this.paroliStepK = 0;
          this.paroliBetK = 1;
        }
      } else if (s === "L") {
        if (isWin) {
          this.oscarProfitL += this.oscarUnitsL;
          if (this.oscarProfitL >= 1) { this.oscarProfitL = 0; this.oscarUnitsL = 1; }
          else { this.oscarUnitsL++; }
        } else {
          this.oscarProfitL -= this.oscarUnitsL;
        }
      } else if (s === "N") {
        if (isWin) this.revLabSeqN.push(this.getLabBet(this.revLabSeqN));
        else {
          if (this.revLabSeqN.length >= 2) { this.revLabSeqN.shift(); this.revLabSeqN.pop(); }
          else this.revLabSeqN = [1, 1];
        }
      }
    });
  }

  calculateVolatility() {
    let totalSwings = 0;
    let count = 0;
    Object.values(this.virtualStats).forEach(stats => {
      for (let i = 1; i < stats.last20.length; i++) {
        totalSwings += Math.abs(stats.last20[i] - stats.last20[i - 1]);
        count++;
      }
    });
    // Normalize to 0.0 - 1.0 (max swing is roughly 6 for G)
    this.marketVolatility = count > 0 ? Math.min(1.0, (totalSwings / count) / 3.0) : 0;
  }

  getStatsSummary() {
    const counts: Record<number, number> = {};
    this.history.forEach(n => counts[n] = (counts[n] || 0) + 1);
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    
    const dozens = [0, 0, 0, 0]; // 0, 1st, 2nd, 3rd
    this.history.forEach(n => {
      if (n === 0) dozens[0]++;
      else dozens[Math.floor((n - 1) / 12) + 1]++;
    });

    const parity = { even: 0, odd: 0 };
    this.history.forEach(n => {
      if (n === 0) return;
      if (n % 2 === 0) parity.even++;
      else parity.odd++;
    });

    const stratMomentum = Object.entries(this.virtualStats).map(([s, stats]) => ({
      strat: s,
      pnl20: stats.last20.reduce((a, b) => a + b, 0),
      streak: stats.streak
    }));

    return {
      hot: sorted.slice(0, 5).map(x => x[0]),
      cold: sorted.slice(-5).map(x => x[0]),
      dozens,
      parity,
      stratMomentum
    };
  }

  async runAIPatternAnalysis() {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY" || key.trim() === "") {
      this.log("⚠️ GEMINI_API_KEY is missing. Using Local AI Analysis fallback.", "#fbbf24");
      this.runLocalPatternAnalysis();
      return;
    }

    this.isAnalyzing = true;
    this.log("🧠 AI Deep Analysis starting...", "#a855f7");
    
    try {
      const stats = this.getStatsSummary();
      const ai = new GoogleGenAI({ apiKey: key });
      const model = "gemini-3-flash-preview";
      
      const prompt = `Analyze these last ${this.history.length} roulette rolls: ${this.history.join(", ")}.
      
      STATISTICAL CONTEXT:
      - Hot Numbers: ${stats.hot.join(", ")}
      - Cold Numbers: ${stats.cold.join(", ")}
      - Dozen Distribution (0, 1st, 2nd, 3rd): ${stats.dozens.join(", ")}
      - Parity (Even/Odd): ${stats.parity.even}/${stats.parity.odd}
      - Strategy Momentum: ${JSON.stringify(stats.stratMomentum)}
      
      Market Volatility: ${this.marketVolatility.toFixed(2)}
      User Risk Tolerance: ${this.config.riskTolerance}
      
      TASK:
      1. Weight multipliers (0.5 to 2.5) for strategies A-I.
      2. Confidence score (0-100).
      3. Sector bias (VOISINS, TIERS, ORPHELINS, NONE).
      4. Market Phase: (ACCUMULATION, TRENDING, CHAOTIC, REVERSAL).
         - ACCUMULATION: Stable, low volatility, numbers repeating or staying in small ranges.
         - TRENDING: Strong momentum in specific sectors or dozens.
         - CHAOTIC: High volatility, unpredictable jumps, no clear patterns.
         - REVERSAL: Patterns are breaking, cold numbers starting to hit.
      
      Return JSON only: { 
        "weights": { "A": number, "B": number, "C": number, "D": number, "E": number, "F": number, "G": number, "H": number, "I": number },
        "confidence": number,
        "sectorBias": string,
        "marketPhase": string
      }`;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              weights: {
                type: Type.OBJECT,
                properties: {
                  A: { type: Type.NUMBER },
                  B: { type: Type.NUMBER },
                  C: { type: Type.NUMBER },
                  D: { type: Type.NUMBER },
                  E: { type: Type.NUMBER },
                  F: { type: Type.NUMBER },
                  G: { type: Type.NUMBER },
                  H: { type: Type.NUMBER },
                  I: { type: Type.NUMBER },
                },
                required: ["A", "B", "C", "D", "E", "F", "G", "H", "I"]
              },
              confidence: { type: Type.NUMBER },
              sectorBias: { type: Type.STRING },
              marketPhase: { type: Type.STRING }
            },
            required: ["weights", "confidence", "sectorBias", "marketPhase"]
          }
        }
      });

      const result = JSON.parse(response.text);
      const weights = result.weights;
      Object.keys(weights).forEach(s => {
        this.aiWeights[s] = Math.max(0.5, Math.min(2.5, weights[s]));
      });
      this.aiConfidence = Math.max(0, Math.min(100, result.confidence || 50));
      this.aiSectorBias = result.sectorBias || "NONE";
      this.marketPhase = result.marketPhase || "CHAOTIC";
      
      this.log(`🧠 AI Analysis: ${this.marketPhase} phase detected. Confidence: ${this.aiConfidence}%`, "#a855f7");
    } catch (e) {
      console.error("AI Pattern Analysis failed:", e);
      this.log("⚠️ Gemini API failed. Falling back to Local AI Analysis.", "#fbbf24");
      this.runLocalPatternAnalysis();
    } finally {
      this.isAnalyzing = false;
    }
  }

  runLocalPatternAnalysis() {
    this.isAnalyzing = true;
    this.log("🧠 Local AI Analysis starting (Fallback mode)...", "#a855f7");
    
    try {
      const stats = this.getStatsSummary();
      
      // Determine Market Phase
      let phase = "CHAOTIC";
      if (this.marketVolatility < 0.3) phase = "ACCUMULATION";
      else if (this.marketVolatility < 0.6) {
        // Check if there's a strong trend in dozens or parity
        const maxDozen = Math.max(...stats.dozens.slice(1));
        const totalDozens = stats.dozens.slice(1).reduce((a, b) => a + b, 0);
        if (totalDozens > 0 && maxDozen / totalDozens > 0.45) phase = "TRENDING";
        else phase = "ACTIVE";
      } else if (this.marketVolatility > 0.8) {
        phase = "REVERSAL";
      }

      // Determine Sector Bias
      let sectorBias = "NONE";
      const sectorCounts = { VOISINS: 0, TIERS: 0, ORPHELINS: 0 };
      const sectorNums: Record<string, number[]> = {
        VOISINS: [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25],
        TIERS: [27,13,36,11,30,8,23,10,5,24,16,33],
        ORPHELINS: [1,20,14,31,9,17,34,6]
      };
      
      this.history.slice(-30).forEach(n => {
        if (sectorNums.VOISINS.includes(n)) sectorCounts.VOISINS++;
        else if (sectorNums.TIERS.includes(n)) sectorCounts.TIERS++;
        else if (sectorNums.ORPHELINS.includes(n)) sectorCounts.ORPHELINS++;
      });
      
      const maxSector = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0];
      if (maxSector[1] > 12) sectorBias = maxSector[0];

      // Determine Weights
      const weights: Record<string, number> = { A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1, I: 1 };
      
      Object.keys(weights).forEach(strat => {
        let weight = 1.0;
        const momentum = stats.stratMomentum[strat] || 0;
        
        if (momentum > 0) weight += 0.2 * Math.min(momentum, 5);
        else if (momentum < 0) weight -= 0.1 * Math.min(Math.abs(momentum), 5);
        
        if (phase === "TRENDING" && ["A", "C", "H", "I"].includes(strat)) weight += 0.5;
        if (phase === "CHAOTIC" && ["B", "G", "E", "F"].includes(strat)) weight -= 0.5;
        if (phase === "ACCUMULATION" && ["D", "E", "F"].includes(strat)) weight += 0.3;
        
        weights[strat] = Math.max(0.5, Math.min(2.5, weight));
      });

      // Determine Confidence
      let confidence = 50;
      if (phase === "TRENDING" || phase === "ACCUMULATION") confidence += 20;
      if (sectorBias !== "NONE") confidence += 15;
      confidence -= this.marketVolatility * 20;
      
      this.aiWeights = weights;
      this.aiConfidence = Math.max(10, Math.min(95, confidence));
      this.aiSectorBias = sectorBias;
      this.marketPhase = phase;
      
      this.log(`🧠 Local AI Analysis: ${this.marketPhase} phase detected. Confidence: ${this.aiConfidence.toFixed(1)}%`, "#a855f7");
    } catch (e) {
      console.error("Local AI Pattern Analysis failed:", e);
    } finally {
      this.isAnalyzing = false;
    }
  }

  calculateStandardDeviation(values: number[]) {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  }

  pickBestStrategy(): string {
    // AI Logic: Score strategies based on recent profitability (PnL), AI weights, volatility, and risk tolerance
    this.calculateVolatility();
    const stats = this.getStatsSummary();
    const available = this.config.activeStrats.length > 0 ? this.config.activeStrats : ["A", "C", "H", "I"];
    const riskMult = this.config.riskTolerance === "HIGH" ? 1.5 : this.config.riskTolerance === "LOW" ? 0.5 : 1.0;
    
    // Market Regime Detection
    // 0.0 - 0.3: Stable, 0.3 - 0.7: Active, 0.7 - 1.0: Volatile/Chaotic
    const regime = this.marketVolatility < 0.3 ? "STABLE" : (this.marketVolatility < 0.7 ? "ACTIVE" : "VOLATILE");
    
    // Local Sector Analysis (Fallback for when AI is off)
    let localSectorBias = "NONE";
    const sectorCounts = { VOISINS: 0, TIERS: 0, ORPHELINS: 0 };
    const sectorNums: Record<string, number[]> = {
      VOISINS: [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25],
      TIERS: [27,13,36,11,30,8,23,10,5,24,16,33],
      ORPHELINS: [1,20,14,31,9,17,34,6]
    };
    
    // Analyze last 30 rolls for local bias
    this.history.slice(-30).forEach(n => {
      if (sectorNums.VOISINS.includes(n)) sectorCounts.VOISINS++;
      else if (sectorNums.TIERS.includes(n)) sectorCounts.TIERS++;
      else if (sectorNums.ORPHELINS.includes(n)) sectorCounts.ORPHELINS++;
    });
    
    const maxSector = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0];
    if (maxSector[1] > 12) localSectorBias = maxSector[0]; // Only bias if > 40% in one sector

    const scores = available.map(strat => {
      const vStats = this.virtualStats[strat];
      if (!vStats) return { strat, score: -999, pnl: 0 };

      // 1. Recent Profitability (Sum of last 20 rolls PnL)
      // Prioritize recent PnL more heavily
      const recentPnL = vStats.last20.reduce((a, b) => a + b, 0) * 2.0;
      
      // 2. Momentum (Streak multiplier)
      // Trending: Follow winning streaks. Reversal: Look for losing streaks to end.
      let momentum = 0;
      if (this.marketPhase === "TRENDING") {
        momentum = vStats.streak > 0 ? (vStats.streak * 2.5 * riskMult) : (vStats.streak * 0.5);
      } else if (this.marketPhase === "REVERSAL") {
        // If on a losing streak in reversal phase, it might be "due"
        momentum = vStats.streak < -3 ? (Math.abs(vStats.streak) * 2.0 * riskMult) : (vStats.streak * 0.5);
      } else if (this.marketPhase === "CHAOTIC") {
        // In chaotic phase, streaks are less reliable, penalize high streaks to avoid traps
        momentum = vStats.streak > 2 ? -3 : (vStats.streak < -2 ? 2 : 0);
      } else {
        momentum = vStats.streak > 0 ? (vStats.streak * 1.5 * riskMult) : (vStats.streak * 0.5);
      }
      
      // 3. Stability Score (Lower standard deviation is better in Accumulation phase)
      const stability = this.calculateStandardDeviation(vStats.last20);
      let stabilityBonus = 0;
      if (this.marketPhase === "ACCUMULATION" || regime === "STABLE") {
        stabilityBonus = (1.0 - Math.min(1.0, stability / 2.0)) * 10;
      }

      // 4. Long-term Win Rate Weighting
      const totalGames = vStats.wins + vStats.losses;
      const winRate = totalGames > 0 ? (vStats.wins / totalGames) : 0.5;
      const winRateBonus = (winRate - 0.4) * 15; // Bonus for win rate > 40%

      // 5. AI Pattern Weight (from Gemini)
      const aiWeight = this.aiWeights[strat] || 1.0;
      const aiBonus = aiWeight * 20;
      
      // 6. Sector Bias Bonus (Combine AI bias and Local bias)
      let biasBonus = 0;
      const activeBias = this.aiSectorBias !== "NONE" ? this.aiSectorBias : localSectorBias;
      
      if (activeBias !== "NONE") {
        const targets = this.getSmartTargets(strat);
        // If strategy targets overlap with biased sector, give bonus
        if (strat === "B" || strat === "G") {
          const overlap = targets.filter((n: number) => sectorNums[activeBias]?.includes(n)).length;
          // Consider aiSectorBias more heavily in volatile/chaotic markets
          const biasMult = (this.marketVolatility > 0.6 || this.marketPhase === "CHAOTIC") ? 15 : 8;
          biasBonus = (overlap / targets.length) * biasMult;
        } else if (strat === "A") {
          // Check dozen/column overlap
          const overlap = targets.filter((t: number) => {
            const nums = this.rezimA === "TUCET" 
              ? Array.from({length: 12}, (_, i) => (t-1)*12 + 1 + i)
              : Array.from({length: 12}, (_, i) => i*3 + t);
            return nums.some(n => sectorNums[activeBias]?.includes(n));
          }).length;
          const biasMult = (this.marketVolatility > 0.6 || this.marketPhase === "CHAOTIC") ? 8 : 4;
          biasBonus = (overlap / targets.length) * biasMult;
        }
      }

      // 7. Statistical Alignment Bonus (Local Intelligence)
      let statBonus = 0;
      const targets = this.getSmartTargets(strat);
      if (strat === "B" || strat === "G") {
        // Bonus for targeting "Hot" numbers
        const hotOverlap = targets.filter((n: number) => stats.hot.includes(n.toString())).length;
        statBonus += hotOverlap * 3.0;
      }
      
      // 8. Risk & Volatility Adjustments
      let riskAdjustment = 0;
      if (this.config.riskTolerance === "LOW") {
        if (["A", "C", "D"].includes(strat)) riskAdjustment += 8;
        if (["B", "G"].includes(strat)) riskAdjustment -= 8;
        if (regime === "VOLATILE") riskAdjustment -= 5;
      } else if (this.config.riskTolerance === "HIGH") {
        if (["B", "G"].includes(strat)) riskAdjustment += 8;
        if (regime === "VOLATILE") riskAdjustment += 5; // High risk loves volatility
      }

      // If highly volatile, penalize high-variance strats unless risk tolerance is HIGH
      // Consider marketVolatility more heavily
      if (this.marketVolatility > 0.5 && this.config.riskTolerance !== "HIGH") {
        if (["B", "G", "E", "F"].includes(strat)) riskAdjustment -= this.marketVolatility * 15;
      }
      
      // 9. Chaos Penalty
      let chaosPenalty = 0;
      if (this.marketPhase === "CHAOTIC") {
        // In chaotic phase, high payout strats are dangerous
        if (["B", "G", "E", "F"].includes(strat)) chaosPenalty = -10;
        else chaosPenalty = 5; // Prefer safer strats in chaos
      }

      // 10. Underperformance & Risk Threshold Penalty
      let riskPenalty = 0;
      // If recent PnL is very negative, penalize heavily
      if (recentPnL < -10) {
        riskPenalty -= Math.abs(recentPnL) * 1.5;
      }
      
      // If win rate is extremely low and we have enough data
      if (totalGames > 10 && winRate < 0.2) {
        riskPenalty -= 20;
      }

      // If losing streak is too long based on risk tolerance
      const maxLosingStreak = this.config.riskTolerance === "LOW" ? -3 : (this.config.riskTolerance === "HIGH" ? -7 : -5);
      if (vStats.streak <= maxLosingStreak) {
        riskPenalty -= Math.abs(vStats.streak) * 3;
      }
      
      // Calculate final score
      const totalScore = recentPnL + momentum + stabilityBonus + winRateBonus + aiBonus + biasBonus + statBonus + riskAdjustment + chaosPenalty + riskPenalty;
      
      return { strat, score: totalScore, pnl: recentPnL };
    });
    
    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    
    return scores[0].strat;
  }
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  app.use(cors());
  app.use(express.json());

  let bot: BotInstance | null = null;

  io.on("connection", (socket) => {
    console.log("Client connected");
    if (bot) {
      socket.emit("bot:status", { running: bot.running });
      socket.emit("bot:update", {
        balance: bot.balance,
        profit: bot.profit,
        activeStrat: bot.activeStrat,
        historyCount: bot.history.length,
        chartData: bot.chartData,
        stats: {
          winRate: (bot.wins / bot.totalBets * 100 || 0).toFixed(2),
          currentStreak: bot.currentStreak,
          maxStreak: bot.maxStreak,
          maxDrawdown: bot.maxDrawdown.toFixed(8),
          totalBets: bot.totalBets
        },
        aiWeights: bot.aiWeights,
        marketVolatility: bot.marketVolatility
      });
      bot.logs.forEach(log => socket.emit("bot:log", log));
    }
  });

  app.post("/api/simulate", (req, res) => {
    const { strategy, initialBalance, baseBet, spins, winProb, payout, sequence } = req.body;
    
    let balance = initialBalance;
    let currentBet = baseBet;
    let history = [];
    let labLogs: string[] = [];
    let wins = 0;
    let losses = 0;
    let maxDrawdown = 0;
    let peak = initialBalance;
    let labSeq = [...(sequence || [1, 2, 3])];
    let fibSeq = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];
    let fibIdx = 0;

    for (let i = 0; i < spins; i++) {
      if (balance < currentBet) break;
      
      const isWin = Math.random() < (winProb / 100);
      balance -= currentBet;
      
      if (strategy === "LABOUCHERE") {
        labLogs.push(`Spin ${i + 1}: [${labSeq.join(",")}] | Bet: ${currentBet.toFixed(8)} | ${isWin ? "WIN" : "LOSS"}`);
        if (labLogs.length > 100) labLogs.shift();
      }

      if (isWin) {
        const winAmt = currentBet * payout;
        balance += winAmt;
        wins++;
        
        if (strategy === "MARTINGALE") {
          currentBet = baseBet;
        } else if (strategy === "LABOUCHERE") {
          if (labSeq.length <= 1) {
            labSeq = [...(sequence || [1, 2, 3])];
          } else {
            labSeq.shift();
            labSeq.pop();
            if (labSeq.length === 0) labSeq = [...(sequence || [1, 2, 3])];
          }
          const u = labSeq.length === 1 ? labSeq[0] : (labSeq[0] + labSeq[labSeq.length - 1]);
          currentBet = baseBet * u;
        } else if (strategy === "FIBONACCI") {
          fibIdx = Math.max(0, fibIdx - 2);
          currentBet = baseBet * fibSeq[fibIdx];
        } else if (strategy === "KELLY") {
          const b = payout - 1;
          const p = winProb / 100;
          const q = 1 - p;
          const f = (b * p - q) / b;
          currentBet = Math.max(baseBet, balance * Math.max(0, f));
        }
      } else {
        losses++;
        if (strategy === "MARTINGALE") {
          currentBet *= 2;
        } else if (strategy === "LABOUCHERE") {
          const u = labSeq.length === 1 ? labSeq[0] : (labSeq[0] + labSeq[labSeq.length - 1]);
          labSeq.push(u);
          
          // Improvement: If sequence is too long, split it or cap it
          if (labSeq.length > 12) {
            const sum = labSeq.reduce((a, b) => a + b, 0);
            const half = Math.floor(sum / 2);
            labSeq = [Math.floor(half/2), Math.ceil(half/2)];
            labLogs.push(`⚠️ Sequence Split Triggered (Length > 12)`);
          }

          const nextU = labSeq.length === 1 ? labSeq[0] : (labSeq[0] + labSeq[labSeq.length - 1]);
          currentBet = baseBet * nextU;
        } else if (strategy === "FIBONACCI") {
          fibIdx = Math.min(fibSeq.length - 1, fibIdx + 1);
          currentBet = baseBet * fibSeq[fibIdx];
        } else if (strategy === "KELLY") {
          const b = payout - 1;
          const p = winProb / 100;
          const q = 1 - p;
          const f = (b * p - q) / b;
          currentBet = Math.max(baseBet, balance * Math.max(0, f));
        }
      }

      if (balance > peak) peak = balance;
      const dd = peak - balance;
      if (dd > maxDrawdown) maxDrawdown = dd;

      if (i % Math.max(1, Math.floor(spins / 100)) === 0 || i === spins - 1) {
        history.push({ spin: i + 1, balance: parseFloat(balance.toFixed(8)) });
      }
    }

    res.json({
      finalBalance: balance,
      wins,
      losses,
      maxDrawdown,
      history,
      labLogs
    });
  });

  app.post("/api/bot/start", (req, res) => {
    console.log("Received start request:", req.body);
    const config: BotConfig = req.body;
    if (bot && bot.running) {
      console.log("Bot already running");
      return res.status(400).json({ error: "Bot is already running" });
    }
    try {
      bot = new BotInstance(config, io);
      bot.start();
      console.log("Bot started successfully");
      res.json({ status: "ok" });
    } catch (e: any) {
      console.error("Error starting bot:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/bot/stop", (req, res) => {
    if (bot) {
      bot.stop();
      res.json({ status: "ok" });
    } else {
      res.status(400).json({ error: "Bot is not initialized" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = parseInt(process.env.PORT || "3000");
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    
    // Auto-start bot if token is provided in environment
    if (process.env.CASINO_TOKEN) {
      console.log("Auto-starting bot from environment variables...");
      const autoConfig: BotConfig = {
        token: process.env.CASINO_TOKEN,
        currency: process.env.CURRENCY || "POL",
        baseBet: parseFloat(process.env.BASE_BET || "0.00000001"),
        activeStrats: (process.env.ACTIVE_STRATS || "A").split(","),
        bets: {
          A: parseFloat(process.env.BET_A || "0.00000001"),
          B: parseFloat(process.env.BET_B || "0.00000001"),
          C: parseFloat(process.env.BET_C || "0.00000001"),
          D: parseFloat(process.env.BET_D || "0.00000001"),
          E: parseFloat(process.env.BET_E || "0.00000001"),
          F: parseFloat(process.env.BET_F || "0.00000001"),
          G: parseFloat(process.env.BET_G || "0.00000001"),
        },
        playG: process.env.PLAY_G === "true",
        betG: parseFloat(process.env.BET_G || "0.00000001"),
        stopLoss: parseFloat(process.env.STOP_LOSS || "100"),
        takeProfit: parseFloat(process.env.TAKE_PROFIT || "100"),
        seedInterval: parseInt(process.env.SEED_INTERVAL || "10"),
        rescueLimit: parseInt(process.env.RESCUE_LIMIT || "10"),
        resetOnProfit: process.env.RESET_ON_PROFIT === "true",
        tgToken: process.env.TG_TOKEN || "",
        tgChat: process.env.TG_CHAT || "",
        aiMode: process.env.AI_MODE === "true",
        riskTolerance: (process.env.RISK_TOLERANCE as any) || "MEDIUM",
      };
      bot = new BotInstance(autoConfig, io);
      bot.start();
    }
  });
}

startServer();
