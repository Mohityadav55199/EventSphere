// Seat numbering shared with the backend (backend/utils/seatLayout.js); keep the logic identical.
// 10 seats per row,
// rows A..Z, then AA, AB, ...   seat #0 = "A1", #9 = "A10", #10 = "B1", #259 = "Z10", #260 = "AA1".
// The server only accepts seats that exist on that map, so a client cannot invent extra seats
// ("Z99", "VIP-1") to sell beyond the event's capacity.
export const SEATS_PER_ROW = 10;

export function rowLabel(rowIndex) {
  let n = rowIndex + 1;
  let label = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

export function rowIndexFromLabel(label) {
  let n = 0;
  for (const ch of label) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function seatIdAt(index) {
  return `${rowLabel(Math.floor(index / SEATS_PER_ROW))}${(index % SEATS_PER_ROW) + 1}`;
}

/** Index of a seat id on the map, or -1 if it is not a valid seat id at all. */
export function seatIndexOf(seatId) {
  const m = /^([A-Z]{1,3})([1-9]|10)$/.exec(String(seatId));
  if (!m) return -1;
  return rowIndexFromLabel(m[1]) * SEATS_PER_ROW + (Number(m[2]) - 1);
}

export function isSeatOnMap(seatId, capacity) {
  const i = seatIndexOf(seatId);
  return i >= 0 && i < capacity;
}
