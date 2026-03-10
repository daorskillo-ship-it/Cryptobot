# Paradice Trinity Bot - Deployment Guide

This bot is a full-stack React + Express application. To host it permanently for free, follow these steps.

## Option 1: Render (Recommended)

Render is the easiest way to host this bot for free.

### 1. Create a GitHub Repository
1. Go to [GitHub](https://github.com) and create a new private repository.
2. Upload all the files from this project to that repository.

### 2. Deploy to Render
1. Go to [Render.com](https://render.com) and create a free account.
2. Click **"New +"** and select **"Web Service"**.
3. Connect your GitHub account and select your bot repository.
4. Use the following settings:
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`

### 3. Keep it Awake (Crucial)
Render's free tier "sleeps" after 15 minutes of inactivity. To keep the bot running 24/7:
1. Go to [Cron-job.org](https://cron-job.org).
2. Create a free account.
3. Create a new "Cronjob" that pings your Render URL (e.g., `https://your-bot.onrender.com`) every **10 minutes**.
4. This will prevent the bot from ever stopping.

---

## Option 2: Railway

Railway is faster but has a monthly limit on free usage.

1. Go to [Railway.app](https://railway.app).
2. Click **"New Project"** -> **"Deploy from GitHub repo"**.
3. Select your repository.
4. Railway will automatically detect the `start` script and deploy it.

---

## Option 3: Google Cloud Run (Professional)

Google Cloud Run is highly scalable and offers a generous free tier.

### 1. Install Google Cloud SDK
Make sure you have the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) installed on your computer.

### 2. Prepare for Deployment
1. Open your terminal in the project folder.
2. Run `gcloud auth login` to sign in.
3. Run `gcloud config set project YOUR_PROJECT_ID`.

### 3. Deploy with one command
Run the following command to build and deploy your bot:
```bash
gcloud run deploy paradice-bot --source . --platform managed --region europe-west1 --allow-unauthenticated
```
*Note: Replace `europe-west1` with your preferred region.*

### 4. Environment Variables on Google Cloud
If you need to add secrets (like Telegram tokens):
1. Go to the [Google Cloud Console](https://console.cloud.google.com/run).
2. Select your service `paradice-bot`.
3. Click **"Edit & Deploy New Revision"**.
4. Go to **"Variables & Secrets"** and add your values.

---

## Option 4: Run on Windows PC (Local)

You can run the bot directly on your Windows computer.

### 1. Install Node.js
Download and install the **LTS version** from [nodejs.org](https://nodejs.org/).

### 2. Download and Extract
Download the project files and extract them into a folder on your computer.

### 3. Run the Bot
1. Find the file named **`run_on_windows.bat`** in the project folder.
2. **Double-click** it.
3. The first time you run it, it will automatically install all dependencies and build the app (this takes about 1-2 minutes).
4. Once it says `[SUCCESS] Starting the bot...`, open your web browser and go to:
   **`http://localhost:3000`**

---

## ⚠️ Important: Keeping the Bot Running 24/7

By default, Google Cloud Run is "serverless," which means it might stop the bot if no one is looking at the website. To keep your bot running 24/7:

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/run).
2.  Click on your service `paradice-bot`.
3.  Click **"Edit & Deploy New Revision"**.
4.  Scroll down to the **"Autoscaling"** section.
5.  Set **"Minimum number of instances"** to **1**.
6.  Click **"Deploy"**.

This ensures that at least one copy of your bot is always awake and betting, even if you close your browser!

---

## Environment Variables

If you want the bot to **start automatically** and run 24/7 without you needing to click "Start" in the browser, add these in your host's (Google Cloud/Render) **Environment Variables** section:

- `CASINO_TOKEN`: Your Paradice access token (REQUIRED for auto-start)
- `CURRENCY`: e.g., `POL`, `USDT_BEP`, `DOGE` (Default: `POL`)
- `ACTIVE_STRATS`: e.g., `A,B,G` (Default: `A`)
- `BET_A`: Base bet for Strat A (Default: `0.00000001`)
- `STOP_LOSS`: Profit amount to stop at (Default: `100`)
- `TAKE_PROFIT`: Profit amount to stop at (Default: `100`)
- `TG_TOKEN`: Your Telegram Bot Token
- `TG_CHAT`: Your Telegram Chat ID
- `AI_MODE`: `true` to enable AI strategy switching (Default: `false`)
- `RISK_TOLERANCE`: `LOW`, `MEDIUM`, or `HIGH` (Default: `MEDIUM`)
- `GEMINI_API_KEY`: Your Google Gemini API Key for deep pattern analysis
- `NODE_ENV`: `production`
- `PORT`: (Automatically set by host)

---

## Local Development

If you want to run it on your own computer:
1. Install [Node.js](https://nodejs.org).
2. Open a terminal in the project folder.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open `http://localhost:3000` in your browser.
