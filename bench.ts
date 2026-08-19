import {mergeCidr, excludeCidr, expandCidr, overlapCidr, containsCidr, normalizeCidr, parseCidr} from "./index.ts";

const runs = Number(process.env.BENCH_RUNS) || 5;
const filter = process.env.BENCH_FILTER;

// Results escape here, otherwise V8 deletes the measured work outright.
let sink: unknown;

function bench(name: string, ops: number, fn: () => unknown): void {
  if (filter && !name.includes(filter)) return;
  for (let i = 0; i < ops; i++) sink = fn(); // warmup
  const times: number[] = [];
  for (let run = 0; run < runs; run++) {
    const start = performance.now();
    for (let i = 0; i < ops; i++) sink = fn();
    times.push((performance.now() - start) * 1e6 / ops);
  }
  times.sort((a, b) => a - b);
  console.info(`${name.padEnd(36)}${times[runs >> 1].toFixed(1).padStart(9)} ns/op`);
}

const v4cidrs = ["10.0.0.0/8", "192.168.0.0/16", "172.16.0.0/12", "1.2.3.0/24", "5.6.7.0/24"];
const v6cidrs = ["::1/128", "fe80::/10", "fc00::/7", "2001:db8::/32", "2001:db8:1::/48"];
const many4 = Array.from({length: 2000}, (_, i) => `${(i >>> 8) & 0xff}.${i & 0xff}.0.0/24`);
const many6 = Array.from({length: 2000}, (_, i) => `2001:db8:${i.toString(16)}::/48`);

// paired `unchecked` rows keep the cost of the default boundary validation visible
const unchecked = {validate: false};

bench("parseCidr v4", 1e6, () => parseCidr("10.0.0.0/8"));
bench("parseCidr v4 unchecked", 1e6, () => parseCidr("10.0.0.0/8", unchecked));
bench("parseCidr v6", 5e5, () => parseCidr("fe80::/10"));
bench("parseCidr v6 unchecked", 5e5, () => parseCidr("fe80::/10", unchecked));

bench("normalizeCidr v4", 5e5, () => normalizeCidr("10.0.0.0/8"));
bench("normalizeCidr v6", 2e5, () => normalizeCidr("fe80::/10"));
bench("normalizeCidr v6 no prefix", 2e5, () => normalizeCidr("2001:db8::1"));
bench("normalizeCidr v6 uncompressed", 2e5, () => normalizeCidr("fe80::/10", {compress: false}));
bench("normalizeCidr v6 mapped", 2e5, () => normalizeCidr("::ffff:1.2.3.4"));

bench("mergeCidr v4", 2e5, () => mergeCidr(v4cidrs));
bench("mergeCidr v6", 1e5, () => mergeCidr(v6cidrs));
bench("mergeCidr v4 2000 nets", 300, () => mergeCidr(many4));
bench("mergeCidr v6 2000 nets", 300, () => mergeCidr(many6));
bench("mergeCidr v6 2000 unchecked", 300, () => mergeCidr(many6, unchecked));

bench("excludeCidr v4", 2e5, () => excludeCidr(["10.0.0.0/8"], ["10.1.0.0/16"]));
bench("excludeCidr v6", 2e4, () => excludeCidr(["fe80::/10"], ["fe80:1::/32"]));
bench("excludeCidr v4 2000 nets", 300, () => excludeCidr(many4, v4cidrs));

bench("overlapCidr v4 array", 3e5, () => overlapCidr(v4cidrs, ["10.1.0.0/16"]));
bench("overlapCidr v6 array", 1e5, () => overlapCidr(v6cidrs, ["fe80:1::/32"]));
bench("overlapCidr v4 single", 1e6, () => overlapCidr("10.0.0.0/8", "10.1.0.0/16"));
bench("overlapCidr v6 single", 5e5, () => overlapCidr("fe80::/10", "fe80:1::/32"));

bench("containsCidr v4 array", 3e5, () => containsCidr(v4cidrs, "10.1.0.0/16"));
bench("containsCidr v6 array", 1e5, () => containsCidr(v6cidrs, "fe80:1::/32"));
bench("containsCidr v4 single", 1e6, () => containsCidr("10.0.0.0/8", "10.1.0.0/16"));
bench("containsCidr v6 single", 5e5, () => containsCidr("fe80::/10", "fe80:1::/32"));

bench("expandCidr v4", 1e4, () => Array.from(expandCidr("10.0.0.0/24")));
bench("expandCidr v6", 1e4, () => Array.from(expandCidr("fe80::/120")));

if (sink === undefined) console.error("sink is empty, results were optimized away");
