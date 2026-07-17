type ScanProgress = (progress: number, label: string) => void;

export type AppraisalPixelScan = {
  text: string;
  ocrConfidence: number;
  cp: number | null;
  attackIv: number | null;
  defenseIv: number | null;
  hpIv: number | null;
};

export type PokemonBaseStats = {
  atk: number;
  def: number;
  hp: number;
};

// Levels 1 through 51 in half-level steps. Level 51 covers the Best Buddy boost.
const CP_MULTIPLIERS = [
  0.094, 0.1351374318, 0.16639787, 0.192650919, 0.21573247,
  0.2365726613, 0.25572005, 0.2735303812, 0.29024988, 0.3060573775,
  0.3210876, 0.3354450362, 0.34921268, 0.3624577511, 0.37523559,
  0.387592416, 0.39956728, 0.4111935514, 0.42250001, 0.432926419,
  0.44310755, 0.4530599591, 0.46279839, 0.472336083, 0.48168495,
  0.4908558003, 0.49985844, 0.508701765, 0.51739395, 0.5259425113,
  0.53435433, 0.542635767, 0.55079269, 0.558830576, 0.56675452,
  0.574569153, 0.58227891, 0.589887917, 0.59740001, 0.604818814,
  0.61215729, 0.619399365, 0.62656713, 0.633644533, 0.64065295,
  0.647576426, 0.65443563, 0.661214806, 0.667934, 0.674577537,
  0.68116492, 0.687680648, 0.69414365, 0.700538673, 0.70688421,
  0.713164996, 0.71939909, 0.725571552, 0.7317, 0.734741009,
  0.73776948, 0.740785574, 0.74378943, 0.746781211, 0.74976104,
  0.752729087, 0.75568551, 0.758630378, 0.76156384, 0.764486065,
  0.76739717, 0.770297266, 0.7731865, 0.776064962, 0.77893275,
  0.781790055, 0.78463697, 0.787473578, 0.79030001, 0.792803968,
  0.79530001, 0.797803921, 0.8003, 0.802803892, 0.8053,
  0.807803864, 0.81029999, 0.812803835, 0.81529999, 0.817803806,
  0.82029999, 0.822803778, 0.82529999, 0.82780375, 0.83029999,
  0.832803722, 0.83529999, 0.837803694, 0.84029999, 0.842803667,
  0.84529999,
] as const;

let activeProgress: ScanProgress | null = null;
let workerPromise: ReturnType<typeof createOcrWorker> | null = null;

async function createOcrWorker() {
  const { createWorker } = await import("tesseract.js");
  return createWorker("eng", undefined, {
    logger(message) {
      if (!activeProgress) return;
      if (message.status === "loading language traineddata") {
        activeProgress(12 + Math.round(message.progress * 18), "Loading local OCR model");
      } else if (message.status === "recognizing text") {
        activeProgress(30 + Math.round(message.progress * 62), "Reading species and CP");
      }
    },
  });
}

async function getOcrWorker() {
  workerPromise ??= createOcrWorker();
  return workerPromise;
}

function loadCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        reject(new Error("This browser cannot analyze image pixels."));
        return;
      }
      context.drawImage(image, 0, 0);
      resolve(canvas);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The screenshot could not be decoded."));
    };
    image.src = url;
  });
}

function pixelAt(data: Uint8ClampedArray, width: number, x: number, y: number) {
  const index = (y * width + x) * 4;
  return [data[index], data[index + 1], data[index + 2]] as const;
}

function isBarPixel(red: number, green: number, blue: number) {
  const gray = Math.max(red, green, blue) - Math.min(red, green, blue) < 18
    && (red + green + blue) / 3 >= 170
    && (red + green + blue) / 3 <= 240;
  const fill = red > 180 && green > 55 && (red - green > 30 || red - blue > 30);
  return gray || fill;
}

function isFilledPixel(red: number, green: number, blue: number) {
  return red > 180 && green > 55 && (red - green > 30 || red - blue > 30);
}

type BarRow = { y: number; start: number; end: number; density: number };

function findBarRow(data: Uint8ClampedArray, width: number, y: number): BarRow | null {
  const minX = Math.round(width * 0.04);
  const maxX = Math.round(width * 0.58);
  const allowedGap = Math.max(4, Math.round(width * 0.007));
  const marked: number[] = [];

  for (let x = minX; x <= maxX; x += 1) {
    if (isBarPixel(...pixelAt(data, width, x, y))) marked.push(x);
  }
  if (!marked.length) return null;

  const groups: Array<{ start: number; end: number; count: number }> = [];
  let start = marked[0];
  let previous = marked[0];
  let count = 1;
  for (const x of marked.slice(1)) {
    if (x - previous > allowedGap) {
      groups.push({ start, end: previous, count });
      start = x;
      count = 1;
    } else {
      count += 1;
    }
    previous = x;
  }
  groups.push({ start, end: previous, count });

  const group = groups
    .map((candidate) => ({
      ...candidate,
      span: candidate.end - candidate.start + 1,
      density: candidate.count / (candidate.end - candidate.start + 1),
    }))
    .filter((candidate) => candidate.start > width * 0.08 && candidate.start < width * 0.22)
    .filter((candidate) => candidate.span > width * 0.28 && candidate.span < width * 0.42)
    .filter((candidate) => candidate.end < width * 0.56 && candidate.density > 0.72)
    .sort((a, b) => b.density - a.density)[0];

  return group ? { y, start: group.start, end: group.end, density: group.density } : null;
}

function findIvBarRows(imageData: ImageData): BarRow[] {
  const { data, width, height } = imageData;
  const rows: BarRow[] = [];
  for (let y = Math.round(height * 0.55); y <= Math.round(height * 0.94); y += 1) {
    const row = findBarRow(data, width, y);
    if (row) rows.push(row);
  }

  const clusters: BarRow[][] = [];
  for (const row of rows) {
    const cluster = clusters.at(-1);
    if (!cluster || row.y - cluster.at(-1)!.y > 1) clusters.push([row]);
    else cluster.push(row);
  }

  const candidates = clusters
    .filter((cluster) => cluster.length >= Math.max(5, Math.round(width * 0.004)))
    .filter((cluster) => cluster.length <= Math.round(width * 0.045))
    .map((cluster) => cluster[Math.floor(cluster.length / 2)]);

  let best: { rows: BarRow[]; score: number } | null = null;
  for (let index = 0; index <= candidates.length - 3; index += 1) {
    for (let second = index + 1; second <= candidates.length - 2; second += 1) {
      for (let third = second + 1; third < candidates.length; third += 1) {
        const triplet = [candidates[index], candidates[second], candidates[third]];
        const firstGap = triplet[1].y - triplet[0].y;
        const secondGap = triplet[2].y - triplet[1].y;
        if (firstGap < height * 0.02 || secondGap < height * 0.02) continue;
        const spacingError = Math.abs(firstGap - secondGap) / Math.max(firstGap, secondGap);
        const horizontalError = (
          Math.abs(triplet[0].start - triplet[1].start)
          + Math.abs(triplet[1].start - triplet[2].start)
          + Math.abs(triplet[0].end - triplet[1].end)
          + Math.abs(triplet[1].end - triplet[2].end)
        ) / width;
        const score = spacingError * 4 + horizontalError;
        if (spacingError <= 0.35 && (!best || score < best.score)) best = { rows: triplet, score };
      }
    }
  }
  return best?.rows ?? [];
}

function measureIv(data: Uint8ClampedArray, width: number, row: BarRow) {
  let lastFilled = -1;
  for (let x = row.start; x <= row.end; x += 1) {
    if (isFilledPixel(...pixelAt(data, width, x, row.y))) lastFilled = x;
  }
  if (lastFilled < 0) return 0;
  const fraction = (lastFilled - row.start + 1) / (row.end - row.start + 1);
  return Math.max(0, Math.min(15, Math.round(fraction * 15)));
}

function readIvs(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [null, null, null] as const;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const rows = findIvBarRows(imageData);
  if (rows.length !== 3) return [null, null, null] as const;
  return rows.map((row) => measureIv(imageData.data, imageData.width, row)) as [number, number, number];
}

function extractCp(text: string) {
  const normalized = text.toUpperCase().replace(/[|]/g, "I");
  const match = normalized.match(/\bC[PFR]\s*[:#-]?\s*([0-9O]{2,5})\b/)
    ?? normalized.match(/\bCP([0-9O]{2,5})\b/);
  if (!match) return null;
  const value = Number(match[1].replaceAll("O", "0"));
  return Number.isInteger(value) && value >= 10 && value <= 10000 ? value : null;
}

export async function scanAppraisalImage(file: File, onProgress: ScanProgress): Promise<AppraisalPixelScan> {
  onProgress(3, "Preparing screenshot");
  const canvas = await loadCanvas(file);
  const [attackIv, defenseIv, hpIv] = readIvs(canvas);
  onProgress(10, attackIv === null ? "Reading appraisal" : "Appraisal bars found");

  activeProgress = onProgress;
  try {
    const worker = await getOcrWorker();
    const result = await worker.recognize(canvas, { rotateAuto: false });
    onProgress(96, "Matching Pokémon catalog");
    return {
      text: result.data.text,
      ocrConfidence: result.data.confidence,
      cp: extractCp(result.data.text),
      attackIv,
      defenseIv,
      hpIv,
    };
  } finally {
    activeProgress = null;
  }
}

export function inferPokemonLevel(
  cp: number,
  baseStats: PokemonBaseStats,
  attackIv: number,
  defenseIv: number,
  hpIv: number,
) {
  const attack = baseStats.atk + attackIv;
  const defense = Math.sqrt(baseStats.def + defenseIv);
  const stamina = Math.sqrt(baseStats.hp + hpIv);
  const matches: number[] = [];

  CP_MULTIPLIERS.forEach((multiplier, index) => {
    const calculated = Math.max(10, Math.floor((attack * defense * stamina * multiplier ** 2) / 10));
    if (calculated === cp) matches.push(1 + index * 0.5);
  });

  return matches.length === 1 ? matches[0] : null;
}
