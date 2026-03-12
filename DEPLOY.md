# 28 Trump Game — Deployment Guide
## Railway (Server) + Netlify (Client)

---

## STEP 1 — Push to GitHub

1. Go to https://github.com → New Repository → name it `28-trump-game` → Create
2. Open terminal in your `28-trump-game` folder and run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/28-trump-game.git
git push -u origin main
```

---

## STEP 2 — Deploy Server on Railway

1. Go to https://railway.app → Sign up with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `28-trump-game` repo
4. Railway will detect it — click **Add Service** → **GitHub Repo**
5. In service settings → **Root Directory** → set to `server`
6. Click **Deploy**
7. Go to **Settings** → **Networking** → **Generate Domain**
8. Copy your domain: `https://28-trump-game-xxxx.railway.app`

### Set Railway Environment Variable:
- Go to your service → **Variables** tab → Add:
  ```
  CLIENT_URL = https://your-netlify-app.netlify.app
  ```
  (Add this after Step 3 when you have the Netlify URL)

---

## STEP 3 — Deploy Client on Netlify

1. Go to https://netlify.com → Sign up with GitHub
2. Click **Add new site** → **Import an existing project** → GitHub
3. Select your `28-trump-game` repo
4. Set these build settings:
   - **Base directory**: `client`
   - **Build command**: `npm run build`
   - **Publish directory**: `client/dist`
5. Before deploying, add **Environment Variable**:
   - Go to **Site configuration** → **Environment variables** → Add:
     ```
     VITE_SERVER_URL = https://28-trump-game-xxxx.railway.app
     ```
     (Use your Railway domain from Step 2)
6. Click **Deploy site**
7. Copy your Netlify URL: `https://your-app.netlify.app`

### Go back to Railway and update CLIENT_URL:
- Railway → your service → Variables → set `CLIENT_URL` to your Netlify URL
- Railway will auto-redeploy

---

## STEP 4 — Test It

1. Open your Netlify URL in browser
2. Share the URL with friends
3. Create a room and play!

---

## Making Updates Later

When you change code locally:
```bash
git add .
git commit -m "your change description"
git push
```
Both Railway and Netlify will **auto-redeploy** on every push. No manual steps needed.

---

## Troubleshooting

**"Connecting..." never connects**
→ Check Railway logs — make sure server is running
→ Make sure `VITE_SERVER_URL` in Netlify matches your Railway domain exactly (no trailing slash)

**Works locally but not on Netlify**
→ Make sure you set the `VITE_SERVER_URL` environment variable in Netlify (not just locally)
→ Rebuild the Netlify site after adding the variable

**Railway keeps sleeping**
→ Railway free tier stays awake. If using Render free tier instead, upgrade to paid or ping the server periodically.
