// Price series: the value at a moment, moving averages.

// The value of `points` ([t, v], oldest first) at moment `t`: the last one
// at or before it, or null before the series starts.
export function pointAt(points, t) {
  let lo = 0;
  let hi = (points?.length || 0) - 1;
  let v = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] <= t) (v = points[mid][1]), (lo = mid + 1);
    else hi = mid - 1;
  }
  return v;
}
// Average of the last `n` values at each point (none for the first n-1).
export function movingAverage(points, n) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    sum += points[i][1];
    if (i >= n) sum -= points[i - n][1];
    if (i >= n - 1) out.push([points[i][0], sum / n]);
  }
  return out;
}
