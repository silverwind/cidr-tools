import {mergeCidr, excludeCidr, expandCidr, overlapCidr, containsCidr, normalizeCidr, parseCidr} from "./index.ts";

let t: DOMHighResTimeStamp;

const v4cidrs = ["10.0.0.0/8", "192.168.0.0/16", "172.16.0.0/12", "1.2.3.0/24", "5.6.7.0/24"];
const v6cidrs = ["::1/128", "fe80::/10", "fc00::/7", "2001:db8::/32", "2001:db8:1::/48"];

// warmup
for (let i = 0; i < 1e4; i++) {
  parseCidr("10.0.0.0/8");
  parseCidr("fe80::/10");
  normalizeCidr("10.0.0.0/8");
  normalizeCidr("fe80::/10");
  mergeCidr(v4cidrs);
  mergeCidr(v6cidrs);
  excludeCidr(["10.0.0.0/8"], ["10.1.0.0/16"]);
  excludeCidr(["fe80::/10"], ["fe80:1::/32"]);
  overlapCidr(v4cidrs, ["10.1.0.0/16"]);
  overlapCidr(v6cidrs, ["fe80:1::/32"]);
  overlapCidr("10.0.0.0/8", "10.1.0.0/16");
  overlapCidr("fe80::/10", "fe80:1::/32");
  containsCidr("10.0.0.0/8", "10.1.0.0/16");
  containsCidr("fe80::/10", "fe80:1::/32");
  containsCidr(v4cidrs, "10.1.0.0/16");
  containsCidr(v6cidrs, "fe80:1::/32");
}
for (let i = 0; i < 1e3; i++) {
  Array.from(expandCidr("10.0.0.0/24"));
  Array.from(expandCidr("fe80::/120"));
}

t = performance.now();
for (let i = 0; i < 1e6; i++) parseCidr("10.0.0.0/8");
console.info(`parseCidr v4: ${Math.round(performance.now() - t)}ms`);

t = performance.now();
for (let i = 0; i < 5e5; i++) parseCidr("fe80::/10");
console.info(`parseCidr v6: ${Math.round(performance.now() - t)}ms`);

t = performance.now();
for (let i = 0; i < 5e5; i++) normalizeCidr("10.0.0.0/8");
console.info(`normalizeCidr v4: ${Math.round(performance.now() - t)}ms`);

t = performance.now();
for (let i = 0; i < 2e5; i++) normalizeCidr("fe80::/10");
console.info(`normalizeCidr v6: ${Math.round(performance.now() - t)}ms`);

t = performance.now();
for (let i = 0; i < 2e5; i++) mergeCidr(v4cidrs);
console.info(`mergeCidr v4: ${Math.round(performance.now() - t)}ms`);

t = performance.now();
for (let i = 0; i < 1e5; i++) mergeCidr(v6cidrs);
console.info(`mergeCidr v6: ${Math.round(performance.now() - t)}ms`);

t = performance.now();
for (let i = 0; i < 2e5; i++) excludeCidr(["10.0.0.0/8"], ["10.1.0.0/16"]);
console.info(`excludeCidr v4: ${Math.round(performance.now() - t)}ms`);

t = performance.now();
for (let i = 0; i < 2e4; i++) excludeCidr(["fe80::/10"], ["fe80:1::/32"]);
console.info(`excludeCidr v6: ${Math.round(performance.now() - t)}ms`);

t = performance.now();
for (let i = 0; i < 3e5; i++) overlapCidr(v4cidrs, ["10.1.0.0/16"]);
console.info(`overlapCidr v4 array: ${Math.round(performance.now() - t)}ms`);

t = performance.now();
for (let i = 0; i < 1e5; i++) overlapCidr(v6cidrs, ["fe80:1::/32"]);
console.info(`overlapCidr v6 array: ${Math.round(performance.now() - t)}ms`);

t = performance.now();
for (let i = 0; i < 1e6; i++) overlapCidr("10.0.0.0/8", "10.1.0.0/16");
console.info(`overlapCidr v4 single: ${Math.round(performance.now() - t)}ms`);

t = performance.now();
for (let i = 0; i < 5e5; i++) overlapCidr("fe80::/10", "fe80:1::/32");
console.info(`overlapCidr v6 single: ${Math.round(performance.now() - t)}ms`);

t = performance.now();
for (let i = 0; i < 3e5; i++) containsCidr(v4cidrs, "10.1.0.0/16");
console.info(`containsCidr v4 array: ${Math.round(performance.now() - t)}ms`);

t = performance.now();
for (let i = 0; i < 1e5; i++) containsCidr(v6cidrs, "fe80:1::/32");
console.info(`containsCidr v6 array: ${Math.round(performance.now() - t)}ms`);

t = performance.now();
for (let i = 0; i < 1e6; i++) containsCidr("10.0.0.0/8", "10.1.0.0/16");
console.info(`containsCidr v4 single: ${Math.round(performance.now() - t)}ms`);

t = performance.now();
for (let i = 0; i < 5e5; i++) containsCidr("fe80::/10", "fe80:1::/32");
console.info(`containsCidr v6 single: ${Math.round(performance.now() - t)}ms`);

t = performance.now();
for (let i = 0; i < 1e4; i++) Array.from(expandCidr("10.0.0.0/24"));
console.info(`expandCidr v4: ${Math.round(performance.now() - t)}ms`);

t = performance.now();
for (let i = 0; i < 1e4; i++) Array.from(expandCidr("fe80::/120"));
console.info(`expandCidr v6: ${Math.round(performance.now() - t)}ms`);
