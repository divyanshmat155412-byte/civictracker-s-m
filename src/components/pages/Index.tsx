import { useUiText } from "@/hooks/useUiText";
import WardPreview from "@/components/WardPreview";
import { photoUrlFor } from "@/lib/photo-url";
import { invokeFunction } from "@/lib/invoke-function";
import { useState, useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Camera, MapPin, Send, Trash2, Droplets, AlertTriangle,
  ShieldAlert, Flame, Lightbulb, Building, Volume2, MoreHorizontal, Pipette,
  ThumbsUp, Clock, TrendingUp, ArrowRight, Image, X, Copy, Check, Sparkles,
  Locate, History, AlertCircle,
} from "lucide-react";
import { useNavigate } from "@/lib/router-compat";
import Layout from "@/components/Layout";
import { CATEGORY_CONFIG, CATEGORY_LABEL_HI, ComplaintCategory, STATUS_CONFIG } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { COMPLAINT_COLS } from "@/lib/db-columns";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import heroBg from "@/assets/hero-bg.jpg";
import PermissionPrompt from "@/components/PermissionPrompt";
import { lazy, Suspense } from "react";
const LocationMapPicker = lazy(() => import("@/components/LocationMapPicker"));
import MapThumbnail from "@/components/MapThumbnail";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import VoiceDictate from "@/components/VoiceDictate";
import { CITIES, DEFAULT_CITY } from "@/lib/cities";
import { reverseGeocode } from "@/lib/reverse-geocode";
import { getRecentLocations, pushRecentLocation, type RecentLocation } from "@/lib/recent-locations";
import { loadDraft, saveDraft, clearDraft, fileToDataUrl, dataUrlToFile } from "@/lib/draft";
import UpvoteButton from "@/components/UpvoteButton";
import VerifyButton from "@/components/VerifyButton";
import SocialShare from "@/components/SocialShare";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

const ICON_MAP: Record<string, React.ElementType> = {
  Trash2, Droplets, AlertTriangle, ShieldAlert, Flame, Lightbulb, Pipette, Building, Volume2, MoreHorizontal,
};

const Index = () => {
  const tx = useUiText();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  

  // Live-refresh recent complaints + stats when new complaints arrive
  const invalidateIndex = useRealtimeInvalidate([["recent-complaints"], ["complaint-stats"]]);
  useEffect(() => {
    const channel = supabase
      .channel("index-complaints-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => {
        invalidateIndex();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [invalidateIndex]);

  // Restore draft on mount (one-shot)
  const initialDraft = useMemo(() => loadDraft() || {}, []);

  const [selectedCategory, setSelectedCategory] = useState<ComplaintCategory | "">(
    (initialDraft.category as ComplaintCategory) || ""
  );
  const [title, setTitle] = useState(initialDraft.title || "");
  const [description, setDescription] = useState(initialDraft.description || "");
  const [location, setLocation] = useState(initialDraft.location || "");
  const [manualLat, setManualLat] = useState(initialDraft.manualLat || "");
  const [manualLng, setManualLng] = useState(initialDraft.manualLng || "");
  const [detectedLat, setDetectedLat] = useState<number | null>(null);
  const [detectedLng, setDetectedLng] = useState<number | null>(null);
  const [priority, setPriority] = useState<string>(initialDraft.priority || "medium");
  const [city, setCity] = useState<string>(() => localStorage.getItem("ct_city") || DEFAULT_CITY);
  const [cityFromProfile, setCityFromProfile] = useState(false);
  const [anonymous, setAnonymous] = useState(initialDraft.anonymous ?? false);
  const [photo, setPhoto] = useState<File | null>(() => {
    if (initialDraft.photoDataUrl && initialDraft.photoName && initialDraft.photoType) {
      return dataUrlToFile(initialDraft.photoDataUrl, initialDraft.photoName, initialDraft.photoType);
    }
    return null;
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(initialDraft.photoDataUrl || null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(initialDraft.photoDataUrl || null);
  const [photoName, setPhotoName] = useState<string | null>(initialDraft.photoName || null);
  const [photoType, setPhotoType] = useState<string | null>(initialDraft.photoType || null);
  const [submitting, setSubmitting] = useState(false);
  const [syncState, setSyncState] = useState<"idle" | "queued" | "failed" | "sent">("idle");
  const [isOnline, setIsOnline] = useState(true);
  const pendingSubmitRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const on = () => {
      setIsOnline(true);
      if (pendingSubmitRef.current) {
        pendingSubmitRef.current = false;
        toast.info(tx("Back online — sending your saved complaint…"));
        formRef.current?.requestSubmit();
      }
    };
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [cityAutoDetecting, setCityAutoDetecting] = useState(false);
  const [detectedAddress, setDetectedAddress] = useState<string | null>(null);
  const [recentLocs, setRecentLocs] = useState<RecentLocation[]>(() => getRecentLocations());
  const [coordsCopied, setCoordsCopied] = useState(false);
  const [draftRestored, setDraftRestored] = useState(Boolean(initialDraft.title || initialDraft.description || initialDraft.photoDataUrl));
  const [classifyingPhoto, setClassifyingPhoto] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ category: ComplaintCategory | null; confidence: number; department: string | null } | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{ count: number; ids: string[] } | null>(null);

  // Auto-save draft (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      saveDraft({
        title, description, category: selectedCategory, priority,
        location, manualLat, manualLng, anonymous,
        photoDataUrl: photoDataUrl ?? undefined,
        photoName: photoName ?? undefined,
        photoType: photoType ?? undefined,
      });
    }, 500);
    return () => clearTimeout(t);
  }, [title, description, selectedCategory, priority, location, manualLat, manualLng, anonymous, photoDataUrl, photoName, photoType]);

  // Load user's home city from profile (overrides default Delhi/localStorage on first load)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("home_city")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const hc = (data as { home_city?: string | null } | null)?.home_city;
      if (hc && hc.trim()) {
        setCity(hc.trim());
        setCityFromProfile(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);


  // Auto-update City + Location via reverse geocoding when coordinates change
  useEffect(() => {
    const latStr = manualLat || (detectedLat !== null ? String(detectedLat) : "");
    const lngStr = manualLng || (detectedLng !== null ? String(detectedLng) : "");
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setCityAutoDetecting(true);
      const { city: matchedCity, address } = await reverseGeocode(lat, lng, controller.signal);
      setCityAutoDetecting(false);

      if (matchedCity && matchedCity !== city && !cityFromProfile) {
        setCity(matchedCity);
      }

      // Only auto-fill Location if it's empty or still showing the raw "lat, lng" string
      if (address) {
        setDetectedAddress(address);
        const trimmed = location.trim();
        const looksLikeCoords = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(trimmed);
        if (!trimmed || looksLikeCoords) {
          setLocation(address);
        }
      }
    }, 600);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualLat, manualLng, detectedLat, detectedLng]);

  const { data: complaints = [] } = useQuery({
    queryKey: ["recent-complaints"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("complaints")
        .select(COMPLAINT_COLS)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["complaint-stats"],
    queryFn: async () => {
      const { count: total } = await supabase.from("complaints").select("id", { count: "exact", head: true });
      const { count: resolved } = await supabase.from("complaints").select("id", { count: "exact", head: true }).eq("status", "resolved");
      return { total: total || 0, resolved: resolved || 0 };
    },
  });

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      if (photoPreview && photoPreview.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
      try {
        const dataUrl = await fileToDataUrl(file);
        setPhotoPreview(dataUrl);
        setPhotoDataUrl(dataUrl);
        setPhotoName(file.name);
        setPhotoType(file.type);
      } catch {
        const previewUrl = URL.createObjectURL(file);
        setPhotoPreview(previewUrl);
      }
      classifyPhoto(file);
    }
  };

  // AI: classify photo → suggest category
  const classifyPhoto = async (file: File) => {
    if (selectedCategory) return; // user already chose
    try {
      setClassifyingPhoto(true);
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data, error } = await invokeFunction("analyze-image", {
        body: { imageUrl: dataUrl },
      });
      if (error) throw error;
      const cat = (data as { category?: string; confidence?: number })?.category;
      const conf = Number((data as { confidence?: number })?.confidence ?? 0);
      if (cat && cat in CATEGORY_CONFIG && conf >= 0.5) {
        // Suggest only — the citizen accepts or picks another category.
        let dept: string | null = null;
        const { data: r } = await supabase.from("city_category_routing")
          .select("departments(name)").ilike("city", city).eq("category", cat).maybeSingle();
        dept = (r as { departments?: { name?: string } | null } | null)?.departments?.name ?? null;
        if (!dept) {
          const { data: f } = await supabase.from("category_routing").select("departments(name)").eq("category", cat).maybeSingle();
          dept = (f as { departments?: { name?: string } | null } | null)?.departments?.name ?? null;
        }
        setAiSuggestion({ category: cat as ComplaintCategory, confidence: conf, department: dept });
      } else {
        setAiSuggestion({ category: null, confidence: conf, department: null });
      }
    } catch (err) {
      console.error("classify-image error:", err);
      setAiSuggestion({ category: null, confidence: 0, department: null });
    } finally {
      setClassifyingPhoto(false);
    }
  };

  // Duplicate detection: same category, ~300m radius, within last 7 days
  const checkDuplicates = async (lat: number | null, lng: number | null) => {
    if (!lat || !lng || !selectedCategory) {
      setDuplicateWarning(null);
      return;
    }
    const { data } = await supabase.rpc("find_nearby_duplicates", {
      _lat: lat, _lng: lng, _category: selectedCategory, _radius_m: 300, _days: 7,
    });
    if (data && data.length > 0) {
      setDuplicateWarning({ count: data.length, ids: data.map((r) => r.complaint_id) });
    } else {
      setDuplicateWarning(null);
    }
  };

  // Re-check duplicates when category or coords change
  useEffect(() => {
    const lat = manualLat ? parseFloat(manualLat) : detectedLat;
    const lng = manualLng ? parseFloat(manualLng) : detectedLng;
    checkDuplicates(
      Number.isFinite(lat as number) ? (lat as number) : null,
      Number.isFinite(lng as number) ? (lng as number) : null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, manualLat, manualLng, detectedLat, detectedLng]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate("/auth"); return; }
    if (!selectedCategory || !description || !location || !title) return;

    setSubmitting(true);
    try {
      let photoUrl: string | null = null;
      if (photo) {
        const ext = photo.name.split(".").pop();
        const filePath = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("complaint-photos").upload(filePath, photo);
        if (!uploadError) {
          photoUrl = photoUrlFor(filePath);
        }
      }

      // Determine lat/lng: prefer manual input, then detected, then parse from location string
      let lat: number | null = null;
      let lng: number | null = null;

      if (manualLat && manualLng) {
        const pLat = parseFloat(manualLat);
        const pLng = parseFloat(manualLng);
        if (Number.isFinite(pLat) && Number.isFinite(pLng) && pLat >= -90 && pLat <= 90 && pLng >= -180 && pLng <= 180) {
          lat = pLat; lng = pLng;
        }
      }
      if (lat === null && detectedLat !== null && detectedLng !== null) {
        lat = detectedLat; lng = detectedLng;
      }
      if (lat === null) {
        const numericMatches = location.match(/-?\d+(?:\.\d+)?/g);
        if (numericMatches && numericMatches.length >= 2) {
          const parsedLat = Number.parseFloat(numericMatches[0]);
          const parsedLng = Number.parseFloat(numericMatches[1]);
          if (Number.isFinite(parsedLat) && parsedLat >= -90 && parsedLat <= 90 && Number.isFinite(parsedLng) && parsedLng >= -180 && parsedLng <= 180) {
            lat = parsedLat; lng = parsedLng;
          }
        }
      }

      const { data, error } = await supabase.from("complaints").insert({
        user_id: user.id, title, description, category: selectedCategory, priority,
        photo_url: photoUrl, location, anonymous, city,
        latitude: lat, longitude: lng,
        submitted_by: anonymous ? "Anonymous" : user.user_metadata?.full_name || user.email || "Citizen",
      }).select("id, complaint_id").single();

      if (error) throw error;

      // Save recent location
      if (lat !== null && lng !== null) {
        pushRecentLocation({ label: location, lat, lng });
        setRecentLocs(getRecentLocations());
      }

      // Generate AI summary in background (non-blocking)
      invokeFunction("generate-summary", {
        body: { complaint_id: data.id, title, description, category: selectedCategory, location, priority },
      }).catch((err) => console.error("AI summary error:", err));

      // Green points are awarded by the database when the complaint is saved.

      setSyncState("sent");
      setSubmittedId(data.complaint_id);
      setSubmitted(true);
      setTitle(""); setDescription(""); setLocation(""); setSelectedCategory("");
      setManualLat(""); setManualLng(""); setDetectedLat(null); setDetectedLng(null); setDetectedAddress(null);
      setPriority("medium"); setAnonymous(false); setPhoto(null); setPhotoPreview(null);
      setPhotoDataUrl(null); setPhotoName(null); setPhotoType(null);
      setDuplicateWarning(null); setDraftRestored(false);
      clearDraft();
      localStorage.setItem("ct_city", city);
      setTimeout(() => setSubmitted(false), 5000);
    } catch (err) {
      console.error("Submit error:", err);
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      const networkish = offline || (err instanceof TypeError) || /fetch|network/i.test(String((err as Error)?.message ?? err));
      if (networkish) {
        pendingSubmitRef.current = true;
        setSyncState("queued");
        toast.warning(tx("You're offline. Your complaint is saved on this phone and will be sent automatically when you're back online."));
      } else {
        setSyncState("failed");
        toast.error(tx("Could not submit complaint. Your draft is saved — please try again."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const copyCoords = async () => {
    const lat = manualLat || (detectedLat !== null ? String(detectedLat) : "");
    const lng = manualLng || (detectedLng !== null ? String(detectedLng) : "");
    if (!lat || !lng) return;
    try {
      await navigator.clipboard.writeText(`${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`);
      setCoordsCopied(true);
      toast.success(tx("Coordinates copied"));
      setTimeout(() => setCoordsCopied(false), 2000);
    } catch {
      toast.error(tx("Could not copy coordinates"));
    }
  };

  const applyRecentLocation = (r: RecentLocation) => {
    setLocation(r.label);
    setManualLat(r.lat.toFixed(6));
    setManualLng(r.lng.toFixed(6));
    setDetectedLat(r.lat);
    setDetectedLng(r.lng);
    toast.success(tx("Recent location applied"));
  };

  const discardDraft = () => {
    clearDraft();
    setTitle(""); setDescription(""); setLocation(""); setSelectedCategory("");
    setManualLat(""); setManualLng(""); setPriority("medium"); setAnonymous(false);
    setDraftRestored(false);
    toast.success(tx("Draft discarded"));
  };


  const [gettingLocation, setGettingLocation] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [showCameraPrompt, setShowCameraPrompt] = useState(false);

  // Auto-detect location on mount
  useEffect(() => {
    if (location) return; // Already have location
    if (!navigator.geolocation) return;
    const tryAutoDetect = async () => {
      try {
        if (navigator.permissions) {
          const status = await navigator.permissions.query({ name: "geolocation" });
          if (status.state === "granted") {
            requestLocation();
          }
        }
      } catch {}
    };
    tryAutoDetect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkAndRequestLocation = async () => {
    if (gettingLocation) return;
    if (!navigator.geolocation) { toast.error(tx("Geolocation is not supported by your browser")); return; }
    try {
      if (navigator.permissions) {
        const status = await navigator.permissions.query({ name: "geolocation" });
        if (status.state === "denied") { setShowLocationPrompt(true); return; }
        if (status.state === "prompt") { setShowLocationPrompt(true); return; }
        requestLocation(); return;
      }
    } catch {}
    setShowLocationPrompt(true);
  };

  const requestLocation = () => {
    setShowLocationPrompt(false);
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setDetectedLat(lat);
        setDetectedLng(lng);
        setLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        setManualLat(lat.toFixed(6));
        setManualLng(lng.toFixed(6));
        setGettingLocation(false);
        toast.success(tx("📍 Location detected!"));
      },
      () => { setGettingLocation(false); setShowLocationPrompt(true); },
      { timeout: 15000, maximumAge: 300000, enableHighAccuracy: true }
    );
  };

  const checkAndRequestCamera = async () => {
    try {
      if (navigator.permissions) {
        const status = await navigator.permissions.query({ name: "camera" as PermissionName });
        if (status.state === "denied") { setShowCameraPrompt(true); return; }
        if (status.state === "prompt") { setShowCameraPrompt(true); return; }
        openCamera(); return;
      }
    } catch {}
    setShowCameraPrompt(true);
  };

  const openCamera = async () => {
    setShowCameraPrompt(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } });
      streamRef.current = stream;
      setShowCamera(true);
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); } }, 100);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") setShowCameraPrompt(true);
        else toast.error(`Could not access camera: ${error.message}`);
      }
    }
  };

  const handleCaptureSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    canvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
        setPhoto(file);
        if (photoPreview && photoPreview.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
        try {
          const dataUrl = await fileToDataUrl(file);
          setPhotoPreview(dataUrl);
          setPhotoDataUrl(dataUrl);
          setPhotoName(file.name);
          setPhotoType(file.type);
        } catch {
          setPhotoPreview(URL.createObjectURL(file));
        }
        handleCloseCamera();
        toast.success(tx("📸 Photo captured!"));
      }
    }, "image/jpeg", 0.9);
  };

  const handleCloseCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((track) => track.stop()); streamRef.current = null; }
    setShowCamera(false);
  };

  const timeAgo = (dateStr: string) => {
    const hours = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3600000);
    if (hours < 1) return t("common.justNow");
    if (hours < 24) return `${hours}${t("common.hAgo")}`;
    return `${Math.floor(hours / 24)}${t("common.dAgo")}`;
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBg} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-primary/80" />
        </div>
        <div className="relative container py-16 md:py-24">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-2xl">
            <h1 className="font-display text-3xl md:text-5xl font-extrabold text-primary-foreground leading-tight mb-4">
              {t("hero.title1")} <br />
              <span className="text-secondary">{t("hero.title2")}</span>
            </h1>
            <p className="text-primary-foreground/80 text-lg md:text-xl mb-8 leading-relaxed">{t("hero.subtitle")}</p>
            <div className="flex flex-wrap gap-3">
              <a href="#submit" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg gradient-accent text-accent-foreground font-semibold shadow-elevated transition-transform hover:scale-105">
                <Camera className="w-5 h-5" /> {t("hero.submitComplaint")}
              </a>
              <a href="#feed" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary-foreground/10 text-primary-foreground border border-primary-foreground/20 font-semibold backdrop-blur-sm hover:bg-primary-foreground/20 transition-colors">
                {t("hero.viewComplaints")} <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="mt-12 grid grid-cols-3 gap-4 max-w-lg">
            {[
              { label: t("hero.totalComplaints"), value: String(stats?.total ?? "—"), icon: TrendingUp },
              { label: t("hero.resolved"), value: String(stats?.resolved ?? "—"), icon: ThumbsUp },
              { label: t("hero.avgResolution"), value: language === "hi" ? "36 घंटे" : "36 hrs", icon: Clock },
            ].map((s) => (
              <div key={s.label} className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-3 text-center border border-primary-foreground/10">
                <s.icon className="w-5 h-5 text-secondary mx-auto mb-1" />
                <div className="font-display font-bold text-xl text-primary-foreground">{s.value}</div>
                <div className="text-[11px] text-primary-foreground/60">{tx(s.label)}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Complaint Form */}
      <section id="submit" className="container py-12 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-2xl mx-auto">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">{t("form.submitComplaint")}</h2>
          <p className="text-muted-foreground mb-6">{user ? t("form.uploadDesc") : t("form.signInToSubmit")}</p>

          {submitted && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-6 p-4 rounded-lg bg-success/10 border border-success/30 text-success font-medium">
              ✅ {t("form.complaintSubmitted")} <span className="font-mono font-bold">#{submittedId}</span>
            </motion.div>
          )}

          {(!isOnline || syncState === "queued" || syncState === "failed") && !submitted && (
            <div role="status" className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
              {!isOnline ? tx("Offline — your draft is saved on this device. ") : ""}
              {syncState === "queued" ? tx("Waiting to send: your complaint will upload automatically when the connection returns.") : syncState === "failed" ? tx("Last attempt failed. Your draft is safe — tap Submit to retry.") : tx("You can keep filling the form.")}
            </div>
          )}
          {draftRestored && !submitted && (
            <div className="mb-4 p-3 rounded-lg bg-info/10 border border-info/30 text-foreground text-sm flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <History className="w-4 h-4 text-info" />
                {tx(" Draft restored from your last session ")}</span>
              <button
                type="button"
                onClick={discardDraft}
                className="text-xs text-muted-foreground hover:text-destructive underline-offset-2 hover:underline"
              >
                {tx(" Discard ")}</button>
            </div>
          )}

          {/* Step progress indicator (sticky) */}
          {!submitted && (() => {
            const steps = [
              { label: "Category", done: Boolean(selectedCategory), targetId: "step-category" },
              { label: "Details", done: Boolean(title && description), targetId: "step-details" },
              { label: "Photo", done: Boolean(photo), targetId: "step-photo" },
              { label: "Location", done: Boolean(location), targetId: "step-location" },
            ];
            const completed = steps.filter((s) => s.done).length;
            const currentIdx = steps.findIndex((s) => !s.done);
            const jumpTo = (id: string) => {
              const el = document.getElementById(id);
              if (!el) return;
              el.scrollIntoView({ behavior: "smooth", block: "start" });
              const focusable = el.querySelector<HTMLElement>(
                "input, textarea, button, [tabindex]:not([tabindex='-1'])"
              );
              focusable?.focus({ preventScroll: true });
            };
            return (
              <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-6 bg-background/85 backdrop-blur-md border-b border-border/60 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  {steps.map((s, i) => {
                    const isCurrent = i === currentIdx;
                    return (
                      <div key={s.label} className="flex items-center gap-2 flex-1">
                        <button
                          type="button"
                          onClick={() => jumpTo(s.targetId)}
                          aria-label={`Go to step ${i + 1}: ${s.label}${s.done ? " (completed)" : ""}`}
                          title={`Jump to ${s.label}`}
                          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background cursor-pointer ${
                            s.done
                              ? "bg-success border-success text-success-foreground hover:bg-success/90"
                              : isCurrent
                              ? "bg-primary/10 border-primary text-primary hover:bg-primary/20"
                              : "bg-card border-border text-muted-foreground hover:border-primary hover:text-foreground"
                          }`}
                        >
                          {s.done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                        </button>
                        {i < steps.length - 1 && (
                          <div className={`flex-1 h-0.5 rounded ${steps[i + 1].done || s.done ? "bg-success" : "bg-border"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-xs gap-2">
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{completed}</span> {tx(" of ")}{steps.length} {tx(" completed ")}</p>
                  {completed === steps.length ? (
                    <span className="text-success font-medium">{tx("✓ Ready to submit")}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => jumpTo(steps[currentIdx].targetId)}
                      className="text-primary hover:underline font-medium"
                    >
                      {tx(" Next: ")}{tx(steps[currentIdx]?.label)} →
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
            <div id="step-details" className="scroll-mt-44">
              <label className="block text-sm font-medium text-foreground mb-2">{t("form.title")} *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("form.titlePlaceholder")} className="w-full rounded-lg border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" required />
            </div>

            <div id="step-category" className="scroll-mt-44">
              <label className="block text-sm font-medium text-foreground mb-2">{t("form.category")} *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                  const Icon = ICON_MAP[config.icon] || MoreHorizontal;
                  return (
                    <button key={key} type="button" onClick={() => setSelectedCategory(key as ComplaintCategory)}
                      className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${selectedCategory === key ? "border-secondary bg-secondary/10 text-foreground shadow-card" : "border-border bg-card text-muted-foreground hover:border-secondary/50"}`}>
                      <Icon className="w-4 h-4 shrink-0" /> {language === "hi" ? CATEGORY_LABEL_HI[key as ComplaintCategory] : config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-foreground">{t("form.description")} *</label>
                <VoiceDictate
                  onTranscribed={(text) =>
                    setDescription((prev) => (prev ? `${prev.trim()} ${text}` : text))
                  }
                />
              </div>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={t("form.descPlaceholder")} className="w-full rounded-lg border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" required />
              <p className="text-xs text-muted-foreground mt-1">{tx("Tap the mic to dictate your complaint.")}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t("form.priority")}</label>
              <div className="flex gap-2">
                {(["low", "medium", "high", "emergency"] as const).map((p) => (
                  <button key={p} type="button" onClick={() => setPriority(p)}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold capitalize transition-all ${priority === p ? p === "emergency" ? "border-destructive bg-destructive/10 text-destructive" : p === "high" ? "border-warning bg-warning/10 text-warning" : "border-secondary bg-secondary/10 text-foreground" : "border-border bg-card text-muted-foreground"}`}>
                    {tx(p)}
                  </button>
                ))}
              </div>
            </div>

            {cityAutoDetecting && (
              <p className="text-xs text-muted-foreground">{tx("Detecting city from coordinates…")}</p>
            )}

            <div id="step-photo" className="scroll-mt-44">
              <label className="block text-sm font-medium text-foreground mb-2">{t("form.photo")}</label>
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />

              {showCamera && (
                <div className="relative rounded-lg overflow-hidden border-2 border-secondary mb-3 bg-black">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-64 object-cover" />
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                    <button type="button" onClick={handleCaptureSnapshot} className="px-5 py-2.5 rounded-full bg-secondary text-secondary-foreground font-semibold shadow-elevated flex items-center gap-2">
                      <Camera className="w-4 h-4" /> {t("form.capture")}
                    </button>
                    <button type="button" onClick={handleCloseCamera} className="px-4 py-2.5 rounded-full bg-destructive text-destructive-foreground font-semibold shadow-elevated">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {photoPreview ? (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img src={photoPreview} alt={tx("Preview")} className="w-full h-48 object-cover" />
                  <button type="button" onClick={() => { setPhoto(null); setPhotoPreview(null); setPhotoDataUrl(null); setPhotoName(null); setPhotoType(null); }} className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive text-destructive-foreground">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {classifyingPhoto && (
                    <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md flex items-center gap-1.5 backdrop-blur-sm">
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                      {tx(" AI suggesting category… ")}</div>
                  )}
                </div>
              ) : !showCamera && (
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={checkAndRequestCamera} className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-secondary hover:text-secondary transition-colors">
                    <Camera className="w-8 h-8" />
                    <span className="text-sm font-medium">{t("form.takeLivePhoto")}</span>
                    <span className="text-xs">{t("form.openCamera")}</span>
                  </button>
                  <button type="button" onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-secondary hover:text-secondary transition-colors">
                    <Image className="w-8 h-8" />
                    <span className="text-sm font-medium">{t("form.chooseGallery")}</span>
                    <span className="text-xs">{t("form.jpgPng")}</span>
                  </button>
                </div>
              )}
              {photoPreview && aiSuggestion && !selectedCategory && (
                <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                  {aiSuggestion.category ? (
                    <>
                      <p className="text-foreground">
                        <Sparkles className="inline w-3.5 h-3.5 text-primary mr-1" />
                        {tx(" AI suggests ")}<b>{tx(CATEGORY_CONFIG[aiSuggestion.category].label)}</b> ({Math.round(aiSuggestion.confidence * 100)}{tx("% sure) ")}{aiSuggestion.department && <> → {aiSuggestion.department}</>}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button type="button" onClick={() => { setSelectedCategory(aiSuggestion.category!); setAiSuggestion(null); }}
                          className="px-3 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground">{tx("Accept")}</button>
                        <button type="button" onClick={() => setAiSuggestion(null)}
                          className="px-3 py-1.5 rounded-lg text-xs bg-muted text-muted-foreground">{tx("I'll choose myself")}</button>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground">{tx("Couldn't identify the issue from the photo — please choose a category below.")}</p>
                  )}
                </div>
              )}
            </div>

            <div id="step-location" className="scroll-mt-44">
              <label className="block text-sm font-medium text-foreground mb-2">{t("form.location")} *</label>

              {/* Address autocomplete search */}
              <div className="mb-2">
                <AddressAutocomplete
                  value={location}
                  onChange={(v) => {
                    setLocation(v);
                    setDetectedLat(null);
                    setDetectedLng(null);
                  }}
                  onPick={(s) => {
                    setLocation(s.short_name || s.display_name);
                    setManualLat(s.lat.toFixed(6));
                    setManualLng(s.lng.toFixed(6));
                    setDetectedLat(s.lat);
                    setDetectedLng(s.lng);
                    toast.success(tx("Address picked"));
                  }}
                  required
                />
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={checkAndRequestLocation}
                  disabled={gettingLocation}
                  className="h-10 px-3 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 text-sm font-medium flex items-center gap-1.5"
                  title={tx("Use my current location")}
                >
                  {gettingLocation ? (
                    <span className="w-4 h-4 block border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <Locate className="w-4 h-4" />
                  )}
                  {tx(" Use my location ")}</button>
                <button
                  type="button"
                  onClick={() => setShowMapPicker(!showMapPicker)}
                  className={`h-10 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1.5 ${showMapPicker ? "border-primary bg-primary/10 text-primary" : "border-input bg-card text-muted-foreground hover:border-primary/50"}`}
                  title={tx("Pick on map")}
                >
                  <MapPin className="w-4 h-4" />
                  {tx(" Pick on map ")}</button>
                {(manualLat || detectedLat !== null) && (
                  <button
                    type="button"
                    onClick={copyCoords}
                    className="h-10 px-3 rounded-lg border border-input bg-card text-muted-foreground hover:border-primary/50 hover:text-primary text-sm font-medium transition-colors flex items-center gap-1.5"
                    title={tx("Copy coordinates")}
                  >
                    {coordsCopied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    {coordsCopied ? tx("Copied") : tx("Copy coords")}
                  </button>
                )}
              </div>

              {/* Recent locations */}
              {recentLocs.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {tx(" Recent locations ")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {recentLocs.map((r, i) => (
                      <button
                        key={`${r.lat},${r.lng},${i}`}
                        type="button"
                        onClick={() => applyRecentLocation(r)}
                        className="px-2.5 py-1 rounded-full bg-muted text-foreground hover:bg-accent hover:text-accent-foreground text-xs font-medium border border-border transition-colors max-w-[200px] truncate"
                        title={r.label}
                      >
                        📍 {r.label.split(",")[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {detectedLat !== null && detectedLng !== null && !showMapPicker && (
                <p className="text-xs text-success mt-2">{tx("📍 Auto-detected: ")}{detectedLat.toFixed(4)}, {detectedLng.toFixed(4)}</p>
              )}
              {manualLat && manualLng && !showMapPicker && detectedLat === null && (
                <p className="text-xs text-muted-foreground mt-2">{tx("📍 Coordinates: ")}{parseFloat(manualLat).toFixed(4)}, {parseFloat(manualLng).toFixed(4)}</p>
              )}
              <WardPreview
                lat={manualLat ? parseFloat(manualLat) : detectedLat}
                lng={manualLng ? parseFloat(manualLng) : detectedLng}
              />
              {detectedAddress && location.trim() !== detectedAddress && (
                <button
                  type="button"
                  onClick={() => setLocation(detectedAddress)}
                  className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1"
                >
                  {tx(" ↩ Reset to detected address ")}</button>
              )}

              {/* Map thumbnail preview */}
              {!showMapPicker && (() => {
                const lat = manualLat ? parseFloat(manualLat) : detectedLat;
                const lng = manualLng ? parseFloat(manualLng) : detectedLng;
                if (!Number.isFinite(lat as number) || !Number.isFinite(lng as number)) return null;
                return (
                  <div className="mt-3">
                    <MapThumbnail
                      lat={lat as number}
                      lng={lng as number}
                      onClick={() => setShowMapPicker(true)}
                    />
                  </div>
                );
              })()}
            </div>

            {/* Duplicate warning */}
            {duplicateWarning && (
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-foreground text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-warning">{tx("Possible duplicate")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {duplicateWarning.count} {tx(" similar ")}{selectedCategory && CATEGORY_CONFIG[selectedCategory as ComplaintCategory]?.label && tx(CATEGORY_CONFIG[selectedCategory as ComplaintCategory].label)} {tx(" complaint")}{language === "en" && duplicateWarning.count > 1 ? "s" : ""} {tx(" reported nearby in the last 7 days ")}{duplicateWarning.ids.length > 0 && <> ({duplicateWarning.ids.slice(0, 2).map((id) => `#${id}`).join(", ")})</>}{tx(". Please check before submitting. ")}</p>
                </div>
              </div>
            )}

            {showMapPicker && (
              <div className="w-full max-w-full overflow-hidden">
                <Suspense fallback={null}><LocationMapPicker
                  lat={manualLat}
                  lng={manualLng}
                  onSelect={(lat, lng) => {
                    setManualLat(lat);
                    setManualLng(lng);
                    setLocation(`${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`);
                    setShowMapPicker(false);
                  }}
                  onClose={() => setShowMapPicker(false)}
                /></Suspense>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{tx("Coordinates ")}<span className="text-muted-foreground font-normal">{tx("(optional)")}</span></label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={manualLat} onChange={(e) => setManualLat(e.target.value)} placeholder={tx("Latitude (e.g. 24.6018)")} type="number" step="any" className="rounded-lg border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                <input value={manualLng} onChange={(e) => setManualLng(e.target.value)} placeholder={tx("Longitude (e.g. 77.2931)")} type="number" step="any" className="rounded-lg border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{tx("Enter manually (city updates automatically).")}</p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="rounded border-input" />
              <span className="text-sm text-muted-foreground">{t("form.anonymous")}</span>
            </label>

            <button type="submit" disabled={!selectedCategory || !description || !location || !title || submitting} className="w-full py-3.5 rounded-lg gradient-accent text-accent-foreground font-semibold text-base flex items-center justify-center gap-2 shadow-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:scale-[1.02] active:scale-[0.98]">
              <Send className="w-5 h-5" /> {submitting ? t("form.submitting") : user ? t("form.submit") : t("form.signInSubmit")}
            </button>
          </form>
        </motion.div>
      </section>

      {/* Recent Complaints Feed */}
      <section id="feed" className="bg-muted/50 py-12 md:py-16">
        <div className="container">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">{t("recent.title")}</h2>
              <p className="text-muted-foreground text-sm mt-1">{t("recent.subtitle")}</p>
            </div>
          </div>

          {complaints.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium">{t("recent.noComplaints")}</p>
              <p className="text-sm">{t("recent.beFirst")}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {complaints.map((c: any, i: number) => {
                const catConfig = CATEGORY_CONFIG[c.category as ComplaintCategory];
                const statusConfig = STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG];
                const Icon = ICON_MAP[catConfig?.icon] || MoreHorizontal;
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => navigate(`/complaints/${c.complaint_id}`)}
                    role="link"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/complaints/${c.complaint_id}`);
                      }
                    }}
                    className="bg-card rounded-xl border border-border p-4 md:p-5 shadow-card hover:shadow-elevated hover:border-primary/30 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: (catConfig?.color || "hsl(var(--muted))") + "18" }}>
                        <Icon className="w-5 h-5" style={{ color: catConfig?.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-mono text-muted-foreground">#{c.complaint_id}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: (statusConfig?.color || "") + "18", color: statusConfig?.color }}>{tx(statusConfig?.label)}</span>
                          {c.priority === "emergency" && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">🚨 {t("common.emergency")}</span>}
                        </div>
                        <h3 className="font-semibold text-foreground text-sm md:text-base">{c.title}</h3>
                        {c.ai_summary ? (
                          <p className="text-xs md:text-sm mt-1 px-2.5 py-1.5 rounded-lg bg-primary/5 border border-primary/10 text-foreground/80 italic flex items-start gap-1.5">
                            <span className="text-primary font-semibold text-[10px] uppercase tracking-wider mt-0.5 shrink-0">{tx("AI")}</span>
                            {c.ai_summary}
                          </p>
                        ) : (
                          <p className="text-muted-foreground text-xs md:text-sm mt-1 line-clamp-2">{c.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {c.location}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {timeAgo(c.created_at)}</span>
                          <UpvoteButton complaintId={c.id} upvotes={c.upvotes || 0} />
                          <VerifyButton complaintId={c.id} verificationCount={c.verification_count || 0} />
                          <SocialShare title={c.title} complaintId={c.complaint_id} />
                        </div>
                      </div>
                      {c.photo_url && (
                        <div className="relative group shrink-0 hidden sm:block">
                          <div className="w-20 h-20 rounded-xl overflow-hidden ring-2 ring-primary/20 shadow-lg group-hover:ring-primary/40 transition-all duration-300 group-hover:shadow-xl group-hover:scale-105">
                            <img src={c.photo_url} alt={tx("Complaint photo")} className="w-full h-full object-cover" />
                          </div>
                          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider shadow-md whitespace-nowrap">
                            <Camera className="w-2.5 h-2.5" /> {tx(" Photo ")}</span>
                        </div>
                      )}
                    </div>
                    {c.photo_url && (
                      <div className="sm:hidden mt-3 relative group">
                        <div className="w-full h-40 rounded-xl overflow-hidden ring-2 ring-primary/20 shadow-lg">
                          <img src={c.photo_url} alt={tx("Complaint photo")} className="w-full h-full object-cover" />
                        </div>
                        <span className="absolute top-2 left-2 flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/90 text-primary-foreground text-[10px] font-bold uppercase tracking-wider shadow-md backdrop-blur-sm">
                          <Camera className="w-3 h-3" /> {tx(" Photo ")}</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="container py-12 md:py-16">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground text-center mb-10">{t("howItWorks.title")}</h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {[
            { step: "1", title: t("howItWorks.step1Title"), desc: t("howItWorks.step1Desc") },
            { step: "2", title: t("howItWorks.step2Title"), desc: t("howItWorks.step2Desc") },
            { step: "3", title: t("howItWorks.step3Title"), desc: t("howItWorks.step3Desc") },
          ].map((item) => (
            <motion.div key={item.step} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center">
              <div className="w-14 h-14 rounded-full gradient-accent text-accent-foreground flex items-center justify-center font-display font-bold text-xl mx-auto mb-4 shadow-elevated">{item.step}</div>
              <h3 className="font-display font-semibold text-foreground mb-2">{item.title}</h3>
              <p className="text-muted-foreground text-sm">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <PermissionPrompt type="camera" visible={showCameraPrompt} onAllow={openCamera} onDismiss={() => setShowCameraPrompt(false)} />
      <PermissionPrompt type="location" visible={showLocationPrompt} onAllow={requestLocation} onDismiss={() => setShowLocationPrompt(false)} />
    </Layout>
  );
};

export default Index;
