# 📖 PodScript Studio

**Complete Podcast to Book Platform** — Transform any podcast into a beautifully formatted book.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

---

## ✨ Features

### 🎬 RSS Pitch Deck Viewer
- Netflix-style streaming interface for podcasts
- Support for audio and video RSS feeds
- High-fidelity playback with ambient background effects
- Episode grid with rich metadata display

### 📺 YouTube Podcast Scraper
- Extract video metadata without API keys
- Integration with free download tools (Cobalt, Y2Mate, YT1s)
- Support for videos, shorts, and live streams
- URL copying and download instructions

### 🎙️ Browser-Based Transcription
- **100% Private** — Audio never leaves your device
- **No API Keys Required** — Uses Whisper AI via Transformers.js
- **Free Forever** — No subscriptions or usage limits
- Supports MP3, WAV, M4A, OGG, WEBM formats
- Real-time progress tracking

### 📚 Book Generation
- Multiple export formats: PDF, HTML, TXT
- Customizable book settings (title, subtitle, author)
- Chapter styles: per-episode or combined narrative
- Optional table of contents and episode dates
- Beautiful typography with Cormorant Garamond font

---

## 🚀 Quick Start

### Option 1: Run with Node.js

```bash
# Clone or download the project
cd podscript-studio

# Install dependencies
npm install

# Start the server
npm start

# Open in browser
open http://localhost:3000
```

### Option 2: Run with Docker

```bash
# Build the image
docker build -t podscript-studio .

# Run the container
docker run -p 3000:3000 podscript-studio

# Open in browser
open http://localhost:3000
```

### Option 3: Static HTML Only

The `public/index.html` file can be opened directly in a browser for client-side only functionality (RSS parsing via CORS proxies, no server-side features).

---

## 📖 Usage Guide

### 1. Load a Podcast Feed

1. Go to the **Pitch Deck** tab
2. Paste an RSS feed URL (e.g., `https://feeds.simplecast.com/54nAGcIl`)
3. Click "Load Feed"
4. Browse and play episodes in the Netflix-style interface

**Sample RSS Feeds to Try:**
- This American Life: `https://feeds.simplecast.com/54nAGcIl`
- NPR Up First: `https://feeds.npr.org/510318/podcast.xml`
- Huberman Lab: `https://feeds.megaphone.fm/hubermanlab`
- Anchor/Spotify: `https://anchor.fm/s/YOUR_ID/podcast/rss`

### 2. Process YouTube Videos

1. Go to the **YouTube** tab
2. Paste a YouTube video URL
3. Click "Extract Info" to get video metadata
4. Use the provided download links (Cobalt recommended)
5. Upload the downloaded audio in the Transcribe tab

### 3. Transcribe Audio

1. Go to the **Transcribe** tab
2. Click "Load Model" (first time only, ~40MB download)
3. Upload audio files OR import from Pitch Deck
4. Click "Transcribe" or "Transcribe All"
5. View transcripts in real-time

### 4. Create Your Book

1. Go to the **Book** tab
2. Customize title, subtitle, and author
3. Choose chapter style and options
4. Export as PDF, HTML, or TXT

---

## 🛠️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `CACHE_TTL_MS` | `600000` | Feed cache duration (10 min) |
| `EP_LIMIT` | `100` | Maximum episodes to fetch |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/feed?url=` | GET | Fetch and parse RSS feed |
| `/api/rss-proxy?url=` | GET | CORS proxy for RSS feeds |
| `/api/youtube/info?url=` | GET | Get YouTube video metadata |
| `/api/youtube/playlist?url=` | GET | Get playlist info |
| `/api/transcription/create` | POST | Create transcription job |
| `/api/book/generate` | POST | Generate book content |
| `/health` | GET | Health check |

---

## 🔒 Privacy & Security

- **Local Processing**: All transcription happens in your browser using WebAssembly
- **No Data Collection**: Audio files are never uploaded to any server
- **No API Keys**: Works without any external API keys
- **CORS Proxies**: RSS feeds are fetched through public CORS proxies
- **Open Source**: Full source code available for audit

---

## 🧰 Tech Stack

**Backend:**
- Node.js 18+
- Express.js
- rss-parser
- node-fetch
- helmet & compression

**Frontend:**
- Vanilla JavaScript (no framework dependencies)
- Transformers.js (Whisper AI)
- Web Audio API
- Modern CSS (Custom Properties, Grid, Flexbox)

**Fonts:**
- Cinzel (Headlines)
- Inter (UI)
- Cormorant Garamond (Book content)

---

## 📝 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + 1` | Switch to Pitch Deck |
| `Alt + 2` | Switch to YouTube |
| `Alt + 3` | Switch to Transcribe |
| `Alt + 4` | Switch to Book |

---

## 🐛 Troubleshooting

### "No speech detected" in transcription
- Ensure the audio file contains actual speech
- Try normalizing the audio volume
- Check the browser console for errors

### RSS feed won't load
- Verify the URL is a valid RSS/XML feed
- Some feeds may be blocked by CORS policies
- Try a different CORS proxy

### Model won't load
- Ensure stable internet connection
- Clear browser cache and retry
- Try a different browser (Chrome/Edge recommended)

### YouTube info extraction fails
- Verify the URL format is correct
- Some videos may have restricted metadata
- Age-restricted videos may not work

---

## 📄 License

MIT License - feel free to use, modify, and distribute.

---

## 🙏 Acknowledgments

- [Transformers.js](https://github.com/xenova/transformers.js) - Browser-based ML inference
- [OpenAI Whisper](https://github.com/openai/whisper) - Speech recognition model
- [rss-parser](https://github.com/rbren/rss-parser) - RSS feed parsing

---

**Made with ❤️ for podcasters, researchers, and book lovers**
