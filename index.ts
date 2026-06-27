import {parseIp, stringifyIp, normalizeIp} from "ip-bigint";

const bits = {4: 32, 6: 128};

const octetStrings: string[] = Array.from({length: 256}, (_, i) => String(i));
const octetDotStrings: string[] = Array.from({length: 256}, (_, i) => `${i}.`);
const prefixStrings: string[] = Array.from({length: 129}, (_, i) => `/${i}`);
const prefixNumStrings: string[] = Array.from({length: 129}, (_, i) => String(i));
const hexStrings: string[] = Array.from({length: 256}, (_, i) => i.toString(16));
const hexPadStrings: string[] = Array.from({length: 256}, (_, i) => i.toString(16).padStart(2, "0"));
const hostMasks: bigint[] = Array.from({length: 129}, (_, i) => (1n << BigInt(i)) - 1n);
const hostNotMasks: bigint[] = hostMasks.map(mask => ~mask);

type Network = string;
type Networks = Network | ReadonlyArray<Network>;
type ValidIpVersion = 4 | 6;

type ParsedCidr = {
  cidr: string;
  ip: string;
  version: ValidIpVersion;
  prefix: string;
  prefixPresent: boolean;
  start: bigint;
  end: bigint;
};

type NormalizeOpts = {
  compress?: boolean;
  hexify?: boolean;
};

type Part4 = {
  start: number,
  end: number,
};

type Part6 = {
  start: bigint,
  end: bigint,
};

type LeanParsedCidr4 = {
  start: number;
  end: number;
  version: 4;
};

type LeanParsedCidr6 = {
  start: bigint;
  end: bigint;
  version: 6;
};

type LeanParsedCidr = LeanParsedCidr4 | LeanParsedCidr6;

const cmpV4StartEnd = (a: LeanParsedCidr4, b: LeanParsedCidr4): number => a.start - b.start || a.end - b.end;
const cmpV4Start = (a: LeanParsedCidr4, b: LeanParsedCidr4): number => a.start - b.start;
const cmpV6StartEnd = (a: LeanParsedCidr6, b: LeanParsedCidr6): number => a.start > b.start ? 1 : a.start < b.start ? -1 : a.end > b.end ? 1 : a.end < b.end ? -1 : 0;
const cmpV6Start = (a: LeanParsedCidr6, b: LeanParsedCidr6): number => a.start > b.start ? 1 : a.start < b.start ? -1 : 0;

// Returns 32-bit number, or -1 on failure. Parses s[0..end-1] to avoid substring allocation.
function parseIPv4Fast(s: string, end: number): number {
  let num = 0;
  let octet = 0;
  let dots = 0;
  let digits = 0;
  for (let i = 0; i < end; i++) {
    const c = s.charCodeAt(i);
    if (c === 46) { // '.'
      if (digits === 0 || octet > 255) return -1;
      num = (num << 8) | octet;
      octet = 0;
      dots++;
      digits = 0;
    } else if (c >= 48 && c <= 57) {
      octet = octet * 10 + (c - 48);
      digits++;
    } else {
      return -1;
    }
  }
  if (dots !== 3 || digits === 0 || octet > 255) return -1;
  return ((num << 8) | octet) >>> 0;
}

function formatIPv4Fast(n: number): string {
  return octetDotStrings[(n >>> 24) & 0xff] + octetDotStrings[(n >>> 16) & 0xff] + octetDotStrings[(n >>> 8) & 0xff] + octetStrings[n & 0xff];
}

function parsePrefixNum(str: string, slashIndex: number): number {
  if (slashIndex === -1) return -1;
  if (slashIndex + 1 >= str.length) throw new Error(`Network is not a CIDR or IP: "${str}"`);
  let prefixNum = 0;
  for (let i = slashIndex + 1; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 48 || c > 57) throw new Error(`Network is not a CIDR or IP: "${str}"`);
    prefixNum = prefixNum * 10 + (c - 48);
  }
  return prefixNum;
}

// Scratch state for zero-allocation IPv4 range parsing in parseIPv4Range.
// Callers must save needed values to locals before a second call clobbers them.
let rangeV4Start = 0;
let rangeV4End = 0;
let rangeV4Prefix = 0;
let rangeSlashIndex = -1;

function parseIPv4Range(str: string): boolean {
  rangeSlashIndex = str.indexOf("/");
  const ipEnd = rangeSlashIndex !== -1 ? rangeSlashIndex : str.length;
  const v4num = parseIPv4Fast(str, ipEnd);
  if (v4num === -1) return false;
  rangeV4Prefix = rangeSlashIndex !== -1 ? parsePrefixNum(str, rangeSlashIndex) : 32;
  const hostBits = 32 - rangeV4Prefix;
  if (hostBits >= 32) {
    rangeV4Start = 0;
    rangeV4End = 0xFFFFFFFF;
  } else {
    const mask = hostBits > 0 ? ((1 << hostBits) >>> 0) - 1 : 0;
    rangeV4Start = (v4num & ~mask) >>> 0;
    rangeV4End = (v4num | mask) >>> 0;
  }
  return true;
}

function doNormalize(cidr: Network, opts?: NormalizeOpts): Network {
  if (parseIPv4Range(cidr)) {
    const ip = formatIPv4Fast(rangeV4Start);
    return rangeSlashIndex !== -1 ? ip + prefixStrings[rangeV4Prefix] : ip;
  }

  // Non-standard IPv4 (octal, single-int, etc.) and IPv6: delegate to ip-bigint.
  const slashIndex = rangeSlashIndex; // reuse from the parseIPv4Range call above
  const prefixPresent = slashIndex !== -1;
  let prefixNum = prefixPresent ? parsePrefixNum(cidr, slashIndex) : -1;
  const {number, version, ipv4mapped, scopeid} = parseIp(prefixPresent ? cidr.substring(0, slashIndex) : cidr);
  if (prefixNum === -1) {
    prefixNum = bits[version];
  }

  if (version === 4) {
    const hostBits = 32 - prefixNum;
    let startNum = Number(number);
    if (hostBits >= 32) {
      startNum = 0;
    } else if (hostBits > 0) {
      startNum = (startNum & ~(((1 << hostBits) >>> 0) - 1)) >>> 0;
    }
    const ip = formatIPv4Fast(startNum);
    return (hostBits > 0 || prefixPresent) ? ip + prefixStrings[prefixNum] : ip;
  }

  const {compress = true, hexify = false} = opts || {};
  const hostBits = 128 - prefixNum;
  if (hostBits <= 0 && !prefixPresent) {
    return normalizeIp(cidr, {compress, hexify});
  }
  const start = hostBits > 0 ? number & hostNotMasks[hostBits] : number;
  // Masking can clear the `::ffff:` marker, leaving an address that is no longer v4-mapped.
  const startMapped = ipv4mapped && (start >> 32n) === 0xffffn;
  // stringifyIp already emits the canonical compressed form, so normalizeIp is only needed to expand.
  const ip = stringifyIp({number: start, version, ipv4mapped: startMapped, scopeid}, {hexify});
  return (compress ? ip : normalizeIp(ip, {compress, hexify})) + prefixStrings[prefixNum];
}

/** Returns a string or array (depending on input) with a normalized representation. Will not include a prefix on single IPs. Will set network address to the start of the network. */
export function normalizeCidr<T extends Networks>(cidr: T, opts?: NormalizeOpts): T {
  return (typeof cidr === "string" ? doNormalize(cidr, opts) : cidr.map(entry => doNormalize(entry, opts))) as T;
}

/** Returns a `parsed` Object which is used internally by this module. It can be used to test whether the passed network is IPv4 or IPv6 or to work with the BigInts directly. */
export function parseCidr(str: Network): ParsedCidr {
  const slashIndex = str.indexOf("/");
  const ipEnd = slashIndex !== -1 ? slashIndex : str.length;
  const prefixPresent = slashIndex !== -1;

  const v4num = parseIPv4Fast(str, ipEnd);
  if (v4num !== -1) {
    const prefixNum = prefixPresent ? parsePrefixNum(str, slashIndex) : 32;
    const ip = formatIPv4Fast(v4num);
    const prefix = prefixNumStrings[prefixNum] ?? String(prefixNum);
    const hostBits = 32 - prefixNum;
    let startNum: number, endNum: number;
    if (hostBits >= 32) {
      startNum = 0;
      endNum = 0xFFFFFFFF;
    } else {
      const mask = hostBits > 0 ? ((1 << hostBits) >>> 0) - 1 : 0;
      startNum = (v4num & ~mask) >>> 0;
      endNum = (v4num | mask) >>> 0;
    }
    return {
      cidr: ip + prefixStrings[prefixNum],
      ip,
      version: 4,
      prefix,
      prefixPresent,
      start: BigInt(startNum),
      end: BigInt(endNum),
    };
  }

  // Non-standard IPv4 (octal, single-int, etc.) and IPv6: delegate to ip-bigint.
  const ipPart = prefixPresent ? str.substring(0, slashIndex) : str;
  let prefixNum = prefixPresent ? parsePrefixNum(str, slashIndex) : -1;

  const {number, version, ipv4mapped, scopeid} = parseIp(ipPart);
  if (!version) {
    throw new Error(`Network is not a CIDR or IP: "${str}"`);
  }

  const numBits = bits[version];
  if (prefixNum === -1) {
    prefixNum = numBits;
  }

  const prefix = prefixNumStrings[prefixNum] ?? String(prefixNum);
  const ip = stringifyIp({number, version, ipv4mapped, scopeid});
  const hostBits = numBits - prefixNum;
  let start = number;
  let end = number;
  if (hostBits > 0) {
    start = number & hostNotMasks[hostBits];
    end = number | hostMasks[hostBits];
  }
  return {
    cidr: ip + prefixStrings[prefixNum],
    ip,
    version,
    prefix,
    prefixPresent,
    start,
    end,
  };
}

// Internal parser. v4 returns number start/end (32-bit math); v6 returns bigint start/end.
function parseCidrLean(str: Network): LeanParsedCidr {
  if (parseIPv4Range(str)) {
    return {start: rangeV4Start, end: rangeV4End, version: 4};
  }

  const slashIndex = rangeSlashIndex; // reuse from the parseIPv4Range call above
  const ipPart = slashIndex !== -1 ? str.substring(0, slashIndex) : str;
  let prefixNum = slashIndex !== -1 ? parsePrefixNum(str, slashIndex) : -1;

  const {number, version} = parseIp(ipPart);
  if (!version) {
    throw new Error(`Network is not a CIDR or IP: "${str}"`);
  }

  const numBits = bits[version];
  if (prefixNum === -1) {
    prefixNum = numBits;
  }

  const hostBits = numBits - prefixNum;

  if (version === 4) {
    const num = Number(number);
    if (hostBits >= 32) return {start: 0, end: 0xFFFFFFFF, version: 4};
    const mask = hostBits > 0 ? ((1 << hostBits) >>> 0) - 1 : 0;
    return {
      start: (num & ~mask) >>> 0,
      end: (num | mask) >>> 0,
      version: 4,
    };
  }

  if (hostBits <= 0) {
    return {start: number, end: number, version: 6};
  }
  return {
    start: number & hostNotMasks[hostBits],
    end: number | hostMasks[hostBits],
    version: 6,
  };
}

// Bit length via Math.clz32, avoiding toString(2) allocation.
function bigintBitLength(n: bigint): number {
  if (n === 0n) return 0;
  let len = 0;
  if (n >= 0x10000000000000000n) { n >>= 64n; len = 64; }
  while (n >= 0x100000000n) { n >>= 32n; len += 32; }
  return len + 32 - Math.clz32(Number(n));
}

function biggestPowerOfTwo(num: bigint): bigint {
  if (num === 0n) return 0n;
  return 1n << BigInt(bigintBitLength(num) - 1);
}

function biggestPowerOfTwo4(num: number): number {
  if (num === 0) return 0;
  if (num >= 0x100000000) return 0x100000000;
  return (1 << (31 - Math.clz32(num))) >>> 0;
}

// Greedily emit the largest CIDR-aligned block at each position, bounded by
// start's alignment (its lowest set bit) and the remaining size.
function subparts4(pStart: number, pEnd: number, output: string[]): void {
  let start = pStart;
  while (start <= pEnd) {
    const size = pEnd - start + 1;
    const lowBit = (start & -start) >>> 0; // 0 when start === 0, i.e. no alignment limit
    const blockSize = (lowBit !== 0 && lowBit <= size) ? lowBit : biggestPowerOfTwo4(size);
    output.push(formatIPv4Fast(start) + prefixStrings[Math.clz32(blockSize - 1)]);
    start += blockSize;
  }
}

// Greedily emit the largest CIDR-aligned block at each position. The block is
// bounded by start's alignment (its lowest set bit) and the remaining size.
function subparts6(pStart: bigint, pEnd: bigint, output: string[]): void {
  // Whole range is one aligned CIDR block (the common merge case): emit it and
  // skip the per-iteration alignment/size bookkeeping below.
  const fullSize = pEnd - pStart + 1n;
  const startLowBit = pStart & -pStart; // 0n when pStart === 0n, i.e. no alignment limit
  if ((fullSize & (fullSize - 1n)) === 0n && (startLowBit === 0n || startLowBit >= fullSize)) {
    output.push(stringifyIp({number: pStart, version: 6}) + prefixStrings[129 - bigintBitLength(fullSize)]);
    return;
  }
  let start = pStart;
  while (start <= pEnd) {
    const size = pEnd - start + 1n;
    const lowBit = start & -start; // 0n when start === 0n, i.e. no alignment limit
    const blockSize = (lowBit !== 0n && lowBit <= size) ? lowBit : biggestPowerOfTwo(size);
    output.push(stringifyIp({number: start, version: 6}) + prefixStrings[129 - bigintBitLength(blockSize)]);
    start += blockSize;
  }
}

function mergeIntervalsRaw4(nets: LeanParsedCidr4[]): Part4[] {
  if (nets.length === 0) return [];
  nets.sort(cmpV4StartEnd);
  const merged: Part4[] = [];
  let curStart = nets[0].start;
  let curEnd = nets[0].end;
  for (let i = 1; i < nets.length; i++) {
    const {start, end} = nets[i];
    if (start <= curEnd + 1) {
      if (end > curEnd) curEnd = end;
    } else {
      merged.push({start: curStart, end: curEnd});
      curStart = start;
      curEnd = end;
    }
  }
  merged.push({start: curStart, end: curEnd});
  return merged;
}

function mergeIntervalsRaw6(nets: LeanParsedCidr6[]): Part6[] {
  if (nets.length === 0) return [];
  nets.sort(cmpV6StartEnd);
  const merged: Part6[] = [];
  let curStart = nets[0].start;
  let curEnd = nets[0].end;
  for (let i = 1; i < nets.length; i++) {
    const {start, end} = nets[i];
    if (start <= curEnd + 1n) {
      if (end > curEnd) curEnd = end;
    } else {
      merged.push({start: curStart, end: curEnd});
      curStart = start;
      curEnd = end;
    }
  }
  merged.push({start: curStart, end: curEnd});
  return merged;
}

function subtractSorted4(bases: Part4[], excls: Part4[]): Part4[] {
  if (excls.length === 0) return bases;
  if (bases.length === 0) return [];

  const result: Part4[] = [];
  let j = 0;

  for (const base of bases) {
    let start = base.start;
    const end = base.end;

    while (j < excls.length && excls[j].end < start) {
      j++;
    }

    let k = j;
    while (k < excls.length && excls[k].start <= end && start <= end) {
      if (excls[k].start > start) {
        result.push({start, end: excls[k].start - 1});
      }
      start = excls[k].end + 1;
      k++;
    }

    if (start <= end) {
      result.push({start, end});
    }
  }

  return result;
}

function subtractSorted6(bases: Part6[], excls: Part6[]): Part6[] {
  if (excls.length === 0) return bases;
  if (bases.length === 0) return [];

  const result: Part6[] = [];
  let j = 0;

  for (const base of bases) {
    let start = base.start;
    const end = base.end;

    while (j < excls.length && excls[j].end < start) {
      j++;
    }

    let k = j;
    while (k < excls.length && excls[k].start <= end && start <= end) {
      if (excls[k].start > start) {
        result.push({start, end: excls[k].start - 1n});
      }
      start = excls[k].end + 1n;
      k++;
    }

    if (start <= end) {
      result.push({start, end});
    }
  }

  return result;
}

/** Returns an array of merged networks */
export function mergeCidr(nets: Networks): Array<Network> {
  const arr = typeof nets === "string" ? [nets] : nets;
  const v4: LeanParsedCidr4[] = [];
  const v6: LeanParsedCidr6[] = [];
  for (const s of arr) {
    const n = parseCidrLean(s);
    if (n.version === 4) v4.push(n); else v6.push(n);
  }

  const merged: Array<Network> = [];
  for (const part of mergeIntervalsRaw4(v4)) {
    subparts4(part.start, part.end, merged);
  }
  for (const part of mergeIntervalsRaw6(v6)) {
    subparts6(part.start, part.end, merged);
  }

  return merged;
}

/** Returns an array of merged remaining networks of the subtraction of `excludeNetworks` from `baseNetworks`. */
export function excludeCidr(base: Networks, excl: Networks): Array<Network> {
  const baseArr = typeof base === "string" ? [base] : base;
  const exclArr = typeof excl === "string" ? [excl] : excl;

  const v4base: LeanParsedCidr4[] = [], v6base: LeanParsedCidr6[] = [];
  const v4excl: LeanParsedCidr4[] = [], v6excl: LeanParsedCidr6[] = [];
  for (const s of baseArr) {
    const n = parseCidrLean(s);
    if (n.version === 4) v4base.push(n); else v6base.push(n);
  }
  for (const s of exclArr) {
    const n = parseCidrLean(s);
    if (n.version === 4) v4excl.push(n); else v6excl.push(n);
  }

  const result: Array<Network> = [];

  {
    const baseParts = mergeIntervalsRaw4(v4base);
    const exclParts = mergeIntervalsRaw4(v4excl);
    for (const part of subtractSorted4(baseParts, exclParts)) {
      subparts4(part.start, part.end, result);
    }
  }

  {
    const baseParts = mergeIntervalsRaw6(v6base);
    const exclParts = mergeIntervalsRaw6(v6excl);
    for (const part of subtractSorted6(baseParts, exclParts)) {
      subparts6(part.start, part.end, result);
    }
  }

  return result;
}

/** Returns a generator for individual IPs contained in the networks. */
export function* expandCidr(nets: Networks): Generator<Network> {
  const arr = typeof nets === "string" ? [nets] : nets;
  const v4: LeanParsedCidr4[] = [];
  const v6: LeanParsedCidr6[] = [];
  for (const s of arr) {
    const n = parseCidrLean(s);
    if (n.version === 4) v4.push(n); else v6.push(n);
  }

  if (v4.length > 0) {
    for (const part of mergeIntervalsRaw4(v4)) {
      let prevHigh = -1;
      let prefix = "";
      for (let num = part.start; num <= part.end; num++) {
        const high = num >>> 8;
        if (high !== prevHigh) {
          prefix = octetDotStrings[(num >>> 24) & 0xff] + octetDotStrings[(num >>> 16) & 0xff] + octetDotStrings[(num >>> 8) & 0xff];
          prevHigh = high;
        }
        yield prefix + octetStrings[num & 0xff];
      }
    }
  }

  if (v6.length > 0) {
    const ipObj = {number: 0n, version: 6 as const};
    for (const part of mergeIntervalsRaw6(v6)) {
      // Per 65536-IP block, the upper 112 bits are constant: stringify them once
      // and iterate the last group numerically. A nonzero last group never joins or
      // alters a zero run, so the compressed form is always that constant prefix
      // plus the group's hex digits.
      let num = part.start;
      while (num <= part.end) {
        const blockStart = num & ~0xffffn;
        const blockEnd = blockStart | 0xffffn;
        let group = Number(num & 0xffffn);
        const groupEnd = part.end < blockEnd ? Number(part.end & 0xffffn) : 0xffff;
        if (group === 0) {
          ipObj.number = blockStart;
          yield stringifyIp(ipObj); // last group zero can be absorbed into "::", stringify in full
          group = 1;
        }
        if (group <= groupEnd) {
          ipObj.number = blockStart | 1n;
          const prefix = stringifyIp(ipObj).slice(0, -1);
          for (; group <= groupEnd; group++) {
            yield group < 256 ? prefix + hexStrings[group] : prefix + hexStrings[group >>> 8] + hexPadStrings[group & 0xff];
          }
        }
        num = blockEnd + 1n;
      }
    }
  }
}

/** Returns a boolean that indicates if `networksA` overlap (intersect) with `networksB`. */
export function overlapCidr(a: Networks, b: Networks): boolean {
  // Fast path for single-vs-single (most common case)
  if (typeof a === "string" && typeof b === "string") {
    // Zero-allocation IPv4 fast path
    if (parseIPv4Range(a)) {
      const startA = rangeV4Start, endA = rangeV4End;
      if (parseIPv4Range(b)) {
        return startA <= rangeV4End && rangeV4Start <= endA;
      }
      const pb = parseCidrLean(b);
      if (pb.version !== 4) return false;
      return startA <= pb.end && pb.start <= endA;
    }
    const pa = parseCidrLean(a);
    const pb = parseCidrLean(b);
    if (pa.version !== pb.version) return false;
    return pa.start <= pb.end && pb.start <= pa.end;
  }

  const aArr = typeof a === "string" ? [a] : a;
  const bArr = typeof b === "string" ? [b] : b;

  const v4a: LeanParsedCidr4[] = [], v6a: LeanParsedCidr6[] = [];
  const v4b: LeanParsedCidr4[] = [], v6b: LeanParsedCidr6[] = [];
  for (const s of aArr) {
    const n = parseCidrLean(s);
    if (n.version === 4) v4a.push(n); else v6a.push(n);
  }
  for (const s of bArr) {
    const n = parseCidrLean(s);
    if (n.version === 4) v4b.push(n); else v6b.push(n);
  }

  // Single-element side uses linear scan to avoid sorting both arrays.
  if (v4a.length > 0 && v4b.length > 0) {
    if (v4b.length === 1) {
      const bs = v4b[0].start, be = v4b[0].end;
      for (const el of v4a) {
        if (el.start <= be && bs <= el.end) return true;
      }
    } else if (v4a.length === 1) {
      const as = v4a[0].start, ae = v4a[0].end;
      for (const el of v4b) {
        if (as <= el.end && el.start <= ae) return true;
      }
    } else {
      v4a.sort(cmpV4Start);
      v4b.sort(cmpV4Start);
      let i = 0, j = 0;
      while (i < v4a.length && j < v4b.length) {
        if (v4a[i].start <= v4b[j].end && v4b[j].start <= v4a[i].end) return true;
        if (v4a[i].end < v4b[j].end) i++; else j++;
      }
    }
  }

  if (v6a.length > 0 && v6b.length > 0) {
    if (v6b.length === 1) {
      const bs = v6b[0].start, be = v6b[0].end;
      for (const el of v6a) {
        if (el.start <= be && bs <= el.end) return true;
      }
    } else if (v6a.length === 1) {
      const as = v6a[0].start, ae = v6a[0].end;
      for (const el of v6b) {
        if (as <= el.end && el.start <= ae) return true;
      }
    } else {
      v6a.sort(cmpV6Start);
      v6b.sort(cmpV6Start);
      let i = 0, j = 0;
      while (i < v6a.length && j < v6b.length) {
        if (v6a[i].start <= v6b[j].end && v6b[j].start <= v6a[i].end) return true;
        if (v6a[i].end < v6b[j].end) i++; else j++;
      }
    }
  }

  return false;
}

/** Returns a boolean that indicates whether `networksA` fully contain all `networksB`. */
export function containsCidr(a: Networks, b: Networks): boolean {
  // Fast path for single-vs-single (most common case)
  if (typeof a === "string" && typeof b === "string") {
    // Zero-allocation IPv4 fast path
    if (parseIPv4Range(a)) {
      const startA = rangeV4Start, endA = rangeV4End;
      if (parseIPv4Range(b)) {
        return startA <= rangeV4Start && endA >= rangeV4End;
      }
      const pb = parseCidrLean(b);
      if (pb.version !== 4) return false;
      return startA <= pb.start && endA >= pb.end;
    }
    const pa = parseCidrLean(a);
    const pb = parseCidrLean(b);
    if (pa.version !== pb.version) return false;
    return pa.start <= pb.start && pa.end >= pb.end;
  }

  const aArr = typeof a === "string" ? [a] : a;
  const bArr = typeof b === "string" ? [b] : b;

  const v4a: LeanParsedCidr4[] = [], v6a: LeanParsedCidr6[] = [];
  const v4b: LeanParsedCidr4[] = [], v6b: LeanParsedCidr6[] = [];
  for (const s of aArr) {
    const n = parseCidrLean(s);
    if (n.version === 4) v4a.push(n); else v6a.push(n);
  }
  for (const s of bArr) {
    const n = parseCidrLean(s);
    if (n.version === 4) v4b.push(n); else v6b.push(n);
  }

  // A target is contained iff the union of containers covers it. Fast path: a single
  // container covers it (no sort needed). Otherwise sort once and sweep contiguous
  // coverage, which coalesces adjacent blocks so blocks that tile a target also count.
  if (v4b.length > 0) {
    if (v4a.length === 0) return false;
    let sorted = false;
    for (const target of v4b) {
      const ts = target.start, te = target.end;
      let covered = false;
      for (const iv of v4a) {
        if (iv.start <= ts && iv.end >= te) { covered = true; break; }
      }
      if (covered) continue;

      if (!sorted) { v4a.sort(cmpV4Start); sorted = true; }
      let cur = ts;
      for (const iv of v4a) {
        if (iv.start > cur) break;
        if (iv.end >= cur) {
          if (iv.end >= te) { covered = true; break; }
          cur = iv.end + 1;
        }
      }
      if (!covered) return false;
    }
  }

  if (v6b.length > 0) {
    if (v6a.length === 0) return false;
    let sorted = false;
    for (const target of v6b) {
      const ts = target.start, te = target.end;
      let covered = false;
      for (const iv of v6a) {
        if (iv.start <= ts && iv.end >= te) { covered = true; break; }
      }
      if (covered) continue;

      if (!sorted) { v6a.sort(cmpV6Start); sorted = true; }
      let cur = ts;
      for (const iv of v6a) {
        if (iv.start > cur) break;
        if (iv.end >= cur) {
          if (iv.end >= te) { covered = true; break; }
          cur = iv.end + 1n;
        }
      }
      if (!covered) return false;
    }
  }

  return true;
}

export default {
  mergeCidr,
  excludeCidr,
  expandCidr,
  overlapCidr,
  containsCidr,
  normalizeCidr,
  parseCidr,
};
