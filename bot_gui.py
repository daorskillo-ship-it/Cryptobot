import tkinter as tk
from tkinter import ttk, messagebox
import requests
import threading
import time

class BotControlGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Trinity Bot - PC Remote Control")
        self.root.geometry("600x500")
        self.root.configure(bg="#0f172a")

        # Configuration
        self.base_url = "https://ais-dev-siwye3mrutzhor23xmfhyv-421644527015.europe-west2.run.app" # Your App URL
        self.running = False

        self.setup_ui()
        self.update_loop()

    def setup_ui(self):
        style = ttk.Style()
        style.theme_use('clam')
        
        # Header
        header = tk.Label(self.root, text="TRINITY BOT REMOTE", font=("Helvetica", 16, "bold"), bg="#1e293b", fg="#818cf8", py=10)
        header.pack(fill=tk.X)

        # Stats Frame
        stats_frame = tk.Frame(self.root, bg="#0f172a", pady=20)
        stats_frame.pack(fill=tk.X, padx=20)

        self.lbl_balance = tk.Label(stats_frame, text="Balance: 0.00000000", font=("Consolas", 12), bg="#0f172a", fg="white")
        self.lbl_balance.pack(side=tk.LEFT, expand=True)

        self.lbl_profit = tk.Label(stats_frame, text="Profit: +0.00000000", font=("Consolas", 12, "bold"), bg="#0f172a", fg="#4ade80")
        self.lbl_profit.pack(side=tk.LEFT, expand=True)

        # Log Area
        self.log_area = tk.Text(self.root, bg="#020617", fg="#94a3b8", font=("Consolas", 9), height=15, padx=10, pady=10)
        self.log_area.pack(fill=tk.BOTH, expand=True, padx=20)
        self.log_area.insert(tk.END, "Connecting to bot server...\n")
        self.log_area.config(state=tk.DISABLED)

        # Controls
        btn_frame = tk.Frame(self.root, bg="#0f172a", pady=20)
        btn_frame.pack(fill=tk.X)

        self.btn_start = tk.Button(btn_frame, text="START BOT", bg="#059669", fg="white", font=("Helvetica", 10, "bold"), 
                                  width=15, command=self.start_bot, relief=tk.FLAT)
        self.btn_start.pack(side=tk.LEFT, padx=50, expand=True)

        self.btn_stop = tk.Button(btn_frame, text="STOP BOT", bg="#e11d48", fg="white", font=("Helvetica", 10, "bold"), 
                                 width=15, command=self.stop_bot, relief=tk.FLAT)
        self.btn_stop.pack(side=tk.LEFT, padx=50, expand=True)

    def log(self, message):
        self.log_area.config(state=tk.NORMAL)
        self.log_area.insert(tk.END, f"[{time.strftime('%H:%M:%S')}] {message}\n")
        self.log_area.see(tk.END)
        self.log_area.config(state=tk.DISABLED)

    def start_bot(self):
        # In a real app, you'd send the full config here
        # For this remote, we assume the bot is already configured on the web
        try:
            # Note: This is a simplified start for the remote
            self.log("Sending START command...")
            # We'd normally fetch the current config from UI or a file
            messagebox.showinfo("Remote Control", "Please start the bot via the Web UI first to ensure full configuration is loaded. This remote can then monitor it.")
        except Exception as e:
            self.log(f"Error: {str(e)}")

    def stop_bot(self):
        try:
            res = requests.post(f"{self.base_url}/api/bot/stop")
            if res.status_code == 200:
                self.log("🛑 Bot stopped via remote.")
            else:
                self.log("❌ Failed to stop bot.")
        except Exception as e:
            self.log(f"Connection Error: {str(e)}")

    def update_loop(self):
        def run():
            while True:
                try:
                    res = requests.get(f"{self.base_url}/api/bot/status", timeout=5)
                    if res.status_code == 200:
                        data = res.json()
                        self.lbl_balance.config(text=f"Balance: {data['balance']:.8f}")
                        profit = data['profit']
                        color = "#4ade80" if profit >= 0 else "#f87171"
                        prefix = "+" if profit >= 0 else ""
                        self.lbl_profit.config(text=f"Profit: {prefix}{profit:.8f}", fg=color)
                    time.sleep(2)
                except Exception as e:
                    print(f"Update error: {e}")
                    time.sleep(5)
        
        threading.Thread(target=run, daemon=True).start()

if __name__ == "__main__":
    root = tk.Tk()
    app = BotControlGUI(root)
    root.mainloop()
