"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { OrderQueueRow, QueueEvent, OrderLevel } from "@/lib/types";

interface Props {
  queue: OrderQueueRow[];
  events?: QueueEvent[];
  onTimeChange?: (levels: OrderLevel[], filteredQueue: OrderQueueRow[]) => void;
}

type ActionFilter = "ALL" | "PLACED" | "CANCELLED" | "FILLED" | "PARTIAL_FILL";

const ACTION_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  PLACED: { bg: "bg-green-900/30", text: "text-green-400", icon: "🟢" },
  CANCELLED: { bg: "bg-red-900/30", text: "text-red-400", icon: "🔴" },
  FILLED: { bg: "bg-blue-900/30", text: "text-blue-400", icon: "🔵" },
  PARTIAL_FILL: { bg: "bg-yellow-900/30", text: "text-yellow-400", icon: "🟡" },
};

// Parse "HH:MM:SS" or ISO to minutes since midnight
function timeToMinutes(t: string): number {
  if (!t) return 0;
  try {
    const d = new Date(t);
    if (!isNaN(d.getTime())) {
      return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    }
  } catch { /* fall through */ }
  // Try HH:MM:SS format
  const parts = t.split(":");
  if (parts.length >= 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]) + (parts[2] ? parseInt(parts[2]) / 60 : 0);
  }
  return 0;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = Math.floor(m % 60);
  const sec = Math.floor((m % 1) * 60);
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// Get HH:MM from ISO timestamp or time string
function getHHMM(t: string): string {
  if (!t) return "";
  try {
    const d = new Date(t);
    if (!isNaN(d.getTime())) {
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
  } catch { /* fall through */ }
  return t.substring(0, 5);
}

export function QueuePanel({ queue, events = [], onTimeChange }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [actionFilter, setActionFilter] = useState<ActionFilter>("ALL");
  const [sideFilter, setSideFilter] = useState<"ALL" | "BID" | "OFFER">("ALL");
  const [viewMode, setViewMode] = useState<"events" | "queue">("queue");

  // Time slider state
  const hasTimestamps = useMemo(
    () => queue.some((q) => q.timestamp || q.time),
    [queue]
  );

  const timeRange = useMemo(() => {
    if (!hasTimestamps) return { min: 540, max: 960 }; // 09:00-16:00 default
    const times = queue
      .map((q) => timeToMinutes(q.timestamp || q.time || ""))
      .filter((t) => t > 0);
    if (times.length === 0) return { min: 540, max: 960 };
    return { min: Math.floor(Math.min(...times)), max: Math.ceil(Math.max(...times)) };
  }, [queue, hasTimestamps]);

  const [timeSlider, setTimeSlider] = useState<number>(timeRange.max);
  const [isTimeFilterActive, setIsTimeFilterActive] = useState(false);

  // Reset slider when data changes
  useEffect(() => {
    setTimeSlider(timeRange.max);
    setIsTimeFilterActive(false);
  }, [timeRange.max, queue.length]);

  // Filter queue by time
  const timeFilteredQueue = useMemo(() => {
    if (!isTimeFilterActive || !hasTimestamps) return queue;
    return queue.filter((q) => {
      const t = timeToMinutes(q.timestamp || q.time || "");
      return t > 0 && t <= timeSlider;
    });
  }, [queue, isTimeFilterActive, hasTimestamps, timeSlider]);

  // Rebuild order book levels from filtered queue
  const filteredLevels = useMemo(() => {
    if (!isTimeFilterActive || !hasTimestamps) return null;
    const priceMap = new Map<number, { bidLot: number; bidFreq: number; offerLot: number; offerFreq: number }>();
    for (const q of timeFilteredQueue) {
      const entry = priceMap.get(q.price) || { bidLot: 0, bidFreq: 0, offerLot: 0, offerFreq: 0 };
      if (q.side === "BID") {
        entry.bidLot += q.lot;
        entry.bidFreq += q.freq || 1;
      } else {
        entry.offerLot += q.lot;
        entry.offerFreq += q.freq || 1;
      }
      priceMap.set(q.price, entry);
    }
    return Array.from(priceMap.entries())
      .map(([price, d]) => ({ price, ...d }))
      .sort((a, b) => b.price - a.price);
  }, [timeFilteredQueue, isTimeFilterActive, hasTimestamps]);

  // Notify parent of time-filtered levels
  useEffect(() => {
    if (onTimeChange && filteredLevels) {
      onTimeChange(filteredLevels, timeFilteredQueue);
    }
  }, [filteredLevels, timeFilteredQueue, onTimeChange]);

  // Stats for time-filtered snapshot
  const snapshotStats = useMemo(() => {
    const q = timeFilteredQueue;
    const bids = q.filter((x) => x.side === "BID");
    const offers = q.filter((x) => x.side === "OFFER");
    const totalBidLot = bids.reduce((s, x) => s + x.lot, 0);
    const totalOfferLot = offers.reduce((s, x) => s + x.lot, 0);
    const topBid = bids.length > 0 ? Math.max(...bids.map((x) => x.price)) : 0;
    const topAsk = offers.length > 0 ? Math.min(...offers.map((x) => x.price)) : 0;
    return { bids, offers, totalBidLot, totalOfferLot, topBid, topAsk, spread: topAsk - topBid };
  }, [timeFilteredQueue]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length, timeFilteredQueue.length]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    let filtered = events;
    if (actionFilter !== "ALL") {
      filtered = filtered.filter((e) => e.action === actionFilter);
    }
    if (sideFilter !== "ALL") {
      filtered = filtered.filter((e) => e.side === sideFilter);
    }
    return filtered;
  }, [events, actionFilter, sideFilter]);

  // Event stats
  const stats = useMemo(() => {
    const placed = events.filter((e) => e.action === "PLACED");
    const cancelled = events.filter((e) => e.action === "CANCELLED");
    const filled = events.filter((e) => e.action === "FILLED");
    const partial = events.filter((e) => e.action === "PARTIAL_FILL");

    const bidPlaced = placed.filter((e) => e.side === "BID").reduce((s, e) => s + e.qty, 0);
    const askPlaced = placed.filter((e) => e.side === "OFFER").reduce((s, e) => s + e.qty, 0);
    const bidCancelled = cancelled.filter((e) => e.side === "BID").reduce((s, e) => s + e.remain_qty, 0);
    const askCancelled = cancelled.filter((e) => e.side === "OFFER").reduce((s, e) => s + e.remain_qty, 0);

    return { placed, cancelled, filled, partial, bidPlaced, askPlaced, bidCancelled, askCancelled };
  }, [events]);

  // No data state
  if (events.length === 0 && queue.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-3 text-sm font-medium text-slate-200">
          📋 Order Queue
        </h3>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-xs text-slate-600">
              Upload queue data (JSON/CSV)
            </p>
            <p className="text-[10px] text-slate-700">
              JSON: Growin order-queue snapshot with timestamps
            </p>
            <p className="text-[10px] text-slate-700">
              CSV: growin-queue-poller.py events
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900 p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-200">
          📋 Queue Monitor
        </h3>
        <div className="flex gap-1">
          {queue.length > 0 && (
            <button
              onClick={() => setViewMode("queue")}
              className={`rounded px-2 py-0.5 text-[10px] ${viewMode === "queue" ? "bg-slate-700 text-teal-400" : "text-slate-500"}`}
            >
              Snapshot ({timeFilteredQueue.length})
            </button>
          )}
          {events.length > 0 && (
            <button
              onClick={() => setViewMode("events")}
              className={`rounded px-2 py-0.5 text-[10px] ${viewMode === "events" ? "bg-slate-700 text-teal-400" : "text-slate-500"}`}
            >
              Events ({events.length})
            </button>
          )}
        </div>
      </div>

      {/* Time Slider — only for snapshot mode with timestamps */}
      {viewMode === "queue" && hasTimestamps && queue.length > 0 && (
        <div className="mb-3 rounded-lg bg-slate-800 p-2">
          <div className="mb-1 flex items-center justify-between">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={isTimeFilterActive}
                onChange={(e) => setIsTimeFilterActive(e.target.checked)}
                className="rounded"
              />
              <span className="text-[10px] text-slate-400">Filter by Time</span>
            </label>
            <span className="text-xs font-mono font-bold text-teal-400">
              {getHHMM(timeFilteredQueue[timeFilteredQueue.length - 1]?.timestamp || "") || minutesToTime(timeSlider)}
            </span>
          </div>
          {isTimeFilterActive && (
            <>
              <input
                type="range"
                min={timeRange.min}
                max={timeRange.max}
                step={1}
                value={timeSlider}
                onChange={(e) => setTimeSlider(parseInt(e.target.value))}
                className="w-full accent-teal-500"
              />
              <div className="flex justify-between text-[9px] text-slate-600">
                <span>{minutesToTime(timeRange.min)}</span>
                <span className="text-slate-500">
                  {timeFilteredQueue.length}/{queue.length} orders
                </span>
                <span>{minutesToTime(timeRange.max)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Snapshot stats */}
      {viewMode === "queue" && timeFilteredQueue.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-1">
          <div className="rounded bg-green-900/20 p-1 text-center">
            <div className="text-[10px] text-green-500">BID</div>
            <div className="text-xs font-bold text-green-400">
              {snapshotStats.totalBidLot.toLocaleString()}
            </div>
            <div className="text-[9px] text-green-600">
              {snapshotStats.bids.length} orders
            </div>
          </div>
          <div className="rounded bg-slate-800 p-1 text-center flex flex-col justify-center">
            <div className="text-[10px] text-slate-500">Spread</div>
            <div className="text-xs font-bold text-slate-300">
              {snapshotStats.spread > 0 ? snapshotStats.spread.toLocaleString() : "-"}
            </div>
          </div>
          <div className="rounded bg-red-900/20 p-1 text-center">
            <div className="text-[10px] text-red-500">OFFER</div>
            <div className="text-xs font-bold text-red-400">
              {snapshotStats.totalOfferLot.toLocaleString()}
            </div>
            <div className="text-[9px] text-red-600">
              {snapshotStats.offers.length} orders
            </div>
          </div>
        </div>
      )}

      {/* Event stats bar */}
      {viewMode === "events" && events.length > 0 && (
        <>
          <div className="mb-2 grid grid-cols-4 gap-1">
            <div className="rounded bg-green-900/20 p-1 text-center">
              <div className="text-[10px] text-green-500">Placed</div>
              <div className="text-xs font-bold text-green-400">{stats.placed.length}</div>
            </div>
            <div className="rounded bg-red-900/20 p-1 text-center">
              <div className="text-[10px] text-red-500">Cancelled</div>
              <div className="text-xs font-bold text-red-400">{stats.cancelled.length}</div>
            </div>
            <div className="rounded bg-blue-900/20 p-1 text-center">
              <div className="text-[10px] text-blue-500">Filled</div>
              <div className="text-xs font-bold text-blue-400">{stats.filled.length}</div>
            </div>
            <div className="rounded bg-yellow-900/20 p-1 text-center">
              <div className="text-[10px] text-yellow-500">Partial</div>
              <div className="text-xs font-bold text-yellow-400">{stats.partial.length}</div>
            </div>
          </div>

          {/* Net flow indicator */}
          <div className="mb-2 flex items-center justify-between rounded bg-slate-800 p-2">
            <div>
              <span className="text-[10px] text-slate-500">BID net: </span>
              <span className={`text-xs font-mono font-bold ${stats.bidPlaced - stats.bidCancelled >= 0 ? "text-green-400" : "text-red-400"}`}>
                {stats.bidPlaced - stats.bidCancelled > 0 ? "+" : ""}{(stats.bidPlaced - stats.bidCancelled).toLocaleString()} lot
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500">OFFER net: </span>
              <span className={`text-xs font-mono font-bold ${stats.askPlaced - stats.askCancelled >= 0 ? "text-red-400" : "text-green-400"}`}>
                {stats.askPlaced - stats.askCancelled > 0 ? "+" : ""}{(stats.askPlaced - stats.askCancelled).toLocaleString()} lot
              </span>
            </div>
          </div>

          {/* Event filters */}
          <div className="mb-2 flex gap-1 flex-wrap">
            {(["ALL", "PLACED", "CANCELLED", "FILLED", "PARTIAL_FILL"] as ActionFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setActionFilter(f)}
                className={`rounded px-1.5 py-0.5 text-[10px] ${actionFilter === f ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}
              >
                {f === "PARTIAL_FILL" ? "Partial" : f}
              </button>
            ))}
            <span className="text-slate-700">|</span>
            {(["ALL", "BID", "OFFER"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setSideFilter(f)}
                className={`rounded px-1.5 py-0.5 text-[10px] ${sideFilter === f ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {viewMode === "events" ? (
          /* Events timeline view */
          <div className="space-y-0.5">
            {filteredEvents.slice(0, 200).map((e, i) => {
              const colors = ACTION_COLORS[e.action];
              return (
                <div
                  key={`${e.order_id}-${e.time}-${i}`}
                  className={`flex items-center gap-1 rounded px-2 py-1 ${colors.bg}`}
                >
                  <span className="text-[10px]">{colors.icon}</span>
                  <span className="text-[10px] text-slate-500 w-14">{getHHMM(e.time)}</span>
                  <span className={`text-[10px] font-medium w-16 ${colors.text}`}>
                    {e.action === "PARTIAL_FILL" ? "PARTIAL" : e.action}
                  </span>
                  <span className={`text-[10px] w-10 ${e.side === "BID" ? "text-green-400" : "text-red-400"}`}>
                    {e.side}
                  </span>
                  <span className="text-[10px] text-slate-300 w-12 text-right font-mono">
                    {e.price.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 w-14 text-right font-mono">
                    {e.remain_qty.toLocaleString()}
                  </span>
                  {e.action === "CANCELLED" && (
                    <span className="text-[9px] text-red-600">-{e.remain_qty}</span>
                  )}
                  {e.action === "PLACED" && (
                    <span className="text-[9px] text-green-600">+{e.qty}</span>
                  )}
                </div>
              );
            })}
            {filteredEvents.length > 200 && (
              <div className="text-center text-[10px] text-slate-600 py-1">
                +{filteredEvents.length - 200} more events
              </div>
            )}
          </div>
        ) : (
          /* Queue snapshot view with time filtering */
          <div className="space-y-2">
            {(() => {
              const bids = snapshotStats.bids;
              const offers = snapshotStats.offers;

              // Group by price level
              const bidsByPrice = new Map<number, number>();
              for (const b of bids) {
                bidsByPrice.set(b.price, (bidsByPrice.get(b.price) || 0) + b.lot);
              }
              const offersByPrice = new Map<number, number>();
              for (const o of offers) {
                offersByPrice.set(o.price, (offersByPrice.get(o.price) || 0) + o.lot);
              }

              const maxLot = Math.max(
                ...Array.from(bidsByPrice.values()),
                ...Array.from(offersByPrice.values()),
                1
              );

              return (
                <>
                  {/* OFFER side */}
                  <div>
                    <h4 className="mb-1 text-[10px] font-medium text-red-400 uppercase flex justify-between">
                      <span>Offer ({offers.length})</span>
                      <span>{snapshotStats.totalOfferLot.toLocaleString()} lot</span>
                    </h4>
                    <div className="space-y-0.5">
                      {Array.from(offersByPrice.entries())
                        .sort((a, b) => b[0] - a[0])
                        .slice(0, 20)
                        .map(([price, lot]) => (
                          <div key={`o-${price}`} className="flex items-center gap-1">
                            <span className="text-[10px] text-red-400 w-12 text-right font-mono">{price.toLocaleString()}</span>
                            <div className="flex-1 h-3.5 bg-slate-800 rounded-sm overflow-hidden">
                              <div
                                className="h-full bg-red-500/30 rounded-sm"
                                style={{ width: `${(lot / maxLot) * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 w-14 text-right font-mono">{lot.toLocaleString()}</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Spread */}
                  {bids.length > 0 && offers.length > 0 && (
                    <div className="py-1 text-center">
                      <span className="text-[10px] text-slate-600">
                        Spread: {snapshotStats.topBid.toLocaleString()} ← {snapshotStats.spread > 0 ? snapshotStats.spread.toLocaleString() : "locked"} → {snapshotStats.topAsk.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* BID side */}
                  <div>
                    <h4 className="mb-1 text-[10px] font-medium text-green-400 uppercase flex justify-between">
                      <span>Bid ({bids.length})</span>
                      <span>{snapshotStats.totalBidLot.toLocaleString()} lot</span>
                    </h4>
                    <div className="space-y-0.5">
                      {Array.from(bidsByPrice.entries())
                        .sort((a, b) => b[0] - a[0])
                        .slice(0, 20)
                        .map(([price, lot]) => (
                          <div key={`b-${price}`} className="flex items-center gap-1">
                            <span className="text-[10px] text-green-400 w-12 text-right font-mono">{price.toLocaleString()}</span>
                            <div className="flex-1 h-3.5 bg-slate-800 rounded-sm overflow-hidden">
                              <div
                                className="h-full bg-green-500/30 rounded-sm"
                                style={{ width: `${(lot / maxLot) * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 w-14 text-right font-mono">{lot.toLocaleString()}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
