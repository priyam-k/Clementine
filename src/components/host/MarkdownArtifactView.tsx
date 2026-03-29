"use client";

import type { ReactNode } from "react";

interface MarkdownArtifactViewProps {
  content: string;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  match = pattern.exec(text);
  while (match) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={`${match.index}-strong`} className="font-black text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={`${match.index}-em`} className="italic text-white/85">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={`${match.index}-code`}
          className="rounded bg-white/10 px-1.5 py-0.5 text-[#EF8354] font-mono text-[0.95em]"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    lastIndex = match.index + token.length;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export function MarkdownArtifactView({ content }: MarkdownArtifactViewProps) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(
        <pre
          key={`code-${index}`}
          className="overflow-x-auto rounded-sm bg-black/45 px-4 py-3 text-[11px] leading-relaxed text-green-300"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    if (/^###\s+/.test(trimmed)) {
      blocks.push(
        <h4 key={`h3-${index}`} className="text-sm font-black uppercase tracking-wide text-white">
          {trimmed.replace(/^###\s+/, "")}
        </h4>
      );
      index += 1;
      continue;
    }

    if (/^##\s+/.test(trimmed)) {
      blocks.push(
        <h3 key={`h2-${index}`} className="text-lg font-black tracking-tight text-white">
          {trimmed.replace(/^##\s+/, "")}
        </h3>
      );
      index += 1;
      continue;
    }

    if (/^#\s+/.test(trimmed)) {
      blocks.push(
        <h2 key={`h1-${index}`} className="text-2xl font-black tracking-tight text-white">
          {trimmed.replace(/^#\s+/, "")}
        </h2>
      );
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${index}`} className="list-disc space-y-1 pl-5 text-sm text-white/75">
          {items.map((item, itemIndex) => (
            <li key={`${itemIndex}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ol key={`ol-${index}`} className="list-decimal space-y-1 pl-5 text-sm text-white/75">
          {items.map((item, itemIndex) => (
            <li key={`${itemIndex}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    const paragraphLines = [trimmed];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^#/.test(lines[index].trim()) &&
      !/^[-*]\s+/.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim()) &&
      !/^```/.test(lines[index].trim())
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push(
      <p key={`p-${index}`} className="text-sm leading-relaxed text-white/75">
        {renderInlineMarkdown(paragraphLines.join(" "))}
      </p>
    );
  }

  return <div className="space-y-4">{blocks}</div>;
}
