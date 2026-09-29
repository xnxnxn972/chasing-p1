/**
 * Turn the traced reference maps into circuits.ts.
 *
 *   node tools/traceCircuits.mjs > src/minigames/TrackRecall/circuits.ts
 *
 * COORDINATES BELOW ARE RAW PIXELS read off the standard published circuit
 * maps, in the image's own frame with y running down. They are NOT normalised
 * by hand — `fit()` does that — because hand-normalising was where the first
 * attempt lost its accuracy: dividing every point by an eyeballed scale and
 * adding an eyeballed offset introduced error on top of error.
 *
 * Two earlier approaches failed and are recorded so they are not repeated:
 *
 *   1. DRAWING FROM MEMORY. Suzuka came out with no crossover at all and
 *      Silverstone had none of its shape. These silhouettes are iconic, so
 *      wrong is obvious to anyone who watches the sport.
 *   2. TRACING OPENSTREETMAP. The data exists and is correctly licensed, but
 *      these venues run several layouts over shared tarmac, so reassembling
 *      the Grand Prix lap from highway=raceway segments kept turning off onto
 *      connectors. Every circuit came back about a quarter of its real length.
 */

/** Traced from the published maps. [x, y] in image pixels, y down. */
const RAW = {
  // 1687 x 1000. Top-left straight, the long diagonal to Ascari, the run to
  // Parabolica, then back up the left with the step before the top.
  monza: [
    [30, 25], [150, 20], [265, 28], [330, 110], [400, 190],
    [480, 290], [560, 390], [640, 490], [700, 570], [742, 628],
    [772, 655], [802, 645], [832, 662], [872, 700], [905, 716],
    [1000, 735], [1150, 760], [1300, 780], [1420, 790], [1520, 797],
    [1600, 806], [1645, 820], [1675, 858], [1668, 902], [1620, 940],
    [1540, 960], [1400, 966], [1200, 960], [1000, 946], [850, 930],
    [720, 916], [688, 906], [658, 890], [630, 874], [604, 858],
    [588, 876], [520, 886], [430, 891], [358, 886], [288, 866],
    [238, 830], [204, 786], [184, 730], [169, 660], [154, 570],
    [140, 470], [131, 390], [119, 350], [104, 334], [84, 330],
    [71, 318], [61, 268], [54, 200], [44, 120], [37, 60]
  ],

  // 1920 x 1080. The tall hook: Casino peak top right, the notch beside it,
  // the descent to Portier, the long tail down to the swimming pool and the
  // hairpin at the bottom, then back up the inside.
  monaco: [
    [1290, 55], [1240, 90], [1190, 140], [1150, 195], [1120, 250],
    [1105, 310], [1110, 355], [1120, 390], [1098, 412], [1000, 420],
    [900, 430], [868, 446], [840, 452], [760, 450], [700, 452],
    [620, 450], [556, 440], [530, 432], [510, 446], [492, 490],
    [470, 560], [452, 640], [443, 710], [438, 780], [443, 850],
    [455, 915], [480, 965], [515, 1010], [560, 1030], [610, 1035],
    [645, 1010], [655, 975], [638, 945], [605, 925], [575, 905],
    [560, 860], [552, 810], [556, 760], [570, 720], [562, 680],
    [558, 640], [570, 600], [582, 560], [590, 530], [615, 515],
    [700, 512], [790, 512], [822, 522], [846, 526], [872, 510],
    [892, 504], [902, 530], [906, 548], [936, 540], [1000, 530],
    [1080, 508], [1150, 480], [1210, 440], [1270, 390], [1320, 330],
    [1355, 270], [1380, 215], [1402, 164], [1416, 130], [1400, 118],
    [1374, 117], [1354, 126], [1340, 152], [1330, 186], [1320, 216],
    [1306, 204], [1300, 174], [1297, 128], [1294, 88]
  ],

  // 2000 x 1125. Start/finish top right, the esses down the right, Degner,
  // the turn 11 spike, Spoon at the far left, then the back straight crossing
  // the turn 9-10 section on its way up to the final chicane.
  suzuka: [
    [1410, 290], [1550, 285], [1650, 290], [1730, 305], [1790, 330],
    [1815, 375], [1820, 440], [1810, 490], [1780, 515], [1720, 505],
    [1680, 470], [1630, 480], [1590, 510], [1540, 525], [1490, 505],
    [1450, 480], [1410, 478], [1360, 505], [1315, 530], [1270, 520],
    [1240, 480], [1215, 430], [1190, 400], [1150, 385], [1105, 395],
    [1060, 430], [1030, 480], [1010, 540], [1010, 600], [1030, 650],
    [1010, 690], [975, 725], [945, 745], [900, 710], [860, 665],
    [820, 615], [790, 570], [760, 520], [730, 480], [712, 470],
    [700, 492], [695, 530], [680, 580], [650, 630], [600, 675],
    [530, 710], [450, 730], [370, 735], [300, 715], [240, 700],
    [195, 720], [175, 770], [185, 820], [225, 850], [290, 855],
    [400, 840], [520, 820], [650, 795], [780, 765], [870, 740],
    [930, 710], [975, 680], [1000, 650], [1015, 600], [1030, 520],
    [1045, 450], [1040, 390], [1060, 360], [1085, 345], [1100, 300],
    [1125, 268], [1180, 255], [1250, 265], [1330, 275]
  ],

  // 2000 x 1125. La Source, Eau Rouge and the climb, Les Combes at the top
  // right, Pouhon down the right, Stavelot, then the long return along the
  // bottom to the Bus Stop.
  spa: [
    [560, 800], [470, 830], [400, 855], [355, 880], [350, 905],
    [385, 915], [430, 895], [460, 840], [470, 780], [455, 715],
    [470, 660], [510, 610], [555, 545], [585, 505], [620, 480],
    [660, 465], [760, 400], [880, 330], [1000, 270], [1120, 215],
    [1240, 170], [1330, 140], [1370, 125], [1400, 145], [1420, 175],
    [1445, 165], [1480, 145], [1510, 150], [1545, 190], [1580, 250],
    [1620, 320], [1645, 375], [1650, 396], [1620, 386], [1570, 340],
    [1520, 300], [1460, 300], [1400, 330], [1320, 385], [1240, 435],
    [1200, 470], [1190, 520], [1210, 575], [1265, 615], [1350, 635],
    [1440, 638], [1480, 655], [1490, 700], [1520, 740], [1570, 790],
    [1605, 840], [1600, 890], [1555, 940], [1480, 965], [1390, 975],
    [1310, 950], [1230, 895], [1180, 830], [1120, 755], [1055, 680],
    [1010, 635], [975, 620], [900, 635], [820, 665], [740, 690],
    [690, 700], [665, 715], [655, 745], [630, 765], [600, 782]
  ],

  // 2000 x 1125. The wide arrowhead: the top edge to Abbey, down the right to
  // Stowe, the chicane at the bottom, up the inside, the Becketts crook, the
  // Wellington diagonal down to The Loop, and back up the left.
  silverstone: [
    [180, 250], [230, 190], [300, 160], [400, 150], [500, 145],
    [600, 130], [680, 110], [710, 90], [740, 115], [770, 120],
    [800, 105], [850, 85], [900, 72], [940, 68], [970, 74],
    [1000, 92], [1030, 122], [1060, 162], [1130, 225], [1220, 290],
    [1320, 350], [1420, 400], [1520, 445], [1600, 490], [1660, 550],
    [1695, 620], [1690, 690], [1650, 740], [1590, 770], [1530, 790],
    [1490, 800], [1465, 826], [1445, 860], [1420, 876], [1400, 900],
    [1375, 935], [1330, 960], [1260, 940], [1180, 915], [1100, 885],
    [1030, 860], [985, 835], [960, 780], [950, 700], [943, 610],
    [935, 520], [925, 440], [910, 370], [895, 330], [925, 300],
    [938, 270], [920, 242], [885, 232], [852, 245], [838, 272],
    [850, 300], [820, 272], [800, 232], [790, 208], [720, 300],
    [640, 400], [560, 490], [490, 570], [440, 640], [405, 690],
    [375, 735], [385, 785], [425, 805], [468, 790], [482, 748],
    [462, 712], [390, 690], [320, 640], [265, 575], [228, 490],
    [208, 400], [196, 320], [186, 275]
  ],

  // 2000 x 1125. Senna S down to turn 1, the long bottom, up the hill to the
  // infield squiggle, the far right loop, then the top back to the start.
  interlagos: [
    [700, 335], [640, 390], [560, 455], [480, 505], [420, 525],
    [370, 535], [355, 560], [375, 595], [405, 625], [420, 650],
    [428, 690], [425, 740], [422, 790], [432, 835], [455, 870],
    [500, 895], [600, 905], [750, 908], [900, 908], [1050, 905],
    [1180, 900], [1290, 890], [1370, 872], [1408, 845], [1420, 805],
    [1412, 750], [1390, 700], [1340, 650], [1270, 605], [1160, 550],
    [1060, 505], [980, 470], [930, 450], [900, 430], [882, 400],
    [884, 365], [905, 335], [940, 322], [985, 320], [1020, 310],
    [1045, 275], [1062, 243], [1085, 238], [1098, 265], [1100, 310],
    [1110, 355], [1130, 388], [1165, 385], [1200, 350], [1235, 300],
    [1280, 250], [1330, 215], [1360, 218], [1378, 245], [1370, 285],
    [1340, 320], [1300, 375], [1280, 430], [1278, 490], [1295, 545],
    [1340, 585], [1400, 595], [1470, 580], [1530, 540], [1580, 485],
    [1605, 420], [1600, 350], [1570, 280], [1520, 200], [1450, 155],
    [1370, 140], [1270, 138], [1150, 142], [1040, 150], [950, 168],
    [870, 205], [800, 255], [745, 300]
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

/**
 * Fit into a 0-100 box, preserving aspect ratio and centring.
 *
 * Aspect ratio is the part that must not be lost: most of these circuits are
 * markedly landscape, and stretching one to fill a square is enough on its own
 * to make it unrecognisable.
 */
function fit(pts) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX;
  const h = Math.max(...ys) - minY;
  const s = 94 / Math.max(w, h);
  const ox = (100 - w * s) / 2;
  const oy = (100 - h * s) / 2;
  return pts.map((p) => [
    Math.round(((p[0] - minX) * s + ox) * 10) / 10,
    Math.round(((p[1] - minY) * s + oy) * 10) / 10
  ]);
}

const order = ['monza', 'monaco', 'suzuka', 'spa', 'silverstone', 'interlagos'];

let out = `/**
 * TRACK RECALL — the circuits.
 *
 * TRACED FROM THE STANDARD PUBLISHED MAPS and kept in their conventional
 * orientation and proportions, because these silhouettes are iconic: an
 * audience of Formula 1 fans spots a wrong one immediately.
 *
 * Simplified, though: corner radii are approximate and a five-second glance
 * is all the player gets. Not track geometry, and not to be used as any.
 *
 * Coordinates are a 0-100 box with y running DOWN, matching canvas axes.
 * Do not edit by hand — change tools/traceCircuits.mjs and regenerate:
 *   node tools/traceCircuits.mjs > src/minigames/TrackRecall/circuits.ts
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
