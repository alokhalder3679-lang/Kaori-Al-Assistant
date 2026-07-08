import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  Music, 
  Video, 
  Image as ImageIcon, 
  BrainCircuit, 
  LogIn, 
  LogOut, 
  Trash2, 
  Save, 
  Download, 
  Loader2, 
  Check, 
  X, 
  RefreshCw, 
  Volume2, 
  CloudOff, 
  Cloud,
  ChevronRight,
  Upload,
  Play,
  Pause,
  AlertCircle
} from "lucide-react";
import { 
  auth, 
  loginWithGoogle, 
  logoutUser, 
  saveStudioAsset, 
  fetchStudioAssets, 
  deleteStudioAsset, 
  CreativeAsset,
  User
} from "../lib/firebase";

interface CreativeStudioProps {
  isOpen: boolean;
  onClose: () => void;
  themeColor?: string;
}

export function CreativeStudio({ isOpen, onClose, themeColor = "cyan" }: CreativeStudioProps) {
  const [activeTab, setActiveTab] = useState<"music" | "video" | "image" | "thinker" | "gallery">("music");
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [gallery, setGallery] = useState<CreativeAsset[]>([]);
  const [galleryLoading, setGalleryLoading] = useState<boolean>(false);

  // Monitor Auth state
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = auth.onAuthStateChanged((currentUser: User | null) => {
      setUser(currentUser);
      if (currentUser) {
        loadGallery(currentUser.uid);
      } else {
        setGallery([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadGallery = async (userId: string) => {
    setGalleryLoading(true);
    try {
      const assets = await fetchStudioAssets(userId);
      setGallery(assets);
    } catch (err) {
      console.error("Error loading gallery creations:", err);
    } finally {
      setGalleryLoading(false);
    }
  };

  const handleSignIn = async () => {
    setAuthLoading(true);
    try {
      const loggedUser = await loginWithGoogle();
      if (loggedUser) {
        setUser(loggedUser);
        loadGallery(loggedUser.uid);
      }
    } catch (err: any) {
      alert("Sign-In failed: " + (err.message || err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutUser();
      setUser(null);
      setGallery([]);
    } catch (err) {
      console.error("Sign-out failed:", err);
    }
  };

  // --- MUSIC SECTION ---
  const [musicPrompt, setMusicPrompt] = useState("");
  const [musicModel, setMusicModel] = useState<"lyria-3-clip-preview" | "lyria-3-pro-preview">("lyria-3-clip-preview");
  const [musicImage, setMusicImage] = useState<string | null>(null);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicResult, setMusicResult] = useState<{ audioUrl: string; lyrics: string; rawData: string; mimeType: string } | null>(null);
  const [musicSaveSuccess, setMusicSaveSuccess] = useState(false);
  const musicFileRef = useRef<HTMLInputElement>(null);

  const handleMusicImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMusicImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateMusic = async () => {
    if (!musicPrompt.trim() && !musicImage) return;
    setMusicLoading(true);
    setMusicResult(null);
    setMusicSaveSuccess(false);

    try {
      let base64 = "";
      let mType = "";
      if (musicImage) {
        const parts = musicImage.split(",");
        mType = parts[0].split(";")[0].split(":")[1];
        base64 = parts[1];
      }

      const response = await fetch("/api/generate-music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: musicPrompt,
          model: musicModel,
          imageBase64: base64 || undefined,
          mimeType: mType || undefined
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Create local URL
      const binary = atob(data.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: data.mimeType || "audio/wav" });
      const audioUrl = URL.createObjectURL(blob);

      setMusicResult({
        audioUrl,
        lyrics: data.lyrics || "Melodic Instrumental (No lyrics yielded).",
        rawData: data.audioBase64,
        mimeType: data.mimeType
      });
    } catch (err: any) {
      alert("Music generation failed: " + (err.message || err));
    } finally {
      setMusicLoading(false);
    }
  };

  const saveMusicToCloud = async () => {
    if (!user || !musicResult) return;
    try {
      await saveStudioAsset(user.uid, {
        type: "music",
        prompt: musicPrompt || `Harmony generated using ${musicModel}`,
        assetData: musicResult.rawData,
        lyrics: musicResult.lyrics,
        mimeType: musicResult.mimeType,
        params: { model: musicModel }
      });
      setMusicSaveSuccess(true);
      loadGallery(user.uid);
    } catch (err: any) {
      alert("Could not sync to cloud: " + err.message);
    }
  };

  // --- VIDEO SECTION ---
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoResolution, setVideoResolution] = useState<"720p" | "1080p">("720p");
  const [videoAspect, setVideoAspect] = useState<"16:9" | "9:16">("16:9");
  const [videoImage, setVideoImage] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoMessage, setVideoMessage] = useState("");
  const [videoResult, setVideoResult] = useState<string | null>(null); // URL to play proxy link
  const [videoSaveSuccess, setVideoSaveSuccess] = useState(false);
  const videoFileRef = useRef<HTMLInputElement>(null);

  const videoMessages = [
    "Initializing Veo multimedia framework...",
    "Decoding workspace visual parameters...",
    "Calibrating high-fidelity camera angles...",
    "Running neural temporal interpolation...",
    "Refining light path-tracing rays...",
    "Assembling cinema-grade frame sequences...",
    "Encoding container stream metadata...",
    "Polishing resolution fields... almost complete!"
  ];

  const handleVideoImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setVideoImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateVideo = async () => {
    if (!videoPrompt.trim() && !videoImage) return;
    setVideoLoading(true);
    setVideoProgress(3);
    setVideoMessage(videoMessages[0]);
    setVideoResult(null);
    setVideoSaveSuccess(false);

    // Progress bar simulator
    let timer = setInterval(() => {
      setVideoProgress((p) => {
        if (p >= 94) {
          clearInterval(timer);
          return 94;
        }
        const delta = p < 30 ? 6 : p < 60 ? 3 : 1;
        // Shift message based on level
        const msgIdx = Math.min(Math.floor((p + delta) / 12), videoMessages.length - 1);
        setVideoMessage(videoMessages[msgIdx]);
        return p + delta;
      });
    }, 1800);

    try {
      let base64 = "";
      let mType = "";
      if (videoImage) {
        const parts = videoImage.split(",");
        mType = parts[0].split(";")[0].split(":")[1];
        base64 = parts[1];
      }

      // 1. Start generation
      const startRes = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: videoPrompt,
          resolution: videoResolution,
          aspectRatio: videoAspect,
          imageBase64: base64 || undefined,
          mimeType: mType || undefined
        })
      });
      const startData = await startRes.json();
      if (startData.error) throw new Error(startData.error);

      const opName = startData.operationName;

      // 2. Poll status
      let done = false;
      let finalUrl = "";
      let attempts = 0;

      while (!done && attempts < 40) {
        attempts++;
        await new Promise((r) => setTimeout(r, 6000));
        
        const statusRes = await fetch("/api/video-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operationName: opName })
        });
        const statusData = await statusRes.json();
        
        if (statusData.error) {
          throw new Error(statusData.error.message || "Deep video model rendering failed");
        }

        if (statusData.done) {
          done = true;
          finalUrl = statusData.videoUrl;
        }
      }

      if (!finalUrl) {
        throw new Error("Video operation search timed out. Refreshing your dashboard is highly recommended!");
      }

      clearInterval(timer);
      setVideoProgress(100);
      setVideoMessage("Veo rendering complete! Ready to stream below.");
      setVideoResult(finalUrl);
    } catch (err: any) {
      clearInterval(timer);
      alert("Video Generaton Failed: " + (err.message || err));
    } finally {
      setVideoLoading(false);
    }
  };

  const saveVideoToCloud = async () => {
    if (!user || !videoResult) return;
    try {
      await saveStudioAsset(user.uid, {
        type: "video",
        prompt: videoPrompt || "Veo Cinematic Masterpiece",
        assetData: videoResult,
        mimeType: "video/mp4",
        params: { resolution: videoResolution, aspectRatio: videoAspect }
      });
      setVideoSaveSuccess(true);
      loadGallery(user.uid);
    } catch (err: any) {
      alert("Could not sync video to cloud: " + err.message);
    }
  };

  // --- IMAGE SECTION ---
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageAspect, setImageAspect] = useState("1:1");
  const [imageSource, setImageSource] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageResult, setImageResult] = useState<{ url: string; rawData: string; mimeType: string } | null>(null);
  const [imageSaveSuccess, setImageSaveSuccess] = useState(false);
  const imageFileRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageSource(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateImage = async () => {
    if (!imagePrompt.trim() && !imageSource) return;
    setImageLoading(true);
    setImageResult(null);
    setImageSaveSuccess(false);

    try {
      let base64 = "";
      let mType = "";
      if (imageSource) {
        const parts = imageSource.split(",");
        mType = parts[0].split(";")[0].split(":")[1];
        base64 = parts[1];
      }

      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: imagePrompt,
          aspectRatio: imageAspect,
          baseImage: base64 || undefined,
          mimeType: mType || undefined
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Create local play url
      const finalUrl = `data:${data.mimeType};base64,${data.imageBase64}`;

      setImageResult({
        url: finalUrl,
        rawData: data.imageBase64,
        mimeType: data.mimeType
      });
    } catch (err: any) {
      alert("Image creation/edit failed: " + (err.message || err));
    } finally {
      setImageLoading(false);
    }
  };

  const saveImageToCloud = async () => {
    if (!user || !imageResult) return;
    try {
      await saveStudioAsset(user.uid, {
        type: "image",
        prompt: imagePrompt || "Generated high fidelity graphic",
        assetData: imageResult.rawData,
        mimeType: imageResult.mimeType,
        params: { aspectRatio: imageAspect }
      });
      setImageSaveSuccess(true);
      loadGallery(user.uid);
    } catch (err: any) {
      alert("Could not sync graphic to your cloud collection: " + err.message);
    }
  };

  // --- COGNITIVE THINKER ---
  const [thinkPrompt, setThinkPrompt] = useState("");
  const [thinkHistory, setThinkHistory] = useState<{ role: "user" | "model"; text: string }[]>([]);
  const [thinkLoading, setThinkLoading] = useState(false);
  const thinkerBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    thinkerBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thinkHistory]);

  const runCognitiveChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thinkPrompt.trim() || thinkLoading) return;

    const currentPrompt = thinkPrompt;
    setThinkPrompt("");
    setThinkHistory((prev) => [...prev, { role: "user", text: currentPrompt }]);
    setThinkLoading(true);

    try {
      const response = await fetch("/api/chat-thinking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: currentPrompt,
          previousMessages: thinkHistory
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setThinkHistory((prev) => [...prev, { role: "model", text: data.text }]);
    } catch (err: any) {
      setThinkHistory((prev) => [...prev, { role: "model", text: `💡 Connection error: ${err.message}` }]);
    } finally {
      setThinkLoading(false);
    }
  };

  // --- DELETIONS ---
  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this creation from your Firebase collection?")) return;
    try {
      await deleteStudioAsset(id);
      if (user) loadGallery(user.uid);
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      {/* Container Card */}
      <motion.div 
        id="creative-media-studio"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: "spring", damping: 30, stiffness: 350 }}
        className="relative w-full max-w-5xl h-[90vh] bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
      >
        {/* Glowing glass accent line */}
        <div className={`absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-${themeColor}-400 to-transparent opacity-80`} />

        {/* Studio Title and Nav */}
        <div className="p-5 border-b border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-${themeColor}-500/10 border border-${themeColor}-500/20 text-${themeColor}-400`}>
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-wider font-sans uppercase">Kaori Creative Studio</h2>
              <p className="text-[10px] text-slate-400 font-mono">HYPERMODAL MULTIMEDIA CO-PILOT</p>
            </div>
          </div>

          {/* Sync status & User Login */}
          <div className="flex items-center gap-3 self-end md:self-auto">
            {user ? (
              <div className="flex items-center gap-3 p-1.5 pr-3 bg-white/5 border border-white/10 rounded-full text-xs">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ""} referrerPolicy="no-referrer" className="w-6 h-6 rounded-full border border-white/10" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-cyan-600 flex items-center justify-center font-bold">{user.displayName?.charAt(0) || "U"}</div>
                )}
                <span className="max-w-[120px] truncate text-slate-300 font-mono">{user.displayName || user.email}</span>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Firebase Synchronized Cloud Active" />
                <button 
                  onClick={handleSignOut} 
                  className="p-1 hover:text-rose-400 transition cursor-pointer"
                  title="Disconnect Firebase Auth"
                >
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                disabled={authLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-xs font-mono font-medium text-cyan-300 hover:text-white transition cursor-pointer"
              >
                {authLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Sync to Firebase</span>
                  </>
                )}
              </button>
            )}

            <button 
              onClick={onClose} 
              className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 rounded-lg transition overflow-hidden cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Master Flex Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Main vertical sidebar selector for features */}
          <div className="w-full md:w-56 bg-slate-950/40 p-4 flex md:flex-col gap-1 border-b md:border-b-0 md:border-r border-white/5 text-xs overflow-x-auto md:overflow-x-visible md:overflow-y-auto no-scrollbar shrink-0">
            <span className="hidden md:block text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-2">Workspace Modules</span>

            <button
              onClick={() => setActiveTab("music")}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg font-mono tracking-wide transition cursor-pointer shrink-0 ${
                activeTab === "music" 
                  ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-medium" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Music className="w-4 h-4" />
              <span>Lyria Music Studio</span>
            </button>

            <button
              onClick={() => setActiveTab("video")}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg font-mono tracking-wide transition cursor-pointer shrink-0 ${
                activeTab === "video" 
                  ? "bg-purple-500/10 border border-purple-500/20 text-purple-300 font-medium" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Veo Video Creator</span>
            </button>

            <button
              onClick={() => setActiveTab("image")}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg font-mono tracking-wide transition cursor-pointer shrink-0 ${
                activeTab === "image" 
                  ? "bg-amber-500/10 border border-amber-500/20 text-amber-300 font-medium" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>Art Canvas</span>
            </button>

            <button
              onClick={() => setActiveTab("thinker")}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg font-mono tracking-wide transition cursor-pointer shrink-0 ${
                activeTab === "thinker" 
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-medium" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BrainCircuit className="w-4 h-4" />
              <span>Cognitive Thinker</span>
            </button>

            <div className="hidden md:block my-4 border-t border-white/5" />

            <span className="hidden md:block text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-2">Cloud Synced Hub</span>

            <button
              onClick={() => setActiveTab("gallery")}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg font-mono tracking-wide transition cursor-pointer shrink-0 ${
                activeTab === "gallery" 
                  ? "bg-slate-800 border border-white/10 text-slate-200 font-semibold" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Cloud className="w-4 h-4" />
                <span>My Collection</span>
              </div>
              {user && gallery.length > 0 && (
                <span className="px-1.5 py-0.5 text-[9px] bg-sky-500/20 border border-sky-400/30 text-sky-300 rounded font-bold font-mono">
                  {gallery.length}
                </span>
              )}
            </button>
          </div>

          {/* Interactive Panel Workspace Content */}
          <div className="flex-1 bg-slate-900/60 p-6 flex flex-col overflow-y-auto">
            
            <AnimatePresence mode="wait">
              
              {/* LYRIA MUSIC TAB */}
              {activeTab === "music" && (
                <motion.div
                  key="tab-music"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex-1 flex flex-col gap-5 justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold font-mono text-cyan-300 uppercase tracking-widest">Lyria Music Synthesis</h3>
                      <span className="text-[10px] text-slate-400 font-mono bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">GOOGLE LYRIA 3 AUDIO ENGINE</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: Prompts & Params */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold font-mono text-slate-300 tracking-wider">CREATIVE MUSICAL PROMPT</label>
                          <textarea
                            value={musicPrompt}
                            onChange={(e) => setMusicPrompt(e.target.value)}
                            placeholder="e.g., A 30-second futuristic lo-fi track with organic synth leads, heavy bass, space ambience, and Tokyo midnight vibes."
                            className="w-full h-28 p-3 bg-slate-950 border border-white/10 rounded-xl text-xs font-sans text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-light"
                          />
                        </div>

                        {/* Model Configuration */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold font-mono text-slate-400">DURATION TIER</label>
                            <select
                              value={musicModel}
                              onChange={(e: any) => setMusicModel(e.target.value)}
                              className="w-full p-2 bg-slate-950 border border-white/10 text-xs font-mono rounded-lg focus:outline-none"
                            >
                              <option value="lyria-3-clip-preview">30 Seconds Clip</option>
                              <option value="lyria-3-pro-preview">Full-Length Song</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold font-mono text-slate-400">INSPIRATION IMAGE (OPTIONAL)</label>
                            <input 
                              type="file" 
                              accept="image/*" 
                              ref={musicFileRef} 
                              onChange={handleMusicImageUpload} 
                              className="hidden" 
                            />
                            <button
                              type="button"
                              onClick={() => musicFileRef.current?.click()}
                              className={`w-full p-2 border border-dashed rounded-lg text-xs font-mono font-light transition-all text-center flex items-center justify-center gap-2 cursor-pointer ${
                                musicImage 
                                  ? "border-cyan-500/40 text-cyan-400 bg-cyan-950/25" 
                                  : "border-white/10 text-slate-400 hover:border-cyan-500/20"
                              }`}
                            >
                              <Upload size={12} />
                              <span className="max-w-[130px] truncate">{musicImage ? "Ref Photo Attached" : "Attached Image"}</span>
                            </button>
                          </div>
                        </div>

                        {/* Image Preview attachment panel */}
                        {musicImage && (
                          <div className="relative w-full h-20 bg-slate-950 border border-white/5 rounded-lg overflow-hidden flex items-center p-2 justify-between">
                            <img src={musicImage} alt="Inspiration source" className="h-16 w-16 object-cover rounded" />
                            <span className="text-[10px] text-cyan-400 font-mono tracking-tight font-light flex items-center gap-1">
                              <Check size={11} className="w-3.5 h-3.5" />
                              Synced for Image-to-Audio
                            </span>
                            <button 
                              onClick={() => setMusicImage(null)}
                              className="p-1 px-2 bg-rose-900/20 text-rose-400 border border-rose-900/30 rounded text-[9px] font-mono hover:bg-rose-900/40 cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        )}

                        <button
                          onClick={generateMusic}
                          disabled={musicLoading || (!musicPrompt.trim() && !musicImage)}
                          className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 disabled:pointer-events-none rounded-xl text-xs font-mono font-medium tracking-wider text-white shadow-lg transition duration-200 cursor-pointer flex items-center justify-center gap-2"
                        >
                          {musicLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Synthesizing Waves...</span>
                            </>
                          ) : (
                            <>
                              <Music className="w-4 h-4" />
                              <span>Generate Sound Layer</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Right: Sound Player & Output logs */}
                      <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl flex flex-col justify-between space-y-4 min-h-[250px]">
                        {musicLoading && (
                          <div className="flex-1 flex flex-col items-center justify-center space-y-3">
                            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
                            <p className="text-xs font-mono text-slate-400">Streaming synthesizer pipeline data...</p>
                          </div>
                        )}

                        {!musicLoading && !musicResult && (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                            <Music className="w-8 h-8 text-slate-600 mb-2" />
                            <p className="text-slate-400 text-xs font-light max-w-xs">Your synthesized soundscapes will materialize here.</p>
                            <p className="text-[9px] text-slate-600 font-mono mt-1">Both short previews & full lengths are supported</p>
                          </div>
                        )}

                        {!musicLoading && musicResult && (
                          <div className="flex-1 flex flex-col justify-between h-full space-y-4">
                            <div className="space-y-3">
                              <span className="text-[9px] font-bold font-mono tracking-widest text-cyan-400 uppercase bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-800/25">OUTPUT DECODED</span>
                              
                              <div className="p-3 bg-cyan-950/10 border border-cyan-800/20 rounded-xl space-y-2">
                                <p className="text-[10px] text-slate-300 font-mono tracking-wider">LYRICS / META LYRIC ANALYSIS</p>
                                <div className="text-[11px] text-slate-400 max-h-[120px] overflow-y-auto leading-relaxed whitespace-pre-line font-serif italic">
                                  {musicResult.lyrics}
                                </div>
                              </div>
                            </div>

                            {/* Player bar */}
                            <div className="space-y-3">
                              <audio src={musicResult.audioUrl} controls className="w-full h-10 accent-cyan-400 bg-slate-950/80 rounded" />
                              
                              <div className="flex items-center gap-2">
                                <a
                                  href={musicResult.audioUrl}
                                  download={`kaori_acoustic_synth_${Date.now()}.wav`}
                                  className="flex-1 py-1.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono text-slate-300 hover:text-white transition flex items-center justify-center gap-1.5"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download WAV</span>
                                </a>

                                {user ? (
                                  <button
                                    onClick={saveMusicToCloud}
                                    disabled={musicSaveSuccess}
                                    className={`flex-1 py-1.5 px-3 border rounded-lg text-xs font-mono transition flex items-center justify-center gap-1.5 ${
                                      musicSaveSuccess
                                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                        : "bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 hover:text-white cursor-pointer"
                                    }`}
                                  >
                                    {musicSaveSuccess ? (
                                      <>
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Cloud Synced</span>
                                      </>
                                    ) : (
                                      <>
                                        <Save className="w-3.5 h-3.5" />
                                        <span>Save to Collection</span>
                                      </>
                                    )}
                                  </button>
                                ) : (
                                  <button
                                    onClick={handleSignIn}
                                    className="flex-1 py-1.5 px-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-[10px] font-mono text-slate-400 hover:text-white transition cursor-pointer flex items-center justify-center gap-1"
                                    title="Connect Firebase database to sync permanently"
                                  >
                                    <CloudOff className="w-3.5 h-3.5" />
                                    <span>Sync Locked</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* VEO VIDEO CREATOR */}
              {activeTab === "video" && (
                <motion.div
                  key="tab-video"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex-1 flex flex-col gap-5 justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold font-mono text-purple-300 uppercase tracking-widest">Veo Cinematic Generation</h3>
                      <span className="text-[10px] text-slate-400 font-mono bg-purple-950 px-2 py-0.5 rounded border border-purple-800">GOOGLE VEO 3 GEN-AI</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left side input and parameters */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold font-mono text-slate-300 tracking-wider">VIDEO CINEMA PROMPT</label>
                          <textarea
                            value={videoPrompt}
                            onChange={(e) => setVideoPrompt(e.target.value)}
                            placeholder="e.g., A glowing majestic jellyfish hovering through a cyber city filled with neon signage, shot on 35mm lens, photorealistic, cyberpunk theme."
                            className="w-full h-24 p-3 bg-slate-950 border border-white/10 rounded-xl text-xs font-sans text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 transition-all font-light"
                          />
                        </div>

                        {/* Format parameters */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold font-mono text-slate-400">RESOLUTION</label>
                            <select
                              value={videoResolution}
                              onChange={(e: any) => setVideoResolution(e.target.value)}
                              className="w-full p-2 bg-slate-950 border border-white/10 text-xs font-mono rounded-lg focus:outline-none text-slate-300"
                            >
                              <option value="720p">720p HD</option>
                              <option value="1080p">1080p Full HD</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-bold font-mono text-slate-400">ASPECT RATIO</label>
                            <select
                              value={videoAspect}
                              onChange={(e: any) => setVideoAspect(e.target.value)}
                              className="w-full p-2 bg-slate-950 border border-white/10 text-xs font-mono rounded-lg focus:outline-none text-slate-300"
                            >
                              <option value="16:9">Landscape 16:9</option>
                              <option value="9:16">Portrait 9:16</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-bold font-mono text-slate-400">START FRAME (OPT)</label>
                            <input 
                              type="file" 
                              accept="image/*" 
                              ref={videoFileRef} 
                              onChange={handleVideoImageUpload} 
                              className="hidden" 
                            />
                            <button
                              type="button"
                              onClick={() => videoFileRef.current?.click()}
                              className={`w-full p-2 border border-dashed rounded-lg text-xs font-mono font-light transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer max-w-full truncate ${
                                videoImage 
                                  ? "border-purple-500/40 text-purple-400 bg-purple-950/25" 
                                  : "border-white/10 text-slate-400 hover:border-purple-500/20"
                              }`}
                            >
                              <Upload size={11} />
                              <span className="truncate">{videoImage ? "Attached" : "First Frame"}</span>
                            </button>
                          </div>
                        </div>

                        {/* Image preview frame widget */}
                        {videoImage && (
                          <div className="relative w-full h-16 bg-slate-950 border border-white/5 rounded-lg overflow-hidden flex items-center p-2 justify-between">
                            <img src={videoImage} alt="Video beginning" className="h-12 w-12 object-cover rounded" />
                            <span className="text-[9px] text-purple-400 font-mono tracking-tight font-light flex items-center gap-1">
                              <Check size={11} className="w-3" />
                              Image-to-Video Mode Unlocked
                            </span>
                            <button 
                              onClick={() => setVideoImage(null)}
                              className="p-1 px-2 bg-rose-900/20 text-rose-400 border border-rose-900/30 rounded text-[9px] font-mono hover:bg-rose-900/40 cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        )}

                        <button
                          onClick={generateVideo}
                          disabled={videoLoading || (!videoPrompt.trim() && !videoImage)}
                          className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 disabled:opacity-40 disabled:pointer-events-none rounded-xl text-xs font-mono font-medium tracking-wider text-white shadow-lg transition duration-200 cursor-pointer flex items-center justify-center gap-2"
                        >
                          {videoLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Executing Veo Pipeline...</span>
                            </>
                          ) : (
                            <>
                              <Video className="w-4 h-4" />
                              <span>Animate Video</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Right side results and loaders */}
                      <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl flex flex-col justify-between space-y-4 min-h-[250px] overflow-hidden">
                        
                        {videoLoading && (
                          <div className="flex-1 flex flex-col items-center justify-center space-y-4 px-4 text-center">
                            <div className="relative w-16 h-16 border-2 border-purple-500/20 rounded-full flex items-center justify-center">
                              <span className="text-xs font-mono text-purple-400 font-semibold">{videoProgress}%</span>
                              <div className="absolute inset-0 border-2 border-t-purple-400 rounded-full animate-spin" style={{ animationDuration: "1.5s" }} />
                            </div>

                            <div className="space-y-1 w-full max-w-xs">
                              <p className="text-xs font-mono font-medium text-slate-300 animate-pulse">{videoMessage}</p>
                              <p className="text-[10px] text-slate-500 font-mono tracking-tight">Veo generations can require up to 1-2 minutes. Stay tuned!</p>
                            </div>

                            {/* visual subtle bar */}
                            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-purple-500 h-full rounded-full transition-all duration-300" style={{ width: `${videoProgress}%` }} />
                            </div>
                          </div>
                        )}

                        {!videoLoading && !videoResult && (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                            <Video className="w-8 h-8 text-slate-600 mb-2" />
                            <p className="text-slate-400 text-xs font-light max-w-xs">Your animated cinematic clips will materialize here.</p>
                            <p className="text-[9px] text-slate-600 font-mono mt-1">Google Veo 3 offers industry-leading temporal video consistency</p>
                          </div>
                        )}

                        {!videoLoading && videoResult && (
                          <div className="flex-1 flex flex-col justify-between h-full space-y-4">
                            <div className="space-y-2">
                              <span className="text-[9px] font-bold font-mono tracking-widest text-purple-400 uppercase bg-purple-950/30 px-2 py-0.5 rounded border border-purple-800/25">DYNAMIC VIDEO OUTPUT</span>
                              
                              <div className="relative rounded-lg overflow-hidden border border-white/10 bg-slate-950 flex items-center justify-center" style={{ aspectRatio: videoAspect === "16:9" ? "16/9" : "9/16", maxHeight: "200px" }}>
                                <video 
                                  src={videoResult} 
                                  controls 
                                  className="w-full h-full object-contain"
                                  autoPlay
                                  loop
                                  muted
                                />
                              </div>
                            </div>

                            {/* Download & sync controls */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <a
                                  href={videoResult}
                                  download={`veo_motion_clip_${Date.now()}.mp4`}
                                  className="flex-1 py-1.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono text-slate-300 hover:text-white transition flex items-center justify-center gap-1.5"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download MP4</span>
                                </a>

                                {user ? (
                                  <button
                                    onClick={saveVideoToCloud}
                                    disabled={videoSaveSuccess}
                                    className={`flex-1 py-1.5 px-3 border rounded-lg text-xs font-mono transition flex items-center justify-center gap-1.5 ${
                                      videoSaveSuccess
                                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                        : "bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20 hover:text-white cursor-pointer"
                                    }`}
                                  >
                                    {videoSaveSuccess ? (
                                      <>
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Cloud Synced</span>
                                      </>
                                    ) : (
                                      <>
                                        <Save className="w-3.5 h-3.5" />
                                        <span>Save to Cloud</span>
                                      </>
                                    )}
                                  </button>
                                ) : (
                                  <button
                                    onClick={handleSignIn}
                                    className="flex-1 py-1.5 px-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-[10px] font-mono text-slate-400 hover:text-white transition cursor-pointer flex items-center justify-center gap-1"
                                    title="Connect Firebase database to sync permanently"
                                  >
                                    <CloudOff className="w-3.5 h-3.5" />
                                    <span>Sync Locked</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ART CANVAS (IMAGE CREATION & EDITING) */}
              {activeTab === "image" && (
                <motion.div
                  key="tab-image"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex-1 flex flex-col gap-5 justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold font-mono text-amber-300 uppercase tracking-widest">Aesthetic Canvas</h3>
                      <span className="text-[10px] text-slate-400 font-mono bg-amber-950 px-2 py-0.5 rounded border border-amber-800">IMAGE GENERATION & EDIT ENGINE</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Inputs */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold font-mono text-slate-300 tracking-wider">GRAPHIC INSTRUCTION</label>
                            {imageSource && (
                              <span className="text-[8px] bg-sky-500/20 text-sky-300 border border-sky-500/30 px-1 py-0.5 rounded font-mono font-bold uppercase">EDIT MODE ACTIVE</span>
                            )}
                          </div>
                          <textarea
                            value={imagePrompt}
                            onChange={(e) => setImagePrompt(e.target.value)}
                            placeholder={imageSource ? "Describe what to ADD, EDIT, or DELETE inside the uploaded starting image..." : "e.g., A minimalist logo vector of a cherry blossom flower on a clean black circle background, sleek luxury vector illustration..."}
                            className="w-full h-24 p-3 bg-slate-950 border border-white/10 rounded-xl text-xs font-sans text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-all font-light"
                          />
                        </div>

                        {/* Controls */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold font-mono text-slate-400">ASPECT RATIO</label>
                            <select
                              value={imageAspect}
                              onChange={(e) => setImageAspect(e.target.value)}
                              disabled={!!imageSource}
                              className="w-full p-2 bg-slate-950 border border-white/10 text-xs font-mono rounded-lg focus:outline-none text-slate-300 disabled:opacity-40"
                            >
                              <option value="1:1">Square 1:1</option>
                              <option value="3:4">Portrait 3:4</option>
                              <option value="4:3">Landscape 4:3</option>
                              <option value="16:9">Widescreen 16:9</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-bold font-mono text-slate-400">START / EDIT BASE WEB-IMAGE</label>
                            <input 
                              type="file" 
                              accept="image/*" 
                              ref={imageFileRef} 
                              onChange={handleImageUpload} 
                              className="hidden" 
                            />
                            <button
                              type="button"
                              onClick={() => imageFileRef.current?.click()}
                              className={`w-full p-2 border border-dashed rounded-lg text-xs font-mono font-light transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer max-w-full truncate ${
                                imageSource 
                                  ? "border-amber-500/40 text-amber-400 bg-amber-950/25" 
                                  : "border-white/10 text-slate-400 hover:border-amber-500/20"
                              }`}
                            >
                              <Upload size={11} />
                              <span className="truncate">{imageSource ? "Source Synced" : "Upload Reference"}</span>
                            </button>
                          </div>
                        </div>

                        {/* Image attachment overview */}
                        {imageSource && (
                          <div className="relative w-full h-16 bg-slate-950 border border-white/5 rounded-lg overflow-hidden flex items-center p-2 justify-between">
                            <img src={imageSource} alt="Aesthetic source reference" className="h-12 w-12 object-cover rounded" />
                            <span className="text-[9px] text-amber-500 font-mono tracking-tight font-light flex items-center gap-1 pt-1">
                              <Check size={11} className="w-3 text-amber-400" />
                              Image Translation Synced
                            </span>
                            <button 
                              onClick={() => {
                                setImageSource(null);
                                if (imageFileRef.current) imageFileRef.current.value = "";
                              }}
                              className="p-1 px-2 bg-rose-900/20 text-rose-400 border border-rose-900/30 rounded text-[9px] font-mono hover:bg-rose-900/40 cursor-pointer"
                            >
                              Disable
                            </button>
                          </div>
                        )}

                        <button
                          onClick={generateImage}
                          disabled={imageLoading || (!imagePrompt.trim() && !imageSource)}
                          className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-40 disabled:pointer-events-none rounded-xl text-xs font-mono font-medium tracking-wider text-white shadow-lg transition duration-200 cursor-pointer flex items-center justify-center gap-2"
                        >
                          {imageLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Rendering Pixel Matrix...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              <span>{imageSource ? "Apply Edit Changes" : "Forge Masterpiece"}</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Render View results */}
                      <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl flex flex-col justify-between space-y-4 min-h-[250px]">
                        {imageLoading && (
                          <div className="flex-1 flex flex-col items-center justify-center space-y-3">
                            <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                            <p className="text-xs font-mono text-slate-400">Path-tracing pixel segments...</p>
                          </div>
                        )}

                        {!imageLoading && !imageResult && (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                            <ImageIcon className="w-8 h-8 text-slate-600 mb-2" />
                            <p className="text-slate-400 text-xs font-light max-w-xs">Your generated arts or graphic alterations will manifest here.</p>
                            <p className="text-[9px] text-slate-600 font-mono mt-1">Both single-prompt creation and edit masking are fully unlocked</p>
                          </div>
                        )}

                        {!imageLoading && imageResult && (
                          <div className="flex-1 flex flex-col justify-between h-full space-y-4">
                            <div className="space-y-2">
                              <span className="text-[9px] font-bold font-mono tracking-widest text-amber-400 uppercase bg-amber-950/30 px-2 py-0.5 rounded border border-amber-800/25">CANVAS VIEWPORT</span>
                              
                              <div className="relative rounded-lg overflow-hidden border border-white/10 bg-slate-950 flex items-center justify-center max-h-[200px]" style={{ aspectRatio: imageAspect === "16:9" ? "16/9" : imageAspect === "4:3" ? "4/3" : imageAspect === "3:4" ? "3/4" : "1/1" }}>
                                <img src={imageResult.url} alt="Rendered artwork outcome" className="w-full h-full object-contain" />
                              </div>
                            </div>

                            {/* Download & sync controls */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <a
                                  href={imageResult.url}
                                  download={`kaori_art_frame_${Date.now()}.png`}
                                  className="flex-1 py-1.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono text-slate-300 hover:text-white transition flex items-center justify-center gap-1.5"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download Art</span>
                                </a>

                                {user ? (
                                  <button
                                    onClick={saveImageToCloud}
                                    disabled={imageSaveSuccess}
                                    className={`flex-1 py-1.5 px-3 border rounded-lg text-xs font-mono transition flex items-center justify-center gap-1.5 ${
                                      imageSaveSuccess
                                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                        : "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 hover:text-white cursor-pointer"
                                    }`}
                                  >
                                    {imageSaveSuccess ? (
                                      <>
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Cloud Synced</span>
                                      </>
                                    ) : (
                                      <>
                                        <Save className="w-3.5 h-3.5" />
                                        <span>Save to Collection</span>
                                      </>
                                    )}
                                  </button>
                                ) : (
                                  <button
                                    onClick={handleSignIn}
                                    className="flex-1 py-1.5 px-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-[10px] font-mono text-slate-400 hover:text-white transition cursor-pointer flex items-center justify-center gap-1"
                                    title="Connect Firebase database to sync permanently"
                                  >
                                    <CloudOff className="w-3.5 h-3.5" />
                                    <span>Sync Locked</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* COGNITIVE THINKER CHAT */}
              {activeTab === "thinker" && (
                <motion.div
                  key="tab-thinker"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex-1 flex flex-col justify-between h-full space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold font-mono text-emerald-300 uppercase tracking-widest">Cognitive Thinking Room</h3>
                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800">GEMINI 3.1 PRO (HIGH THINKING ACTIVE)</span>
                  </div>

                  {/* Chat logs */}
                  <div className="flex-1 bg-slate-950/60 border border-white/5 rounded-xl p-4 overflow-y-auto space-y-4 max-h-[300px] min-h-[220px]">
                    {thinkHistory.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <BrainCircuit className="w-8 h-8 text-emerald-600/60 mb-2 animate-pulse" />
                        <p className="text-slate-400 text-xs font-light max-w-sm">
                          Welcome to the High Cognitive reasoning module. Here, Gemini 3.1 Pro is invoked with a <strong className="text-emerald-400 font-normal">HIGH Thinking level</strong> to solve complex code, logic, and general planning tasks.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {thinkHistory.map((msg, idx) => (
                          <div 
                            key={idx} 
                            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                          >
                            <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mb-1">
                              {msg.role === "user" ? "USER INQUIRY" : "GEMINI COGNITIVE OUTPUT"}
                            </span>
                            <div 
                              className={`max-w-[85%] p-3 rounded-xl text-xs leading-relaxed font-sans ${
                                msg.role === "user" 
                                  ? "bg-slate-800 border border-white/5 text-slate-200" 
                                  : "bg-emerald-950/20 border border-emerald-800/30 text-slate-200"
                              }`}
                            >
                              {msg.text}
                            </div>
                          </div>
                        ))}
                        {thinkLoading && (
                          <div className="flex items-center gap-2 text-emerald-400 font-mono text-[10px] animate-pulse">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Thinking (Analyzing logical steps, weighting models)...</span>
                          </div>
                        )}
                        <div ref={thinkerBottomRef} />
                      </div>
                    )}
                  </div>

                  {/* Form */}
                  <form onSubmit={runCognitiveChat} className="flex gap-2">
                    <input
                      type="text"
                      value={thinkPrompt}
                      onChange={(e) => setThinkPrompt(e.target.value)}
                      placeholder="Ask any complex logical puzzle, mathematical formula or programming request..."
                      className="flex-1 p-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-light"
                    />
                    <button
                      type="submit"
                      disabled={thinkLoading || !thinkPrompt.trim()}
                      className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-mono text-xs border border-emerald-800/30 rounded-xl transition cursor-pointer"
                    >
                      Search Mind
                    </button>
                    {thinkHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setThinkHistory([])}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/5 rounded-xl transition cursor-pointer"
                        title="Clear logical memory"
                      >
                        Reset
                      </button>
                    )}
                  </form>
                </motion.div>
              )}

              {/* CLOUD MY COLLECTION GALLERY */}
              {activeTab === "gallery" && (
                <motion.div
                  key="tab-gallery"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex-1 flex flex-col gap-4 overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold font-mono text-slate-300 uppercase tracking-wider">Cloud Synchronized Vault</h3>
                    <span className="text-[9px] font-bold font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-white/5">FIREBASE FIRESTORE DATA</span>
                  </div>

                  {!user ? (
                    <div className="flex-1 bg-slate-950/50 border border-white/5 rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-4">
                      <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-full">
                        <CloudOff className="w-8 h-8" />
                      </div>
                      <div className="space-y-1.5 max-w-sm">
                        <h4 className="text-sm font-semibold font-mono text-slate-200">Unauthenticated Offline Mode</h4>
                        <p className="text-xs text-slate-400 font-light">
                          All synthesized music, Veo video streams, and artworks generated in the play sessions are kept temporary in browser variables. Connect Firebase database to sync permanently.
                        </p>
                      </div>
                      <button
                        onClick={handleSignIn}
                        className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-mono text-xs font-semibold rounded-xl tracking-wider hover:shadow-cyan-500/10 hover:shadow-lg transition cursor-pointer"
                      >
                        Sign in with Google
                      </button>
                    </div>
                  ) : galleryLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-2">
                      <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                      <p className="text-xs font-mono text-slate-400">Fetching cloud entries...</p>
                    </div>
                  ) : gallery.length === 0 ? (
                    <div className="flex-1 bg-slate-950/30 border border-white/5 rounded-xl p-8 flex flex-col items-center justify-center text-center">
                      <Cloud className="w-8 h-8 text-slate-600 mb-2" />
                      <p className="text-slate-400 text-xs font-light max-w-xs">No saved multimedia assets inside your database yet.</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-1">Generate items inside Lyria, Veo, or Canvas tabs then click "Save to Collection"!</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 pr-1">
                      {gallery.map((asset) => (
                        <div 
                          key={asset.id} 
                          className="bg-slate-950 border border-white/5 hover:border-white/10 rounded-xl p-4 space-y-3 flex flex-col justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className={`text-[8px] font-bold font-mono px-2 py-0.5 rounded border uppercase ${
                                asset.type === "music" 
                                  ? "bg-cyan-950 border-cyan-800 text-cyan-400" 
                                  : asset.type === "video" 
                                    ? "bg-purple-950 border-purple-800 text-purple-400" 
                                    : "bg-amber-950 border-amber-800 text-amber-400"
                              }`}>
                                {asset.type}
                              </span>
                              <button 
                                onClick={() => asset.id && handleDeleteItem(asset.id)}
                                className="text-slate-500 hover:text-rose-400 transition cursor-pointer text-xs"
                                title="Delete from Firebase"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>

                            <p className="text-[11px] text-slate-300 font-light line-clamp-2 leading-relaxed">
                              Prompt: <strong className="font-light italic text-slate-400">"{asset.prompt}"</strong>
                            </p>
                          </div>

                          {/* Render Preview Asset Elements */}
                          <div className="bg-slate-900/60 rounded-lg p-2 flex items-center justify-center border border-white/5 overflow-hidden">
                            {asset.type === "image" && (
                              <img src={`data:${asset.mimeType || "image/png"};base64,${asset.assetData}`} alt="Art piece" className="max-h-[110px] object-contain rounded" />
                            )}
                            {asset.type === "music" && (
                              <div className="w-full space-y-2">
                                <audio src={`data:${asset.mimeType || "audio/wav"};base64,${asset.assetData}`} controls className="w-full h-8 accent-cyan-400" />
                                {asset.lyrics && (
                                  <div className="text-[10px] text-slate-400 max-h-[50px] overflow-y-auto font-serif italic text-center whitespace-pre-line leading-relaxed">
                                    {asset.lyrics}
                                  </div>
                                )}
                              </div>
                            )}
                            {asset.type === "video" && (
                              <video src={asset.assetData} controls className="max-h-[110px] object-contain w-full rounded" muted />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
