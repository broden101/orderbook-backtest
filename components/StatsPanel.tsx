"use client";

import { Trade, OrderLevel } from "@/lib/types";

interface Props {
  trades: Trade[];
  levels: OrderLevel[];
}

export function StatsPanel({ trades, levels }: Props) {
  const buyTrades = trades.filter((t) => t.side === "BUY");
  const sellTrades = trades.filter((t) => t.side === "SELL");
  const totalBuyLot = buyTrades.reduce((s, t) => s + t.lot, 0);
  const totalSellLot = sellTrades.reduce((s, t) => s + t.lot, 0);
  const avgBuy = buyTrades.length > 0
    ? buyTrades.reduce((s, t) => s + t.price, 0) / buyTrades.length
    : 0;
  const avgSell = sellTrades.length > 0
    ? sellTrades.reduce((s, t) => s + t.price, 0) / sellTrades.length
    : 0;

  // Top price levels by volume
  const priceVol = new Map<number, { lot: number; buy: number; sell: number }>();
  for (const t of trades) {
    const e = priceVol.get(t.price) || { lot: 0, buy: 0, sell: 0 };
    e.lot += t.lot;
    if (t.side === "BUY") e.buy += t.lot;
    else e.sell += t.lot;
    priceVol.set(t.price, e);
  }
  const topPrices = Array.from(priceVol.entries())
    .sort((a, b) => b[1].lot - a[1].lot)
    .slice(0, 10);

  if (trades.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-500">
        Load data to see statistics
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
          <p className="text-xs text-slate-500">Total Trades</p>
          <p className="mt-1 text-xl font-bold text-slate-200">
            {trades.length.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
          <p className="text-xs text-slate-500">Total Lot</p>
          <p className="mt-1 text-xl font-bold text-slate-200">
            {(totalBuyLot + totalSellLot).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-green-900/30 bg-green-900/10 p-3">
          <p className="text-xs text-green-400/70">BUY Lot</p>
          <p className="mt-1 text-xl font-bold text-green-400">
            {totalBuyLot.toLocaleString()}
          </p>
          <p className="text-xs text-green-600">
            Avg: Rp{avgBuy.toFixed(0)}
          </p>
        </div>
        <div className="rounded-lg border border-red-900/30 bg-red-900/10 p-3">
          <p className="text-xs text-red-400/70">SELL Lot</p>
          <p className="mt-1 text-xl font-bold text-red-400">
            {totalSellLot.toLocaleString()}
          </p>
          <p className="text-xs text-red-600">
            Avg: Rp{avgSell.toFixed(0)}
          </p>
        </div>
      </div>

      {/* Top Price Levels */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h4 className="mb-3 text-xs font-medium text-slate-500">
          🔥 Top Price Levels by Volume
        </h4>
        <div className="space-y-1.5">
          {topPrices.map(([price, d]) => {
            const total = d.buy + d.sell;
            return (
              <div key={price} className="grid grid-cols-4 gap-2 text-xs">
                <span className="font-medium text-slate-300">{price}</span>
                <span className="text-green-400">
                  {d.buy.toLocaleString()}
                </span>
                <span className="text-red-400">
                  {d.sell.toLocaleString()}
                </span>
                <span className="text-right text-slate-500">
                  {d.buy > d.sell ? "🟢 Buy Dom" : "🔴 Sell Dom"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Order Book depth summary */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h4 className="mb-3 text-xs font-medium text-slate-500">
          📊 Order Book Depth
        </h4>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-slate-500">Total Bid Levels</p>
            <p className="mt-1 text-lg font-bold text-green-400">
              {levels.filter((l) => l.bidLot > 0).length}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Total Offer Levels</p>
            <p className="mt-1 text-lg font-bold text-red-400">
              {levels.filter((l) => l.offerLot > 0).length}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Buy/Sell Ratio</p>
            <p className="mt-1 text-lg font-bold text-slate-200">
              {sellTrades.length > 0
                ? (buyTrades.length / sellTrades.length).toFixed(2)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Price Range</p>
            <p className="mt-1 text-lg font-bold text-slate-200">
              {levels.length > 0
                ? `${levels[levels.length - 1]?.price} - ${levels[0]?.price}`
                : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
