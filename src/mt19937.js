const N = 624;
const M = 397;
const MATRIX_A = 0x9908b0df;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;

export class MT19937 {
  constructor(seed = 5489) {
    this.mt = new Uint32Array(N);
    this.index = N;
    this.seed(seed);
  }

  seed(seed) {
    this.mt[0] = seed >>> 0;
    for (let i = 1; i < N; i += 1) {
      const prev = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = (Math.imul(1812433253, prev) + i) >>> 0;
    }
    this.index = N;
  }

  nextUint32() {
    if (this.index >= N) {
      this.twist();
    }

    let y = this.mt[this.index];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;

    this.index += 1;
    return y >>> 0;
  }

  next() {
    return this.nextUint32() / 0x100000000;
  }

  twist() {
    for (let i = 0; i < N; i += 1) {
      const x = (this.mt[i] & UPPER_MASK) + (this.mt[(i + 1) % N] & LOWER_MASK);
      let xa = x >>> 1;
      if (x % 2 !== 0) {
        xa ^= MATRIX_A;
      }
      this.mt[i] = this.mt[(i + M) % N] ^ xa;
    }
    this.index = 0;
  }
}
