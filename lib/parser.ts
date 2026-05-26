import { Trade, OrderLevel, TradeRow, OrderQueueEntry, OrderQueueRow } from "./types";

// ── CSV Parser ────────────────────────────────────────────

export function parseTradeCsv(text: string): TradeRow[] {
  const lines = text.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length === 0) return [];

  // Auto-detect delimiter
  const delim = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].split(delim).map((h) => h.trim());
  const rows: TradeRow[] = [];

  // Normalize header to title case for consistent access
  const normalizeHeader = (h: string) => {
    const lower = h.toLowerCase();
    // Map common variants
    if (lower === "type") return "Side"; // "type" column is actually "Side" in our CSV
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  };
  const normHeader = header.map(normalizeHeader);

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim);
    if (cols.length < 4) continue;

    const row: Record<string, string> = {};
    normHeader.forEach((h, idx) => {
      row[h] = (cols[idx] || "").trim();
    });

    rows.push(row as unknown as TradeRow);
  }
  return rows;
}

export function mapRowsToTrades(rows: TradeRow[]): Trade[] {
  return rows.map((r, idx) => {
    const price = parseFloat(r.Price) || 0;
    const lot = parseInt(r.Lot) || 0;
    const rawSide = r.Side?.trim().toUpperCase() || "";
    const side = rawSide === "BUY" || rawSide === "B" ? "BUY" : "SELL";
    const refPrice = price - (price * 0.005); // estimate
    const changePct = refPrice > 0 ? ((price - refPrice) / refPrice) * 100 : 0;

    return {
      id: `t${idx}`,
      time: r.Time || "",
      code: r.Code || "",
      price,
      lot,
      change: price - refPrice,
      changePct,
      side,
      board: r.Board || "",
    };
  });
}

// ── Order Queue Parser (from Growin JSON) ─────────────────

export function parseOrderQueue(entries: OrderQueueEntry[]): OrderQueueRow[] {
  return entries.map((e) => {
    const rawSide = (e.side || "").toString().toUpperCase();
    const side = rawSide === "BID" || rawSide === "BUY" ? "BID" : "OFFER";
    return {
      price: (e.price as number) || 0,
      side,
      lot: (e.lot as number) || (e.volume as number) || 0,
      freq: (e.freq as number) || 0,
      broker: (e.broker as string) || (e.broker_code as string) || "",
      time: (e.queue_time as string) || (e.time as string) || "",
    };
  });
}

// Build order book levels from trades
export function buildOrderBook(trades: Trade[]): {
  levels: OrderLevel[];
  lastPrice: number;
  high: number;
  low: number;
  open: number;
  volume: number;
} {
  if (trades.length === 0) {
    return { levels: [], lastPrice: 0, high: 0, low: 0, open: 0, volume: 0 };
  }

  const priceMap = new Map<
    number,
    { bidLot: number; bidFreq: number; offerLot: number; offerFreq: number }
  >();

  let lastPrice = 0;
  let high = 0;
  let low = Infinity;
  let open = trades[0].price;
  let volume = 0;

  for (const t of trades) {
    if (t.price > 0) lastPrice = t.price;
    if (t.price > high) high = t.price;
    if (t.price < low) low = t.price;
    volume += t.lot;

    const entry = priceMap.get(t.price) || {
      bidLot: 0,
      bidFreq: 0,
      offerLot: 0,
      offerFreq: 0,
    };

    if (t.side === "BUY") {
      entry.bidLot += t.lot;
      entry.bidFreq += 1;
    } else {
      entry.offerLot += t.lot;
      entry.offerFreq += 1;
    }
    priceMap.set(t.price, entry);
  }

  const levels: OrderLevel[] = Array.from(priceMap.entries())
    .map(([price, d]) => ({
      price,
      bidLot: d.bidLot,
      bidFreq: d.bidFreq,
      offerLot: d.offerLot,
      offerFreq: d.offerFreq,
    }))
    .sort((a, b) => b.price - a.price);

  return {
    levels,
    lastPrice,
    high,
    low: low === Infinity ? 0 : low,
    open,
    volume,
  };
}

// Build order book from queue data (more accurate - actual bid/offer placed)
export function buildOrderBookFromQueue(queue: OrderQueueRow[]): OrderLevel[] {
  if (queue.length === 0) return [];

  const priceMap = new Map<
    number,
    { bidLot: number; bidFreq: number; offerLot: number; offerFreq: number }
  >();

  for (const q of queue) {
    const entry = priceMap.get(q.price) || {
      bidLot: 0,
      bidFreq: 0,
      offerLot: 0,
      offerFreq: 0,
    };

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
    .map(([price, d]) => ({
      price,
      bidLot: d.bidLot,
      bidFreq: d.bidFreq,
      offerLot: d.offerLot,
      offerFreq: d.offerFreq,
    }))
    .sort((a, b) => b.price - a.price);
}

// Calculate change percentage relative to open
export function calcChange(lastPrice: number, open: number): number {
  if (open === 0) return 0;
  return ((lastPrice - open) / open) * 100;
}

// ── Sample data generator ─────────────────────────────────

export function generateSampleData(): Trade[] {
  const trades: Trade[] = [];
  const basePrice = 170;
  const stock = "BUMI";
  let price = basePrice;

  for (let h = 9; h <= 16; h++) {
    for (let m = 0; m < 60; m += 1) {
      if (h === 9 && m < 30) continue;
      const volatility = Math.random() * 8 - 4;
      price = Math.max(150, Math.min(185, price + volatility * 0.3));

      for (let t = 0; t < Math.floor(Math.random() * 5) + 1; t++) {
        const lotMultiplier = Math.floor(Math.random() * 10) + 1;
        const side = Math.random() > 0.5 ? "BUY" : "SELL";
        const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(Math.floor(Math.random() * 59)).padStart(2, "0")}`;

        trades.push({
          id: `s${h}${m}${t}`,
          time: timeStr,
          code: stock,
          price: Math.round(price),
          lot: 5 * lotMultiplier,
          change: side === "BUY" ? Math.round(price - basePrice) : Math.round(basePrice - price),
          changePct: ((price - basePrice) / basePrice) * 100,
          side: side as "BUY" | "SELL",
        });
      }
    }
  }
  return trades;
}

// ── CSV export for sample ────────────────────────────────

export function tradesToCsv(trades: Trade[]): string {
  const header = "Time,Code,Price,Lot,Change,Side\n";
  const rows = trades
    .map(
      (t) =>
        `${t.time},${t.code},${t.price},${t.lot},${t.change.toFixed(2)},${t.side}`
    )
    .join("\n");
  return header + rows;
}
