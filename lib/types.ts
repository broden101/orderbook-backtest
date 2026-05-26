// Running Trade types
export interface Trade {
  id: string;
  time: string; // HH:MM:SS
  code: string;
  price: number;
  lot: number;
  change: number; // +/-
  changePct: number;
  side: "BUY" | "SELL";
  board?: string;
}

export interface TradeRow {
  Time: string;
  Code: string;
  Price: string;
  Lot: string;
  Change: string;
  Side: string;
  Board?: string;
  [key: string]: string | undefined;
}

// Order Book level
export interface OrderLevel {
  price: number;
  bidLot: number;
  bidFreq: number;
  offerLot: number;
  offerFreq: number;
}

// Order Queue (from Growin API - bid/offer yang dipasang)
export interface OrderQueueEntry {
  symbol?: string;
  price?: number;
  side?: string; // "Bid" | "Offer" | "Buy" | "Sell"
  volume?: number;
  lot?: number;
  freq?: number;
  broker?: string;
  broker_code?: string;
  queue_time?: string;
  time?: string;
  [key: string]: unknown;
}

export interface OrderQueueRow {
  price: number;
  side: "BID" | "OFFER";
  lot: number;
  freq: number;
  broker: string;
  time: string;
}

export interface OrderBookData {
  levels: OrderLevel[];
  lastPrice: number;
  high: number;
  low: number;
  open: number;
  volume: number;
  value: number;
}

export interface PlaybackState {
  status: "idle" | "playing" | "paused" | "done";
  currentIndex: number;
  speed: number;
  elapsed: number;
}

export type SideFilter = "all" | "BUY" | "SELL";
export type TabId = "backtest" | "data" | "stats" | "queue";
