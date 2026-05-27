"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Trade,
  OrderLevel,
  PlaybackState,
  SideFilter,
  TabId,
  OrderQueueEntry,
  OrderQueueRow,
  QueueEvent,
} from "@/lib/types";
import {
  parseTradeCsv,
  mapRowsToTrades,
  buildOrderBook,
  calcChange,
  generateSampleData,
  parseOrderQueue,
  buildOrderBookFromQueue,
  parseQueueEventsCsv,
} from "@/lib/parser";
import { OrderBookPanel } from "@/components/OrderBookPanel";
import { RunningTradePanel } from "@/components/RunningTradePanel";
import { BacktestControls } from "@/components/BacktestControls";
import { StatsPanel } from "@/components/StatsPanel";
import { QueuePanel } from "@/components/QueuePanel";

export default function Home() {
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [displayedTrades, setDisplayedTrades] = useState<Trade[]>([]);
  const [levels, setLevels] = useState<OrderLevel[]>([]);
  const [queueLevels, setQueueLevels] = useState<OrderLevel[]>([]);
  const [queueRows, setQueueRows] = useState<OrderQueueRow[]>([]);
  const [queueEvents, setQueueEvents] = useState<QueueEvent[]>([]);
  const [summary, setSummary] = useState({
    lastPrice: 0,
    high: 0,
    low: 0,
    open: 0,
    volume: 0,
  });
  const [filter, setFilter] = useState<SideFilter>("all");
  const [tab, setTab] = useState<TabId>("backtest");

  // Playback state
  const [playback, setPlayback] = useState<PlaybackState>({
    status: "idle",
    currentIndex: 0,
    speed: 1,
    elapsed: 0,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rebuild order book from a subset of trades
  const rebuild = useCallback((trades: Trade[]) => {
    const ob = buildOrderBook(trades);
    setLevels(ob.levels);
    setSummary({
      lastPrice: ob.lastPrice,
      high: ob.high,
      low: ob.low,
      open: ob.open,
      volume: ob.volume,
    });
  }, []);

  // Load data (full reset)
  const loadData = useCallback(
    (trades: Trade[]) => {
      stopPlayback();
      setAllTrades(trades);
      setDisplayedTrades([]);
      setPlayback({
        status: "idle",
        currentIndex: 0,
        speed: 1,
        elapsed: 0,
      });
      rebuild([]);
    },
    [rebuild]
  );

  // ── CSV Upload ──────────────────────────────────────

  const handleCsvUpload = useCallback(
    (text: string) => {
      const rows = parseTradeCsv(text);
      const trades = mapRowsToTrades(rows);
      if (trades.length === 0) return;
      loadData(trades);
    },
    [loadData]
  );

  // ── Queue Upload ────────────────────────────────────

  const handleQueueUpload = useCallback(
    (text: string) => {
      try {
        // Detect queue events CSV (has "action" column from growin-queue-poller.py)
        if (text.includes("action") && text.includes("order_id")) {
          const events = parseQueueEventsCsv(text);
          if (events.length > 0) {
            setQueueEvents(events);
            return;
          }
        }

        // Try JSON first
        const data = JSON.parse(text);
        const entries: OrderQueueEntry[] = Array.isArray(data)
          ? data
          : data.data || data.queue || [];
        const rows = parseOrderQueue(entries);
        setQueueRows(rows);
        const obLevels = buildOrderBookFromQueue(rows);
        setQueueLevels(obLevels);
      } catch {
        // Try CSV
        const rows = parseTradeCsv(text);
        const mapped = rows.map((r, i) => ({
          price: parseFloat(r.Price) || 0,
          side: ((r.Side || "").toUpperCase() === "BID" || (r.Side || "").toUpperCase() === "BUY"
            ? "BID"
            : "OFFER") as "BID" | "OFFER",
          lot: parseInt(r.Lot) || 0,
          freq: parseInt(r.Change || "0") || 0,
          broker: r.Board || "",
          time: r.Time || "",
        }));
        setQueueRows(mapped);
        const obLevels = buildOrderBookFromQueue(mapped);
        setQueueLevels(obLevels);
      }
    },
    []
  );

  const handleGenerateSample = useCallback(() => {
    const trades = generateSampleData();
    loadData(trades);
  }, [loadData]);

  const handleReset = useCallback(() => {
    stopPlayback();
    setAllTrades([]);
    setDisplayedTrades([]);
    setLevels([]);
    setQueueLevels([]);
    setQueueRows([]);
    setQueueEvents([]);
    setSummary({ lastPrice: 0, high: 0, low: 0, open: 0, volume: 0 });
    setPlayback({ status: "idle", currentIndex: 0, speed: 1, elapsed: 0 });
  }, []);

  // ── Playback ────────────────────────────────────────

  const stopPlayback = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handlePlay = useCallback(() => {
    if (allTrades.length === 0) return;

    const startIdx = playback.currentIndex;

    if (startIdx >= allTrades.length) {
      setPlayback((p) => ({ ...p, status: "idle", currentIndex: 0 }));
      setDisplayedTrades([]);
      rebuild([]);
      return;
    }

    setPlayback((p) => ({ ...p, status: "playing" }));

    let idx = startIdx;
    intervalRef.current = setInterval(() => {
      idx++;
      if (idx > allTrades.length) {
        stopPlayback();
        setPlayback((p) => ({
          ...p,
          status: "done",
          currentIndex: allTrades.length,
        }));
        rebuild(allTrades);
        setDisplayedTrades(allTrades);
        return;
      }

      const subset = allTrades.slice(0, idx);
      setDisplayedTrades(subset);
      rebuild(subset);
      setPlayback((p) => ({
        ...p,
        currentIndex: idx,
        elapsed: p.elapsed + 1,
      }));
    }, 1000 / playback.speed);
  }, [allTrades, playback.currentIndex, playback.speed, rebuild, stopPlayback]);

  const handlePause = useCallback(() => {
    stopPlayback();
    setPlayback((p) => ({ ...p, status: "paused" }));
  }, [stopPlayback]);

  const handleStop = useCallback(() => {
    stopPlayback();
    setPlayback({ status: "idle", currentIndex: 0, speed: 1, elapsed: 0 });
    setDisplayedTrades([]);
    rebuild([]);
  }, [stopPlayback, rebuild]);

  const handleSpeedChange = useCallback((speed: number) => {
    setPlayback((p) => ({ ...p, speed }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPlayback();
  }, [stopPlayback]);

  // Recalculate when speed changes during play
  useEffect(() => {
    if (playback.status === "playing") {
      stopPlayback();
      const spd = playback.speed;

      const interval = setInterval(() => {
        setPlayback((p) => {
          const nextIdx = p.currentIndex + 1;
          if (nextIdx > allTrades.length) {
            clearInterval(interval);
            setDisplayedTrades(allTrades);
            rebuild(allTrades);
            return { ...p, status: "done", currentIndex: allTrades.length };
          }
          const subset = allTrades.slice(0, nextIdx);
          setDisplayedTrades(subset);
          rebuild(subset);
          return { ...p, currentIndex: nextIdx, elapsed: p.elapsed + 1 };
        });
      }, 1000 / spd);

      intervalRef.current = interval;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback.speed, playback.status === "playing"]);

  const chgPct = calcChange(summary.lastPrice, summary.open);
  const value = displayedTrades.reduce(
    (s, t) => s + t.price * t.lot * 100,
    0
  );

  // Merge queue levels into order book when available
  const displayLevels = queueLevels.length > 0 ? queueLevels : levels;

  const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: "backtest", label: "Backtest", icon: "🎮" },
    { id: "queue", label: "Queue", icon: "📋" },
    { id: "data", label: "Data", icon: "📂" },
    { id: "stats", label: "Stats", icon: "📊" },
  ];

  return (
    <div className="mx-auto flex h-screen flex-col px-2 py-2">
      {/* Top Bar */}
      <header className="mb-2 flex items-center justify-between rounded-lg bg-slate-900 px-4 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-slate-100">
            📈 OrderBook Backtest
          </h1>
          {allTrades.length > 0 && (
            <span className="text-xs text-slate-500">
              {allTrades.length} trades loaded
            </span>
          )}
          {queueRows.length > 0 && (
            <span className="text-xs text-teal-500">
              · {queueRows.length} queue entries
            </span>
          )}
        </div>
        <nav className="flex gap-1 rounded-lg bg-slate-800 p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                tab === t.id
                  ? "bg-slate-700 text-teal-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 gap-2 overflow-hidden">
        {/* LEFT: Order Book */}
        <div className="w-[320px] flex-shrink-0">
          <OrderBookPanel
            levels={displayLevels}
            lastPrice={summary.lastPrice}
            high={summary.high}
            low={summary.low}
            open={summary.open}
            volume={summary.volume}
            value={value}
            frequency={displayedTrades.length}
            changePct={chgPct}
          />
        </div>

        {/* RIGHT: Running Trade + Controls or Data/Stats/Queue */}
        <div className="flex flex-1 gap-2 overflow-hidden">
          {/* Running Trade */}
          <div className="flex-1">
            <RunningTradePanel
              trades={displayedTrades}
              filter={filter}
              onFilterChange={setFilter}
              onClear={() => {
                stopPlayback();
                setAllTrades([]);
                setDisplayedTrades([]);
                setLevels([]);
                setQueueLevels([]);
                setQueueRows([]);
                setQueueEvents([]);
                setSummary({
                  lastPrice: 0,
                  high: 0,
                  low: 0,
                  open: 0,
                  volume: 0,
                });
                setPlayback({
                  status: "idle",
                  currentIndex: 0,
                  speed: 1,
                  elapsed: 0,
                });
              }}
              currentIndex={playback.currentIndex}
              totalTrades={allTrades.length}
              isPlaying={playback.status === "playing"}
            />
          </div>

          {/* Right sidebar: Controls / Data / Stats / Queue */}
          <div className="w-[340px] flex-shrink-0 overflow-y-auto">
            {tab === "backtest" && (
              <BacktestControls
                playback={playback}
                onPlay={handlePlay}
                onPause={handlePause}
                onStop={handleStop}
                onSpeedChange={handleSpeedChange}
                onCsvUpload={handleCsvUpload}
                onGenerateSample={handleGenerateSample}
                onReset={handleReset}
                hasData={allTrades.length > 0}
                totalTrades={allTrades.length}
              />
            )}
            {tab === "queue" && (
              <div className="space-y-4">
                <QueuePanel
                  queue={queueRows}
                  events={queueEvents}
                  onTimeChange={(levels, filteredQueue) => {
                    setQueueLevels(levels);
                    // Update queue rows count display
                    if (filteredQueue.length !== queueRows.length) {
                      // Don't replace original rows, just update levels
                    }
                  }}
                />
                {/* Queue upload */}
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <h3 className="mb-3 text-sm font-medium text-slate-200">
                    📋 Upload Queue Data
                  </h3>
                  <QueueUpload onUpload={handleQueueUpload} />
                </div>
              </div>
            )}
            {tab === "data" && (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-3 text-sm font-medium text-slate-200">
                  📄 Raw Data
                </h3>
                <p className="text-xs text-slate-500">
                  {allTrades.length === 0
                    ? "Load data to see raw trades here"
                    : `Showing ${displayedTrades.length}/${allTrades.length} trades`}
                </p>
                {allTrades.length > 0 && (
                  <div className="mt-3 max-h-[70vh] overflow-y-auto">
                    <pre className="rounded-lg bg-slate-950 p-3 text-[10px] text-slate-400 font-mono whitespace-pre-wrap">
                      {JSON.stringify(
                        allTrades.slice(0, 50),
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}
              </div>
            )}
            {tab === "stats" && (
              <StatsPanel trades={displayedTrades} levels={displayLevels} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Queue Upload Component
function QueueUpload({ onUpload }: { onUpload: (text: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onUpload(reader.result);
        }
      };
      reader.readAsText(file);
    },
    [onUpload]
  );

  const handlePaste = useCallback(() => {
    const text = textareaRef.current?.value;
    if (text && text.trim()) {
      onUpload(text);
    }
  }, [onUpload]);

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-lg border-2 border-dashed border-slate-700 p-4 text-center hover:border-slate-600"
      >
        <p className="text-xs text-slate-400">Upload Queue JSON/CSV</p>
        <p className="mt-1 text-[10px] text-slate-600">
          Format: JSON dari growin-fetch-all.py
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".json,.csv,.txt"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      <div>
        <textarea
          ref={textareaRef}
          rows={3}
          className="tool-input font-mono text-xs"
          placeholder="Paste queue JSON di sini..."
        />
        <button
          onClick={handlePaste}
          className="mt-2 w-full tool-btn-ghost text-xs"
        >
          📥 Load Queue Data
        </button>
      </div>
    </div>
  );
}
