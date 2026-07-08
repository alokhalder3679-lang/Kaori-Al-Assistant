import React, { useState, useEffect, useRef } from "react";
import { MyraaAudioSession, LiveState } from "./lib/audio";
import { MyraaCoreVisualizer, MyraaEmotion } from "./components/MyraaCoreVisualizer";
import { BrowserAgent } from "./components/BrowserAgent";
import { 
  Power, 
  Volume2, 
  Info, 
  Sparkles, 
  Globe, 
  Maximize2, 
  MessageSquareOff, 
  Compass, 
  CircleAlert,
  MicOff,
  Mic,
  X,
  Brain,
  Monitor,
  Play,
  Pause,
  Square,
  RefreshCw,
  Copy,
  Check,
  LogIn,
  LogOut,
  User as UserIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Memory, MemoryCategory } from "./lib/memoryTypes";
import { MemoryDashboard } from "./components/MemoryDashboard";
import { CreativeStudio } from "./components/CreativeStudio";
import { 
  auth, 
  loginWithGoogle, 
  logoutUser, 
  saveUserMemory, 
  fetchUserMemories, 
  deleteUserMemory,
  User 
} from "./lib/firebase";

export default function App() {
  const [state, setState] = useState<LiveState>("disconnected");
  const [kaoriVolumePeak, setKaoriVolumePeak] = useState<number>(0);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Real-time Screen Sharing states
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [isScreenSharingPaused, setIsScreenSharingPaused] = useState<boolean>(false);
  const [screenVisionMode, setScreenVisionMode] = useState<boolean>(true);
  const [isSimulatedSharing, setIsSimulatedSharing] = useState<boolean>(false);

  // References to preserve state across intervals
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenIntervalRef = useRef<any>(null);

  const isPausedRef = useRef<boolean>(false);
  const screenVisionRef = useRef<boolean>(true);
  const stateRef = useRef<LiveState>("disconnected");
  const isSimulatedSharingRef = useRef<boolean>(false);

  // Sync state changes with refs to totally prevent stale closures in callbacks
  useEffect(() => {
    isPausedRef.current = isScreenSharingPaused;
  }, [isScreenSharingPaused]);

  useEffect(() => {
    screenVisionRef.current = screenVisionMode;
  }, [screenVisionMode]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    isSimulatedSharingRef.current = isSimulatedSharing;
  }, [isSimulatedSharing]);

  // Clean up streaming intervals on unmount
  useEffect(() => {
    return () => {
      if (screenIntervalRef.current) {
        clearInterval(screenIntervalRef.current);
      }
    };
  }, []);

  const captureFrameAndSend = () => {
    const video = screenVideoRef.current;
    const isSimulated = isSimulatedSharingRef.current;
    if ((!video && !isSimulated) || isPausedRef.current || !screenVisionRef.current) {
      return;
    }

    if (stateRef.current === "disconnected") {
      return;
    }

    try {
      if (!screenCanvasRef.current) {
        screenCanvasRef.current = document.createElement("canvas");
      }
      const canvas = screenCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const maxDim = 960;

      if (isSimulated) {
        const width = 960;
        const height = 540;
        canvas.width = width;
        canvas.height = height;

        // Background - Deep space midnight
        ctx.fillStyle = "#030712";
        ctx.fillRect(0, 0, width, height);

        // Tech visual grid
        ctx.strokeStyle = "rgba(6, 182, 212, 0.08)";
        ctx.lineWidth = 1;
        const gridSize = 40;
        for (let x = 0; x < width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        // Animated neon circles
        const now = Date.now();
        const cycle = (now / 4000) % 1;
        const radius = 80 + cycle * 120;
        ctx.strokeStyle = "rgba(6, 182, 212, 0.12)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(168, 85, 247, 0.1)";
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, 45, 0, Math.PI * 2);
        ctx.stroke();

        // Crosshairs
        ctx.strokeStyle = "rgba(6, 182, 212, 0.25)";
        ctx.beginPath();
        ctx.moveTo(width / 2 - 25, height / 2);
        ctx.lineTo(width / 2 + 25, height / 2);
        ctx.moveTo(width / 2, height / 2 - 25);
        ctx.lineTo(width / 2, height / 2 + 25);
        ctx.stroke();

        // Floating info HUD
        ctx.font = "bold 24px sans-serif";
        ctx.fillStyle = "#22d3ee";
        ctx.textAlign = "center";
        ctx.fillText("VIRTUAL SYSTEM VISION CORE", width / 2, 75);

        ctx.font = "14px monospace";
        ctx.fillStyle = "#64748b";
        ctx.fillText("SIMULATED DESKTOP BROADCAST (PREVIEW ACTIVE)", width / 2, 105);

        // real-time updating labels
        ctx.font = "bold 16px monospace";
        ctx.fillStyle = "#38bdf8";
        ctx.fillText(`COSMIC CHRONO CLOCK: ${new Date().toLocaleTimeString()} UTC`, width / 2, 180);

        ctx.fillStyle = "#c084fc";
        ctx.fillText(`VOICE EMOTION LEVEL: ${stateRef.current.toUpperCase()}`, width / 2, 215);

        ctx.fillStyle = "#f472b6";
        ctx.fillText("DURABLE MEMORY DRIVES: CALIBRATED AND ACTIVE", width / 2, 250);

        // Core visual borders with futuristic brackets
        ctx.strokeStyle = "rgba(6, 182, 212, 0.35)";
        ctx.lineWidth = 2;
        ctx.strokeRect(30, 30, width - 60, height - 60);

        const bLen = 25;
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 4;
        // Top Left
        ctx.beginPath(); ctx.moveTo(30, 30 + bLen); ctx.lineTo(30, 30); ctx.lineTo(30 + bLen, 30); ctx.stroke();
        // Top Right
        ctx.beginPath(); ctx.moveTo(width - 30, 30 + bLen); ctx.lineTo(width - 30, 30); ctx.lineTo(width - 30 - bLen, 30); ctx.stroke();
        // Bottom Left
        ctx.beginPath(); ctx.moveTo(30, height - 30 - bLen); ctx.lineTo(30, height - 30); ctx.lineTo(30 + bLen, height - 30); ctx.stroke();
        // Bottom Right
        ctx.beginPath(); ctx.moveTo(width - 30, height - 30 - bLen); ctx.lineTo(width - 30, height - 30); ctx.lineTo(width - 30 - bLen, height - 30); ctx.stroke();

        // Waveforms at bottom
        ctx.strokeStyle = "rgba(34, 211, 238, 0.25)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 60; x < width - 60; x += 12) {
          const y = height - 90 + Math.sin(x * 0.04 + now * 0.0025) * 12;
          if (x === 60) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.font = "11px monospace";
        ctx.fillStyle = "#475569";
        ctx.fillText("DIRECT MEDIA ENCAPSULATION TRANSMISSION VIA WEB_IFRAME", width / 2, height - 50);

      } else {
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        let width = video.videoWidth;
        let height = video.videoHeight;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(video, 0, 0, width, height);
      }

      // Highly compressed JPEG standard is optimized and preserves details perfectly
      const dataUrl = canvas.toDataURL("image/jpeg", 0.55);
      const base64 = dataUrl.split(",")[1];

      if (sessionRef.current && stateRef.current !== "disconnected") {
        sessionRef.current.sendVideoFrame(base64);
      }
    } catch (err) {
      console.error("[Screen Capture] Failed drawing frame to canvas:", err);
    }
  };

  const startScreenSharing = async () => {
    setErrorText(null);
    try {
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== "function") {
        console.warn("Screen sharing mediaDevices API missing. Engaging virtual visual simulator fallback...");
        setIsSimulatedSharing(true);
        setIsScreenSharing(true);
        setIsScreenSharingPaused(false);

        if (screenIntervalRef.current) {
          clearInterval(screenIntervalRef.current);
        }
        screenIntervalRef.current = setInterval(() => {
          captureFrameAndSend();
        }, 2000);

        setTimeout(() => {
          captureFrameAndSend();
        }, 500);
        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 5 }
        },
        audio: false
      });

      setIsSimulatedSharing(false);
      screenStreamRef.current = stream;

      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.play().catch(e => console.error("Video play warning:", e));
      screenVideoRef.current = video;

      setIsScreenSharing(true);
      setIsScreenSharingPaused(false);

      // Stop handling when native stop sharing bar button ends
      stream.getVideoTracks()[0].onended = () => {
        stopScreenSharing();
      };

      // Set up frame capture interval (one frame every 2 seconds is highly robust, preventing overload)
      if (screenIntervalRef.current) {
        clearInterval(screenIntervalRef.current);
      }
      screenIntervalRef.current = setInterval(() => {
        captureFrameAndSend();
      }, 2000);

      // Promptly capture first frame immediately
      setTimeout(() => {
        captureFrameAndSend();
      }, 500);

    } catch (e: any) {
      console.warn("Screen sharing permission declined or missing API: falling back to virtual simulator HUD", e);
      if (e.name === "NotAllowedError") {
        setErrorText("Screen capture permission was declined. Using virtual simulator fallback.");
      }
      
      // Fall back gracefully to simulator!
      setIsSimulatedSharing(true);
      setIsScreenSharing(true);
      setIsScreenSharingPaused(false);

      if (screenIntervalRef.current) {
        clearInterval(screenIntervalRef.current);
      }
      screenIntervalRef.current = setInterval(() => {
        captureFrameAndSend();
      }, 2000);

      setTimeout(() => {
        captureFrameAndSend();
      }, 500);
    }
  };

  const stopScreenSharing = () => {
    if (screenIntervalRef.current) {
      clearInterval(screenIntervalRef.current);
      screenIntervalRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      screenStreamRef.current = null;
    }

    if (screenVideoRef.current) {
      screenVideoRef.current.pause();
      screenVideoRef.current = null;
    }

    setIsScreenSharing(false);
    setIsScreenSharingPaused(false);
    setIsSimulatedSharing(false);
  };

  const pauseScreenSharing = () => {
    setIsScreenSharingPaused(true);
  };

  const resumeScreenSharing = () => {
    setIsScreenSharingPaused(false);
    // Refresh first frame immediately
    setTimeout(() => {
      captureFrameAndSend();
    }, 100);
  };

  const switchScreenShare = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
    }
    await startScreenSharing();
  };

  const [activeEmotion, setActiveEmotion] = useState<MyraaEmotion>("idle");
  const [themeColor, setThemeColor] = useState<string>("charcoal");
  const [userCaption, setUserCaption] = useState<string>("");
  const [characterState, setCharacterState] = useState<"idle" | "thinking" | "talking">("idle");

  const detectEmotionFromText = (text: string): MyraaEmotion => {
    const lower = text.toLowerCase();
    if (lower.includes("haha") || lower.includes("lol") || lower.includes("funny") || lower.includes("joke") || lower.includes("hehe") || lower.includes("wink")) return "playful";
    if (lower.includes("happy") || lower.includes("harmony") || lower.includes("glad") || lower.includes("joy") || lower.includes("wonderful") || lower.includes("love") || lower.includes("smile")) return "happy";
    if (lower.includes("wow") || lower.includes("awesome") || lower.includes("excited") || lower.includes("amazing") || lower.includes("yay") || lower.includes("incredible") || lower.includes("hype")) return "excited";
    if (lower.includes("really?") || lower.includes("curious") || lower.includes("interest") || lower.includes("tell me more") || lower.includes("why") || lower.includes("how") || lower.includes("wonder")) return "curious";
    if (lower.includes("think") || lower.includes("calculat") || lower.includes("analyz") || lower.includes("hmmm") || lower.includes("process") || lower.includes("let me see") || lower.includes("conclude")) return "thinking";
    if (lower.includes("proud") || lower.includes("achieved") || lower.includes("expert") || lower.includes("skill") || lower.includes("confidence") || lower.includes("succeed")) return "proud";
    if (lower.includes("sad") || lower.includes("sorry") || lower.includes("unfortunate") || lower.includes("grief") || lower.includes("bad") || lower.includes("regret") || lower.includes("alas") || lower.includes("cry")) return "sad";
    if (lower.includes("shock") || lower.includes("surprise") || lower.includes("gasp") || lower.includes("unexpected") || lower.includes("seriously") || lower.includes("oh my")) return "surprised";
    if (lower.includes("blush") || lower.includes("shy") || lower.includes("embarrass") || lower.includes("nervous") || lower.includes("oops") || lower.includes("sorry about")) return "embarrassed";
    if (lower.includes("what?") || lower.includes("confus") || lower.includes("puzzled") || lower.includes("dont know") || lower.includes("not sure") || lower.includes("wait")) return "confused";
    return "idle";
  };
  const [modelCaption, setModelCaption] = useState<string>("");
  const [activeProjectorUrl, setActiveProjectorUrl] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Myraa Autopilot system controller state
  const [browserTrigger, setBrowserTrigger] = useState<{
    type: string;
    args: any;
    id: string;
    callback: (res: any) => void;
  } | null>(null);

  // Myraa recollections database core state
  const [memories, setMemories] = useState<Memory[]>([]);
  const [showMemoryDashboard, setShowMemoryDashboard] = useState<boolean>(false);
  const [showCreativeStudio, setShowCreativeStudio] = useState<boolean>(false);
  const [sessionKeyPoints, setSessionKeyPoints] = useState<string[]>([]);
  const [keyboardText, setKeyboardText] = useState("");
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isInIframe, setIsInIframe] = useState<boolean>(false);

  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch (e) {
      setIsInIframe(true);
    }
  }, []);

  const handleCopyLink = () => {
    const appUrl = window.location.origin;
    navigator.clipboard.writeText(appUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }).catch(err => {
      console.error("Clipboard copy failed:", err);
    });
  };

  const sessionRef = useRef<MyraaAudioSession | null>(null);

  // Poll speaking volume matching the outputAnalyser in real-time
  useEffect(() => {
    if (state !== "speaking") {
      setKaoriVolumePeak(0);
      return;
    }

    let animationFrameId: number;

    const updateVolume = () => {
      const analyser = sessionRef.current?.outputAnalyser;
      if (analyser) {
        const bufferLength = analyser.frequencyBinCount;
        if (bufferLength > 0) {
          const dataArray = new Uint8Array(bufferLength);
          analyser.getByteFrequencyData(dataArray);
          
          let maxVal = 0;
          for (let i = 0; i < bufferLength; i++) {
            if (dataArray[i] > maxVal) {
              maxVal = dataArray[i];
            }
          }
          
          const peak = maxVal / 255;
          setKaoriVolumePeak((prev) => {
            if (peak > prev) {
              return peak;
            } else {
              return prev * 0.8 + peak * 0.2; // Smooth decline decay
            }
          });
        }
      }
      animationFrameId = requestAnimationFrame(updateVolume);
    };

    updateVolume();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [state]);

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyboardText.trim() || !sessionRef.current) return;
    sessionRef.current.sendTextMessage(keyboardText.trim());
    setKeyboardText("");
  };

  // Monitor Auth state & Load memories accordingly
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }
    const unsubscribe = auth.onAuthStateChanged(async (currentUser: User | null) => {
      setUser(currentUser);
      setAuthLoading(false);
      
      if (currentUser) {
        // Fetch memories from Firestore
        try {
          const userMems = await fetchUserMemories(currentUser.uid);
          setMemories(userMems as any[]);
        } catch (err) {
          console.error("Error loading user memories from Firestore:", err);
        }
      } else {
        // Fallback to Express endpoint for guest
        const loadMemoriesWithRetry = async (retriesLeft = 5, delayMs = 1500) => {
          try {
            const res = await fetch("/api/memories");
            if (!res.ok) {
              throw new Error(`Server returned HTTP ${res.status}`);
            }
            const data = await res.json();
            if (Array.isArray(data)) {
              setMemories(data);
            }
          } catch (err: any) {
            console.warn(`[Recollections] Load attempt failed. Retries remaining: ${retriesLeft}. Error:`, err);
            if (retriesLeft > 0) {
              setTimeout(() => {
                loadMemoriesWithRetry(retriesLeft - 1, delayMs * 1.5);
              }, delayMs);
            } else {
              console.error("Initial persistent recollections load failure:", err);
            }
          }
        };
        loadMemoriesWithRetry();
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error("Sign-In failed:", err);
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error("Sign-out failed:", err);
    }
  };

  const handleClearSession = () => {
    if (sessionRef.current) {
      sessionRef.current.clearSession();
    }
    setSessionKeyPoints([]);
  };

  const handleAddManualMemory = async (category: MemoryCategory, text: string) => {
    if (user) {
      // Save to Firestore
      try {
        const saved = await saveUserMemory(user.uid, category, text);
        setMemories((prev) => [saved as any, ...prev]);
      } catch (err) {
        console.error("Error saving user memory to Firestore:", err);
      }
    } else {
      // Save to local Express backend
      try {
        const resp = await fetch("/api/memories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, text })
        });
        const saved = await resp.json();
        if (saved && saved.id) {
          setMemories((prev) => [saved, ...prev]);
        }
      } catch (err) {
        console.error("Manual database recollect upload error:", err);
      }
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (user) {
      // Delete from Firestore
      try {
        await deleteUserMemory(id);
        setMemories((prev) => prev.filter(m => m.id !== id));
      } catch (err) {
        console.error("Error deleting user memory from Firestore:", err);
      }
    } else {
      // Delete from local Express backend
      try {
        const resp = await fetch(`/api/memories/${id}`, {
          method: "DELETE"
        });
        const resObj = await resp.json();
        if (resObj && resObj.success) {
          setMemories((prev) => prev.filter(m => m.id !== id));
        }
      } catch (err) {
        console.error("Manual memory delete execution failed:", err);
      }
    }
  };

  // Initialize the audio session handlers once on mount
  useEffect(() => {
    sessionRef.current = new MyraaAudioSession({
      onStateChange: (newState) => {
        setState(newState);
        if (newState === "disconnected") {
          // Reset captions on disconnect
          setUserCaption("");
          setModelCaption("");
          setSessionKeyPoints([]);
          setActiveEmotion("idle");
          setCharacterState("idle");
        } else if (newState === "listening") {
          // Return to receptive resting state
          setActiveEmotion("idle");
          setCharacterState("idle");
        } else if (newState === "speaking") {
          setCharacterState("talking");
        }
      },
      onTranscription: (role, text) => {
        if (role === "user") {
          setUserCaption(text);
          // Auto-clear the other caption when user starts talking
          setModelCaption("");
          setCharacterState("thinking");
        } else if (role === "model") {
          setModelCaption((prev) => {
            const next = prev + text;
            const newEmotion = detectEmotionFromText(next);
            setActiveEmotion(newEmotion);
            return next;
          });
          // Clear user caption when model replies
          setUserCaption("");
        }
      },
      onToolCall: (name, args, callback) => {
        console.log(`[App] Tool call triggered: ${name}`, args);
        
        const browserTools = [
          "browserOpen",
          "browserSearch",
          "browserClick",
          "browserMediaControl",
          "browserScroll",
          "browserType",
          "browserGoBack",
          "browserTabAction",
          "openWebsite"
        ];

        if (browserTools.includes(name)) {
          // Bring up the Holographic Browser Controller if it is not active
          if (!activeProjectorUrl) {
            let startingUrl = "https://youtube.com";
            if ((name === "browserOpen" || name === "openWebsite") && args.url) {
              startingUrl = args.url;
            }
            setActiveProjectorUrl(startingUrl);
          }

          // Map instructions directly onto Browser Agent
          setBrowserTrigger({
            type: name === "openWebsite" ? "browserOpen" : name,
            args,
            id: Math.random().toString(),
            callback: (res) => {
              callback(res);
              setBrowserTrigger(null);
            }
          });
        } else if (name === "changeBackground") {
          const colorName = args.color?.toLowerCase();
          const validColors = ["violet", "crimson", "emerald", "celestial", "gold", "rose", "charcoal"];
          
          if (colorName && validColors.includes(colorName)) {
            setThemeColor(colorName);
            callback({ result: `Successfully shifted aesthetic atmosphere to ${colorName}.` });
          } else {
            callback({ error: `Unsupported color '${colorName}'. Supported themes are: ${validColors.join(", ")}` });
          }
        } else {
          callback({ error: `Tool ${name} is not implemented.` });
        }
      },
      onError: (err) => {
        setErrorText(err);
      },
      onMemorySync: (updatedMemories) => {
        console.log("[App] WebSocket memories sync triggered:", updatedMemories);
        if (Array.isArray(updatedMemories)) {
          setMemories(updatedMemories);
        }
      },
      onSessionMemorySync: (keyPoints) => {
        console.log("[App] WebSocket session memory sync triggered:", keyPoints);
        if (Array.isArray(keyPoints)) {
          setSessionKeyPoints(keyPoints);
        }
      }
    });

    return () => {
      if (sessionRef.current) {
        sessionRef.current.disconnect();
      }
    };
  }, []);

  const handleToggleConnection = async () => {
    setErrorText(null);
    if (!sessionRef.current) return;

    if (state === "disconnected") {
      await sessionRef.current.connect();
    } else {
      sessionRef.current.disconnect();
    }
  };

  // Maps theme colors to CSS ambient light spots
  const getAmbientStyles = () => {
    switch (themeColor) {
      case "violet":
        return "from-purple-950/40 via-violet-950/20 to-slate-950";
      case "crimson":
        return "from-red-950/40 via-orange-950/20 to-slate-950";
      case "emerald":
        return "from-emerald-950/40 via-teal-950/20 to-slate-950";
      case "celestial":
        return "from-sky-950/45 via-indigo-950/25 to-slate-950";
      case "gold":
        return "from-amber-950/30 via-yellow-950/15 to-slate-950";
      case "rose":
        return "from-rose-950/40 via-pink-950/20 to-slate-950";
      case "charcoal":
      default:
        return "from-slate-900/50 via-slate-950/30 to-slate-950";
    }
  };

  const getThemeTextGlow = () => {
    switch (themeColor) {
      case "violet": return "text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.5)]";
      case "crimson": return "text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.5)]";
      case "emerald": return "text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]";
      case "celestial": return "text-sky-400 drop-shadow-[0_0_12px_rgba(14,165,233,0.5)]";
      case "gold": return "text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]";
      case "rose": return "text-pink-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.5)]";
      case "charcoal":
      default:
        return "text-indigo-400 drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]";
    }
  };

  const getOrbRingColor = () => {
    switch (state) {
      case "listening": return "border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.3)] bg-indigo-500/10";
      case "speaking": return "border-purple-500/70 shadow-[0_0_40px_rgba(168,85,247,0.4)] bg-purple-500/10";
      case "connecting": return "border-amber-500/50 animate-pulse bg-amber-500/10";
      case "disconnected":
      default:
        return "border-white/10 hover:border-indigo-500/30 bg-white/5";
    }
  };

  return (
    <div
      id="myraa-holographic-desktop"
      className={`relative w-full h-screen overflow-hidden bg-[#020205] text-white ${getAmbientStyles()} theme-transition flex flex-col justify-between p-6 sm:p-10 select-none`}
    >
      {/* Ambient Background Gradients matching Frosted Glass theme */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-900/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-cyan-900/15 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-[20%] right-[10%] w-[300px] h-[300px] bg-indigo-800/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Decorative grid pattern background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-40" />

      {/* FULL VIEWPORT HOLOGRAPHIC STAGE: Kaori materializes across the entire screen */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none">
        <MyraaCoreVisualizer
          session={sessionRef.current}
          state={state}
          themeColor={themeColor}
          activeEmotion={activeEmotion}
          characterState={characterState}
        />
      </div>

      {/* HEADER SECTION - Minimalist typography */}
      <header className="relative z-30 flex items-center justify-between w-full max-w-5xl mx-auto select-none">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-[0.4em] text-white/50 uppercase font-sans">
            Kaori
          </span>
          <div className={`w-1.5 h-1.5 rounded-full ${
            state === "listening" || state === "speaking" 
              ? "bg-cyan-400" 
              : "bg-white/10"
          }`} />
        </div>

        <div className="flex items-center gap-4 sm:gap-5">
          {/* Faint utilities hidden in margin */}
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1 opacity-25 hover:opacity-100 text-white transition text-xs font-mono tracking-widest cursor-pointer"
            title="Sway Themes and Info"
          >
            <Compass size={14} />
            <span className="hidden sm:inline">TOPICS</span>
          </button>

          <button 
            onClick={() => setShowMemoryDashboard(!showMemoryDashboard)}
            className="flex items-center gap-1 opacity-25 hover:opacity-100 text-white transition text-xs font-mono tracking-widest cursor-pointer"
            title="Recollections Database"
          >
            <Brain size={14} />
            <span className="hidden sm:inline">RECALLS</span>
          </button>

          <button 
            onClick={() => setShowCreativeStudio(!showCreativeStudio)}
            className="flex items-center gap-1.5 opacity-40 hover:opacity-100 text-cyan-400 hover:text-cyan-300 font-semibold transition text-xs font-mono tracking-widest cursor-pointer animate-pulse"
            title="Multimedia AI Creative Studio"
          >
            <Sparkles size={14} />
            <span className="hidden sm:inline">STUDIO</span>
          </button>

          {/* Real-time screen sharing toggler button inside Myraa glass style header */}
          <button 
            onClick={isScreenSharing ? stopScreenSharing : startScreenSharing}
            className={`flex items-center gap-1.5 transition text-xs font-mono tracking-widest cursor-pointer ${
              isScreenSharing 
                ? "text-cyan-400 opacity-100 font-semibold" 
                : "opacity-25 hover:opacity-100 text-white"
            }`}
            title="Share Screen with Kaori"
          >
            <Monitor size={14} className={isScreenSharing && !isScreenSharingPaused ? "animate-pulse text-cyan-400" : ""} />
            <span className="hidden md:inline">{isScreenSharing ? "SHARING" : "SHARE SCREEN"}</span>
          </button>

          {/* User Sign-In/Sign-Out controls */}
          {user ? (
            <div className="flex items-center gap-2 border border-cyan-500/10 bg-cyan-950/15 py-1 px-2.5 rounded-full transition hover:bg-cyan-950/25">
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || "User"} 
                  referrerPolicy="no-referrer"
                  className="w-4.5 h-4.5 rounded-full object-cover border border-cyan-400/30"
                />
              ) : (
                <UserIcon size={12} className="text-cyan-400" />
              )}
              <span className="text-[10px] font-mono font-medium max-w-[80px] truncate text-slate-300">
                {user.displayName?.split(" ")[0] || "User"}
              </span>
              <button
                onClick={handleSignOut}
                className="ml-1 opacity-50 hover:opacity-100 transition hover:text-rose-400 cursor-pointer"
                title="Sign Out"
              >
                <LogOut size={11} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              disabled={authLoading}
              className="flex items-center gap-1 px-2.5 py-1 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 rounded-full text-[10px] font-mono tracking-wider text-cyan-300 transition duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              title="Secure login with Google"
            >
              <LogIn size={11} />
              <span>LOGIN</span>
            </button>
          )}
        </div>
      </header>

      {isInIframe && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-30 w-full max-w-5xl mx-auto mt-4 p-3 rounded-2xl border border-cyan-500/15 bg-cyan-950/20 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-cyan-200 font-mono text-center sm:text-left"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
            <span>Interactive viewport is inside a preview frame. Screen-sharing is supported on direct tabs!</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a 
              href={window.location.origin}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30 text-cyan-300 font-bold transition uppercase tracking-wider text-[10px] cursor-pointer"
            >
              Launch Direct App
            </a>
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-medium transition uppercase tracking-wider text-[10px] cursor-pointer"
            >
              {copiedLink ? "Link Copied!" : "Copy App Link"}
            </button>
          </div>
        </motion.div>
      )}

      {/* CORE AVATAR AND VISUALS */}
      <main className="relative z-10 flex-1 w-full max-w-4xl mx-auto flex flex-col items-center justify-between py-6">
        
        {/* Holographic Projection Screen Widget (if website opened) */}
        <AnimatePresence>
          {activeProjectorUrl && (
            <div className="absolute inset-x-0 top-0 z-30 flex justify-center p-2">
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="flex items-center justify-between gap-4 p-3.5 rounded-2xl border border-indigo-500/20 bg-indigo-950/45 backdrop-blur-xl shadow-lg w-full max-w-md"
              >
                <div className="flex items-center gap-3 overflow-hidden text-left">
                  <div className="p-2 ml-1 rounded-xl bg-indigo-500/20 text-indigo-300">
                    <Globe size={18} />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="text-xs font-bold font-mono tracking-wide text-indigo-200 uppercase">Holographic Projection Broadcast</h4>
                    <p className="text-xs text-indigo-400 truncate max-w-[200px]">{activeProjectorUrl}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveProjectorUrl(activeProjectorUrl)}
                    className="p-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-400 transition"
                    title="View Frame"
                  >
                    <Maximize2 size={14} />
                  </button>
                  <button
                    onClick={() => setActiveProjectorUrl(null)}
                    className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Space Spacer to avoid head area */}
        <div className="h-10 sm:h-20" />

        {/* Cinematic dialogue layer overlay - Smooth, delicate text transitions with soft focus blur */}
        <div id="cinematic-subtitles" className="w-full max-w-3xl flex flex-col items-center justify-center text-center px-6 relative z-25 mt-auto mb-6 pointer-events-none min-h-[6rem]">
          <AnimatePresence mode="wait">
            {(() => {
              const textType = modelCaption 
                ? "model" 
                : userCaption 
                  ? "user" 
                  : "status";

              const activeText = modelCaption 
                ? modelCaption 
                : userCaption 
                  ? userCaption 
                  : state === "listening" 
                    ? "I am listening. Speak freely..." 
                    : state === "connecting" 
                      ? "Materializing presence links..." 
                      : "Connect memory core to awaken my voice.";

              return (
                <motion.div
                  key={textType}
                  initial={{ opacity: 0, y: 15, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -15, filter: "blur(6px)" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col items-center justify-center w-full"
                >
                  {textType === "model" && (
                    <h2 className="text-xl sm:text-2xl font-light text-white leading-relaxed tracking-wide font-display max-w-2xl drop-shadow-[0_2px_20px_rgba(0,0,0,0.9)]">
                      {activeText}
                    </h2>
                  )}

                  {textType === "user" && (
                    <p className="text-cyan-300 font-mono text-sm sm:text-base tracking-wider flex items-center justify-center gap-2 drop-shadow-[0_1px_10px_rgba(0,0,0,0.85)] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span>&ldquo;{activeText}&rdquo;</span>
                    </p>
                  )}

                  {textType === "status" && (
                    <span className="text-xs sm:text-sm uppercase tracking-[0.3em] font-medium text-white/30 font-sans tracking-widest drop-shadow-[0_1px_4px_rgba(0, 0, 0, 0.5)]">
                      {activeText}
                    </span>
                  )}
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </div>

        {/* Interactive suggestions prompt guide */}
        <AnimatePresence>
          {showGuide && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="mt-6 p-5 rounded-2xl border border-white/10 bg-slate-900/85 backdrop-blur-2xl max-w-md text-left w-full absolute z-40 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-3 text-white">
                <div className="flex items-center gap-1.5 font-display text-sm font-bold tracking-wide">
                  <Compass size={16} className="text-indigo-400" />
                  <span>PLAYFUL CORE SUGGESTIONS</span>
                </div>
                <button 
                  onClick={() => setShowGuide(false)}
                  className="text-slate-400 hover:text-white transition"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="text-xs text-slate-400 mb-4 font-mono leading-relaxed">
                Kaori is equipped with dynamic visual modules and standard text browser projectors. Here are clever triggers to try speaking aloud:
              </p>
              <div className="space-y-2 text-xs font-serif italic text-indigo-300">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition cursor-pointer font-sans normal-case text-slate-200">
                  ⚡ &quot;Kaori, change atmosphere of your core to crimson&quot; <span className="text-[10px] font-mono text-indigo-400 block mt-0.5 font-medium">Shifts theme color background</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition cursor-pointer font-sans normal-case text-slate-200">
                  ⚡ &quot;Open youtube.com on my screen please&quot; <span className="text-[10px] font-mono text-indigo-400 block mt-0.5 font-medium">Invokes browser projector panel</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition cursor-pointer font-sans normal-case text-slate-200">
                  ⚡ &quot;Tell me a witty joke and change background to gold&quot; <span className="text-[10px] font-mono text-indigo-400 block mt-0.5 font-medium">Combines tools & voice</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Error Banner */}
        <AnimatePresence>
          {errorText && (() => {
            const isMicError = errorText.toLowerCase().includes("microphone") || errorText.toLowerCase().includes("mic ");
            const isScreenShareError = errorText.includes("getDisplayMedia") || errorText.includes("Screen sharing") || errorText.includes("permission declined") || errorText.includes("declined");

            return (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className={`mt-6 flex flex-col gap-3 p-4 rounded-2xl border backdrop-blur-xl max-w-md w-full text-left ${
                  isMicError 
                    ? "border-cyan-500/20 bg-slate-950/70 shadow-[0_0_20px_rgba(6,182,212,0.05)]" 
                    : "border-rose-500/20 bg-rose-950/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  {isMicError ? (
                    <MicOff className="text-cyan-400 shrink-0 mt-0.5 animate-pulse" size={18} />
                  ) : (
                    <CircleAlert className="text-rose-400 shrink-0 mt-0.5" size={18} />
                  )}
                  <div className="flex-1">
                    <h4 className={`text-xs font-bold uppercase tracking-widest font-mono ${
                      isMicError ? "text-cyan-300" : "text-rose-300"
                    }`}>
                      {isMicError ? "Keyboard Whisper Mode Active" : "Core Error Protocol"}
                    </h4>
                    <p className={`text-xs mt-1 leading-relaxed ${
                      isMicError ? "text-slate-300" : "text-rose-200"
                    }`}>
                      {errorText}
                    </p>
                  </div>
                </div>

                {isScreenShareError && (
                  <div className="mt-1 p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-xs text-cyan-200 space-y-2">
                    <p className="font-semibold text-cyan-300 font-mono text-[10px] uppercase tracking-wider">💡 Troubleshooting Guidance:</p>
                    <p className="leading-relaxed">
                      By default, browsers disallow iframe applications from calling screen-sharing APIs. Opening the page in its own tab bypasses this restriction!
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={handleCopyLink}
                        type="button"
                        className="flex items-center gap-1 p-1.5 px-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/30 text-[10px] font-mono text-cyan-300 uppercase tracking-widest active:scale-95 transition cursor-pointer"
                      >
                        {copiedLink ? (
                          <>
                            <Check size={10} />
                            <span>COPIED LINK!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={10} />
                            <span>COPY DIRECT URL</span>
                          </>
                        )}
                      </button>
                      <span className="text-[9px] text-slate-400">Open copied link in a new tab to share!</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setErrorText(null)}
                    className={`text-[10px] font-bold underline font-mono uppercase cursor-pointer ${
                      isMicError ? "text-cyan-400 hover:text-cyan-300" : "text-rose-400 hover:text-rose-300"
                    }`}
                  >
                    {isMicError ? "Acknowledge" : "Dismiss"}
                  </button>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

      </main>

      {/* FOOTER INTERFACE WITH WAVEFORM AND CONTROLS */}
      <footer className="relative z-10 w-full max-w-2xl mx-auto flex flex-col items-center gap-5 mt-auto">
        
        {/* Sleek Glassmorphic Keyboard/Chat Input Fallback when connected */}
        {state !== "disconnected" && state !== "connecting" && (
          <form 
            onSubmit={handleSendText} 
            className="w-full max-w-md px-4 flex items-center gap-1.5 border border-white/10 bg-slate-950/60 backdrop-blur-xl rounded-2xl p-1.5 shadow-lg transition-all duration-300 focus-within:border-cyan-500/30"
          >
            <input 
              type="text"
              value={keyboardText}
              onChange={(e) => setKeyboardText(e.target.value)}
              placeholder="Type a whisper message or instruction..."
              className="flex-1 bg-transparent border-none text-xs text-white/90 placeholder:text-slate-500 py-1.5 px-3 focus:outline-none tracking-wider font-mono"
            />
            <button 
              type="submit"
              disabled={!keyboardText.trim()}
              className="p-1.5 px-3.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/30 text-[10px] font-mono text-cyan-300 uppercase tracking-widest active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer font-bold"
            >
              SEND
            </button>
          </form>
        )}



        {/* Dynamic Minimalist Waveform Visualizer & Peak-Level Indicator Compound */}
        <div className="flex flex-col items-center gap-2.5 w-48 p-3 rounded-2xl border border-white/5 bg-white/[0.01] backdrop-blur-md">
          <div className="flex items-center justify-center gap-1 h-8 w-44">
            {[12, 28, 16, 32, 20, 8].map((baseHeight, idx) => {
              let heightFactor = 0.35;
              if (state === "speaking") {
                const volBoost = kaoriVolumePeak * 1.6;
                heightFactor = 0.2 + volBoost + Math.sin(Date.now() * 0.02 + idx * 0.9) * (0.3 + kaoriVolumePeak * 0.5);
              } else if (state === "listening") {
                heightFactor = 0.2 + Math.sin(Date.now() * 0.01 + idx * 0.5) * 0.4;
              } else {
                heightFactor = idx % 2 === 0 ? 0.25 : 0.12;
              }
              const calculatedHeight = Math.max(3, baseHeight * heightFactor);

              return (
                <div
                  key={idx}
                  className={`w-0.5 rounded-full transition-all duration-150 ${
                    state === "speaking" ? "bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.5)]" : state === "listening" ? "bg-cyan-400" : "bg-white/10"
                  }`}
                  style={{ height: `${calculatedHeight}px` }}
                />
              );
            })}
          </div>

          {/* Real-time Peak Level Indicator Meter */}
          <div className="w-full flex flex-col gap-1 items-center px-1 border-t border-white/5 pt-2">
            <div className="w-full flex justify-between items-center text-[8px] font-mono tracking-widest text-slate-500 uppercase px-1">
              <span>PEAK LEVEL</span>
              <span className={`transition-colors duration-150 ${state === "speaking" ? "text-pink-400 font-bold font-mono" : "text-slate-600"}`}>
                {state === "speaking" ? `${Math.round(kaoriVolumePeak * 100)}%` : "0%"}
              </span>
            </div>
            {/* Stereophonic-style LED meters */}
            <div className="w-full h-1.5 flex gap-0.5 bg-black/40 rounded p-0.5 border border-white/5 overflow-hidden">
              {Array.from({ length: 16 }).map((_, segmentIdx) => {
                const segmentThreshold = (segmentIdx + 1) / 16;
                const isActive = state === "speaking" && kaoriVolumePeak >= segmentThreshold;
                
                let colorClass = "bg-white/[0.03]";
                if (isActive) {
                  if (segmentIdx < 6) {
                    colorClass = "bg-cyan-500 shadow-[0_0_4px_rgba(6,182,212,0.6)]";
                  } else if (segmentIdx < 12) {
                    colorClass = "bg-indigo-500 shadow-[0_0_4px_rgba(99,102,241,0.6)]";
                  } else {
                    colorClass = "bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.8)]";
                  }
                }
                return (
                  <div
                    key={segmentIdx}
                    className={`flex-1 h-full rounded-[1px] transition-all duration-100 ${colorClass}`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Glossy Beautiful Primary Connector Core Node */}
        <div className="flex items-center justify-center relative mb-4">
          <button 
            onClick={handleToggleConnection}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 cursor-pointer ${
              state === "disconnected"
                ? "bg-white/10 hover:bg-white/15 border border-white/15 text-white shadow-[0_0_20px_rgba(255,255,255,0.02)] hover:scale-105 active:scale-95"
                : state === "listening"
                ? "bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/80 text-cyan-200 shadow-[0_0_35px_rgba(34,211,238,0.3)] animate-pulse scale-105"
                : state === "speaking"
                ? "bg-purple-500/90 hover:bg-purple-600 border border-purple-400/95 text-white shadow-[0_0_35px_rgba(168,85,247,0.4)] scale-105"
                : "bg-amber-600 border border-amber-300 text-white animate-spin"
            }`}
            title={state === "disconnected" ? "Awake Kaori" : "Sleep core"}
          >
            {state === "disconnected" ? (
              <Power className="opacity-80" size={24} />
            ) : state === "connecting" ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : state === "listening" ? (
              <Mic size={24} className="text-cyan-200" />
            ) : (
              <Volume2 size={24} className="text-white" />
            )}
          </button>

          {/* Quiet Reset Projection Anchor */}
          {(activeProjectorUrl || errorText) && (
            <button 
              onClick={() => {
                if (activeProjectorUrl) setActiveProjectorUrl(null);
                setErrorText(null);
              }}
              className="absolute right-[-60px] p-2 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition duration-150 cursor-pointer"
              title="Reset Screen Broadcasts"
            >
              <X size={16} />
            </button>
          )}
        </div>

      </footer>



      {/* Holographic Website frame projections */}
      <AnimatePresence>
        {activeProjectorUrl && (
          <BrowserAgent
            url={activeProjectorUrl}
            onClose={() => {
              setActiveProjectorUrl(null);
              setBrowserTrigger(null);
            }}
            actionTrigger={browserTrigger}
          />
        )}
      </AnimatePresence>

      {/* Dynamic Floating Glassmorphic Screen Sharing Control Hub */}
      <AnimatePresence>
        {isScreenSharing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, x: 50 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.85, x: 50 }}
            className={`absolute bottom-6 md:bottom-10 right-6 md:right-10 z-50 w-72 p-4 rounded-2xl border ${
              isScreenSharingPaused 
                ? "border-amber-500/20 bg-slate-950/70" 
                : "border-cyan-500/20 bg-slate-950/70"
            } backdrop-blur-2xl shadow-2xl overflow-hidden`}
          >
            {/* Header / Indicator */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isScreenSharingPaused ? "bg-amber-400" : "bg-cyan-400 animate-pulse"}`} />
                <span className="text-[10px] font-bold font-mono tracking-widest text-slate-200">
                  {isScreenSharingPaused ? "SCREEN VISION PAUSED" : "SCREEN VISION ACTIVE"}
                </span>
              </div>
              <button 
                onClick={stopScreenSharing}
                className="text-slate-400 hover:text-white transition-colors duration-150 p-1 rounded-lg hover:bg-white/5 cursor-pointer"
                title="Stop Sharing"
              >
                <X size={14} />
              </button>
            </div>

            {/* Smart Video PIP Preview Holder */}
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-900 border border-white/5 mb-3 flex items-center justify-center group select-none">
              {isSimulatedSharing ? (
                /* Beautiful design-pairing visualizer for virtual feed */
                <div className="absolute inset-0 flex flex-col justify-between p-3 bg-gradient-to-br from-cyan-950/40 via-slate-950 to-indigo-950/40 font-mono text-[9px] text-cyan-400">
                  <div className="flex justify-between items-center bg-black/40 p-1.5 rounded-lg border border-cyan-500/15">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                      <span className="font-bold text-[8px] uppercase tracking-wider text-cyan-300">VIRTUAL VISION ACTIVATED</span>
                    </span>
                    <span className="text-slate-500 text-[8px]">960x540</span>
                  </div>
                  <div className="flex flex-col items-center justify-center py-4 text-center">
                    <span className="text-[10px] font-bold tracking-widest text-cyan-300 uppercase animate-pulse">Simulator Active</span>
                    <span className="text-[7.5px] text-slate-400 max-w-[200px] leading-relaxed mt-1">Sending dynamic simulated system frames to Voice AI perfectly inside iframe sandbox</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-cyan-500/10 pt-1 text-slate-400 text-[8px]">
                    <span>FPS: 0.5 (AUTO)</span>
                    <span className="text-indigo-400 font-bold">IFRAME FALLBACK DIRECT</span>
                  </div>
                </div>
              ) : (
                <video
                  ref={(el) => {
                    if (el && screenStreamRef.current && el.srcObject !== screenStreamRef.current) {
                      el.srcObject = screenStreamRef.current;
                      el.muted = true;
                      el.play().catch(err => console.log("Mini preview stream play issue:", err));
                    }
                  }}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    isScreenSharingPaused ? "opacity-30 blur-sm" : "opacity-90"
                  }`}
                  autoPlay
                  playsInline
                  muted
                />
              )}

              {isScreenSharingPaused && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] uppercase tracking-widest font-mono text-amber-400 font-bold px-2 py-1 bg-amber-950/40 border border-amber-500/20 rounded-md">
                    Transmission Paused
                  </span>
                </div>
              )}
              
              {!isScreenSharingPaused && screenVisionMode && !isSimulatedSharing && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/50 border border-cyan-400/20 text-[9px] font-mono text-cyan-300">
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                  <span>Streaming FPS: 0.5</span>
                </div>
              )}
            </div>

            {/* Quick Action Control Strip */}
            <div className="flex items-center justify-between gap-1.5 mb-2.5">
              {isScreenSharingPaused ? (
                <button
                  onClick={resumeScreenSharing}
                  className="flex-1 py-1.5 px-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg text-xs font-mono font-medium text-cyan-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="Resume Streaming Feed"
                >
                  <Play size={10} />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  onClick={pauseScreenSharing}
                  className="flex-1 py-1.5 px-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg text-xs font-mono font-medium text-amber-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="Pause Streaming Feed"
                >
                  <Pause size={10} />
                  <span>Pause</span>
                </button>
              )}

              <button
                onClick={switchScreenShare}
                className="py-1.5 px-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono text-slate-300 hover:text-white flex items-center justify-center gap-1 transition-all cursor-pointer"
                title="Choose Another Screen or Window"
              >
                <RefreshCw size={11} />
                <span>Switch</span>
              </button>

              <button
                onClick={stopScreenSharing}
                className="py-1.5 px-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg text-xs font-mono text-rose-400 flex items-center justify-center gap-1 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                title="Terminate Stream"
              >
                <Square size={9} />
                <span>Stop</span>
              </button>
            </div>

            {/* Core Mode Configuration Toggle */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-left">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold font-mono text-slate-200">SCREEN VISION MODE</span>
                <span className="text-[8px] text-slate-400 uppercase font-mono max-w-[150px]">Gemini Auto-Analysis</span>
              </div>
              <button
                onClick={() => setScreenVisionMode(!screenVisionMode)}
                className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                  screenVisionMode ? "bg-cyan-500" : "bg-white/10"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out ${
                    screenVisionMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recollections sliding core panel */}
      <MemoryDashboard
        isOpen={showMemoryDashboard}
        onClose={() => setShowMemoryDashboard(false)}
        memories={memories}
        onAddMemory={handleAddManualMemory}
        onDeleteMemory={handleDeleteMemory}
        themeColor={themeColor}
        sessionKeyPoints={sessionKeyPoints}
        onClearSession={handleClearSession}
      />

      {/* Multimedia Creative Studio Modal Dashboard */}
      <CreativeStudio
        isOpen={showCreativeStudio}
        onClose={() => setShowCreativeStudio(false)}
        themeColor={themeColor}
      />
    </div>
  );
}
