"use client";

import { useCallback, useRef, useState } from "react";
import { Mic, MicOff, CheckCircle, AlertCircle, Send, ChevronDown, Zap } from "lucide-react";

type VoiceState = "idle" | "listening" | "ready" | "unsupported";

interface CommandDispatchCardProps {
  onSubmit?: (command: string) => void;
}

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

const SAMPLE_COMMANDS = [
  "Run distributed neural net analysis on dataset ambrosia-v4",
  "Compute the fibonacci sequence till the 9999th number",
  "Render fractal sequence B at 4K resolution",
  "Scan and classify images in flora-v2 dataset",
  "Benchmark all connected worker nodes",
];

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function speakConfirmation(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const short = text.length > 40 ? text.slice(0, 40) + "…" : text;
  const utterance = new SpeechSynthesisUtterance(
    `Got it. ${short}. Breaking this into subtasks now.`
  );
  utterance.rate = 1.1;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

export function CommandDispatchCard({ onSubmit }: CommandDispatchCardProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>(() =>
    getSpeechRecognitionConstructor() ? "idle" : "unsupported"
  );
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const dispatchedRef = useRef(false);
  const transcriptRef = useRef("");

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecAPI = getSpeechRecognitionConstructor();
    if (!SpeechRecAPI) return;

    const recognition = new SpeechRecAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;
    dispatchedRef.current = false;

    recognition.onstart = () => {
      setVoiceState("listening");
      transcriptRef.current = "";
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        const nextTranscript = `${transcriptRef.current} ${final}`.trim();
        transcriptRef.current = nextTranscript;
        setValue(nextTranscript);
      }
      if (interim) {
        setValue(`${transcriptRef.current} ${interim}`.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "not-allowed") {
        setVoiceState("unsupported");
      } else {
        setVoiceState("idle");
      }
    };

    recognition.onend = () => {
      setVoiceState((prev) =>
        prev === "listening" ? (transcriptRef.current ? "ready" : "idle") : prev
      );
    };

    recognition.start();
  }, []);

  const handleMicClick = () => {
    if (voiceState === "idle" || voiceState === "ready") {
      startListening();
    } else if (voiceState === "listening") {
      stopListening();
    }
  };

  const dispatchCommand = (command: string) => {
    if (!command.trim() || submitted) return;
    onSubmit?.(command.trim());
    setSubmitted(true);
    speakConfirmation(command.trim());
    dispatchedRef.current = true;
    setTimeout(() => {
      setSubmitted(false);
      transcriptRef.current = "";
      setValue("");
      setVoiceState("idle");
    }, 1800);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatchCommand(value);
  };

  const fillSuggestion = (cmd: string) => {
    setValue(`Hey Clementine, ${cmd}`);
    setShowSuggestions(false);
  };

  const stateLabel: Partial<Record<VoiceState, string>> = {
    idle: "Tap to speak",
    listening: "Listening…",
    ready: "Voice ready",
    unsupported: "Not available",
  };

  return (
    <div className="h-full bg-white p-5 border border-[#120B09]/5 shadow-sm rounded-sm hover:border-[#EF8354]/20 transition-all">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4A3935]/50 font-[Inter,sans-serif] mb-1">
            Command Dispatch
          </p>
          <h3 className="text-xl font-black text-[#120B09] tracking-tight uppercase">
            Voice + Text Input
          </h3>
        </div>
        <div className="text-right">
          <Zap size={16} className="text-[#EF8354] ml-auto mb-1" />
          <span
            className={`text-[10px] font-black uppercase tracking-widest font-[Inter,sans-serif] ${
              voiceState === "listening"
                ? "text-[#EF8354]"
                : voiceState === "ready"
                ? "text-green-700"
                : voiceState === "unsupported"
                ? "text-[#BA1A1A]"
                : "text-[#4A3935]/40"
            }`}
          >
            {stateLabel[voiceState]}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[112px_1fr] gap-4 items-start">
        <div className="flex flex-col items-center">
          <div className="relative flex items-center justify-center my-1">
            {voiceState === "listening" && (
              <>
                <div className="absolute w-20 h-20 rounded-full border border-[#EF8354]/30 pulse-ring" />
                <div
                  className="absolute w-20 h-20 rounded-full border border-[#EF8354]/15 pulse-ring"
                  style={{ animationDelay: "0.5s" }}
                />
              </>
            )}
            <button
              onClick={handleMicClick}
              disabled={voiceState === "unsupported"}
              className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:cursor-not-allowed ${
                voiceState === "listening"
                  ? "bg-[#EF8354] shadow-lg shadow-[#EF8354]/20"
                  : voiceState === "ready"
                  ? "bg-green-700 shadow-lg shadow-green-700/20"
                  : voiceState === "unsupported"
                  ? "bg-[#F5F1EE]"
                  : "bg-[#120B09] hover:bg-[#2a1b17]"
              }`}
            >
              {voiceState === "ready" ? (
                <CheckCircle size={22} className="text-white" />
              ) : voiceState === "listening" ? (
                <Mic size={22} className="text-white" />
              ) : voiceState === "unsupported" ? (
                <AlertCircle size={20} className="text-[#BA1A1A]" />
              ) : (
                <MicOff size={22} className="text-white" />
              )}
            </button>
          </div>
          <p className="mt-3 text-center text-[10px] text-[#4A3935]/45 font-[Inter,sans-serif] font-bold">
            Speak or type a workload
          </p>
        </div>

        <div className="h-full flex flex-col">
          <form onSubmit={handleSubmit} className="h-full flex flex-col gap-3">
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Hey Clementine, ..."
              rows={6}
              className="flex-1 w-full min-h-[11rem] bg-[#F5F1EE] border border-[#120B09]/8 rounded-sm px-4 py-3 text-sm text-[#120B09] placeholder-[#120B09]/30 resize-none focus:outline-none focus:border-[#EF8354]/50 focus:bg-white transition-all font-medium"
            />

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!value.trim() || submitted}
                className={`flex-1 flex items-center justify-center gap-2 py-3 font-black text-[10px] uppercase tracking-widest rounded-sm transition-all font-[Inter,sans-serif] ${
                  submitted
                    ? "bg-green-600 text-white"
                    : value.trim()
                    ? "bg-[#EF8354] text-white hover:brightness-110 active:scale-[0.98]"
                    : "bg-[#EDE7E3] text-[#4A3935]/50 cursor-not-allowed"
                }`}
              >
                {submitted ? (
                  "Dispatched ✓"
                ) : (
                  <>
                    <Send size={12} />
                    Dispatch
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowSuggestions((current) => !current)}
                className="px-3 py-3 bg-[#F5F1EE] hover:bg-[#EDE7E3] text-[#120B09]/60 rounded-sm transition-all"
              >
                <ChevronDown
                  size={14}
                  className={`transition-transform ${showSuggestions ? "rotate-180" : ""}`}
                />
              </button>
            </div>
          </form>

          {showSuggestions && (
            <div className="mt-2 border border-[#120B09]/8 rounded-sm overflow-hidden">
              {SAMPLE_COMMANDS.map((cmd, index) => (
                <button
                  key={index}
                  onClick={() => fillSuggestion(cmd)}
                  className="w-full text-left px-4 py-3 text-xs text-[#4A3935] hover:bg-[#F5F1EE] border-b border-[#120B09]/5 last:border-0 transition-all font-medium"
                >
                  <span className="text-[#EF8354] font-black text-[10px] uppercase tracking-widest font-[Inter,sans-serif] mr-2">
                    Hey Clementine,
                  </span>
                  {cmd}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
