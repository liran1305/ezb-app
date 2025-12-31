# ע.ז.ב - עשה זאת בעצמך

AI-powered home repair diagnosis app for Israeli users.

![App Screenshot](screenshot.png)

## Quick Start (5 minutes)

### 1. Setup Server

```bash
cd server
npm install
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
npm run dev
```

### 2. Setup Client

```bash
cd client
npm install
npm run dev
```

### 3. Open on Phone

- Open `http://YOUR_COMPUTER_IP:3000` on your phone
- Or use ngrok for easy mobile testing:
  ```bash
  npx ngrok http 3000
  ```

## Features

- 📸 Take photo of any home problem
- 🔍 AI diagnosis using Claude Vision
- ✅ DIY feasibility assessment
- 📝 Step-by-step repair instructions
- 🛒 Shopping list with Israeli store prices
- 💡 Local tips (Home Center, ACE, etc.)
- ⚠️ Safety warnings
- 📞 When to call a professional

## Deployment

### Deploy Server (Railway/Render/Fly.io)

1. Push server folder to GitHub
2. Connect to Railway/Render
3. Set `ANTHROPIC_API_KEY` environment variable
4. Deploy

### Deploy Client (Vercel/Netlify)

1. Push client folder to GitHub
2. Connect to Vercel/Netlify
3. Set `VITE_API_URL` to your server URL
4. Deploy

### Quick Deploy with Railway

```bash
# In server folder
railway login
railway init
railway up
```

## PWA Installation

On mobile:
1. Open the app in Chrome/Safari
2. Tap "Add to Home Screen"
3. App will work offline for viewing past diagnoses

## Project Structure

```
ezb-app/
├── client/                 # React PWA
│   ├── src/
│   │   ├── App.jsx        # Main app component
│   │   ├── App.css        # Styles
│   │   └── components/
│   │       ├── CameraCapture.jsx
│   │       └── DiagnosisResult.jsx
│   ├── public/
│   │   └── manifest.json  # PWA manifest
│   └── index.html
│
└── server/                 # Express API
    └── index.js           # Claude Vision integration
```

## Customization

### Modify the AI Prompt

Edit `server/index.js` - look for `DIAGNOSIS_PROMPT` to customize:
- Add more Israeli stores
- Adjust difficulty scoring
- Change response format

### Add Features

Ideas for v2:
- [ ] History of past diagnoses
- [ ] Share to WhatsApp
- [ ] Hebrew voice input
- [ ] Connect to local professionals
- [ ] Affiliate links to stores

## Costs

- Claude API: ~$0.01-0.03 per diagnosis
- Hosting: Free tier on Vercel + Railway

## License

MIT
