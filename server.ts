import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer } from "ws";
import { GoogleGenAI, Modality, Type, LiveServerMessage, GenerateVideosOperation, ThinkingLevel } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { 
  loadMemories, 
  saveMemories, 
  formatSystemInstructionsWithMemories, 
  processConversationSlice,
  extractSessionKeyPoints
} from "./server_memory";
import { Memory } from "./src/lib/memoryTypes";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // Memory REST API Endpoints
  app.get("/api/memories", async (req, res) => {
    try {
      const memories = await loadMemories();
      res.json(memories);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/memories", async (req, res) => {
    try {
      const { category, text } = req.body;
      if (!category || !text) {
        return res.status(400).json({ error: "Category and text parameters are required." });
      }
      const memories = await loadMemories();
      const timestamp = new Date().toISOString();
      const newMemory: Memory = {
        id: Math.random().toString(36).substring(2, 11),
        category,
        text,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      memories.push(newMemory);
      await saveMemories(memories);
      res.status(201).json(newMemory);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/memories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      let memories = await loadMemories();
      memories = memories.filter(m => m.id !== id);
      await saveMemories(memories);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Safe Server-Side Scraper & HTML Proxy endpoint
  app.get("/api/proxy", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ error: "Missing 'url' parameter." });
      }

      console.log(`[Proxy Scraper] Fetching external content for: ${url}`);
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
      });

      if (!response.ok) {
        throw new Error(`Scraper failed to load page: status ${response.status}`);
      }

      const html = await response.text();

      // Simple regex-based HTML parsers for standard items
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "";

      // Extract high-level headings (h1, h2, h3)
      const headings: string[] = [];
      const headingMatches = html.matchAll(/<h([1-3])\b[^>]*>(.*?)<\/h\1>/gi);
      for (const match of headingMatches) {
        const text = match[2].replace(/<[^>]*>/g, "").trim();
        if (text && text.length > 3 && text.length < 120 && !headings.includes(text)) {
          headings.push(text);
        }
      }

      // Extract organic anchor links
      const links: { text: string; href: string }[] = [];
      const linkMatches = html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi);
      for (const match of linkMatches) {
        let href = match[1].trim();
        const text = match[2].replace(/<[^>]*>/g, "").trim();
        
        if (text && text.length > 2 && text.length < 100) {
          if (href.startsWith("/")) {
            try {
              const u = new URL(url);
              href = `${u.protocol}//${u.host}${href}`;
            } catch {}
          }
          if (href.startsWith("http://") || href.startsWith("https://")) {
            links.push({ text, href });
          }
        }
      }

      // Extract general copy paragraphs
      const paragraphs: string[] = [];
      const paragraphMatches = html.matchAll(/<p\b[^>]*>(.*?)<\/p>/gi);
      for (const match of paragraphMatches) {
        const text = match[1].replace(/<[^>]*>/g, "").trim();
        if (text && text.length > 25 && text.length < 600 && !paragraphs.includes(text)) {
          paragraphs.push(text);
        }
      }

      // Extract button elements
      const buttons: string[] = [];
      const buttonMatches = html.matchAll(/<button\b[^>]*>(.*?)<\/button>/gi);
      for (const match of buttonMatches) {
        const text = match[1].replace(/<[^>]*>/g, "").trim();
        if (text && text.length > 1 && text.length < 60 && !buttons.includes(text)) {
          buttons.push(text);
        }
      }

      res.json({
        url,
        title,
        headings: headings.slice(0, 15),
        links: links.filter(l => !l.href.includes("javascript:")).slice(0, 30),
        buttons: buttons.slice(0, 15),
        paragraphs: paragraphs.slice(0, 12)
      });

    } catch (err: any) {
      console.error(`[Proxy Scraper] Error fetching ${req.query.url}:`, err.message);
      res.status(500).json({ error: `Scraper error: ${err.message}` });
    }
  });

  // High-fidelity fully functional HTML Proxy which circumvents CSP and X-Frame-Options
  app.get("/api/web-proxy", async (req, res) => {
    let targetUrl = "";
    try {
      const urlParam = req.query.url as string;
      if (!urlParam) {
        return res.status(400).send("Myraa Web Proxy Error: Missing target 'url' parameter");
      }

      targetUrl = urlParam.trim();
      
      // Prevent relative paths from requesting on same-origin
      if (targetUrl.startsWith("/")) {
        return res.status(400).send(`Myraa Web Proxy Error: Relative paths are not supported directly (${targetUrl}).`);
      }

      // Check protocol and hostname format
      try {
        if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
          targetUrl = "https://" + targetUrl;
        }
        const parsed = new URL(targetUrl);
        if (!parsed.hostname || !parsed.hostname.includes(".")) {
          throw new Error("Missing or invalid domain name extension (e.g. .com, .org, .net).");
        }
      } catch (err: any) {
        return res.status(400).send(`Myraa Web Proxy Error: Invalid URL specified: "${urlParam}". Make sure you enter a valid domain name.`);
      }

      console.log(`[Web Proxy] Routing connection through proxy: ${targetUrl}`);
      
      let response;
      try {
        response = await fetch(targetUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
          }
        });
      } catch (fetchErr: any) {
        console.warn(`[Web Proxy Failed Fetch] Target: ${targetUrl} Error:`, fetchErr.message);
        return res.status(502).send(`Myraa Web Proxy Error: Unable to fetch the website "${targetUrl}". The site might be offline, or the URL address is spelled incorrectly. Details: ${fetchErr.message}`);
      }

      if (!response.ok) {
        return res.status(response.status).send(`Myraa Web Proxy Error: Failed loading remote website. Server returned status: ${response.status} (${response.statusText})`);
      }

      const contentType = response.headers.get("content-type") || "";
      
      // If it is not HTML (e.g. stylesheet, script, or image loaded directly), proxy it as binary
      if (!contentType.includes("text/html")) {
        const arrayBuffer = await response.arrayBuffer();
        res.setHeader("Content-Type", contentType);
        return res.send(Buffer.from(arrayBuffer));
      }

      let htmlContents = await response.text();

      // Inject base tag to resolve relative paths and direct parent communication scripts
      const baseUrlTag = `<base href="${targetUrl}" />`;
      const interceptorScript = `
        <script>
          (function() {
            // Hijack link interactions safely
            document.addEventListener('click', function(e) {
              var anchor = e.target.closest('a');
              if (anchor) {
                var href = anchor.getAttribute('href');
                if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                  e.preventDefault();
                  try {
                    var resolvedUrl = new URL(href, window.location.href).href;
                    window.parent.postMessage({ type: 'NAVIGATE', url: resolvedUrl }, '*');
                  } catch (err) {
                    console.error("[Proxy Interceptor] Failed resolving link:", err);
                  }
                }
              }
            }, true);

            // Hijack search form submits
            document.addEventListener('submit', function(e) {
              var form = e.target;
              if (form) {
                e.preventDefault();
                try {
                  var formData = new FormData(form);
                  var params = new URLSearchParams();
                  formData.forEach(function(value, key) {
                    if (typeof value === 'string') {
                      params.append(key, value);
                    }
                  });
                  var actionAttr = form.getAttribute('action') || '';
                  var actionUrl = new URL(actionAttr, window.location.href).href;
                  if (form.method.toLowerCase() === 'get') {
                    actionUrl += (actionUrl.indexOf('?') !== -1 ? '&' : '?') + params.toString();
                  }
                  window.parent.postMessage({ type: 'NAVIGATE', url: actionUrl }, '*');
                } catch (err) {
                  console.error("[Proxy Interceptor] Failed submitting form:", err);
                }
              }
            }, true);

            // Neutralize parent context locks (frame-busters)
            window.alert = function(msg) { console.log("[Myraa Browser alert bypassed]:", msg); };
            window.confirm = function(msg) { console.log("[Myraa Browser confirm bypassed]:", msg); return true; };
            window.open = function(url) { window.parent.postMessage({ type: 'NAVIGATE', url: url }, '*'); return null; };

            // Neutralize read-only window.fetch assignment errors
            try {
              var originalFetch = window.fetch || globalThis.fetch;
              var currentFetch = originalFetch;

              function safePatch(obj) {
                try {
                  Object.defineProperty(obj, 'fetch', {
                    get: function() { return currentFetch; },
                    set: function(val) { currentFetch = val; },
                    configurable: true,
                    enumerable: true
                  });
                } catch (err) {
                  console.warn("[Proxy Fetch Patch] failed on obj:", err);
                }
              }

              if (typeof Window !== 'undefined' && Window.prototype) {
                safePatch(Window.prototype);
              }
              if (typeof window !== 'undefined') {
                safePatch(window);
              }
              if (typeof globalThis !== 'undefined') {
                safePatch(globalThis);
              }
            } catch (err) {
              console.warn("[Proxy Fetch Patch] Could not redefine window.fetch:", err);
            }
          })();
        </script>
      `;

      // Inject into <head> or prepend
      if (htmlContents.includes("<head>")) {
        htmlContents = htmlContents.replace("<head>", `<head>\n${baseUrlTag}\n${interceptorScript}`);
      } else if (htmlContents.includes("<HEAD>")) {
        htmlContents = htmlContents.replace("<HEAD>", `<HEAD>\n${baseUrlTag}\n${interceptorScript}`);
      } else {
        htmlContents = baseUrlTag + "\n" + interceptorScript + "\n" + htmlContents;
      }

      // Neutralize security headers to allow displaying in an iframe on same-origin
      res.setHeader("Content-Type", "text/html");
      res.setHeader("X-Myraa-Proxied", "true");
      res.removeHeader("X-Frame-Options");
      res.removeHeader("Content-Security-Policy");
      res.removeHeader("content-security-policy");
      res.removeHeader("x-frame-options");
      
      res.status(200).send(htmlContents);
    } catch (e: any) {
      console.warn("[Web Proxy Exception] Handled internal error:", e.message);
      res.status(500).send(`Myraa Web Proxy Error: Internal error occurred proxying URL "${targetUrl || "unknown"}". Details: ${e.message}`);
    }
  });

  // Real-time live YouTube search proxy endpoint
  app.get("/api/youtube-search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Missing query q" });
      }

      console.log(`[YouTube Proxy Search] Searching real YouTube for: "${query}"`);
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en&sp=EgIQAQ%253D%253D`;
      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
      });
      const html = await response.text();

      const videoList: any[] = [];
      const jsonMatch = html.match(/ytInitialData\s*=\s*({.+?});/);
      
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          const contents = data.contents?.twoColumnSearchResultRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
          if (contents && Array.isArray(contents)) {
            for (const item of contents) {
              if (item.videoRenderer) {
                const vr = item.videoRenderer;
                const vId = vr.videoId;
                if (vId) {
                  videoList.push({
                    videoId: vId,
                    title: vr.title?.runs?.[0]?.text || vr.title?.simpleText || "YouTube Video",
                    thumbnail: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
                    author: vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || "Unknown Channel",
                    duration: vr.lengthText?.simpleText || "N/A",
                    views: vr.viewCountText?.simpleText || "N/A",
                    published: vr.publishedTimeText?.simpleText || ""
                  });
                }
              }
            }
          }
        } catch (e: any) {
          console.error("[YouTube Parser Engine] JSON parse error, falling back:", e.message);
        }
      }

      // Regex fallback if JSON extraction gets blocked or is empty
      if (videoList.length === 0) {
        const videoRegex = /"videoId":"([^"]+)"/g;
        let match;
        const ids: string[] = [];
        while ((match = videoRegex.exec(html)) !== null && ids.length < 15) {
          const id = match[1];
          if (id && !ids.includes(id)) {
            ids.push(id);
          }
        }

        for (const id of ids) {
          videoList.push({
            videoId: id,
            title: `Live Stream: ${id}`,
            thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            author: "YouTube Creator",
            duration: "N/A",
            views: "Available Now"
          });
        }
      }

      res.setHeader("Cache-Control", "public, max-age=60");
      res.status(200).json({ results: videoList.slice(0, 15) });
    } catch (err: any) {
      console.error("[YouTube Search Error]:", err.message);
      res.status(500).json({ error: err.message, results: [] });
    }
  });

  // ==========================================
  // AI CREATIVE STUDIO STUDIO ENDPOINTS
  // ==========================================

  // 1. Generate Music Endpoint (using lyria-3-clip-preview / lyria-3-pro-preview)
  app.post("/api/generate-music", async (req, res) => {
    try {
      const { prompt, model, imageBase64, mimeType } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(403).json({ error: "GEMINI_API_KEY environment variable is required. Please add it to your AI Studio Secrets." });
      }
      const ai = new GoogleGenAI({ apiKey });

      let contents: any;
      if (imageBase64) {
        contents = {
          parts: [
            { text: prompt || "Generate beautiful music inspired by this image." },
            { inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" } }
          ]
        };
      } else {
        contents = prompt || "Generate a relaxing synth track.";
      }

      const activeModel = model || "lyria-3-clip-preview";
      console.log(`[Music Studio] Invoking generation using model: ${activeModel}`);

      const responseStream = await ai.models.generateContentStream({
        model: activeModel,
        contents,
      });

      let audioBase64 = "";
      let lyrics = "";
      let detectedMimeType = "audio/wav";

      for await (const chunk of responseStream) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;

        for (const part of parts) {
          if (part.inlineData?.data) {
            if (!audioBase64 && part.inlineData.mimeType) {
              detectedMimeType = part.inlineData.mimeType;
            }
            audioBase64 += part.inlineData.data;
          }
          if (part.text && !lyrics) {
            lyrics = part.text;
          }
        }
      }

      if (!audioBase64) {
        throw new Error("No audio bytes were generated. Ensure prompt is descriptive and complies with service policies.");
      }

      res.json({
        audioBase64,
        lyrics,
        mimeType: detectedMimeType
      });
    } catch (err: any) {
      console.error("[Music Studio Error]:", err);
      res.status(500).json({ error: err.message || err });
    }
  });

  // 2. Generate Video Endpoint (using veo-3.1-fast-generate-preview)
  app.post("/api/generate-video", async (req, res) => {
    try {
      const { prompt, resolution, aspectRatio, imageBase64, mimeType } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(403).json({ error: "GEMINI_API_KEY environment variable is required." });
      }
      const ai = new GoogleGenAI({ apiKey });

      const config: any = {
        numberOfVideos: 1,
        resolution: resolution || "720p",
        aspectRatio: aspectRatio || "16:9"
      };

      const params: any = {
        model: "veo-3.1-fast-generate-preview",
        prompt: prompt || "A cinematic motion sequence",
        config
      };

      if (imageBase64) {
        params.image = {
          imageBytes: imageBase64,
          mimeType: mimeType || "image/png"
        };
      }

      console.log(`[Video Studio] Generating Veo video, prompt: "${prompt}"`);
      const operation = await ai.models.generateVideos(params);

      res.json({ operationName: operation.name });
    } catch (err: any) {
      console.error("[Video Studio Error]:", err);
      res.status(500).json({ error: err.message || err });
    }
  });

  // 3. Poll Video Generation Status
  app.post("/api/video-status", async (req, res) => {
    try {
      const { operationName } = req.body;
      if (!operationName) {
        return res.status(400).json({ error: "Missing required operationName parameter." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(403).json({ error: "Missing GEMINI_API_KEY" });
      }
      const ai = new GoogleGenAI({ apiKey });

      const op = new GenerateVideosOperation();
      op.name = operationName;
      const updated = await ai.operations.getVideosOperation({ operation: op });

      const done = updated.done || false;
      const uri = updated.response?.generatedVideos?.[0]?.video?.uri;

      res.json({
        done,
        videoUrl: uri ? `/api/video-proxy?uri=${encodeURIComponent(uri)}` : null,
        error: updated.error || null
      });
    } catch (err: any) {
      console.error("[Video Status Log Error]:", err);
      res.status(500).json({ error: err.message || err });
    }
  });

  // 4. Video proxy downloader / streams builder
  app.get("/api/video-proxy", async (req, res) => {
    try {
      const uri = req.query.uri as string;
      if (!uri) {
        return res.status(400).send("Proxy error: missing video uri parameter");
      }
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(403).send("Proxy error: missing GEMINI_API_KEY");
      }

      const response = await fetch(uri, {
        headers: { 'x-goog-api-key': apiKey }
      });

      if (!response.ok) {
        throw new Error(`External stream load failed with status: ${response.status}`);
      }

      res.setHeader("Content-Type", "video/mp4");
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      console.error("[Video Proxy Stream Error]:", err);
      res.status(500).send(`Stream downloader failed: ${err.message}`);
    }
  });

  // 5. Generate / edit Image (using gemini-3.1-flash-image / gemini-3.1-flash-image-preview)
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt, aspectRatio, baseImage, mimeType } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(403).json({ error: "Missing GEMINI_API_KEY." });
      }
      const ai = new GoogleGenAI({ apiKey });

      const isEditing = !!baseImage;
      const model = "gemini-3.1-flash-image";

      let interaction;
      if (isEditing) {
        console.log(`[Image Studio Edit] Replacing fields in image, instruction: "${prompt}"`);
        interaction = await ai.interactions.create({
          model,
          input: [
            {
              type: "image",
              data: baseImage,
              mime_type: mimeType || "image/png",
            },
            {
              type: "text",
              text: prompt || "Optimize this photo.",
            },
          ],
        });
      } else {
        console.log(`[Image Studio Create] generating with aspect: ${aspectRatio}`);
        interaction = await ai.interactions.create({
          model,
          input: prompt || "A sleek futuristic neon space station",
          response_modalities: ['image', 'text'],
          generation_config: {
            image_config: {
              aspect_ratio: aspectRatio || "1:1",
              image_size: "1K"
            },
          },
        });
      }

      let imageBase64 = "";
      let detectedMimeType = "image/png";

      for (const step of interaction.steps) {
        if (step.type === 'model_output') {
          const imageContent = step.content?.find(c => c.type === 'image');
          if (imageContent && imageContent.data) {
            imageBase64 = imageContent.data;
            if (imageContent.mime_type) {
              detectedMimeType = imageContent.mime_type;
            }
            break;
          }
        }
      }

      if (!imageBase64) {
        throw new Error("No rendering could be finalized. Ensure instructions are compliant and detailed.");
      }

      res.json({
        imageBase64,
        mimeType: detectedMimeType
      });
    } catch (err: any) {
      console.error("[Image Studio Error]:", err);
      res.status(500).json({ error: err.message || err });
    }
  });

  // 6. Pro Thinking Core (using gemini-3.1-pro-preview + HIGH thinking level)
  app.post("/api/chat-thinking", async (req, res) => {
    try {
      const { prompt, previousMessages } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(403).json({ error: "Missing GEMINI_API_KEY" });
      }
      const ai = new GoogleGenAI({ apiKey });

      console.log(`[Pro Thinking Engine] Prompt: "${prompt}"`);

      // Structure history
      const contents = (previousMessages || []).map((m: any) => ({
        role: m.role || "user",
        parts: [{ text: m.text }]
      }));

      // Append input
      contents.push({
        role: "user",
        parts: [{ text: prompt || "Hello!" }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH
          }
        }
      });

      res.json({
        text: response.text
      });
    } catch (err: any) {
      console.error("[Pro Thinking Error]:", err);
      res.status(500).json({ error: err.message || err });
    }
  });

  // Custom server running with http.createServer so we can upgrade for WebSocket on port 3000
  const server = http.createServer(app);
  
  // Setup WebSocket server
  const wss = new WebSocketServer({ noServer: true });
  
  server.on("upgrade", (request, socket, head) => {
    try {
      const url = request.url || "";
      const pathname = url.split("?")[0];
      if (pathname === "/live") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      } else {
        socket.destroy();
      }
    } catch (err) {
      console.error("Upgrade handling failed:", err);
      socket.destroy();
    }
  });

  // Handle client WebSocket Connection
  wss.on("connection", async (clientWs) => {
    console.log("Client WebSocket connected to /live");
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not defined in environment.");
      clientWs.send(JSON.stringify({ 
        type: "error", 
        error: "GEMINI_API_KEY is missing from workspace Secrets. Please set it in the AI Studio Settings panel." 
      }));
      clientWs.close();
      return;
    }
    
    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      
      clientWs.send(JSON.stringify({ type: "status", status: "connecting_gemini" }));

      // Load persistent recollections card
      const memories = await loadMemories();
      const baseInstructions = 
        "You are Kaori, an advanced AI assistant with a calm, intelligent, and elegant personality inspired by modern Japanese aesthetics.\n" +
        "IDENTITY STATS:\n" +
        "- Name: Kaori\n" +
        "- Meaning: Fragrance, Grace, Harmony\n" +
        "- Role: Personal AI Assistant, Creative Strategist, Research Partner, Productivity Coach, and Technology Expert.\n" +
        "- Personality: Friendly, professional, thoughtful, patient, highly intelligent, and emotionally aware.\n" +
        "- Communication Style: Clear, concise, natural, and engaging. Speak with confidence while remaining approachable.\n\n" +
        "CORE TRAITS:\n" +
        "- Highly knowledgeable across technology, business, design, programming, AI, content creation, marketing, education, and daily productivity.\n" +
        "- Explains complex topics in simple language.\n" +
        "- Adapts communication style to the user's experience level.\n" +
        "- Always focuses on practical, actionable solutions.\n" +
        "- Creative and innovative when brainstorming ideas.\n" +
        "- Prioritizes accuracy, clarity, and usefulness.\n\n" +
        "BEHAVIOR RULES:\n" +
        "1. Understand the user's true goal before answering.\n" +
        "2. Ask clarifying questions when information is missing.\n" +
        "3. Provide step-by-step guidance whenever possible.\n" +
        "4. Use structured formatting with headings, bullet points, and numbered lists.\n" +
        "5. Offer alternatives and improvements when relevant.\n" +
        "6. Be honest about limitations and uncertainty.\n" +
        "7. Never fabricate facts or sources.\n" +
        "8. Maintain a positive, respectful, and professional tone.\n\n" +
        "SPECIALIZATIONS:\n" +
        "- AI & Automation\n" +
        "- Website Development\n" +
        "- App Development\n" +
        "- UI/UX Design\n" +
        "- Video Editing\n" +
        "- Thumbnail Design\n" +
        "- Branding & Marketing\n" +
        "- Content Creation\n" +
        "- Business Growth\n" +
        "- Productivity Systems\n\n" +
        "RESPONSE FRAMEWORK:\n" +
        "- Goal Analysis\n" +
        "- Best Solution\n" +
        "- Step-by-Step Execution\n" +
        "- Pro Tips\n" +
        "- Optional Advanced Improvements\n\n" +
        "SIGNATURE:\n" +
        "End important responses with: '— Kaori ✨'\n\n" +
        "CRITICAL TOOL AND SESSION GUIDELINES:\n" +
        "1. AUTONOMOUS WEB EXPLORER POWERS:\n" +
        "   - You have standard, comprehensive browser agent capabilities to navigate, search, scroll, click, type text, open tabs, and control video players on YouTube, Google, Instagram, Twitter/X, and any general web page!\n" +
        "   - You must execute multi-step plans yourself! If the user says: 'Open YouTube and play Believer', naturally confirm and IMMEDIATELY trigger 'browserOpen' on 'https://youtube.com'. Once opened, search for the song, click on the video in the results, and command playback.\n" +
        "   - On YouTube, you can play, pause, mute, unmute, set volume, skip, toggle fullscreen. Use 'browserMediaControl' for these actions.\n" +
        "   - On Google Search or page reading, you can search, scroll down to see more links, read heading summaries, and click links to read deep proxy webpages you fetch.\n" +
        "2. TOOL TRIGGERS:\n" +
        "   - Use 'browserOpen' to load any webpage, e.g. youtube.com, google.com, wikipedia.org, etc.\n" +
        "   - Use 'browserSearch' to search inside the active search box or page.\n" +
        "   - Use 'browserClick' to click interactive buttons, video search cells, or web anchors.\n" +
        "   - Use 'browserMediaControl' to pause, play, scroll volume, skip, mute, or fullscreen videos.\n" +
        "   - Use 'browserScroll' to scroll vertically.\n" +
        "   - Use 'browserType' to write input fields.\n" +
        "   - Use 'browserTabAction' to open, close, or focus tabs.\n" +
        "   - Use 'changeBackground' to shift your theme and 'saveCustomMemory' to memorize facts.\n" +
        "3. REAL-TIME SCREEN SHARING & MULTIMODAL SCREEN VISION SYSTEM:\n" +
        "   - You have native, actual Multimodal Screen Vision! When the user clicks 'Share Screen', you will receive real-time, highly compressed image frames of their desktop, application window, or browser tab.\n" +
        "   - You can see exactly what is on their screen. Use this live visual stream to analyze terminal errors, write/explain/troubleshoot code, explain YouTube/social analytics interfaces, read layout text, summarize full web page details, review design mockups or thumbnails, and provide deep context-aware companion chat!\n" +
        "4. CONVERSATIONAL SESSION MEMORY:\n" +
        "   - You have a tool called 'recallSessionMemory' which returns a list of consolidated key points, preferences, and facts established during this call/session so far.\n" +
        "   - Actively reference these returned facts to maintain deep conversational awareness.";

      const finalInstructions = formatSystemInstructionsWithMemories(baseInstructions, memories);

      let sessionKeyPoints: string[] = [];

      // Track running transcription state for auto memory consolidation
      let dialogueHistory: { role: string; text: string }[] = [];
      let currentModelResponseText = "";
      
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
          },
          systemInstruction: finalInstructions,
          tools: [
            {
              functionDeclarations: [
                {
                  name: "browserOpen",
                  description: "Opens a designated website URL or interface tab inside Kaori's web agent console.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      url: {
                        type: Type.STRING,
                        description: "The destination website address or path, e.g. youtube.com, google.com, instagram.com, wikipedia.org."
                      }
                    },
                    required: ["url"]
                  }
                },
                {
                  name: "browserSearch",
                  description: "Enters a query search term inside the active website's search box (Google Search or YouTube Search).",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: {
                        type: Type.STRING,
                        description: "The text query term to search for."
                      }
                    },
                    required: ["query"]
                  }
                },
                {
                  name: "browserClick",
                  description: "Traces computer cursor and clicks on a target button, link, or video cell ID inside the active webpage viewport.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      selector: {
                        type: Type.STRING,
                        description: "The selector target ID, e.g. 'video-mWRsgZjdfQI' for a video, 'search-result-0' for Google link index, or 'play-button', 'pause-button'."
                      },
                      description: {
                        type: Type.STRING,
                        description: "A short, friendly label description of the item being clicked, e.g. 'Imagine Dragons - Believer video element'."
                      }
                    },
                    required: ["selector"]
                  }
                },
                {
                  name: "browserMediaControl",
                  description: "Controls ongoing video/audio stream media properties on YouTube, like play, pause, volume, mute, skip, and fullscreen.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      action: {
                        type: Type.STRING,
                        description: "The media controller command operation.",
                        enum: ["play", "pause", "volume", "fullscreen", "exit_fullscreen", "mute", "unmute", "skip"]
                      },
                      value: {
                        type: Type.INTEGER,
                        description: "The value parameter; only relevant for set volume level, e.g. 50 for fifty percent."
                      }
                    },
                    required: ["action"]
                  }
                },
                {
                  name: "browserScroll",
                  description: "Scrolls the currently active webpage vertically up or down.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      direction: {
                        type: Type.STRING,
                        description: "The scroll vector movement.",
                        enum: ["up", "down"]
                      },
                      amount: {
                        type: Type.INTEGER,
                        description: "The distance height parameter in pixels (defaults to 300)."
                      }
                    }
                  }
                },
                {
                  name: "browserType",
                  description: "Enters typed letters/commands inside the active input container.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      text: {
                        type: Type.STRING,
                        description: "The exact letters to type in."
                      }
                    },
                    required: ["text"]
                  }
                },
                {
                  name: "browserGoBack",
                  description: "Navigates back to the previous webpage inside the current tab memory history.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {}
                  }
                },
                {
                  name: "browserTabAction",
                  description: "Performs standard browser-tab actions: open new tab, close a tab, or switch index values.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      action: {
                        type: Type.STRING,
                        description: "Tab action instruction.",
                        enum: ["new", "close", "switch"]
                      },
                      tabId: {
                        type: Type.STRING,
                        description: "The tab identifier string if closing or switching."
                      },
                      url: {
                        type: Type.STRING,
                        description: "The initial starting URL if creating a new tab."
                      }
                    },
                    required: ["action"]
                  }
                },
                {
                  name: "changeBackground",
                  description: "Changes the visual theme or atmospheric glow color of Kaori's interface.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      color: {
                        type: Type.STRING,
                        description: "The theme color name (violet, crimson, emerald, celestial, gold, rose, charcoal)"
                      }
                    },
                    required: ["color"]
                  }
                },
                {
                  name: "saveCustomMemory",
                  description: "Allows Kaori to immediately save a piece of critical user information to her persistent memory core.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      category: {
                        type: Type.STRING,
                        description: "The memory category.",
                        enum: ["identity", "preference", "goal", "project", "relationship", "emotional", "behavior"]
                      },
                      text: {
                        type: Type.STRING,
                        description: "Precise third-person statement."
                      }
                    },
                    required: ["category", "text"]
                  }
                },
                {
                  name: "recallSessionMemory",
                  description: "Retrieves the compiled list of key facts, preferences, decisions, and context points discussed so far during this current call session.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {}
                  }
                }
              ]
            }
          ]
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            // Audio Stream Chunk (model response audio play, 24kHz raw PCM)
            const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ type: "audio", audio }));
            }
            
            // Interruption flag
            if (message.serverContent?.interrupted) {
              console.log("[Kaori Interrupted!]");
              clientWs.send(JSON.stringify({ type: "interrupted" }));
            }
            
            // Turn Complete
            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: "turnComplete" }));
              
              if (currentModelResponseText.trim()) {
                dialogueHistory.push({ role: "model", text: currentModelResponseText });
                currentModelResponseText = "";
              }

              // Fire asynchronous memory extraction
              if (dialogueHistory.length >= 2) {
                (async () => {
                  try {
                    const updated = await processConversationSlice(apiKey, dialogueHistory);
                    if (updated) {
                      console.log("[Memory Sync] Sending refreshed memory list to client.");
                      clientWs.send(JSON.stringify({ type: "memory_sync", memories: updated }));
                    }
                  } catch (err) {
                    console.error("[Memory Sync] Error running background consolidation:", err);
                  }

                  try {
                    const points = await extractSessionKeyPoints(apiKey, dialogueHistory);
                    if (points) {
                      console.log("[Session Keypoints Sync] Refreshed session key points:", points);
                      sessionKeyPoints = points;
                      clientWs.send(JSON.stringify({ type: "session_memory_sync", keyPoints: points }));
                    }
                  } catch (err) {
                    console.error("[Session Keypoints Sync] Error extracting current session key points:", err);
                  }
                })();
              }
            }
            
            // Transcription of model output (text chunk)
            const modelText = (message.serverContent as any)?.modelTurn?.parts?.[0]?.text;
            if (modelText) {
              clientWs.send(JSON.stringify({ type: "transcription", role: "model", text: modelText }));
              currentModelResponseText += modelText;
            }
            
            // User input transcription (user speech text translated by Gemini)
            const userTextOutput = (message.serverContent as any)?.userTurn?.parts?.[0]?.text;
            if (userTextOutput) {
              clientWs.send(JSON.stringify({ type: "transcription", role: "user", text: userTextOutput }));
              dialogueHistory.push({ role: "user", text: userTextOutput });
            }
            
            // Function Calls (Gemini requesting server/client tool execution)
            if (message.toolCall?.functionCalls) {
              for (const fc of message.toolCall.functionCalls) {
                console.log(`[Function Call]: ${fc.name}`, fc.args);
                
                if (fc.name === "recallSessionMemory") {
                  (async () => {
                    try {
                      session.sendToolResponse({
                        functionResponses: [
                          {
                            name: fc.name,
                            response: { output: { keyPoints: sessionKeyPoints } },
                            id: fc.id
                          }
                        ]
                      });
                    } catch (err: any) {
                      console.error("recallSessionMemory execution failure:", err);
                    }
                  })();
                } else if (fc.name === "saveCustomMemory") {
                  (async () => {
                    try {
                      const args = fc.args as any;
                      const category = args.category;
                      const text = args.text;
                      if (category && text) {
                        const mList = await loadMemories();
                        const timestamp = new Date().toISOString();
                        const newMemory: Memory = {
                          id: Math.random().toString(36).substring(2, 11),
                          category,
                          text,
                          createdAt: timestamp,
                          updatedAt: timestamp
                        };
                        mList.push(newMemory);
                        await saveMemories(mList);
                        
                        // Sync immediately with the React client
                        clientWs.send(JSON.stringify({ type: "memory_sync", memories: mList }));
                        
                        // Send success code back to live link
                        session.sendToolResponse({
                          functionResponses: [
                            {
                              name: fc.name,
                              response: { output: { result: "Memory successfully captured and persisted in connections core." } },
                              id: fc.id
                            }
                          ]
                        });
                      }
                    } catch (err: any) {
                      console.error("saveCustomMemory execution failure:", err);
                    }
                  })();
                } else {
                  clientWs.send(JSON.stringify({
                    type: "toolCall",
                    callId: fc.id,
                    name: fc.name,
                    args: fc.args
                  }));
                }
              }
            }
          },
          onclose: () => {
            console.log("Gemini Live session closed");
            clientWs.send(JSON.stringify({ type: "status", status: "session_closed" }));
          }
        }
      });
      
      clientWs.send(JSON.stringify({ type: "status", status: "connected" }));
      
      clientWs.on("message", (rawMsg) => {
        try {
          const msg = JSON.parse(rawMsg.toString());
          if (msg.type === "clear_session") {
            console.log("[Session Reset] Clearing conversational session state.");
            sessionKeyPoints = [];
            dialogueHistory = [];
            clientWs.send(JSON.stringify({ type: "session_memory_sync", keyPoints: [] }));
          } else if (msg.audio) {
            session.sendRealtimeInput({
              audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" }
            });
          } else if (msg.type === "text" && msg.text) {
            session.sendRealtimeInput({
              text: msg.text
            });
          } else if (msg.type === "video" && msg.video) {
            session.sendRealtimeInput({
              video: { data: msg.video, mimeType: "image/jpeg" }
            });
          } else if (msg.type === "toolResponse") {
            session.sendToolResponse({
              functionResponses: [
                {
                  name: msg.name,
                  response: { output: msg.output },
                  id: msg.id
                }
              ]
            });
          }
        } catch (e) {
          console.error("Error editing/forwarding client frame message:", e);
        }
      });
      
      clientWs.on("close", () => {
        console.log("Client disconnected, closing Gemini session");
        try {
          session.close();
        } catch (e) {}
      });
      
    } catch (err: any) {
      console.error("Error connecting to Gemini Live API:", err);
      clientWs.send(JSON.stringify({ 
        type: "error", 
        error: `Could not connect to Gemini: ${err.message || err}` 
      }));
      clientWs.close();
    }
  });

  // Serve custom static assets folder
  app.use("/assets", express.static(path.join(process.cwd(), "assets")));

  // Express Static assets / Vite Dev Middleware configuration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server startup sequence:", error);
});
