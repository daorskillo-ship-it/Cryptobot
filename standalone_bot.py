import tkinter as tk
from tkinter import ttk, messagebox
import requests
import threading
import time
import random
import json

# Casino API URL
API_URL = "https://api.paradice.in/api.php"

class StandaloneBot:
    def __init__(self, config):
        self.config = config
        self.running = False
        self.profit = 0
        self.balance = 0
        self.session_start_bal = None
        self.highest_bal = 0
        self.history = []
        self.active_strat = config['activeStrats'][0] if config['activeStrats'] else "A"
        
        # Strategy States
        self.lab_seqs = {s: [1, 1] for s in ["A", "C", "D", "E", "F"]}
        self.strat_b_nums = self.generate_random_8()
        self.strat_b_loss_counter = 0
        self.strat_b_current_bet = config['bets'].get("B", 0)
        
        self.strat_g_nums = [0] + self.generate_smart_6()
        self.strat_g_loss_counter = 0
        self.strat_g_current_bet = config['bets'].get("G", 0)
        
        self.rezim_a = "TUCET"
        self.dynamic_limit = config['rescueLimit']
        self.last_seed_time = time.time()
        
        # Virtual Stats for Local Heuristic
        self.virtual_stats = {s: {"wins": 0, "losses": 0, "streak": 0, "last20": []} for s in ["A", "B", "C", "D", "E", "F", "G"]}
        self.weights = {s: 1.0 for s in ["A", "B", "C", "D", "E", "F", "G"]}

    def generate_random_8(self):
        return random.sample(range(37), 8)

    def generate_smart_6(self):
        if not self.history:
            return random.sample(range(1, 37), 6)
        counts = {i: self.history.count(i) for i in range(1, 37)}
        return sorted(counts.keys(), key=lambda x: counts[x])[:6]

    def get_lab_bet(self, seq):
        if not seq: return 1
        return seq[0] if len(seq) == 1 else seq[0] + seq[-1]

    def update_lab(self, seq, is_win, units):
        if is_win:
            if len(seq) >= 2:
                seq = seq[1:-1]
            elif len(seq) == 1:
                seq = []
            return seq if seq else [1, 1]
        else:
            seq.append(units)
            return seq

    def get_smart_targets(self, strat):
        if len(self.history) < 15:
            if strat == "A": return [1, 2]
            if strat == "C": return "RED"
            if strat == "D": return [1, 2, 3]
            if strat == "G": return [0] + self.generate_smart_6()
            return []

        if strat == "A":
            counts = {1: 0, 2: 0, 3: 0}
            for n in self.history:
                if 1 <= n <= 36:
                    idx = ((n-1)//12 + 1) if self.rezim_a == "TUCET" else ((n-1)%3 + 1)
                    counts[idx] += 1
            return sorted(counts.keys(), key=lambda x: counts[x])[:2]
        
        elif strat == "C":
            red_nums = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
            c = {"RED": 0, "BLACK": 0, "EVEN": 0, "ODD": 0}
            for n in self.history:
                if n == 0: continue
                if n in red_nums: c["RED"] += 1
                else: c["BLACK"] += 1
                if n % 2 == 0: c["EVEN"] += 1
                else: c["ODD"] += 1
            return min(c, key=c.get)
            
        elif strat == "G":
            return [0] + self.generate_smart_6()
            
        return []

    def get_pocket_str_a(self, mode, idx):
        if mode == "TUCET":
            mapping = {1: "1,2,3,4,5,6,7,8,9,10,11,12", 2: "13,14,15,16,17,18,19,20,21,22,23,24", 3: "25,26,27,28,29,30,31,32,33,34,35,36"}
        else:
            mapping = {1: "1,4,7,10,13,16,19,22,25,28,31,34", 2: "2,5,8,11,14,17,20,23,26,29,32,35", 3: "3,6,9,12,15,18,21,24,27,30,33,36"}
        return mapping.get(idx, "")

    def update_virtual_stats(self, roll):
        # A: Tucet/Rada
        a_win = False
        if 1 <= roll <= 36:
            idx = ((roll-1)//12 + 1) if self.rezim_a == "TUCET" else ((roll-1)%3 + 1)
            targets = self.get_smart_targets("A")
            a_win = idx in targets
        self._upd_stat("A", a_win)

        # C: 50/50
        c_target = self.get_smart_targets("C")
        red_nums = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
        c_win = False
        if roll != 0:
            if c_target == "RED" and roll in red_nums: c_win = True
            elif c_target == "BLACK" and roll not in red_nums: c_win = True
            elif c_target == "EVEN" and roll % 2 == 0: c_win = True
            elif c_target == "ODD" and roll % 2 != 0: c_win = True
        self._upd_stat("C", c_win)

        # G: AI Lot
        g_targets = self.get_smart_targets("G")
        self._upd_stat("G", roll in g_targets)

        # B, D, E, F (Simplified checks)
        self._upd_stat("B", roll in self.strat_b_nums)
        self._upd_stat("D", False)
        self._upd_stat("E", False)
        self._upd_stat("F", False)

    def _upd_stat(self, strat, is_win):
        st = self.virtual_stats[strat]
        if is_win:
            st["wins"] += 1
            st["streak"] = st["streak"] + 1 if st["streak"] > 0 else 1
            st["last20"].append(1)
        else:
            st["losses"] += 1
            st["streak"] = st["streak"] - 1 if st["streak"] < 0 else -1
            st["last20"].append(-1)
        if len(st["last20"]) > 20:
            st["last20"].pop(0)

    def run_local_analysis(self):
        strats = ["A", "B", "C", "D", "E", "F", "G"]
        scores = {}
        for s in strats:
            stats = self.virtual_stats[s]
            pnl = sum(stats['last20'])
            momentum = stats['streak'] * 1.5 if stats['streak'] > 0 else stats['streak'] * 0.5
            scores[s] = pnl + momentum
        
        mx, mn = max(scores.values()), min(scores.values())
        for s in strats:
            if mx == mn: self.weights[s] = 1.0
            else: self.weights[s] = 0.5 + ((scores[s] - mn) / (mx - mn)) * 1.5

    def pick_best_strat(self):
        available = self.config['activeStrats'] if self.config['activeStrats'] else ["A"]
        scored = []
        for s in available:
            pnl = sum(self.virtual_stats[s]['last20'])
            momentum = self.virtual_stats[s]['streak'] * 0.8 if self.virtual_stats[s]['streak'] > 0 else self.virtual_stats[s]['streak'] * 0.3
            score = pnl + momentum + (self.weights[s] * 5)
            scored.append((s, score))
        return max(scored, key=lambda x: x[1])[0]

class BotGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Trinity Standalone Bot")
        self.root.geometry("800x600")
        self.root.configure(bg="#0f172a")
        
        self.bot = None
        self.setup_ui()

    def setup_ui(self):
        # Left Panel: Config
        self.config_frame = tk.Frame(self.root, bg="#1e293b", width=250)
        self.config_frame.pack(side=tk.LEFT, fill=tk.Y, padx=10, pady=10)
        
        tk.Label(self.config_frame, text="SETTINGS", bg="#1e293b", fg="white", font=("Arial", 10, "bold")).pack(pady=10)
        
        self.ent_token = self.create_input("Casino Token", is_password=True)
        self.ent_currency = self.create_input("Currency (e.g. POL)", default="POL")
        self.ent_bet = self.create_input("Base Bet", default="0.00000001")
        self.ent_sl = self.create_input("Stop Loss", default="100")
        self.ent_tp = self.create_input("Take Profit", default="100")
        
        self.btn_start = tk.Button(self.config_frame, text="START BOT", bg="#059669", fg="white", command=self.start_bot)
        self.btn_start.pack(fill=tk.X, padx=20, pady=10)
        
        self.btn_stop = tk.Button(self.config_frame, text="STOP BOT", bg="#e11d48", fg="white", command=self.stop_bot)
        self.btn_stop.pack(fill=tk.X, padx=20, pady=5)

        # Right Panel: Stats & Logs
        self.main_frame = tk.Frame(self.root, bg="#0f172a")
        self.main_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        self.lbl_status = tk.Label(self.main_frame, text="Balance: 0.00000000 | Profit: 0.00000000", bg="#0f172a", fg="white", font=("Consolas", 12))
        self.lbl_status.pack(pady=10)
        
        self.log_area = tk.Text(self.main_frame, bg="#020617", fg="#94a3b8", font=("Consolas", 9))
        self.log_area.pack(fill=tk.BOTH, expand=True)

    def create_input(self, label, default="", is_password=False):
        tk.Label(self.config_frame, text=label, bg="#1e293b", fg="#94a3b8", font=("Arial", 8)).pack(anchor="w", padx=20)
        ent = tk.Entry(self.config_frame, bg="#0f172a", fg="white", borderwidth=0)
        if is_password: ent.config(show="*")
        ent.insert(0, default)
        ent.pack(fill=tk.X, padx=20, pady=(0, 10))
        return ent

    def log(self, msg):
        self.log_area.insert(tk.END, f"[{time.strftime('%H:%M:%S')}] {msg}\n")
        self.log_area.see(tk.END)

    def start_bot(self):
        token = self.ent_token.get()
        if not token:
            messagebox.showerror("Error", "Token is required")
            return
            
        config = {
            "token": token,
            "currency": self.ent_currency.get(),
            "activeStrats": ["A", "C", "G"],
            "bets": {"A": float(self.ent_bet.get()), "B": float(self.ent_bet.get()), "C": float(self.ent_bet.get()), "G": float(self.ent_bet.get())},
            "rescueLimit": 25,
            "stopLoss": float(self.ent_sl.get()),
            "takeProfit": float(self.ent_tp.get())
        }
        
        self.bot = StandaloneBot(config)
        self.bot.running = True
        self.log("🚀 Bot Starting...")
        threading.Thread(target=self.bot_loop, daemon=True).start()

    def stop_bot(self):
        if self.bot:
            self.bot.running = False
            self.log("🛑 Bot Stopping...")

    def bot_loop(self):
        while self.bot.running:
            try:
                # 1. Prepare Bet
                strat = self.bot.active_strat
                bets_payload = []
                total_bet = 0
                info_msg = ""
                
                if strat == "A":
                    u = self.bot.get_lab_bet(self.bot.lab_seqs["A"])
                    targets = self.bot.get_smart_targets("A")
                    amt = self.bot.config['bets']["A"] * u
                    for t in targets:
                        bets_payload.append({"pocket": self.bot.get_pocket_str_a(self.bot.rezim_a, t), "bet": round(amt, 8)})
                        total_bet += amt
                    info_msg = f"A-{self.bot.rezim_a} ({u}u)"
                
                elif strat == "C":
                    u = self.bot.get_lab_bet(self.bot.lab_seqs["C"])
                    target = self.bot.get_smart_targets("C")
                    pockets = {
                        "RED": "1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36",
                        "BLACK": "2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35",
                        "EVEN": "2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36",
                        "ODD": "1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35"
                    }
                    amt = self.bot.config['bets']["C"] * u
                    bets_payload.append({"pocket": pockets.get(target, pockets["RED"]), "bet": round(amt, 8)})
                    total_bet += amt
                    info_msg = f"C-{target} ({u}u)"

                elif strat == "G":
                    self.bot.strat_g_nums = self.bot.get_smart_targets("G")
                    for n in self.bot.strat_g_nums:
                        bets_payload.append({"pocket": str(n), "bet": round(self.bot.strat_g_current_bet, 8)})
                        total_bet += self.bot.strat_g_current_bet
                    info_msg = f"G-AI Lot ({self.bot.strat_g_current_bet:.8f})"

                if not bets_payload:
                    self.log(f"⚠️ Strategy {strat} not fully implemented or no targets. Skipping...")
                    self.bot.active_strat = random.choice(self.bot.config['activeStrats'])
                    time.sleep(2)
                    continue

                # 2. API Call
                headers = {"x-access-token": self.bot.config['token'], "Content-Type": "application/json"}
                payload = {
                    "query": "mutation spinRoulette($bets: [RouletteBetInput]!, $currency: CurrencyEnum!) { spinRoulette(bets: $bets, currency: $currency) { roll winAmount user { wallets { currency balance } } } }",
                    "variables": {"bets": bets_payload, "currency": self.bot.config['currency']}
                }
                
                try:
                    response = requests.post(API_URL, json=payload, headers=headers, timeout=10)
                    res = response.json()
                except Exception as e:
                    self.log(f"❌ Network/API Error: {str(e)}")
                    time.sleep(5)
                    continue
                
                if "errors" in res:
                    err = res['errors'][0]['message']
                    self.log(f"❌ API Error: {err}")
                    if "balance" in err.lower(): 
                        self.bot.running = False
                        break
                    time.sleep(5)
                    continue
                
                data = res['data']['spinRoulette']
                roll = data['roll']
                win = float(data.get('winAmount', data.get('win_amount', 0)))
                
                # Robust balance fetching
                wallets = data['user']['wallets']
                cur_bal = 0
                target_curr = self.bot.config['currency'].upper()
                for w in wallets:
                    if w['currency'].upper() == target_curr or w['currency'].upper() == "USDT":
                        cur_bal = float(w['balance'])
                        break
                
                # 3. Update State
                if self.bot.session_start_bal is None: 
                    self.bot.session_start_bal = cur_bal + total_bet
                    self.bot.highest_bal = self.bot.session_start_bal
                
                self.bot.balance = cur_bal
                self.bot.profit = cur_bal - self.bot.session_start_bal
                
                # Update virtual stats before adding to history
                self.bot.update_virtual_stats(roll)
                self.bot.history.append(roll)
                
                is_win = win > total_bet
                
                # Update Strategy Logic
                if strat == "A":
                    u = self.bot.get_lab_bet(self.bot.lab_seqs["A"])
                    self.bot.lab_seqs["A"] = self.bot.update_lab(self.bot.lab_seqs["A"], is_win, u if is_win else u*2)
                    self.bot.rezim_a = "RADA" if self.bot.rezim_a == "TUCET" else "TUCET"
                elif strat == "C":
                    u = self.bot.get_lab_bet(self.bot.lab_seqs["C"])
                    self.bot.lab_seqs["C"] = self.bot.update_lab(self.bot.lab_seqs["C"], is_win, u)
                elif strat == "G":
                    if is_win:
                        self.bot.strat_g_loss_counter = 0
                        self.bot.strat_g_current_bet = self.bot.config['bets']["G"]
                    else:
                        self.bot.strat_g_loss_counter += 1
                        if self.bot.strat_g_loss_counter % 2 == 0: self.bot.strat_g_current_bet *= 2

                # AI Analysis Trigger
                if len(self.bot.history) % 10 == 0:
                    self.bot.run_local_analysis()

                # Profit Lock
                if cur_bal > self.bot.highest_bal:
                    diff = cur_bal - self.bot.highest_bal
                    self.bot.highest_bal = cur_bal
                    
                    # Reset sequences
                    self.bot.lab_seqs = {s: [1, 1] for s in ["A", "C", "D", "E", "F"]}
                    self.bot.strat_g_loss_counter = 0
                    self.bot.strat_g_current_bet = self.bot.config['bets']["G"]
                    
                    self.log(f"🔒 LOCK (+{diff:.8f})", "#22d3ee")
                    
                    # Switch strategy
                    self.bot.active_strat = self.bot.pick_best_strat()

                # 4. UI Update
                self.lbl_status.config(text=f"Balance: {self.bot.balance:.8f} | Profit: {self.bot.profit:.8f}")
                res_icon = "✅" if is_win else "❌"
                self.log(f"#{roll} | {info_msg} | Bet: {total_bet:.8f} | {res_icon}")
                
                if self.bot.profit >= self.bot.config['takeProfit']:
                    self.log("🏆 Take Profit Reached!")
                    self.bot.running = False
                    break
                
                if self.bot.profit <= -self.bot.config['stopLoss']:
                    self.log("🛑 Stop Loss Hit!")
                    self.bot.running = False
                    break
                
                time.sleep(1.2)
            except Exception as e:
                self.log(f"⚠️ Loop Error: {str(e)}")
                time.sleep(5)

if __name__ == "__main__":
    root = tk.Tk()
    app = BotGUI(root)
    root.mainloop()
