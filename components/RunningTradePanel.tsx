"use client";

import { useRef, useEffect } from "react";
import { Trade, SideFilter } from "@/lib/types";

interface Props {
  trades: Trade[];
  filter: SideFilter;
  onFilterChange: (f: SideFilter) => void;
  onClear: () => void;
  currentIndex: number;
  totalTrades: number;
  isPlaying: boolean;
}

export function RunningTradePanel({
  trades,
  filter,
  onFilterChange,
  onClear,
  currentIndex,
  totalTrades,
  isPlaying,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top (newest trade appears here)
  useEffect(() => {
    if (scrollRef.current && isPlaying) {
      scrollRef.current.scrollTop = 0;
    }
  }, [trades.length, isPlaying]);

  const filtered =
    filter === "all"
      ? trades
      : trades.filter((t) => t.side === filter);

  // Newest first (top → bottom)
  const reversed = [...filtered].reverse();

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-800 p-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-slate-100">
              Running Trade
            </span>
            <span className="ml-2 text-xs text-slate-500">
              {totalTrades} trades
            </span>
          </div>
          <div className="text-xs text-slate-500">
            {currentIndex}/{totalTrades}
          </div>
        </div>

        {/* Filters */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex gap-1">
            {(["all", "BUY", "SELL"] as SideFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => onFilterChange(f)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === f
                    ? f === "all"
                      ? "bg-slate-700 text-slate-200"
                      : f === "BUY"
                        ? "bg-green-900/40 text-green-400"
                        : "bg-red-900/40 text-red-400"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {f === "all" ? "All" : f === "BUY" ? "Buy" : "Sell"}
              </button>
            ))}
          </div>
          <button
            onClick={onClear}
            className="text-xs text-slate-600 hover:text-red-400 transition-colors"
          >
            Clear All
          </button>
        </div>

        {/* Column headers */}
        <div className="mt-2 grid grid-cols-7 gap-1 border-t border-slate-800 pt-2 text-[10px] text-slate-600">
          <span className="col-span-2">Time</span>
          <span>Code</span>
          <span className="text-right">Price</span>
          <span className="text-right">Lot</span>
          <span className="text-right">Chg%</span>
          <span className="text-right">Side</span>
        </div>
      </div>

      {/* Trade rows */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {reversed.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-slate-500">
            {totalTrades === 0
              ? "No trades yet — load or start playback"
              : "No trades match filter"}
          </div>
        ) : (
          reversed.map((trade) => {
            const isBuy = trade.side === "BUY";
            const sideColor = isBuy ? "text-green-400" : "text-red-400";
            const chgColor = trade.changePct >= 0 ? "text-green-400" : "text-red-400";

            return (
              <div
                key={trade.id}
                className="grid grid-cols-7 gap-1 border-b border-slate-800/20 px-3 py-1.5 text-xs hover:bg-slate-800/20"
              >
                <span className="col-span-2 font-mono text-slate-400">
                  {trade.time}
                </span>
                <span className="font-medium text-slate-300">{trade.code}</span>
                <span className="text-right font-mono text-slate-200">
                  {trade.price}
                </span>
                <span className="text-right font-mono text-slate-400">
                  {trade.lot}
                </span>
                <span className={`text-right font-mono ${chgColor}`}>
                  {trade.changePct >= 0 ? "+" : ""}
                  {trade.changePct.toFixed(2)}
                </span>
                <span className={`text-right font-bold ${sideColor}`}>
                  {isBuy ? "BUY" : "SELL"}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer summary */}
      <div className="border-t border-slate-800 p-2 text-[10px] text-slate-600">
        <span className="text-green-400">
          BUY {trades.filter((t) => t.side === "BUY").length}
        </span>
        {" · "}
        <span className="text-red-400">
          SELL {trades.filter((t) => t.side === "SELL").length}
        </span>
        {" · Total lot "}
        {trades.reduce((s, t) => s + t.lot, 0).toLocaleString()}
      </div>
    </div>
  );
}
