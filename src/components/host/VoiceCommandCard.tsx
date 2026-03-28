"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, CheckCircle, AlertCircle } from "lucide-react";

type VoiceState = "idle" | "listening" | "transcribing" | "ready" | "unsupported";

interface VoiceCommandCardProps {
  onTranscript?: (text: string) => void;
}

// ─── SpeechRecognition types ──────────────────────────────────────────────────

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

// ─── TTS confirmation helper ──────────────────────────────────────────────────

function speakConfirmation(text: string) {
  if (!("speechSynthesis" in window)) return;
  const short = text.length > 40 ? text.slice(0, 40) + "…" : text;
  const utterance = new SpeechSynthesisUtterance(
    `Got it. ${short}. Breaking this into subtasks now.`
  );
  utterance.rate = 1.1;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VoiceCommandCard({ onTranscript }: VoiceCommandCardProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const dispatchedRef = useRef(false);

  // Check for browser support on mount
  useEffect(() => {
    const SpeechRecAPI =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecAPI) {
      setVoiceState("unsupported");
    }
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setInterimTranscript("");
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecAPI =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecAPI) return;

    const recognition = new SpeechRecAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;
    dispatchedRef.current = false;

    recognition.onstart = () => {
      setVoiceState("listening");
      setTranscript("");
      setInterimTranscript("");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) {
        setTranscript((prev) => (prev + " " + final).trim());
        setInterimTranscript("");
      }
      if (interim) {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("[voice] recognition error:", event.error);
      if (event.error === "not-allowed") {
        setVoiceState("unsupported");
      } else {
        setVoiceState("idle");
      }
    };

    recognition.onend = () => {
      setInterimTranscript("");
      setVoiceState((prev) => {
        if (prev === "listening" || prev === "transcribing") {
          return transcript ? "ready" : "idle";
        }
        return prev;
      });
    };

    recognition.start();
  }, [transcript]);

  const handleMicClick = () => {
    if (voiceState === "idle" || voiceState === "ready") {
      startListening();
    } else if (voiceState === "listening" || voiceState === "transcribing") {
      stopListening();
    }
  };

  const handleDispatch = () => {
    if (!transcript.trim() || dispatchedRef.current) return;
    dispatchedRef.current = true;
    speakConfirmation(transcript);
    onTranscript?.(transcript.trim());
    setVoiceState("idle");
    setTranscript("");
    setInterimTranscript("");
  };

  // Auto-transition to ready when transcript is non-empty and recognition ends
  const displayText = transcript + (interimTranscript ? " " + interimTranscript : "");

  const stateLabel: Partial<Record<VoiceState, string>> = {
    idle: "Tap to speak",
    listening: "Listening…",
    transcribing: "Transcribing…",
    ready: "Ready to dispatch",
    unsupported: "Not available",
  };

  return (
    <div className="bg-[#120B09] border border-[#EF8354]/20 rounded-sm p-6 hover:border-[#EF8354]/40 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 font-[Inter,sans-serif] mb-1">
            Voice Command
          </p>
          <h3 className="text-sm font-black text-white tracking-tight uppercase">
            Hey Clementine
          </h3>
        </div>
        <span
          className={`text-[10px] font-black uppercase tracking-widest font-[Inter,sans-serif] transition-colors ${
            voiceState === "listening"
              ? "text-[#EF8354]"
              : voiceState === "ready"
              ? "text-green-400"
              : voiceState === "unsupported"
              ? "text-red-400"
              : "text-white/30"
          }`}
        >
          {stateLabel[voiceState]}
        </span>
      </div>

      {/* Mic button */}
      <div className="flex justify-center my-5">
        <div className="relative flex items-center justify-center">
          {voiceState === "listening" && (
            <>
              <div className="absolute w-20 h-20 rounded-full border border-[#EF8354]/40 pulse-ring" />
              <div
                className="absolute w-20 h-20 rounded-full border border-[#EF8354]/20 pulse-ring"
                style={{ animationDelay: "0.5s" }}
              />
            </>
          )}
          <button
            onClick={handleMicClick}
            disabled={voiceState === "unsupported"}
            className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:cursor-not-allowed ${
              voiceState === "listening"
                ? "bg-[#EF8354] shadow-lg shadow-[#EF8354]/30"
                : voiceState === "ready"
                ? "bg-green-700 shadow-lg shadow-green-700/30"
                : voiceState === "unsupported"
                ? "bg-white/5"
                : "bg-white/10 hover:bg-white/15"
            }`}
          >
            {voiceState === "transcribing" ? (
              <Loader2 size={22} className="text-[#EF8354] animate-spin" />
            ) : voiceState === "ready" ? (
              <CheckCircle size={22} className="text-white" />
            ) : voiceState === "listening" ? (
              <Mic size={22} className="text-white" />
            ) : voiceState === "unsupported" ? (
              <AlertCircle size={20} className="text-red-400/60" />
            ) : (
              <MicOff size={22} className="text-white/40" />
            )}
          </button>
        </div>
      </div>

      {/* Transcript display */}
      <div className="min-h-[44px] bg-white/5 rounded-sm px-3 py-2 border border-white/5">
        {displayText ? (
          <p className="text-white/80 text-xs leading-relaxed font-medium">
            &ldquo;{displayText}
            {voiceState === "listening" && (
              <span className="inline-block w-0.5 h-3.5 bg-[#EF8354] ml-0.5 animate-pulse align-middle" />
            )}
            &rdquo;
          </p>
        ) : voiceState === "unsupported" ? (
          <p className="text-red-400/60 text-xs italic font-[Inter,sans-serif]">
            Speech recognition not available in this browser.
          </p>
        ) : (
          <p className="text-white/20 text-xs italic font-[Inter,sans-serif]">
            Say &ldquo;Hey Clementine, …&rdquo; to begin
          </p>
        )}
      </div>

      {/* Dispatch button */}
      {(voiceState === "ready" || (transcript && voiceState === "idle")) && (
        <button
          onClick={handleDispatch}
          className="mt-3 w-full py-2.5 bg-[#EF8354] text-white text-[10px] font-black uppercase tracking-widest rounded-sm hover:brightness-110 transition-all font-[Inter,sans-serif]"
        >
          Dispatch Task →
        </button>
      )}

      {/* Stop button while listening */}
      {voiceState === "listening" && (
        <button
          onClick={stopListening}
          className="mt-3 w-full py-2.5 bg-white/10 text-white/60 text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-white/15 transition-all font-[Inter,sans-serif]"
        >
          Stop Listening
        </button>
      )}
    </div>
  );
}
