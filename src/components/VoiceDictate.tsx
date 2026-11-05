import { invokeFunction } from "@/lib/invoke-function";
import { useRef, useState } from "react";
import { Mic, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  onTranscribed: (text: string) => void;
}

const VoiceDictate = ({ onTranscribed }: Props) => {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) {
          setProcessing(false);
          return;
        }
        setProcessing(true);
        try {
          const buf = await blob.arrayBuffer();
          // Convert to base64 in chunks to avoid call-stack overflow
          const bytes = new Uint8Array(buf);
          let binary = "";
          const CHUNK = 0x8000;
          for (let i = 0; i < bytes.length; i += CHUNK) {
            binary += String.fromCharCode.apply(
              null,
              Array.from(bytes.subarray(i, i + CHUNK)) as unknown as number[],
            );
          }
          const base64 = btoa(binary);

          const { data, error } = await invokeFunction("voice-stt", {
            body: { audio: base64, mimeType: "audio/webm" },
          });
          if (error) throw error;
          const text = (data as { text?: string; error?: string })?.text;
          if (data?.error) throw new Error(data.error);
          if (text) {
            onTranscribed(text);
            toast.success("Voice transcribed");
          } else {
            toast.error("Could not transcribe audio");
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Transcription failed";
          toast.error(msg);
        } finally {
          setProcessing(false);
        }
      };
      mr.start();
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stop = () => {
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
    setRecording(false);
  };

  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      disabled={processing}
      title={recording ? "Stop recording" : "Dictate description"}
      className={`shrink-0 h-10 w-10 rounded-lg flex items-center justify-center border transition-all ${
        recording
          ? "border-destructive bg-destructive text-destructive-foreground animate-pulse"
          : processing
            ? "border-input bg-muted text-muted-foreground"
            : "border-input bg-card text-muted-foreground hover:border-primary hover:text-primary"
      }`}
    >
      {processing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : recording ? (
        <Square className="w-4 h-4 fill-current" />
      ) : (
        <Mic className="w-4 h-4" />
      )}
    </button>
  );
};

export default VoiceDictate;
