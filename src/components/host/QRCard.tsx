"use client";
import { Copy, CheckCheck, Smartphone, ExternalLink } from "lucide-react";
import { useState } from "react";
import QRCode from "react-qr-code";
import type { Session } from "@/lib/types";

interface QRCardProps {
  session: Session;
}

export function QRCard({ session }: QRCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(session.joinUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPlaceholder = session.joinCode === "—";

  return (
    <div className="bg-white border border-[#120B09]/5 shadow-sm rounded-sm p-6 hover:border-[#EF8354]/20 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4A3935]/50 font-[Inter,sans-serif] mb-1">
            Worker Invite
          </p>
          <h3 className="text-sm font-black text-[#120B09] tracking-tight uppercase">Scan to Join</h3>
        </div>
        <Smartphone size={18} className="text-[#4A3935]/30" />
      </div>

      {/* Real QR Code */}
      <div className="flex justify-center mb-4">
        <div className="p-3 bg-white border border-[#EDE7E3] rounded-sm">
          {isPlaceholder ? (
            <div className="w-24 h-24 bg-[#F5F1EE] flex items-center justify-center">
              <span className="text-[9px] text-[#4A3935]/30 font-[Inter,sans-serif] uppercase font-bold tracking-wider text-center">
                Awaiting session…
              </span>
            </div>
          ) : (
            <QRCode
              value={session.joinUrl}
              size={96}
              fgColor="#120B09"
              bgColor="white"
              level="M"
            />
          )}
        </div>
      </div>

      {/* Join code */}
      {!isPlaceholder && (
        <div className="text-center mb-3">
          <span className="text-xl font-black tracking-[0.4em] text-[#EF8354] font-[Inter,sans-serif]">
            {session.joinCode}
          </span>
        </div>
      )}

      {/* URL preview */}
      {!isPlaceholder && (
        <p className="text-[9px] text-center text-[#4A3935]/40 font-[Inter,sans-serif] mb-3 truncate px-2" title={session.joinUrl}>
          {session.joinUrl}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          disabled={isPlaceholder}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#F5F1EE] hover:bg-[#EDE7E3] text-[#120B09] transition-all rounded-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {copied ? <CheckCheck size={12} className="text-green-700" /> : <Copy size={12} />}
          <span className="text-[10px] font-black uppercase tracking-widest font-[Inter,sans-serif]">
            {copied ? "Copied!" : "Copy Link"}
          </span>
        </button>
        {!isPlaceholder && (
          <a
            href={session.joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2.5 bg-[#F5F1EE] hover:bg-[#EDE7E3] text-[#120B09]/60 transition-all rounded-sm flex items-center"
            title="Open join page"
          >
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
