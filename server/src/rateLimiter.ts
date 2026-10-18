/** Einfacher Token-Bucket: `rate` Nachrichten pro Sekunde, kurzfristig bis `burst`. */
export class RateLimiter {
  private tokens: number;
  private last: number;

  constructor(
    private rate = 10,
    private burst = 20,
    private now: () => number = Date.now,
  ) {
    this.tokens = burst;
    this.last = now();
  }

  allow(): boolean {
    const t = this.now();
    this.tokens = Math.min(this.burst, this.tokens + ((t - this.last) / 1000) * this.rate);
    this.last = t;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
