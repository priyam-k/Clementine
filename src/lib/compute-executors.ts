// ─── Real JavaScript computation executors ───────────────────────────────────
// These run in the browser on worker nodes and produce genuine computed results.
// Each executor yields to the event loop periodically to avoid freezing the tab.

// ─── Prime Sieve ─────────────────────────────────────────────────────────────
// Counts primes in [rangeStart, rangeEnd] using a segmented Sieve of Eratosthenes.

export async function executePrimeSieveTask(
  payload: Record<string, unknown>,
  onProgress: (p: number) => void
): Promise<Record<string, unknown>> {
  const startTime = Date.now();
  const rangeStart = Math.max(2, typeof payload.rangeStart === "number" ? payload.rangeStart : 1_000_000);
  const rangeEnd = Math.min(50_000_000, typeof payload.rangeEnd === "number" ? payload.rangeEnd : 2_000_000);

  onProgress(3);

  const sqrtEnd = Math.floor(Math.sqrt(rangeEnd));
  const smallSieve = new Uint8Array(sqrtEnd + 1);
  const smallPrimes: number[] = [];
  for (let i = 2; i <= sqrtEnd; i++) {
    if (!smallSieve[i]) {
      smallPrimes.push(i);
      for (let j = i * i; j <= sqrtEnd; j += i) smallSieve[j] = 1;
    }
  }

  onProgress(8);

  const SEGMENT = 65536;
  let primeCount = 0;
  let largestPrime = 0;
  const total = rangeEnd - rangeStart;

  for (let low = rangeStart; low <= rangeEnd; low += SEGMENT) {
    const high = Math.min(low + SEGMENT - 1, rangeEnd);
    const sieve = new Uint8Array(high - low + 1);

    for (const p of smallPrimes) {
      const firstMultiple = Math.ceil(low / p) * p;
      const start = firstMultiple === p ? p * p : firstMultiple;
      for (let j = start; j <= high; j += p) sieve[j - low] = 1;
    }

    for (let i = (low <= 2 ? 2 : low); i <= high; i++) {
      if (!sieve[i - low]) {
        primeCount++;
        largestPrime = i;
      }
    }

    onProgress(8 + Math.floor(((low - rangeStart) / total) * 87));
    await new Promise<void>((r) => setTimeout(r, 0));
  }

  return {
    primeCount,
    largestPrime,
    rangeStart,
    rangeEnd,
    density: parseFloat((primeCount / total).toFixed(8)),
    durationMs: Date.now() - startTime,
  };
}

// ─── Text Analysis ────────────────────────────────────────────────────────────
// Word frequency, statistics, and basic NLP on a text sample.

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with","by",
  "from","is","was","are","were","be","been","has","have","had","do","does","did",
  "will","would","could","should","may","might","it","its","this","that","these",
  "those","i","you","he","she","we","they","my","your","his","her","our","their",
  "not","so","if","as","up","out","no","can","into","than","then","when","who",
  "what","which","there","all","also","just","more","about","over","after","back",
  "other","new","some","time","way","only","because","while","where","most",
]);

export async function executeTextAnalysisTask(
  payload: Record<string, unknown>,
  onProgress: (p: number) => void
): Promise<Record<string, unknown>> {
  const startTime = Date.now();
  const text = typeof payload.text === "string" ? payload.text : "";
  const topN = typeof payload.topN === "number" ? payload.topN : 20;

  onProgress(10);

  const words = text.toLowerCase().match(/\b[a-z']+\b/g) ?? [];
  const sentences = (text.match(/[.!?]+\s/g) ?? []).length + 1;
  const avgWordLen = words.length > 0
    ? words.reduce((s, w) => s + w.length, 0) / words.length
    : 0;

  onProgress(35);

  const freq: Record<string, number> = {};
  for (const w of words) {
    if (w.length > 2 && !STOP_WORDS.has(w)) freq[w] = (freq[w] ?? 0) + 1;
  }

  onProgress(65);

  // Bigram frequency
  const bigrams: Record<string, number> = {};
  for (let i = 0; i < words.length - 1; i++) {
    const bg = `${words[i]} ${words[i + 1]}`;
    bigrams[bg] = (bigrams[bg] ?? 0) + 1;
  }

  onProgress(85);

  const topWords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => `${word}:${count}`)
    .join(", ");

  const topBigrams = Object.entries(bigrams)
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([bg, c]) => `"${bg}":${c}`)
    .join(", ");

  // Lexical diversity (type-token ratio)
  const ttr = words.length > 0
    ? parseFloat((Object.keys(freq).length / words.length).toFixed(4))
    : 0;

  return {
    totalWords: words.length,
    uniqueWords: Object.keys(freq).length,
    lexicalDiversity: ttr,
    avgWordLength: parseFloat(avgWordLen.toFixed(2)),
    sentenceCount: sentences,
    avgSentenceLength: parseFloat((words.length / sentences).toFixed(1)),
    topWords: topWords || "(none)",
    topBigrams: topBigrams || "(none)",
    durationMs: Date.now() - startTime,
  };
}

// ─── Monte Carlo ──────────────────────────────────────────────────────────────
// Estimates π or computes integrals via random sampling.

export async function executeMonteCarloTask(
  payload: Record<string, unknown>,
  onProgress: (p: number) => void
): Promise<Record<string, unknown>> {
  const startTime = Date.now();
  const iterations = Math.min(
    5_000_000,
    typeof payload.iterations === "number" ? payload.iterations : 1_000_000
  );
  const target = typeof payload.target === "string" ? payload.target : "pi";

  const BATCH = 200_000;
  let inside = 0;

  for (let i = 0; i < iterations; i += BATCH) {
    const batchSize = Math.min(BATCH, iterations - i);
    for (let j = 0; j < batchSize; j++) {
      const x = Math.random() * 2 - 1;
      const y = Math.random() * 2 - 1;
      if (x * x + y * y <= 1) inside++;
    }
    onProgress(5 + Math.floor(((i + batchSize) / iterations) * 90));
    await new Promise<void>((r) => setTimeout(r, 0));
  }

  const estimate = (inside / iterations) * 4;
  const piError = Math.abs(estimate - Math.PI);
  const relativeError = piError / Math.PI;

  // Also compute variance estimation via Welford's online algorithm
  let mean = 0;
  let m2 = 0;
  const sampleN = Math.min(10000, iterations);
  for (let i = 0; i < sampleN; i++) {
    const x = Math.random();
    const y = Math.random();
    const inCircle = x * x + y * y <= 1 ? 1 : 0;
    const delta = inCircle - mean;
    mean += delta / (i + 1);
    m2 += delta * (inCircle - mean);
  }
  const variance = sampleN > 1 ? m2 / (sampleN - 1) : 0;

  return {
    target,
    estimate: parseFloat(estimate.toFixed(8)),
    piError: parseFloat(piError.toFixed(8)),
    relativeError: parseFloat(relativeError.toFixed(6)),
    accuracy: parseFloat(((1 - relativeError) * 100).toFixed(4)),
    iterations,
    samplingVariance: parseFloat(variance.toFixed(6)),
    durationMs: Date.now() - startTime,
  };
}

// ─── Sort Benchmark ───────────────────────────────────────────────────────────
// Generates a deterministic array and measures sort performance + statistics.

export async function executeSortBenchmarkTask(
  payload: Record<string, unknown>,
  onProgress: (p: number) => void
): Promise<Record<string, unknown>> {
  const startTime = Date.now();
  const size = Math.min(
    2_000_000,
    typeof payload.size === "number" ? payload.size : 500_000
  );
  const seed = typeof payload.seed === "number" ? payload.seed : 42;

  onProgress(5);

  // Generate pseudo-random array using LCG — deterministic, reproducible
  const arr = new Float64Array(size);
  let s = (seed >>> 0) || 1;
  for (let i = 0; i < size; i++) {
    s = Math.imul(s, 1664525) + 1013904223;
    arr[i] = (s >>> 0) / 0xffffffff;
  }

  onProgress(25);

  const sortArr = Array.from(arr);
  const genMs = Date.now() - startTime;

  const sortStart = Date.now();
  sortArr.sort((a, b) => a - b);
  const sortMs = Date.now() - sortStart;

  onProgress(80);

  const n = sortArr.length;
  const min = sortArr[0];
  const max = sortArr[n - 1];
  const median = sortArr[Math.floor(n / 2)];
  const p10 = sortArr[Math.floor(n * 0.1)];
  const p90 = sortArr[Math.floor(n * 0.9)];

  // Sample for mean (full pass would be O(n))
  let sum = 0;
  const step = Math.max(1, Math.floor(n / 10000));
  let samples = 0;
  for (let i = 0; i < n; i += step) { sum += sortArr[i]; samples++; }
  const mean = sum / samples;

  return {
    size,
    seed,
    generationMs: genMs,
    sortMs,
    itemsPerSecond: Math.round(size / Math.max(sortMs, 1) * 1000),
    min: parseFloat(min.toFixed(6)),
    max: parseFloat(max.toFixed(6)),
    mean: parseFloat(mean.toFixed(6)),
    median: parseFloat(median.toFixed(6)),
    p10: parseFloat(p10.toFixed(6)),
    p90: parseFloat(p90.toFixed(6)),
    durationMs: Date.now() - startTime,
  };
}

// ─── Number Crunch ────────────────────────────────────────────────────────────
// Full statistical analysis + linear regression on a number array.

export async function executeNumberCrunchTask(
  payload: Record<string, unknown>,
  onProgress: (p: number) => void
): Promise<Record<string, unknown>> {
  const startTime = Date.now();
  const raw = Array.isArray(payload.numbers) ? (payload.numbers as unknown[]) : [];
  const numbers = raw.filter((n): n is number => typeof n === "number" && isFinite(n));
  const label = typeof payload.label === "string" ? payload.label : "dataset";

  if (numbers.length === 0) {
    return { error: "no valid numbers provided", label, durationMs: Date.now() - startTime };
  }

  onProgress(15);

  const n = numbers.length;
  let sum = 0;
  let min = numbers[0];
  let max = numbers[0];
  for (const x of numbers) {
    sum += x;
    if (x < min) min = x;
    if (x > max) max = x;
  }
  const mean = sum / n;

  onProgress(35);

  // Variance & stdDev (Welford's)
  let m2 = 0;
  let runMean = 0;
  for (let i = 0; i < n; i++) {
    const delta = numbers[i] - runMean;
    runMean += delta / (i + 1);
    m2 += delta * (numbers[i] - runMean);
  }
  const variance = n > 1 ? m2 / (n - 1) : 0;
  const stdDev = Math.sqrt(variance);

  onProgress(55);

  // Median
  const sorted = [...numbers].sort((a, b) => a - b);
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  // Percentiles
  const p25 = sorted[Math.floor(n * 0.25)];
  const p75 = sorted[Math.floor(n * 0.75)];

  onProgress(70);

  // Linear regression (OLS)
  const xBar = (n - 1) / 2;
  let sxy = 0; let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (i - xBar) * (numbers[i] - mean);
    sxx += (i - xBar) ** 2;
  }
  const slope = sxx > 0 ? sxy / sxx : 0;
  const intercept = mean - slope * xBar;
  let ssTot = 0; let ssRes = 0;
  for (let i = 0; i < n; i++) {
    ssTot += (numbers[i] - mean) ** 2;
    ssRes += (numbers[i] - (slope * i + intercept)) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 1;

  onProgress(90);

  // Skewness & kurtosis
  let skewAcc = 0; let kurtAcc = 0;
  for (const x of numbers) {
    const z = stdDev > 0 ? (x - mean) / stdDev : 0;
    skewAcc += z ** 3;
    kurtAcc += z ** 4;
  }
  const skewness = n > 2 ? (skewAcc / n) * (n / ((n - 1) * (n - 2))) * n : 0;
  const kurtosis = n > 3 ? kurtAcc / n - 3 : 0;

  const trend = slope > stdDev * 0.01 ? "increasing" : slope < -stdDev * 0.01 ? "decreasing" : "stable";

  return {
    label,
    count: n,
    sum: parseFloat(sum.toFixed(4)),
    mean: parseFloat(mean.toFixed(4)),
    median: parseFloat(median.toFixed(4)),
    stdDev: parseFloat(stdDev.toFixed(4)),
    variance: parseFloat(variance.toFixed(4)),
    min: parseFloat(min.toFixed(4)),
    max: parseFloat(max.toFixed(4)),
    p25: parseFloat(p25.toFixed(4)),
    p75: parseFloat(p75.toFixed(4)),
    skewness: parseFloat(skewness.toFixed(4)),
    kurtosis: parseFloat(kurtosis.toFixed(4)),
    trend,
    slope: parseFloat(slope.toFixed(6)),
    r2: parseFloat(r2.toFixed(4)),
    durationMs: Date.now() - startTime,
  };
}
