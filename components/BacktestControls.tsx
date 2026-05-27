"use client";

import { useCallback, useRef } from "react";
import { PlaybackState, Trade } from "@/lib/types";
import { generateSampleData, tradesToCsv } from "@/lib/parser";

interface Props {
  playback: PlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
  onCsvUpload: (text: string) => void;
  onGenerateSample: () => void;
  onReset: () => void;
  hasData: boolean;
  totalTrades: number;
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
  hasData,
  totalTrades,
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

  const SPEEDS = [1, 2, 5, 10];
  const isIdle = playback.status === "idle";
  const isPlaying = playback.status === "playing";
  const isPaused = playback.status === "paused";
  const isDone = playback.status === "done";

  return (
    <div className="space-y-4">
      {/* Playback Controls */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-3 text-sm font-medium text-slate-200">
          🎮 Backtest Controls
        </h3>

        <div className="flex items-center gap-2">
          {/* Play/Pause/Resume */}
          {isPlaying ? (
            <button onClick={onPause} className="tool-btn px-6">
              ⏸ Pause
            </button>
          ) : isPaused ? (
            <button onClick={onPlay} className="tool-btn px-6">
              ▶ Resume
            </button>
          ) : (
            <button
              onClick={onPlay}
              disabled={isIdle && !hasData}
              className={`px-6 tool-btn ${
                isIdle && !hasData ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              ▶ Play
            </button>
          )}

          {/* Stop */}
          {!isIdle && (
            <button onClick={onStop} className="tool-btn-ghost">
              ⏹ Stop
            </button>
          )}

          {/* Speed */}
          <div className="ml-auto flex items-center gap-1">
            <span className="mr-1 text-xs text-slate-500">
              {playback.speed}x
            </span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`rounded-md px-2 py-1 text-xs transition-colors ${
                  playback.speed === s
                    ? "bg-teal-500/20 text-teal-400"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Progress */}
        {!isIdle && (
          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all ${
                  isDone
                    ? "bg-green-500"
                    : isPlaying
                      ? "bg-teal-500"
                      : "bg-yellow-500"
                }`}
                style={{
                  width: `${
                    playback.currentIndex > 0 && totalTrades > 0
                      ? (playback.currentIndex / totalTrades) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {isDone
                ? "✅ Playback complete"
                : isPlaying
                  ? `Playing back...`
                  : isPaused
                    ? `⏸ Paused`
                    : "Ready"}
            </p>
          </div>
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
              placeholder="Atau paste CSV data di sini...
Time,Code,Price,Lot,Change,Side
09:30:01,BUMI,170,10,0.00,BUY
09:30:05,BUMI,169,25,-0.58,SELL"
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
