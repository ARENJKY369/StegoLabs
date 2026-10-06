"use client";

import { useRef, useState, type ReactNode } from "react";
import { UploadCloud } from "lucide-react";
import type { ModuleAccent } from "@/lib/nav";

const ACCENT_DRAG: Record<ModuleAccent, string> = {
  teal: "border-teal bg-teal-dim",
  grape: "border-grape bg-grape-dim",
  amber: "border-amber bg-amber-dim",
  danger: "border-danger bg-danger-dim",
  mint: "border-mint bg-mint-dim",
  azure: "border-azure bg-azure-dim",
};

interface DropZoneProps {
  onFile: (file: File) => void;
  accept: string;
  accent?: ModuleAccent;
  headline: string;
  note?: string;
  icon?: ReactNode;
  compact?: boolean;
  multiple?: boolean;
  onFiles?: (files: File[]) => void;
}

/**
 * File intake that works three ways: drag & drop, click, or tap (mobile).
 * The border takes the module accent color on drag-over.
 */
export default function DropZone({
  onFile,
  onFiles,
  accept,
  accent = "teal",
  headline,
  note,
  icon,
  compact = false,
  multiple = false,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (multiple && onFiles) {
      onFiles(Array.from(files));
    } else {
      onFile(files[0]);
    }
  };

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`w-full rounded-card border border-dashed text-left transition-colors duration-150 ${
        dragging
          ? ACCENT_DRAG[accent]
          : "border-line-bright bg-card hover:border-ink-faint"
      } ${compact ? "px-4 py-3.5" : "px-5 py-7"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <span className={`flex items-center ${compact ? "gap-3" : "flex-col gap-2 text-center"}`}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-raise text-ink-faint">
          {icon ?? <UploadCloud size={16} strokeWidth={1.8} />}
        </span>
        <span className={compact ? "" : "block"}>
          <span className="block text-body font-medium text-ink">{headline}</span>
          {note ? (
            <span className="mt-0.5 block text-cap text-ink-faint">{note}</span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
