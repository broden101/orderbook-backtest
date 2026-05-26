"use client";

import { useRef, useEffect } from "react";
import { OrderQueueRow } from "@/lib/types";

interface Props {
  queue: OrderQueueRow[];
}

export function QueuePanel({ queue }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [queue.length]);

  if (queue.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-3 text-sm font-medium text-slate-200">
          📋 Order Queue (Bid/Offer)
        </h3>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-slate-600 text-center">
            Upload data queue atau generate sample<br />
            untuk melihat antrian bid/offer
          </p>
        </div>
      </div>
    );
  }

  const bids = queue.filter((q) => q.side === "BID");
  const offers = queue.filter((q) => q.side === "OFFER");

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-200">
          📋 Order Queue (Bid/Offer)
        </h3>
        <span className="text-[10px] text-slate-500">
          {queue.length} entries
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2">
        {/* Offers (sorted high to low) */}
        <div>
          <h4 className="mb-1 text-[10px] font-medium text-red-400 uppercase">
            Offer ({offers.length})
          </h4>
          <div className="space-y-0.5">
            {offers
              .sort((a, b) => b.price - a.price)
              .slice(0, 30)
              .map((q, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-red-400">{q.broker || "-"}</span>
                  <span className="text-slate-300">{q.price.toLocaleString()}</span>
                  <span className="text-slate-500">{q.lot.toLocaleString()}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Spread */}
        {bids.length > 0 && offers.length > 0 && (
          <div className="py-1 text-center">
            <span className="text-[10px] text-slate-600">
              Spread: {Math.max(...offers.map((o) => o.price)).toLocaleString()} - {Math.min(...bids.map((b) => b.price)).toLocaleString()}
            </span>
          </div>
        )}

        {/* Bids (sorted high to low) */}
        <div>
          <h4 className="mb-1 text-[10px] font-medium text-green-400 uppercase">
            Bid ({bids.length})
          </h4>
          <div className="space-y-0.5">
            {bids
              .sort((a, b) => b.price - a.price)
              .slice(0, 30)
              .map((q, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-green-400">{q.broker || "-"}</span>
                  <span className="text-slate-300">{q.price.toLocaleString()}</span>
                  <span className="text-slate-500">{q.lot.toLocaleString()}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
