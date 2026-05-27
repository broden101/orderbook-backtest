"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { OrderQueueRow, QueueEvent } from "@/lib/types";

interface Props {
  queue: OrderQueueRow[];
  events?: QueueEvent[];
}

type ActionFilter = "ALL" | "PLACED" | "CANCELLED" | "FILLED" | "PARTIAL_FILL";

const ACTION_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  PLACED: { bg: "bg-green-900/30", text: "text-green-400", icon: "🟢" },
  CANCELLED: { bg: "bg-red-900/30", text: "text-red-400", icon: "🔴" },
  FILLED: { bg: "bg-blue-900/30", text: "text-blue-400", icon: "🔵" },
  PARTIAL_FILL: { bg: "bg-yellow-900/30", text: "text-yellow-400", icon: "🟡" },
};

export function QueuePanel({ queue, events = [] }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [actionFilter, setActionFilter] = useState<ActionFilter>("ALL");
  const [sideFilter, setSideFilter] = useState<"ALL" | "BID" | "OFFER">("ALL");
  const [viewMode, setViewMode] = useState<"events" | "queue">("events");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length, queue.length]);

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
          📋 Order Queue Events
        </h3>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-xs text-slate-600">
              Upload queue events CSV dari growin-queue-poller.py
            </p>
            <p className="text-[10px] text-slate-700">
              Format: time,order_id,side,price,qty,remain_qty,action,partial,rank
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
          <button
            onClick={() => setViewMode("events")}
            className={`rounded px-2 py-0.5 text-[10px] ${viewMode === "events" ? "bg-slate-700 text-teal-400" : "text-slate-500"}`}
          >
            Events ({events.length})
          </button>
          <button
            onClick={() => setViewMode("queue")}
            className={`rounded px-2 py-0.5 text-[10px] ${viewMode === "queue" ? "bg-slate-700 text-teal-400" : "text-slate-500"}`}
          >
            Snapshot ({queue.length})
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {events.length > 0 && (
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
      )}

      {/* Net flow indicator */}
      {events.length > 0 && (
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
      )}

      {/* Filters */}
      {events.length > 0 && (
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
      )}

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {viewMode === "events" ? (
          <div className="space-y-0.5">
            {filteredEvents.slice(0, 200).map((e, i) => {
              const colors = ACTION_COLORS[e.action];
              return (
                <div
                  key={`${e.order_id}-${e.time}-${i}`}
                  className={`flex items-center gap-1 rounded px-2 py-1 ${colors.bg}`}
                >
                  <span className="text-[10px]">{colors.icon}</span>
                  <span className="text-[10px] text-slate-500 w-14">{e.time}</span>
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
          /* Queue snapshot view (original) */
          <div className="space-y-2">
            {(() => {
              const bids = queue.filter((q) => q.side === "BID");
              const offers = queue.filter((q) => q.side === "OFFER");
              return (
                <>
                  <div>
                    <h4 className="mb-1 text-[10px] font-medium text-red-400 uppercase">
                      Offer ({offers.length})
                    </h4>
                    <div className="space-y-0.5">
                      {offers.sort((a, b) => b.price - a.price).slice(0, 30).map((q, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-red-400">{q.broker || "-"}</span>
                          <span className="text-slate-300">{q.price.toLocaleString()}</span>
                          <span className="text-slate-500">{q.lot.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {bids.length > 0 && offers.length > 0 && (
                    <div className="py-1 text-center">
                      <span className="text-[10px] text-slate-600">
                        Spread: {Math.max(...offers.map((o) => o.price)).toLocaleString()} - {Math.min(...bids.map((b) => b.price)).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div>
                    <h4 className="mb-1 text-[10px] font-medium text-green-400 uppercase">
                      Bid ({bids.length})
                    </h4>
                    <div className="space-y-0.5">
                      {bids.sort((a, b) => b.price - a.price).slice(0, 30).map((q, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-green-400">{q.broker || "-"}</span>
                          <span className="text-slate-300">{q.price.toLocaleString()}</span>
                          <span className="text-slate-500">{q.lot.toLocaleString()}</span>
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
