/**
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
  {
    id: 'monza',
    name: 'Monza',
    country: 'Italy',
    fact: 'The fastest circuit on the calendar, and mostly long straights joined by three big stops.',
    points: [
      [3, 22.9], [15.6, 23.2], [19.6, 28.1], [29.9, 38.9], [40.2, 55],
      [44.2, 59], [46.6, 59.6], [48.2, 61.9], [51.2, 61.9], [58.6, 63.6],
      [75.8, 66.5], [86.2, 67.1], [93, 68.1], [97, 71.1], [95.9, 74.5],
      [90.2, 76.5], [75.8, 77.1], [58.6, 75.6], [44.2, 73.9], [41.4, 72.8],
      [36.8, 71.9], [35.7, 70.8], [33.3, 71.1], [27.1, 72.5], [21.3, 72.2],
      [15.6, 69.3], [12.5, 65.3], [11.3, 61.3], [9.2, 53.8], [8.5, 46.4],
      [7.9, 41.8], [6.7, 40.6], [5.5, 40.3], [5, 38.9], [4.4, 33.8],
      [3.8, 28.6]
    ]
  },
  {
    id: 'monaco',
    name: 'Monaco',
    country: 'Monaco',
    fact: 'Barely three and a bit kilometres of public road, and the slowest corner in Formula 1 is in the middle of it.',
    points: [
      [84.6, 4.1], [80.8, 8.9], [76, 17.5], [72.2, 27.1], [68.3, 34.3],
      [74.1, 38.5], [77.9, 35.7], [82.7, 39.5], [87.4, 9.9], [92.2, 11.8],
      [97, 12.7], [95.1, 22.9], [90.9, 29.9], [82.7, 38.5], [74.1, 43.3],
      [65.5, 45.8], [47.3, 46.2], [46.4, 50.6], [40.6, 50], [38.7, 48.1],
      [28.2, 47.7], [18.7, 48.1], [16.8, 51.9], [15.4, 55.7], [14.8, 61.5],
      [16.4, 64.3], [14.8, 69.7], [14.5, 74.8], [11.6, 79.2], [11, 85],
      [13.5, 90.1], [18.7, 94.9], [22.5, 95.9], [23.4, 93], [20.2, 89.2],
      [16.8, 84.4], [8.2, 82.5], [3.4, 71], [3, 60.5], [4.3, 50],
      [8.2, 43.3], [11.6, 40.1], [14.8, 39.5], [28.2, 41.4], [42.5, 42],
      [49.2, 38.5], [56.9, 37.6], [64.5, 36.6], [68.3, 34.3]
    ]
  },
  {
    id: 'suzuka',
    name: 'Suzuka',
    country: 'Japan',
    fact: 'The only figure-of-eight on the calendar: the back straight crosses the first sector on a bridge.',
    points: [
      [76, 34.4], [90.3, 35.3], [95.5, 37.6], [97, 41.8], [96.4, 46.4],
      [93.8, 47.6], [90.3, 44.7], [86.9, 45.6], [83.4, 47.6], [80, 48.5],
      [77.1, 46.2], [74.2, 45.3], [70.8, 47.4], [67.4, 48.5], [64.2, 46.8],
      [62, 43], [60.8, 40.7], [57.6, 40.5], [54.1, 42.4], [51.8, 47],
      [51, 51.6], [52.6, 55.6], [50.7, 60.2], [46.7, 63.1], [42.1, 57.4],
      [38, 52.8], [35.2, 48.2], [33.6, 45.2], [32.9, 47.6], [32, 49.9],
      [31.2, 52.2], [27.1, 56], [21.4, 58.5], [15.1, 59.4], [9.1, 57.9],
      [5.1, 58.8], [3, 63.1], [4.1, 66.3], [7.9, 66.9], [16.8, 66],
      [28.3, 63.7], [36.3, 61.7], [43.2, 59.3], [47.8, 57.1], [51.3, 53.3],
      [52.8, 48.2], [53, 42.4], [52.2, 39.3], [53.9, 38.2], [55.1, 34.9],
      [57.6, 33.1], [64.5, 33.6], [70.2, 33.9]
    ]
  },
  {
    id: 'spa',
    name: 'Spa-Francorchamps',
    country: 'Belgium',
    fact: 'Seven kilometres through a forest, and Eau Rouge climbs more than a four-storey building.',
    points: [
      [19.1, 67], [6.2, 69.9], [3, 72.7], [5.2, 74.2], [9, 72],
      [11.9, 64.9], [10.5, 60.5], [15.5, 56.2], [19.1, 49.1], [22.7, 44.8],
      [28.4, 41.9], [41.3, 31.8], [53.5, 26.8], [67.9, 21.8], [75.8, 19.6],
      [80.1, 22.9], [82.2, 21.8], [86.5, 20.8], [90.1, 24.7], [96.6, 34.7],
      [97, 38.7], [93, 35.9], [87.2, 31.8], [80.1, 34], [66.4, 41.9],
      [64, 44], [64.3, 50.5], [70, 54.8], [83.7, 56], [85.1, 60.5],
      [88.7, 63.4], [93, 69.9], [91.5, 74.9], [84.4, 79.2], [77.2, 80.4],
      [66.4, 74.9], [60.7, 64.9], [50.6, 56], [48.5, 54.5], [39.9, 57],
      [32, 59.8], [27, 60.5], [25.5, 63.8], [23.4, 64.9]
    ]
  },
  {
    id: 'silverstone',
    name: 'Silverstone',
    country: 'United Kingdom',
    fact: 'Maggotts and Becketts is a sequence of direction changes taken at around 300 km/h.',
    points: [
      [3, 36.7], [9.3, 29.1], [21.8, 27.3], [33.1, 24.1], [36.8, 26],
      [40.6, 24.7], [46.9, 22.4], [50.6, 22.2], [53.8, 23.9], [56.9, 26.6],
      [63.2, 32.6], [73.2, 39.8], [84.5, 44.8], [92, 49.2], [97, 55.5],
      [97, 61.1], [92, 65.5], [84.5, 68], [82, 71.1], [79.5, 73],
      [76.9, 76.1], [71.9, 77.8], [65.7, 75.3], [59.4, 73], [53.1, 70.2],
      [50.4, 65.5], [49.4, 58.6], [48.7, 50.4], [48.1, 44.8], [46.2, 39.8],
      [42.5, 37.9], [45, 36.7], [45.6, 33.5], [43.7, 32.3], [40, 31.4],
      [38.1, 36.7], [31.2, 50.4], [21.8, 58.6], [17.4, 61.7], [14.9, 64.9],
      [16.2, 67.4], [19.3, 68], [21.2, 65.9], [19.9, 63], [11.1, 61.1],
      [6.1, 54.2], [4, 44.8]
    ]
  },
  {
    id: 'interlagos',
    name: 'Interlagos',
    country: 'Brazil',
    fact: 'Run anti-clockwise, and the whole lap climbs and falls across a natural bowl.',
    points: [
      [28.7, 36.4], [20.7, 42.5], [13.5, 48.3], [7.6, 50.5], [3, 51.7],
      [7.4, 57.5], [9.1, 60.4], [8.5, 65], [8.1, 70.1], [10.3, 74.9],
      [16.4, 77.4], [31.6, 77.8], [49.8, 77.8], [64.3, 77.4], [78.8, 74.9],
      [80.7, 70.8], [78.8, 62.9], [75.9, 58.9], [60.7, 51.7], [49.8, 46.9],
      [44.7, 44.4], [41.8, 41.1], [42.2, 37.1], [45.4, 35.3], [50.5, 35],
      [53.9, 29.9], [55.6, 29.3], [56.3, 33.8], [58.2, 40.3], [61.4, 39.9],
      [65.5, 35.3], [73.8, 27.4], [76.8, 28.1], [72.3, 36], [70.1, 44.7],
      [70.6, 50.5], [75.2, 54.6], [80.3, 55.3], [87.6, 53.4], [93.4, 46.9],
      [97, 41.8], [93.4, 31.6], [83.9, 22.9], [71.6, 22.2], [53.4, 22.6],
      [42.5, 24.8], [35.3, 30.6]
    ]
  }
];

export const circuitById = (id: string) => CIRCUITS.find((c) => c.id === id);
