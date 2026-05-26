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
}

// Order Book level
export interface OrderLevel {
  price: number;
  bidLot: number;
  bidFreq: number;
  offerLot: number;
  offerFreq: number;
}

// Parsed data from user input
export interface OrderBookData {
  stock: string;
  lastPrice: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  open: number;
  volume: number;
  value: number;
  frequency: number;
  levels: OrderLevel[];
  trades: Trade[];
}

// Playback state
export interface PlaybackState {
  status: "idle" | "playing" | "paused" | "done";
  currentIndex: number;
  speed: number; // 1x, 2x, 5x, 10x
  elapsed: number;
}

// CSV trade row
export interface TradeRow {
  Time: string;
  Code: string;
  Price: string;
  Lot: string;
  Change: string;
  Side: string;
}

export type SideFilter = "all" | "BUY" | "SELL";
export type TabId = "backtest" | "data" | "stats";
