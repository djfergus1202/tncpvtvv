const express = require("express");
const Parser = require("rss-parser");
const helmet = require("helmet");
const compression = require("compression");
const crypto = require("crypto");
const path = require("path");
const cors = require("cors");

/**
 * 🎬 PodScript Studio - Complete Podcast to Book Platform
 * 
 * Features:
 * - RSS Feed parsing and streaming interface
 * - YouTube video metadata extraction
 * - Transcription queue management
 * - Book generation API
 */

const app = express();

app.disable("x-powered-by");
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false 
}));

// Serve static files from same directory
app.use(express.static(__dirname));

const parser = new Parser({
  timeout: 30000,
  headers: {
    'User-Agent': 'PodScript-Studio/1.0'
  },
  customFields: {
    feed: [
      ["itunes:author", "itunesAuthor"],
      ["itunes:image", "itunesImage"],
      ["itunes:category", "itunesCategory"],
    ],
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
      ["itunes:image", "itunesImage"],
      ["itunes:duration", "duration"],
      ["itunes:season", "season"],
      ["itunes:episode", "episode"],
      ["itunes:summary", "itunesSummary"],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

// -------------------- Configuration --------------------
const PORT = process.env.PORT || 3000;
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 10 * 60 * 1000);
const EP_LIMIT = Number(process.env.EP_LIMIT || 100);

// -------------------- Utilities --------------------
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stripHtml(str) {
  if (!str) return "";
  return String(str).replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();
}

function safeTruncate(str, n = 320) {
  const s = stripHtml(str);
  return s.length > n ? s.slice(0, n).trim() + "..." : s;
}

function normalizeToHttps(url) {
  if (!url) return "";
  return url.startsWith("http://") ? url.replace("http://", "https://") : url;
}

function stableHash(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex").slice(0, 16);
}

function pickImageUrl(item, feedImage) {
  // Try media:thumbnail
  const tn = item.mediaThumbnail?.[0]?.$?.url;
  if (tn) return normalizeToHttps(tn);
  
  // Try itunes:image
  if (item.itunesImage) {
    if (typeof item.itunesImage === "string") return normalizeToHttps(item.itunesImage);
    if (item.itunesImage.href) return normalizeToHttps(item.itunesImage.href);
    if (item.itunesImage.url) return normalizeToHttps(item.itunesImage.url);
    if (item.itunesImage.$?.href) return normalizeToHttps(item.itunesImage.$.href);
  }
  
  // Fallback to feed image
  return feedImage || "";
}

function pickMedia(item) {
  // Enclosure (most common for podcasts)
  if (item.enclosure?.url) {
    return { url: item.enclosure.url, type: item.enclosure.type || "" };
  }
  
  // media:content
  const mc = item.mediaContent?.[0];
  if (mc?.$?.url) {
    return { url: mc.$.url, type: mc.$.type || "" };
  }
  
  return { url: item.link || "", type: "" };
}

function inferKind(mediaUrl, mediaType) {
  const u = (mediaUrl || "").toLowerCase();
  const t = (mediaType || "").toLowerCase();
  if (t.startsWith("video/") || u.includes(".m3u8") || u.match(/\.(mp4|webm|mov)(\?|$)/)) {
    return "video";
  }
  return "audio";
}

function formatDuration(dur) {
  if (!dur) return "";
  // If already formatted like "1:23:45" return as is
  if (String(dur).includes(":")) return dur;
  // If numeric seconds
  const secs = parseInt(dur);
  if (isNaN(secs)) return dur;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// -------------------- Feed Cache --------------------
const feedCache = new Map();

async function getFeed(url) {
  const hash = stableHash(url);
  const cached = feedCache.get(hash);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const feed = await parser.parseURL(url);
    
    // Extract feed image
    let feedImage = "";
    if (feed.image?.url) feedImage = normalizeToHttps(feed.image.url);
    else if (feed.itunesImage) {
      if (typeof feed.itunesImage === "string") feedImage = normalizeToHttps(feed.itunesImage);
      else if (feed.itunesImage.href) feedImage = normalizeToHttps(feed.itunesImage.href);
      else if (feed.itunesImage.$?.href) feedImage = normalizeToHttps(feed.itunesImage.$.href);
    }

    const items = (feed.items || []).slice(0, EP_LIMIT).map((item, index) => {
      const { url: mediaUrl, type: mediaType } = pickMedia(item);
      if (!mediaUrl) return null;

      const description = item.contentSnippet || item.itunesSummary || 
                         stripHtml(item.contentEncoded) || item.content || "";

      return {
        id: stableHash(item.guid || item.link || mediaUrl),
        index,
        title: safeTruncate(item.title, 200),
        description: safeTruncate(description, 500),
        mediaUrl: normalizeToHttps(mediaUrl),
        mediaType,
        kind: inferKind(mediaUrl, mediaType),
        image: pickImageUrl(item, feedImage),
        pubDate: item.pubDate || item.isoDate || "",
        duration: formatDuration(item.duration),
        season: item.season || "",
        episode: item.episode || "",
        link: item.link || ""
      };
    }).filter(Boolean);

    const result = {
      meta: {
        title: feed.title || "Untitled",
        description: stripHtml(feed.description || ""),
        link: feed.link || "",
        image: feedImage,
        author: feed.itunesAuthor || feed.creator || ""
      },
      items
    };

    feedCache.set(hash, { timestamp: Date.now(), data: result });
    return result;
  } catch (err) {
    console.error("RSS Parse Error:", err.message);
    throw new Error("Failed to parse RSS feed: " + err.message);
  }
}

// -------------------- YouTube Utilities --------------------
function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
    /youtube\.com\/live\/([^&\n?#]+)/
  ];
  for (const p of patterns) {
    const match = url.match(p);
    if (match) return match[1];
  }
  return null;
}

function extractPlaylistId(url) {
  const match = url.match(/[?&]list=([^&]+)/);
  return match ? match[1] : null;
}

// -------------------- API Routes --------------------

// Health check
app.get("/health", (req, res) => res.json({ status: "ok", timestamp: Date.now() }));

// Fetch RSS feed
app.get("/api/feed", async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "Missing 'url' query parameter" });
  }

  try {
    const feed = await getFeed(url);
    res.json(feed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy RSS for CORS
app.get("/api/rss-proxy", async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "Missing URL" });
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PodScript-Studio/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      },
      timeout: 30000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const text = await response.text();
    res.set('Content-Type', 'application/xml');
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// YouTube video info (via noembed - no API key needed)
app.get("/api/youtube/info", async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "Missing 'url' query parameter" });
  }

  const videoId = extractYouTubeId(url);
  if (!videoId) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const noembedUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(noembedUrl);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    res.json({
      id: videoId,
      title: data.title || "Unknown Title",
      author: data.author_name || "Unknown",
      authorUrl: data.author_url || "",
      thumbnail: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      thumbnailHQ: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      provider: "YouTube"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// YouTube playlist info (basic - just extracts IDs)
app.get("/api/youtube/playlist", async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "Missing 'url' query parameter" });
  }

  const playlistId = extractPlaylistId(url);
  if (!playlistId) {
    return res.status(400).json({ error: "Invalid playlist URL" });
  }

  // Note: Full playlist extraction requires YouTube Data API or yt-dlp
  // This returns basic info and instructions
  res.json({
    playlistId,
    playlistUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
    message: "Full playlist extraction requires yt-dlp. Use: yt-dlp --flat-playlist -j 'PLAYLIST_URL'",
    downloadCommand: `yt-dlp -x --audio-format mp3 -o '%(title)s.%(ext)s' 'https://www.youtube.com/playlist?list=${playlistId}'`
  });
});

// Transcription job management (in-memory for demo)
const transcriptionJobs = new Map();

app.post("/api/transcription/create", (req, res) => {
  const { episodes } = req.body;
  if (!episodes || !Array.isArray(episodes)) {
    return res.status(400).json({ error: "Missing episodes array" });
  }

  const jobId = stableHash(Date.now() + Math.random());
  const job = {
    id: jobId,
    created: Date.now(),
    status: "pending",
    episodes: episodes.map(ep => ({
      ...ep,
      status: "pending",
      transcript: null
    })),
    completed: 0,
    total: episodes.length
  };

  transcriptionJobs.set(jobId, job);
  res.json({ jobId, total: episodes.length });
});

app.get("/api/transcription/:jobId", (req, res) => {
  const job = transcriptionJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  res.json(job);
});

app.post("/api/transcription/:jobId/update", (req, res) => {
  const job = transcriptionJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  const { episodeId, status, transcript } = req.body;
  const episode = job.episodes.find(ep => ep.id === episodeId);
  if (episode) {
    episode.status = status;
    if (transcript) episode.transcript = transcript;
    if (status === "completed") job.completed++;
    if (status === "error") episode.error = req.body.error;
  }

  job.status = job.completed === job.total ? "completed" : "processing";
  res.json({ success: true });
});

// Book generation
app.post("/api/book/generate", (req, res) => {
  const { title, subtitle, author, chapters, format } = req.body;

  if (!chapters || !Array.isArray(chapters)) {
    return res.status(400).json({ error: "Missing chapters array" });
  }

  // Generate book content based on format
  let content;
  
  if (format === "txt") {
    content = generateTextBook(title, subtitle, author, chapters);
  } else if (format === "html") {
    content = generateHtmlBook(title, subtitle, author, chapters);
  } else {
    return res.status(400).json({ error: "Unsupported format. Use 'txt' or 'html'" });
  }

  res.json({ content, format });
});

function generateTextBook(title, subtitle, author, chapters) {
  let text = `${"=".repeat(60)}\n`;
  text += `${(title || "Untitled").toUpperCase()}\n`;
  if (subtitle) text += `${subtitle}\n`;
  text += `\nBy ${author || "Unknown Author"}\n`;
  text += `${"=".repeat(60)}\n\n`;

  chapters.forEach((ch, i) => {
    text += `\n${"-".repeat(40)}\n`;
    text += `CHAPTER ${i + 1}: ${ch.title || `Chapter ${i + 1}`}\n`;
    if (ch.date) text += `${ch.date}\n`;
    text += `${"-".repeat(40)}\n\n`;
    text += `${ch.content || ""}\n\n`;
  });

  return text;
}

function generateHtmlBook(title, subtitle, author, chapters) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title || "Untitled")}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600&display=swap" rel="stylesheet">
  <style>
    @page { margin: 1in; }
    body { font-family: 'Cormorant Garamond', Georgia, serif; line-height: 1.8; max-width: 700px; margin: 0 auto; padding: 2rem; color: #1a1612; }
    .title-page { text-align: center; page-break-after: always; padding: 4rem 0; }
    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .subtitle { font-size: 1.2rem; color: #8b7355; margin-bottom: 2rem; }
    .author { font-style: italic; font-size: 1.3rem; }
    .ornament { font-size: 1.5rem; margin: 2rem 0; color: #c4563a; }
    .chapter { page-break-before: always; margin-bottom: 3rem; }
    .chapter-number { font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.2em; color: #c4563a; margin-bottom: 0.5rem; }
    .chapter-title { font-size: 1.8rem; font-weight: 600; margin-bottom: 1.5rem; }
    .chapter-date { font-size: 0.9rem; color: #8b7355; margin-bottom: 1rem; }
    p { margin-bottom: 1rem; text-indent: 1.5em; text-align: justify; }
    p:first-of-type { text-indent: 0; }
  </style>
</head>
<body>
  <div class="title-page">
    <h1>${escapeHtml(title || "Untitled")}</h1>
    <p class="subtitle">${escapeHtml(subtitle || "")}</p>
    <div class="ornament">❧</div>
    <p class="author">${escapeHtml(author || "")}</p>
  </div>
  ${chapters.map((ch, i) => `
    <div class="chapter">
      <div class="chapter-number">Chapter ${i + 1}</div>
      <h2 class="chapter-title">${escapeHtml(ch.title || `Chapter ${i + 1}`)}</h2>
      ${ch.date ? `<p class="chapter-date">${escapeHtml(ch.date)}</p>` : ""}
      <div class="chapter-content">${ch.content || ""}</div>
    </div>
  `).join("")}
</body>
</html>`;
}

// Serve main app
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Catch-all for SPA routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// -------------------- Start Server --------------------
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🎬 PODSCRIPT STUDIO                                      ║
║                                                            ║
║   Server running at: http://localhost:${PORT}                 ║
║                                                            ║
║   Features:                                                ║
║   • RSS Pitch Deck Viewer                                  ║
║   • YouTube Podcast Scraper                                ║
║   • Browser-based Whisper Transcription                    ║
║   • Book Generation & Export                               ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
