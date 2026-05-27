"use client";

import { useCallback, useRef } from "react";
import { PlaybackState, Trade } from "@/lib/types";

interface Props {
  playback: PlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
  onCsvUpload: (text: string) => void;
  onGenerateSample: () => void;
  onReset: () => void;
  onScrub?: (index: number) => void;
  hasData: boolean;
  totalTrades: number;
  currentTime?: string;
  allTrades?: Trade[];
}

export function BacktestControls({
  playback,
  onPlay,
  onPause,
  onStop,
  onSpeedChange,
  onCsvUpload,
  onGenerateSample,
  onReset,
  onScrub,
  hasData,
  totalTrades,
  currentTime,
  allTrades,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onCsvUpload(reader.result);
        }
      };
      reader.readAsText(file);
    },
    [onCsvUpload]
  );

  const handlePaste = useCallback(() => {
    const text = textareaRef.current?.value;
    if (text && text.trim()) {
      onCsvUpload(text);
    }
  }, [onCsvUpload]);

  const handleSample = useCallback(() => {
    onGenerateSample();
  }, [onGenerateSample]);

  const SPEEDS = [1, 2, 5, 10, 20, 50, 100];
  const isIdle = playback.status === "idle";
  const isPlaying = playback.status === "playing";
  const isPaused = playback.status === "paused";
  const isDone = playback.status === "done";

  const pct = totalTrades > 0 ? (playback.currentIndex / totalTrades) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Playback Controls */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-200">
            🎮 Backtest Controls
          </h3>
          {currentTime && (
            <span className="text-xs font-mono font-bold text-teal-400">
              {currentTime}
            </span>
          )}
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-1.5 mb-2">
          {isPlaying ? (
            <button onClick={onPause} className="rounded bg-slate-700 px-2 py-0.5 text-xs text-yellow-400 hover:bg-slate-600">⏸</button>
          ) : (
            <button
              onClick={onPlay}
              disabled={isIdle && !hasData}
              className={`rounded bg-slate-700 px-2 py-0.5 text-xs text-green-400 hover:bg-slate-600 ${
                isIdle && !hasData ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              ▶
            </button>
          )}
          {!isIdle && (
            <button onClick={onStop} className="rounded bg-slate-700 px-2 py-0.5 text-xs text-red-400 hover:bg-slate-600">⏹</button>
          )}
          <div className="flex-1" />
          {/* Speed buttons */}
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                playback.speed === s ? "bg-teal-700 text-teal-200" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Scrub slider */}
        {hasData && (
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-slate-500 w-8">{pct.toFixed(0)}%</span>
            <input
              type="range"
              min={0}
              max={totalTrades}
              step={1}
              value={playback.currentIndex}
              onChange={(e) => onScrub?.(parseInt(e.target.value))}
              className="flex-1 accent-teal-500 h-1"
            />
            <span className="text-[9px] text-slate-500 w-20 text-right">
              {playback.currentIndex.toLocaleString()}/{totalTrades.toLocaleString()}
            </span>
          </div>
        )}

        {/* Status text */}
        {!isIdle && (
          <p className="mt-1 text-[10px] text-slate-500">
            {isDone ? "✅ Playback complete" : isPlaying ? "Playing..." : isPaused ? "⏸ Paused" : "Ready"}
          </p>
        )}
      </div>

      {/* Data Loader */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-3 text-sm font-medium text-slate-200">
          📂 Data Source
        </h3>

        {/* Upload CSV */}
        <div className="space-y-3">
          <div
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer rounded-lg border-2 border-dashed border-slate-700 p-4 text-center hover:border-slate-600"
          >
            <p className="text-xs text-slate-400">
              Upload CSV Running Trade
            </p>
            <p className="mt-1 text-[10px] text-slate-600">
              Format: Time,Code,Price,Lot,Change,Side
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFile}
              className="hidden"
            />
          </div>

          {/* Manual paste */}
          <div>
            <textarea
              ref={textareaRef}
              rows={4}
              className="tool-input font-mono text-xs"
              placeholder="Atau paste CSV data di sini...\nTime,Code,Price,Lot,Change,Side\n09:30:01,BUMI,170,10,0.00,BUY\n09:30:05,BUMI,169,25,-0.58,SELL"
            />
            <button
              onClick={handlePaste}
              className="mt-2 w-full tool-btn-ghost text-xs"
            >
              📥 Load from Text
            </button>
          </div>

          {/* Generate sample */}
          <button
            onClick={handleSample}
            className="w-full tool-btn-ghost text-xs"
          >
            🎲 Generate Sample Data (BUMI)
          </button>

          {/* Reset */}
          <button
            onClick={onReset}
            className="w-full text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            🔄 Reset All Data
          </button>
        </div>
      </div>
    </div>
  );
}
