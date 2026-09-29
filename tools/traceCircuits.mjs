/**
 * Turn the traced reference maps into circuits.ts.
 *
 *   node tools/traceCircuits.mjs > src/minigames/TrackRecall/circuits.ts
 *
 * The outlines below were traced by hand from the standard circuit maps. Two
 * earlier approaches failed and are worth recording so nobody repeats them:
 *
 *   1. DRAWING FROM MEMORY. Suzuka came out as an angular blob with no
 *      crossover; Silverstone had none of its actual shape. These maps are
 *      iconic, which means wrong is instantly obvious to the audience.
 *   2. TRACING OPENSTREETMAP. The data is there and correctly licensed, but
 *      these venues carry several layouts over shared tarmac, so reassembling
 *      the Grand Prix lap from highway=raceway segments kept wandering onto
 *      connectors. Every circuit came back at a quarter of its real length.
 *
 * Tracing the published maps is both more accurate and far quicker.
 *
 * Coordinates here are raw pixel positions from the reference images divided
 * by a per-image scale. This script fits each into a 0-100 box, preserving
 * aspect ratio and centring, so the outlines stay in their conventional
 * orientation and proportions.
 */

const RAW = {
  monza: [
    [1.8, 1.2], [14.7, 1.5], [18.8, 6.5], [29.4, 17.6], [40, 34.1],
    [44.1, 38.2], [46.5, 38.8], [48.2, 41.2], [51.2, 41.2], [58.8, 42.9],
    [76.5, 45.9], [87.1, 46.5], [94.1, 47.6], [98.2, 50.6], [97.1, 54.1],
    [91.2, 56.2], [76.5, 56.8], [58.8, 55.3], [44.1, 53.5], [41.2, 52.4],
    [36.5, 51.5], [35.3, 50.3], [32.9, 50.6], [26.5, 52.1], [20.6, 51.8],
    [14.7, 48.8], [11.5, 44.7], [10.3, 40.6], [8.2, 32.9], [7.4, 25.3],
    [6.8, 20.6], [5.6, 19.4], [4.4, 19.1], [3.8, 17.6], [3.2, 12.4],
    [2.6, 7.1]
  ],
  monaco: [
    [64.5, 3], [62.5, 5.5], [60, 10], [58, 15], [56, 18.8],
    [59, 21], [61, 19.5], [63.5, 21.5], [66, 6], [68.5, 7],
    [71, 7.5], [70, 12.8], [67.8, 16.5], [63.5, 21], [59, 23.5],
    [54.5, 24.8], [45, 25], [44.5, 27.3], [41.5, 27], [40.5, 26],
    [35, 25.8], [30, 26], [29, 28], [28.3, 30], [28, 33],
    [28.8, 34.5], [28, 37.3], [27.8, 40], [26.3, 42.3], [26, 45.3],
    [27.3, 48], [30, 50.5], [32, 51], [32.5, 49.5], [30.8, 47.5],
    [29, 45], [24.5, 44], [22, 38], [21.8, 32.5], [22.5, 27],
    [24.5, 23.5], [26.3, 21.8], [28, 21.5], [35, 22.5], [42.5, 22.8],
    [46, 21], [50, 20.5], [54, 20], [56, 18.8]
  ],
  suzuka: [
    [72.5, 14.5], [85, 15.3], [89.5, 17.3], [90.8, 21], [90.3, 25],
    [88, 26], [85, 23.5], [82, 24.3], [79, 26], [76, 26.8],
    [73.5, 24.8], [71, 24], [68, 25.8], [65, 26.8], [62.3, 25.3],
    [60.3, 22], [59.3, 20], [56.5, 19.8], [53.5, 21.5], [51.5, 25.5],
    [50.8, 29.5], [52.2, 33], [50.5, 37], [47, 39.5], [43, 34.5],
    [39.5, 30.5], [37, 26.5], [35.6, 23.9], [35, 26], [34.2, 28],
    [33.5, 30], [30, 33.3], [25, 35.5], [19.5, 36.3], [14.3, 35],
    [10.8, 35.8], [9, 39.5], [10, 42.3], [13.3, 42.8], [21, 42],
    [31, 40], [38, 38.3], [44, 36.2], [48, 34.3], [51, 31],
    [52.3, 26.5], [52.5, 21.5], [51.8, 18.8], [53.3, 17.8], [54.3, 15],
    [56.5, 13.4], [62.5, 13.8], [67.5, 14.1]
  ],
  spa: [
    [28.5, 39.5], [19.5, 41.5], [17.3, 43.5], [18.8, 44.5], [21.5, 43],
    [23.5, 38], [22.5, 35], [26, 32], [28.5, 27], [31, 24],
    [35, 22], [44, 15], [52.5, 11.5], [62.5, 8], [68, 6.5],
    [71, 8.8], [72.5, 8], [75.5, 7.3], [78, 10], [82.5, 17],
    [82.8, 19.8], [80, 17.8], [76, 15], [71, 16.5], [61.5, 22],
    [59.8, 23.5], [60, 28], [64, 31], [73.5, 31.8], [74.5, 35],
    [77, 37], [80, 41.5], [79, 45], [74, 48], [69, 48.8],
    [61.5, 45], [57.5, 38], [50.5, 31.8], [49, 30.8], [43, 32.5],
    [37.5, 34.5], [34, 35], [33, 37.3], [31.5, 38]
  ],
  silverstone: [
    [10, 15], [15, 9], [25, 7.5], [34, 5], [37, 6.5],
    [40, 5.5], [45, 3.6], [48, 3.5], [50.5, 4.8], [53, 7],
    [58, 11.8], [66, 17.5], [75, 21.5], [81, 25], [85, 30],
    [85, 34.5], [81, 38], [75, 40], [73, 42.5], [71, 44],
    [69, 46.5], [65, 47.8], [60, 45.8], [55, 44], [50, 41.8],
    [47.8, 38], [47, 32.5], [46.5, 26], [46, 21.5], [44.5, 17.5],
    [41.5, 16], [43.5, 15], [44, 12.5], [42.5, 11.5], [39.5, 10.8],
    [38, 15], [32.5, 26], [25, 32.5], [21.5, 35], [19.5, 37.5],
    [20.5, 39.5], [23, 40], [24.5, 38.3], [23.5, 36], [16.5, 34.5],
    [12.5, 29], [10.8, 21.5]
  ],
  interlagos: [
    [35.5, 16.8], [30, 21], [25, 25], [21, 26.5], [17.8, 27.3],
    [20.8, 31.3], [22, 33.3], [21.6, 36.5], [21.3, 40], [22.8, 43.3],
    [27, 45], [37.5, 45.3], [50, 45.3], [60, 45], [70, 43.3],
    [71.3, 40.5], [70, 35], [68, 32.3], [57.5, 27.3], [50, 24],
    [46.5, 22.3], [44.5, 20], [44.8, 17.3], [47, 16], [50.5, 15.8],
    [52.8, 12.3], [54, 11.9], [54.5, 15], [55.8, 19.5], [58, 19.2],
    [60.8, 16], [66.5, 10.6], [68.6, 11.1], [65.5, 16.5], [64, 22.5],
    [64.3, 26.5], [67.5, 29.3], [71, 29.8], [76, 28.5], [80, 24],
    [82.5, 20.5], [80, 13.5], [73.5, 7.5], [65, 7], [52.5, 7.3],
    [45, 8.8], [40, 12.8]
  ]
};

const META = {
  monza: { name: 'Monza', country: 'Italy', fact: 'The fastest circuit on the calendar, and mostly long straights joined by three big stops.' },
  monaco: { name: 'Monaco', country: 'Monaco', fact: 'Barely three and a bit kilometres of public road, and the slowest corner in Formula 1 is in the middle of it.' },
  suzuka: { name: 'Suzuka', country: 'Japan', fact: 'The only figure-of-eight on the calendar: the back straight crosses the first sector on a bridge.' },
  spa: { name: 'Spa-Francorchamps', country: 'Belgium', fact: 'Seven kilometres through a forest, and Eau Rouge climbs more than a four-storey building.' },
  silverstone: { name: 'Silverstone', country: 'United Kingdom', fact: 'Maggotts and Becketts is a sequence of direction changes taken at around 300 km/h.' },
  interlagos: { name: 'Interlagos', country: 'Brazil', fact: 'Run anti-clockwise, and the whole lap climbs and falls across a natural bowl.' }
};

/** Fit into a 0-100 box, preserving aspect ratio and centring. */
function fit(pts) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  const span = Math.max(w, h) || 1;
  const s = 94 / span;
  const ox = (100 - w * s) / 2 - Math.min(...xs) * s;
  const oy = (100 - h * s) / 2 - Math.min(...ys) * s;
  return pts.map((p) => [
    Math.round((p[0] * s + ox) * 10) / 10,
    Math.round((p[1] * s + oy) * 10) / 10
  ]);
}

const order = ['monza', 'monaco', 'suzuka', 'spa', 'silverstone', 'interlagos'];

let out = `/**
 * TRACK RECALL — the circuits.
 *
 * TRACED FROM THE STANDARD PUBLISHED MAPS, and kept in their conventional
 * orientation, because these silhouettes are iconic: an audience of Formula 1
 * fans spots a wrong one instantly.
 *
 * Two earlier approaches failed, recorded so they are not repeated. Drawing
 * from memory produced a Suzuka with no crossover and a Silverstone with none
 * of its shape. Tracing OpenStreetMap looked right in principle and the data
 * is correctly licensed, but these venues run several layouts over shared
 * tarmac, so reassembling the Grand Prix lap from highway=raceway segments
 * kept turning off onto connectors and every circuit came back about a
 * quarter of its true length.
 *
 * These are simplified: corner counts and radii are approximate, and a
 * five-second glance is all the player gets anyway. They are for this game,
 * not for anything that needs real track geometry.
 *
 * Coordinates are a 0-100 box with y running DOWN, matching canvas axes.
 * Regenerate with: node tools/traceCircuits.mjs
 */

export interface Circuit {
  id: string;
  name: string;
  country: string;
  /** Closed loop, 0-100, y down. */
  points: [number, number][];
  /** One line shown with the result, so a play teaches something. */
  fact: string;
}

export const CIRCUITS: Circuit[] = [
`;

for (const id of order) {
  const m = META[id];
  const pts = fit(RAW[id]);
  out += `  {\n    id: '${id}',\n    name: '${m.name}',\n    country: '${m.country}',\n`;
  out += `    fact: '${m.fact.replace(/'/g, "\\'")}',\n    points: [\n`;
  for (let i = 0; i < pts.length; i += 5) {
    out += '      ' + pts.slice(i, i + 5).map((p) => `[${p[0]}, ${p[1]}]`).join(', ') + ',\n';
  }
  out = out.slice(0, -2) + '\n    ]\n  }' + (id === order[order.length - 1] ? '\n' : ',\n');
}

out += `];

export const circuitById = (id: string) => CIRCUITS.find((c) => c.id === id);
`;

process.stdout.write(out);
