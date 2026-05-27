"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { OrderQueueRow, QueueEvent, OrderLevel } from "@/lib/types";

interface Props {
  queue: OrderQueueRow[];
  events?: QueueEvent[];
  /** Called whenever the visible queue changes (playback tick or manual jump) */
  onQueueUpdate?: (levels: OrderLevel[], visibleQueue: OrderQueueRow[]) => void;
}

type PlaybackStatus = "idle" | "playing" | "paused" | "done";

// ── Helpers ──────────────────────────────────────────────────

function parseTs(t: string): Date | null {
  if (!t) return null;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

function fmtTime(t: string): string {
  const d = parseTs(t);
  if (!d) return t.substring(0, 8) || "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function fmtShort(t: string): string {
  const d = parseTs(t);
  if (!d) return t.substring(0, 5) || "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function tsToSec(t: string): number {
  const d = parseTs(t);
  if (!d) return 0;
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

function secToTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
}

// Build OrderLevel[] from a set of queue rows
function buildLevels(rows: OrderQueueRow[]): OrderLevel[] {
  const priceMap = new Map<number, { bidLot: number; bidFreq: number; offerLot: number; offerFreq: number }>();
  for (const q of rows) {
    const e = priceMap.get(q.price) || { bidLot: 0, bidFreq: 0, offerLot: 0, offerFreq: 0 };
    if (q.side === "BID") {
      e.bidLot += q.lot;
      e.bidFreq += q.freq || 1;
    } else {
      e.offerLot += q.lot;
      e.offerFreq += q.freq || 1;
    }
    priceMap.set(q.price, e);
  }
  return Array.from(priceMap.entries())
    .map(([price, d]) => ({ price, ...d }))
    .sort((a, b) => b.price - a.price);
}

// ── Component ────────────────────────────────────────────────

export function QueuePanel({ queue, events = [], onQueueUpdate }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Playback state
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [speed, setSpeed] = useState(1); // orders per tick

  // Sort queue by timestamp once on load
  const sortedQueue = useMemo(() => {
    if (queue.length === 0) return [];
    return [...queue]
      .filter((q) => q.timestamp || q.time)
      .sort((a, b) => {
        const ta = a.timestamp || a.time || "";
        const tb = b.timestamp || b.time || "";
        return ta < tb ? -1 : ta > tb ? 1 : 0;
      });
  }, [queue]);

  // Time range
  const timeRange = useMemo(() => {
    if (sortedQueue.length === 0) return { start: 0, end: 0 };
    const first = tsToSec(sortedQueue[0].timestamp || sortedQueue[0].time || "");
    const last = tsToSec(sortedQueue[sortedQueue.length - 1].timestamp || sortedQueue[sortedQueue.length - 1].time || "");
    return { start: first, end: last };
  }, [sortedQueue]);

  // Currently visible orders (first N sorted by time)
  const visibleOrders = useMemo(
    () => sortedQueue.slice(0, currentIdx),
    [sortedQueue, currentIdx]
  );

  // Current time of playback
  const currentTime = useMemo(() => {
    if (currentIdx <= 0) return secToTime(timeRange.start);
    if (currentIdx >= sortedQueue.length) return secToTime(timeRange.end);
    return fmtTime(sortedQueue[currentIdx - 1].timestamp || sortedQueue[currentIdx - 1].time || "");
  }, [currentIdx, sortedQueue, timeRange]);

  // Stats for visible orders
  const stats = useMemo(() => {
    const bids = visibleOrders.filter((q) => q.side === "BID");
    const offers = visibleOrders.filter((q) => q.side === "OFFER");
    const totalBidLot = bids.reduce((s, q) => s + q.lot, 0);
    const totalOfferLot = offers.reduce((s, q) => s + q.lot, 0);
    const topBid = bids.length > 0 ? Math.max(...bids.map((q) => q.price)) : 0;
    const topAsk = offers.length > 0 ? Math.min(...offers.map((q) => q.price)) : 0;
    return { bids, offers, totalBidLot, totalOfferLot, topBid, topAsk, spread: topAsk - topBid };
  }, [visibleOrders]);

  // Notify parent whenever visible orders change
  useEffect(() => {
    if (onQueueUpdate && visibleOrders.length > 0) {
      onQueueUpdate(buildLevels(visibleOrders), visibleOrders);
    } else if (onQueueUpdate && visibleOrders.length === 0 && status === "idle") {
      onQueueUpdate([], []);
    }
  }, [visibleOrders, onQueueUpdate, status]);

  // ── Playback controls ─────────────────────────────────────

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handlePlay = useCallback(() => {
    if (sortedQueue.length === 0) return;
    // If at end, restart
    if (currentIdx >= sortedQueue.length) {
      setCurrentIdx(0);
    }
    setStatus("playing");
  }, [sortedQueue.length, currentIdx]);

  const handlePause = useCallback(() => {
    stopTimer();
    setStatus("paused");
  }, [stopTimer]);

  const handleStop = useCallback(() => {
    stopTimer();
    setStatus("idle");
    setCurrentIdx(0);
  }, [stopTimer]);

  // Animation loop — runs when status === "playing"
  useEffect(() => {
    if (status !== "playing") {
      stopTimer();
      return;
    }

    // Determine interval: speed = orders per 100ms tick
    const batchSize = Math.max(1, speed);
    const tickMs = 50; // 50ms per tick for smooth animation

    intervalRef.current = setInterval(() => {
      setCurrentIdx((prev) => {
        const next = prev + batchSize;
        if (next >= sortedQueue.length) {
          stopTimer();
          setStatus("done");
          return sortedQueue.length;
        }
        return next;
      });
    }, tickMs);

    return () => stopTimer();
  }, [status, speed, sortedQueue.length, stopTimer]);

  // Auto-scroll recent orders
  useEffect(() => {
    if (scrollRef.current && status === "playing") {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentIdx, status]);

  // ── Manual slider (scrub) ─────────────────────────────────
  const handleScrub = useCallback((val: number) => {
    stopTimer();
    setStatus("paused");
    setCurrentIdx(val);
  }, [stopTimer]);

  // ── Price level bar chart data ─────────────────────────────
  const priceData = useMemo(() => {
    const bidsByPrice = new Map<number, number>();
    const offersByPrice = new Map<number, number>();
    for (const q of visibleOrders) {
      if (q.side === "BID") {
        bidsByPrice.set(q.price, (bidsByPrice.get(q.price) || 0) + q.lot);
      } else {
        offersByPrice.set(q.price, (offersByPrice.get(q.price) || 0) + q.lot);
      }
    }
    const maxLot = Math.max(
      ...Array.from(bidsByPrice.values()),
      ...Array.from(offersByPrice.values()),
      1
    );
    return { bidsByPrice, offersByPrice, maxLot };
  }, [visibleOrders]);

  // Recent orders (last 8 that appeared)
  const recentOrders = useMemo(() => {
    const start = Math.max(0, currentIdx - 8);
    return sortedQueue.slice(start, currentIdx).reverse();
  }, [sortedQueue, currentIdx]);

  // ── No data state ──────────────────────────────────────────
  if (queue.length === 0 && events.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-3 text-sm font-medium text-slate-200">📋 Queue Replay</h3>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-slate-600 text-center">
            Upload queue JSON dari Growin<br />
            <span className="text-[10px] text-slate-700">Orders di-playback sesuai urutan jam</span>
          </p>
        </div>
      </div>
    );
  }

  const pct = sortedQueue.length > 0 ? (currentIdx / sortedQueue.length) * 100 : 0;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900 p-4">
      {/* Header + Time */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-200">📋 Queue Replay</h3>
        <span className="text-xs font-mono font-bold text-teal-400">
          {currentTime}
        </span>
      </div>

      {/* Playback controls */}
      <div className="mb-2 rounded-lg bg-slate-800 p-2">
        <div className="flex items-center gap-1.5 mb-2">
          {status === "playing" ? (
            <button onClick={handlePause} className="rounded bg-slate-700 px-2 py-0.5 text-xs text-yellow-400 hover:bg-slate-600">⏸</button>
          ) : (
            <button onClick={handlePlay} className="rounded bg-slate-700 px-2 py-0.5 text-xs text-green-400 hover:bg-slate-600">▶</button>
          )}
          <button onClick={handleStop} className="rounded bg-slate-700 px-2 py-0.5 text-xs text-red-400 hover:bg-slate-600">⏹</button>
          <div className="flex-1" />
          {/* Speed buttons */}
          {[1, 2, 5, 10, 50, 100].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                speed === s ? "bg-teal-700 text-teal-200" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Progress / scrub bar */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-slate-500 w-8">{pct.toFixed(0)}%</span>
          <input
            type="range"
            min={0}
            max={sortedQueue.length}
            step={1}
            value={currentIdx}
            onChange={(e) => handleScrub(parseInt(e.target.value))}
            className="flex-1 accent-teal-500 h-1"
          />
          <span className="text-[9px] text-slate-500 w-24 text-right">
            {currentIdx.toLocaleString()}/{sortedQueue.length.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-2 grid grid-cols-3 gap-1">
        <div className="rounded bg-green-900/20 p-1 text-center">
          <div className="text-[10px] text-green-500">BID</div>
          <div className="text-xs font-bold text-green-400">{stats.totalBidLot.toLocaleString()}</div>
          <div className="text-[9px] text-green-600">{stats.bids.length} orders</div>
        </div>
        <div className="rounded bg-slate-800 p-1 text-center flex flex-col justify-center">
          <div className="text-[10px] text-slate-500">Spread</div>
          <div className="text-xs font-bold text-slate-300">
            {stats.topBid > 0 && stats.topAsk > 0 ? stats.spread.toLocaleString() : "-"}
          </div>
          {stats.topBid > 0 && stats.topAsk > 0 && (
            <div className="text-[9px] text-slate-600">
              {stats.topBid}←→{stats.topAsk}
            </div>
          )}
        </div>
        <div className="rounded bg-red-900/20 p-1 text-center">
          <div className="text-[10px] text-red-500">OFFER</div>
          <div className="text-xs font-bold text-red-400">{stats.totalOfferLot.toLocaleString()}</div>
          <div className="text-[9px] text-red-600">{stats.offers.length} orders</div>
        </div>
      </div>

      {/* Content: price level bars + recent orders */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2">
        {/* Price level bar chart */}
        {visibleOrders.length > 0 && (
          <div className="space-y-1">
            {/* OFFER bars */}
            <div>
              <h4 className="text-[9px] font-medium text-red-400 uppercase mb-0.5">Offer</h4>
              {Array.from(priceData.offersByPrice.entries())
                .sort((a, b) => b[0] - a[0])
                .slice(0, 15)
                .map(([price, lot]) => (
                  <div key={`o-${price}`} className="flex items-center gap-1 mb-0.5">
                    <span className="text-[10px] text-red-400 w-11 text-right font-mono">{price.toLocaleString()}</span>
                    <div className="flex-1 h-3 bg-slate-800 rounded-sm overflow-hidden">
                      <div className="h-full bg-red-500/30 rounded-sm transition-all duration-75" style={{ width: `${(lot / priceData.maxLot) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 w-12 text-right font-mono">{lot.toLocaleString()}</span>
                  </div>
                ))}
            </div>

            {/* Spread gap */}
            {stats.topBid > 0 && stats.topAsk > 0 && (
              <div className="text-center py-0.5">
                <span className="text-[9px] text-slate-600">─── {stats.spread} spread ───</span>
              </div>
            )}

            {/* BID bars */}
            <div>
              <h4 className="text-[9px] font-medium text-green-400 uppercase mb-0.5">Bid</h4>
              {Array.from(priceData.bidsByPrice.entries())
                .sort((a, b) => b[0] - a[0])
                .slice(0, 15)
                .map(([price, lot]) => (
                  <div key={`b-${price}`} className="flex items-center gap-1 mb-0.5">
                    <span className="text-[10px] text-green-400 w-11 text-right font-mono">{price.toLocaleString()}</span>
                    <div className="flex-1 h-3 bg-slate-800 rounded-sm overflow-hidden">
                      <div className="h-full bg-green-500/30 rounded-sm transition-all duration-75" style={{ width: `${(lot / priceData.maxLot) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 w-12 text-right font-mono">{lot.toLocaleString()}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Recent orders feed */}
        {recentOrders.length > 0 && (
          <div className="border-t border-slate-800 pt-1">
            <h4 className="text-[9px] text-slate-500 uppercase mb-0.5">Recent Orders</h4>
            {recentOrders.map((q, i) => (
              <div
                key={`${q.order_id || i}-${q.timestamp || q.time}`}
                className={`flex items-center gap-1 rounded px-1 py-0.5 ${q.side === "BID" ? "bg-green-900/10" : "bg-red-900/10"} ${i === 0 ? "ring-1 ring-teal-600/30" : ""}`}
              >
                <span className="text-[9px] text-slate-500 w-12">{fmtTime(q.timestamp || q.time || "")}</span>
                <span className={`text-[9px] font-medium w-8 ${q.side === "BID" ? "text-green-400" : "text-red-400"}`}>
                  {q.side}
                </span>
                <span className="text-[9px] text-slate-300 font-mono w-10 text-right">{q.price}</span>
                <span className="text-[9px] text-slate-400 font-mono w-12 text-right">{q.lot} lot</span>
                {q.order_id && (
                  <span className="text-[8px] text-slate-700 ml-auto">#{q.order_id}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
