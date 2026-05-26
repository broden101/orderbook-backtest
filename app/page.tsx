"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Trade,
  OrderLevel,
  PlaybackState,
  SideFilter,
  TabId,
  OrderBookData,
} from "@/lib/types";
import {
  parseTradeCsv,
  mapRowsToTrades,
  buildOrderBook,
  calcChange,
  generateSampleData,
} from "@/lib/parser";
import { OrderBookPanel } from "@/components/OrderBookPanel";
import { RunningTradePanel } from "@/components/RunningTradePanel";
import { BacktestControls } from "@/components/BacktestControls";
import { StatsPanel } from "@/components/StatsPanel";

export default function Home() {
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [displayedTrades, setDisplayedTrades] = useState<Trade[]>([]);
  const [levels, setLevels] = useState<OrderLevel[]>([]);
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

  const handleGenerateSample = useCallback(() => {
    const trades = generateSampleData();
    loadData(trades);
  }, [loadData]);

  const handleReset = useCallback(() => {
    stopPlayback();
    setAllTrades([]);
    setDisplayedTrades([]);
    setLevels([]);
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
      // Reset if done
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
        // Final rebuild with all trades
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
      // Restart with new speed
      const idx = playback.currentIndex;
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

  const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: "backtest", label: "Backtest", icon: "🎮" },
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
            levels={levels}
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

        {/* RIGHT: Running Trade + Controls or Data/Stats */}
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

          {/* Right sidebar: Controls / Data / Stats */}
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
              />
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
              <StatsPanel trades={displayedTrades} levels={levels} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
