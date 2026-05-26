"use client";

import { useRef, useEffect } from "react";
import { OrderLevel } from "@/lib/types";

interface Props {
  levels: OrderLevel[];
  lastPrice: number;
  high: number;
  low: number;
  open: number;
  volume: number;
  value: number;
  frequency: number;
  changePct: number;
}

export function OrderBookPanel({
  levels,
  lastPrice,
  high,
  low,
  open,
  volume,
  value,
  frequency,
  changePct,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const posColor = changePct >= 0 ? "text-green-400" : "text-red-400";

  // Auto-scroll to last price level
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector(`[data-price="${lastPrice}"]`);
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [lastPrice, levels]);

  // Find max lot for depth bars
  const maxBid = Math.max(...levels.map((l) => l.bidLot), 1);
  const maxOffer = Math.max(...levels.map((l) => l.offerLot), 1);

  // Format volume
  const fmtVol = (v: number) => {
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
    if (v >= 1_000) return (v / 1_000).toFixed(1) + "K";
    return v.toString();
  };

  const fmtVal = (v: number) => {
    if (v >= 1_000_000_000_000) return (v / 1_000_000_000_000).toFixed(2) + "T";
    if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(2) + "B";
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
    if (v >= 1_000) return (v / 1_000).toFixed(1) + "K";
    return v.toString();
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-800 p-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-slate-100">
              Order Book
            </span>
            <span className="ml-2 text-xs text-slate-500">Real-time</span>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${posColor}`}>{lastPrice}</div>
            <div className={`text-xs ${posColor}`}>
              {changePct >= 0 ? "+" : ""}
              {changePct.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Summary row */}
        <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-slate-400">
          <div>
            <span className="text-slate-600">H</span> {high}
          </div>
          <div>
            <span className="text-slate-600">L</span> {low}
          </div>
          <div>
            <span className="text-slate-600">O</span> {open}
          </div>
          <div>
            <span className="text-slate-600">Vol</span> {fmtVol(volume)}
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-4 gap-2 border-b border-slate-800 px-3 py-1.5 text-[10px] text-slate-600">
        <span className="text-left">Bid</span>
        <span className="text-center">Price</span>
        <span className="text-center">Offer</span>
        <span className="text-right">Freq</span>
      </div>

      {/* Levels */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {levels.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-slate-500">
            Load data to view Order Book
          </div>
        ) : (
          levels.map((level) => {
            const isLastPrice = level.price === lastPrice;
            const bidPct = (level.bidLot / maxBid) * 100;
            const offerPct = (level.offerLot / maxOffer) * 100;

            return (
              <div
                key={level.price}
                data-price={level.price}
                className={`group relative grid grid-cols-4 gap-2 border-b border-slate-800/30 px-3 py-1 text-xs hover:bg-slate-800/30 ${
                  isLastPrice ? "bg-slate-800/50 ring-1 ring-teal-500/30" : ""
                }`}
              >
                {/* Bid depth bar */}
                {level.bidLot > 0 && (
                  <div
                    className="absolute bottom-0 left-0 top-0 bg-green-500/10 transition-all"
                    style={{ width: `${bidPct}%` }}
                  />
                )}
                {/* Offer depth bar */}
                {level.offerLot > 0 && (
                  <div
                    className="absolute bottom-0 right-0 top-0 bg-red-500/10 transition-all"
                    style={{ width: `${offerPct}%` }}
                  />
                )}

                {/* Bid */}
                <span className="relative z-10 text-green-400">
                  {level.bidLot > 0 ? fmtVol(level.bidLot) : "—"}
                </span>

                {/* Price */}
                <span
                  className={`relative z-10 text-center font-medium ${
                    isLastPrice ? "text-teal-400" : "text-slate-300"
                  }`}
                >
                  {level.price}
                </span>

                {/* Offer */}
                <span className="relative z-10 text-center text-red-400">
                  {level.offerLot > 0 ? fmtVol(level.offerLot) : "—"}
                </span>

                {/* Freq */}
                <span className="relative z-10 text-right text-slate-500">
                  {level.bidFreq + level.offerFreq}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 p-2 text-[10px] text-slate-600">
        Freq: {frequency.toLocaleString()} · Val: Rp{fmtVal(value)}
      </div>
    </div>
  );
}
