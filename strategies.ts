export type StrategyType = 'flat' | 'martingale' | 'fibonacci' | 'dalembert' | 'kelly';

export interface SimulationResult {
  bets: {
    betNumber: number;
    betAmount: number;
    won: boolean;
    profit: number;
    bankroll: number;
  }[];
  finalBankroll: number;
  maxDrawdown: number;
  peakBankroll: number;
  totalBets: number;
  wins: number;
  losses: number;
}

export function simulateStrategy(
  strategy: StrategyType,
  startingBankroll: number,
  baseBet: number,
  odds: number,
  winProbability: number,
  numberOfBets: number
): SimulationResult {
  let bankroll = startingBankroll;
  let currentBet = baseBet;
  let peakBankroll = startingBankroll;
  let maxDrawdown = 0;
  let wins = 0;
  let losses = 0;
  
  const bets = [];
  
  // Fibonacci sequence generator
  const fib = [1, 1];
  for (let i = 2; i < 50; i++) {
    fib[i] = fib[i - 1] + fib[i - 2];
  }
  let fibIndex = 0;

  for (let i = 1; i <= numberOfBets; i++) {
    if (bankroll <= 0) break; // Bankrupt

    // Adjust bet if it exceeds bankroll
    if (currentBet > bankroll) {
      currentBet = bankroll;
    }

    // Simulate outcome
    const won = Math.random() < winProbability;
    
    let profit = 0;
    if (won) {
      profit = currentBet * (odds - 1);
      bankroll += profit;
      wins++;
    } else {
      profit = -currentBet;
      bankroll += profit;
      losses++;
    }

    bets.push({
      betNumber: i,
      betAmount: currentBet,
      won,
      profit,
      bankroll
    });

    // Update stats
    if (bankroll > peakBankroll) {
      peakBankroll = bankroll;
    }
    const drawdown = peakBankroll - bankroll;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }

    // Calculate next bet based on strategy
    if (strategy === 'flat') {
      currentBet = baseBet;
    } else if (strategy === 'martingale') {
      if (won) {
        currentBet = baseBet;
      } else {
        currentBet *= 2;
      }
    } else if (strategy === 'fibonacci') {
      if (won) {
        fibIndex = Math.max(0, fibIndex - 2);
        currentBet = baseBet * fib[fibIndex];
      } else {
        fibIndex++;
        currentBet = baseBet * fib[fibIndex];
      }
    } else if (strategy === 'dalembert') {
      if (won) {
        currentBet = Math.max(baseBet, currentBet - baseBet);
      } else {
        currentBet += baseBet;
      }
    } else if (strategy === 'kelly') {
      // Kelly Criterion: f* = (bp - q) / b
      // b = decimal odds - 1
      // p = probability of winning
      // q = probability of losing (1 - p)
      const b = odds - 1;
      const p = winProbability;
      const q = 1 - p;
      const kellyFraction = (b * p - q) / b;
      
      if (kellyFraction > 0) {
        // Use fractional Kelly (e.g., half-Kelly) to reduce volatility, but here we use full Kelly
        currentBet = bankroll * kellyFraction;
        // Cap at some reasonable amount or let it ride
      } else {
        currentBet = 0; // Don't bet if EV is negative
      }
    }
  }

  return {
    bets,
    finalBankroll: bankroll,
    maxDrawdown,
    peakBankroll,
    totalBets: bets.length,
    wins,
    losses
  };
}

export function calculateRecovery(
  strategy: StrategyType,
  baseBet: number,
  losingStreak: number,
  odds: number
): { nextBet: number; totalLost: number; profitOnWin: number } {
  let totalLost = 0;
  let nextBet = baseBet;
  
  if (strategy === 'flat') {
    totalLost = baseBet * losingStreak;
    nextBet = baseBet;
  } else if (strategy === 'martingale') {
    // 1, 2, 4, 8...
    for (let i = 0; i < losingStreak; i++) {
      totalLost += baseBet * Math.pow(2, i);
    }
    nextBet = baseBet * Math.pow(2, losingStreak);
  } else if (strategy === 'fibonacci') {
    const fib = [1, 1];
    for (let i = 2; i <= losingStreak + 1; i++) {
      fib[i] = fib[i - 1] + fib[i - 2];
    }
    for (let i = 0; i < losingStreak; i++) {
      totalLost += baseBet * fib[i];
    }
    nextBet = baseBet * fib[losingStreak];
  } else if (strategy === 'dalembert') {
    for (let i = 0; i < losingStreak; i++) {
      totalLost += baseBet + (i * baseBet);
    }
    nextBet = baseBet + (losingStreak * baseBet);
  } else if (strategy === 'kelly') {
    // Kelly doesn't have a fixed recovery sequence based on streak, it depends on bankroll.
    // We'll just return 0 for this to indicate it's not applicable in the same way.
    return { nextBet: 0, totalLost: 0, profitOnWin: 0 };
  }

  const profitOnWin = (nextBet * (odds - 1)) - totalLost;

  return { nextBet, totalLost, profitOnWin };
}
