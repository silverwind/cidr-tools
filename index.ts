import {parseIp, stringifyIp, normalizeIp} from "ip-bigint";

const bits = {4: 32, 6: 128};

// Pre-computed lookup tables for fast string formatting
const octetStrings: string[] = Array.from({length: 256}, (_, i) => String(i));
const prefixStrings: string[] = Array.from({length: 129}, (_, i) => `/${i}`);
const prefixNumStrings: string[] = Array.from({length: 129}, (_, i) => String(i));

type IPv4Address = string;
type IPv6Address = string;
type IPv4CIDR = string;
type IPv6CIDR = string;
type CIDR = string;
type Network = IPv4Address | IPv4CIDR | IPv6Address | IPv6CIDR;
type Networks = Network | Array<Network>;
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


// Fast IPv4 parser: returns 32-bit number or -1 on failure.
// Parses from s[0] to s[end-1], avoiding substring allocation.
function parseIPv4Fast(s: string, end: number): number {
  let num = 0;
  let octet = 0;
  let dots = 0;
  let digits = 0;
  for (let i = 0; i < end; i++) {
    const c = s.charCodeAt(i);
    if (c === 46) { // '.'
      if (digits === 0 || octet > 255) return -1;
      num = ((num << 8) | octet) >>> 0;
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

// Fast IPv4 formatter from 32-bit number using pre-computed octet strings
function formatIPv4Fast(n: number): string {
  return `${octetStrings[(n >>> 24) & 0xff]}.${octetStrings[(n >>> 16) & 0xff]}.${octetStrings[(n >>> 8) & 0xff]}.${octetStrings[n & 0xff]}`;
}

// Parse prefix number from string after slash, returns -1 if no slash
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

// Module-level scratch variables for zero-allocation IPv4 range parsing.
// Used by parseIPv4Range; callers must save values before a second call.
let rangeV4Start = 0;
let rangeV4End = 0;
let rangeV4Prefix = 0;
let rangeSlashIndex = -1;

// Parse IPv4 CIDR/IP into rangeV4* scratch vars without object allocation.
// Returns true on success (standard dotted-decimal IPv4), false otherwise.
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
  // IPv4 fast path: skip full parseCidr, avoid BigInt allocation
  if (parseIPv4Range(cidr)) {
    const ip = formatIPv4Fast(rangeV4Start);
    return rangeSlashIndex !== -1 ? ip + prefixStrings[rangeV4Prefix] : ip;
  }

  // Full path for IPv6 and non-standard IPv4
  const {start, end, prefix, version, prefixPresent} = parseCidr(cidr);
  if (version === 4) {
    const ip = formatIPv4Fast(Number(start));
    return (start !== end || prefixPresent) ? ip + prefixStrings[Number(prefix)] : ip;
  }
  const {compress = true, hexify = false} = opts || {};
  if (start !== end || prefixPresent) {
    const ip = normalizeIp(stringifyIp({number: start, version}), {compress, hexify});
    return ip + prefixStrings[Number(prefix)];
  } else {
    return normalizeIp(cidr, {compress, hexify});
  }
}

/** Returns a string or array (depending on input) with a normalized representation. Will not include a prefix on single IPs. Will set network address to the start of the network. */
export function normalizeCidr<T extends Network | Array<Network>>(cidr: T, opts?: NormalizeOpts): T {
  if (Array.isArray(cidr)) {
    // @ts-expect-error - better than using overload
    return cidr.map(entry => normalizeCidr(entry, opts));
  } else {
    // @ts-expect-error - better than using overload
    return doNormalize(cidr, opts);
  }
}

/** Returns a `parsed` Object which is used internally by this module. It can be used to test whether the passed network is IPv4 or IPv6 or to work with the BigInts directly. */
export function parseCidr(str: Network): ParsedCidr {
  const slashIndex = str.indexOf("/");
  const ipEnd = slashIndex !== -1 ? slashIndex : str.length;
  const prefixPresent = slashIndex !== -1;

  // Fast path for standard IPv4: try parsing directly without substring
  const v4num = parseIPv4Fast(str, ipEnd);
  if (v4num !== -1) {
    const prefixNum = prefixPresent ? parsePrefixNum(str, slashIndex) : 32;
    const ip = formatIPv4Fast(v4num);
    const prefix = prefixNumStrings[prefixNum];
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

  // Fallback: need substring for ip-bigint
  const ipPart = prefixPresent ? str.substring(0, slashIndex) : str;
  let prefixNum = prefixPresent ? parsePrefixNum(str, slashIndex) : -1;

  const {number, version, ipv4mapped, scopeid} = parseIp(ipPart);
  if (!version) {
    throw new Error(`Network is not a CIDR or IP: "${str}"`);
  }

  if (prefixNum === -1) {
    prefixNum = bits[version as ValidIpVersion];
  }

  const prefix = prefixNumStrings[prefixNum];
  const ip = stringifyIp({number, version, ipv4mapped, scopeid});
  const numBits = bits[version as ValidIpVersion];
  const hostBits = numBits - prefixNum;
  const mask = hostBits > 0 ? (1n << BigInt(hostBits)) - 1n : 0n;
  return {
    cidr: ip + prefixStrings[prefixNum],
    ip,
    version: version as ValidIpVersion,
    prefix,
    prefixPresent,
    start: number & ~mask,
    end: number | mask,
  };
}

// Lightweight internal parser returning only {start, end, version}.
// Skips stringifyIp() and string field construction.
// Uses fast path for IPv4 addresses in standard dotted-decimal notation.
// Returns number start/end for IPv4, bigint start/end for IPv6.
function parseCidrLean(str: Network): LeanParsedCidr {
  // Fast path for standard IPv4: reuse parseIPv4Range to avoid duplication
  if (parseIPv4Range(str)) {
    return {start: rangeV4Start, end: rangeV4End, version: 4};
  }

  // Fallback: need substring for ip-bigint
  const slashIndex = rangeSlashIndex; // reuse from parseIPv4Range call
  const ipPart = slashIndex !== -1 ? str.substring(0, slashIndex) : str;
  let prefixNum = slashIndex !== -1 ? parsePrefixNum(str, slashIndex) : -1;

  const {number, version} = parseIp(ipPart);
  if (!version) {
    throw new Error(`Network is not a CIDR or IP: "${str}"`);
  }

  if (prefixNum === -1) {
    prefixNum = bits[version as ValidIpVersion];
  }

  const numBits = bits[version as ValidIpVersion];
  const hostBits = numBits - prefixNum;

  // Rare fallback: non-standard IPv4 parsed by ip-bigint
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

  const mask = hostBits > 0 ? (1n << BigInt(hostBits)) - 1n : 0n;
  return {
    start: number & ~mask,
    end: number | mask,
    version: 6,
  };
}


// Count bit length of a bigint using Math.clz32, avoiding toString(2) string allocation.
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

// IPv4 number-based biggest power of two
function biggestPowerOfTwo4(num: number): number {
  if (num === 0) return 0;
  if (num >= 0x100000000) return 0x100000000;
  return (1 << (31 - Math.clz32(num))) >>> 0;
}

// IPv4 number-based subparts
function subparts4(pStart: number, pEnd: number, output: Part4[]): void {
  if (pEnd < pStart) return;

  if (pEnd === pStart) {
    output.push({start: pStart, end: pEnd});
    return;
  }

  if ((pEnd - pStart) === 1) {
    if (pEnd % 2 === 0) {
      output.push({start: pStart, end: pStart}, {start: pEnd, end: pEnd});
    } else {
      output.push({start: pStart, end: pEnd});
    }
    return;
  }

  const size = pEnd - pStart + 1;

  // Fast path: if size is a power of 2 and start is aligned
  if ((size & (size - 1)) === 0 && pStart % size === 0) {
    output.push({start: pStart, end: pEnd});
    return;
  }

  let biggest = biggestPowerOfTwo4(size);

  let start: number;
  let end: number;
  if (size === biggest && pStart % biggest === 0) {
    output.push({start: pStart, end: pEnd});
    return;
  } else if (pStart % biggest === 0) {
    start = pStart;
    end = start + biggest - 1;
  } else {
    start = Math.floor(pEnd / biggest) * biggest;

    if ((start + biggest - 1) > pEnd) {
      start = (Math.floor(pEnd / biggest) - 1) * biggest;

      while (start < pStart) {
        biggest /= 2;
        start = (Math.floor(pEnd / biggest) - 1) * biggest;
      }

      end = start + biggest - 1;
    } else {
      start = Math.floor(pEnd / biggest) * biggest;
      end = start + biggest - 1;
    }
  }

  if (start !== pStart) {
    subparts4(pStart, start - 1, output);
  }

  output.push({start, end});

  if (end !== pEnd) {
    subparts4(end + 1, pEnd, output);
  }
}

// IPv6 bigint-based subparts with bitwise optimizations
function subparts6(pStart: bigint, pEnd: bigint, output: Part6[]): void {
  if (pEnd < pStart) return;

  if (pEnd === pStart) {
    output.push({start: pStart, end: pEnd});
    return;
  }

  if ((pEnd - pStart) === 1n) {
    if (pEnd % 2n === 0n) {
      output.push({start: pStart, end: pStart}, {start: pEnd, end: pEnd});
    } else {
      output.push({start: pStart, end: pEnd});
    }
    return;
  }

  const size = pEnd - pStart + 1n;

  // Fast path: if size is a power of 2 and start is aligned
  if ((size & (size - 1n)) === 0n && (pStart & (size - 1n)) === 0n) {
    output.push({start: pStart, end: pEnd});
    return;
  }

  let biggest = biggestPowerOfTwo(size);

  let start: bigint;
  let end: bigint;
  if (size === biggest && (pStart & (biggest - 1n)) === 0n) {
    output.push({start: pStart, end: pEnd});
    return;
  } else if ((pStart & (biggest - 1n)) === 0n) {
    start = pStart;
    end = start + biggest - 1n;
  } else {
    // Round down pEnd to nearest multiple of biggest
    start = pEnd & -biggest;

    if ((start + biggest - 1n) > pEnd) {
      start = (pEnd & -biggest) - biggest;

      while (start < pStart) {
        biggest >>= 1n;
        start = (pEnd & -biggest) - biggest;
      }

      end = start + biggest - 1n;
    } else {
      start = pEnd & -biggest;
      end = start + biggest - 1n;
    }
  }

  if (start !== pStart) {
    subparts6(pStart, start - 1n, output);
  }

  output.push({start, end});

  if (end !== pEnd) {
    subparts6(end + 1n, pEnd, output);
  }
}

function formatPart4(part: Part4): CIDR {
  const ip = formatIPv4Fast(part.start);
  const size = part.end - part.start + 1;
  const hostBits = size <= 1 ? 0 : size >= 0x100000000 ? 32 : 31 - Math.clz32(size);
  return ip + prefixStrings[32 - hostBits];
}

function formatPart6(part: Part6): CIDR {
  const ip = stringifyIp({number: part.start, version: 6});
  const size = part.end - part.start + 1n;
  const hostBits = size <= 1n ? 0 : bigintBitLength(size) - 1;
  return ip + prefixStrings[128 - hostBits];
}

// IPv4 number-based merge intervals
function mergeIntervalsRaw4(nets: LeanParsedCidr4[]): Part4[] {
  if (nets.length === 0) return [];
  nets.sort((a, b) => a.start - b.start || a.end - b.end);
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

// IPv6 bigint-based merge intervals
function mergeIntervalsRaw6(nets: LeanParsedCidr6[]): Part6[] {
  if (nets.length === 0) return [];
  nets.sort((a, b) => a.start > b.start ? 1 : a.start < b.start ? -1 : a.end > b.end ? 1 : a.end < b.end ? -1 : 0);
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

function mergeIntervals4(nets: LeanParsedCidr4[]): Part4[] {
  const merged: Part4[] = [];
  for (const part of mergeIntervalsRaw4(nets)) {
    subparts4(part.start, part.end, merged);
  }
  return merged;
}

function mergeIntervals6(nets: LeanParsedCidr6[]): Part6[] {
  const merged: Part6[] = [];
  for (const part of mergeIntervalsRaw6(nets)) {
    subparts6(part.start, part.end, merged);
  }
  return merged;
}

// IPv4 number-based subtract
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

// IPv6 bigint-based subtract
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
  const arr = Array.isArray(nets) ? nets : [nets];
  const v4: LeanParsedCidr4[] = [];
  const v6: LeanParsedCidr6[] = [];
  for (const s of arr) {
    const n = parseCidrLean(s);
    if (n.version === 4) v4.push(n); else v6.push(n);
  }

  const merged: Array<Network> = [];
  for (const part of mergeIntervals4(v4)) {
    merged.push(formatPart4(part));
  }
  for (const part of mergeIntervals6(v6)) {
    merged.push(formatPart6(part));
  }

  return merged;
}

/** Returns an array of merged remaining networks of the subtraction of `excludeNetworks` from `baseNetworks`. */
export function excludeCidr(base: Networks, excl: Networks): Array<Network> {
  const baseArr = Array.isArray(base) ? base : [base];
  const exclArr = Array.isArray(excl) ? excl : [excl];

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

  // IPv4
  {
    const baseParts = mergeIntervalsRaw4(v4base);
    const exclParts = mergeIntervalsRaw4(v4excl);
    const remaining = subtractSorted4(baseParts, exclParts);
    const aligned: Part4[] = [];
    for (const part of remaining) {
      subparts4(part.start, part.end, aligned);
    }
    for (const p of aligned) {
      result.push(formatPart4(p));
    }
  }

  // IPv6
  {
    const baseParts = mergeIntervalsRaw6(v6base);
    const exclParts = mergeIntervalsRaw6(v6excl);
    const remaining = subtractSorted6(baseParts, exclParts);
    const aligned: Part6[] = [];
    for (const part of remaining) {
      subparts6(part.start, part.end, aligned);
    }
    for (const p of aligned) {
      result.push(formatPart6(p));
    }
  }

  return result;
}

/* Returns a generator for individual IPs contained in the networks. */
export function* expandCidr(nets: Networks): Generator<Network> {
  const arr: Array<Network> = Array.isArray(nets) ? nets : [nets];
  const v4: LeanParsedCidr4[] = [];
  const v6: LeanParsedCidr6[] = [];
  for (const s of arr) {
    const n = parseCidrLean(s);
    if (n.version === 4) v4.push(n); else v6.push(n);
  }

  if (v4.length > 0) {
    for (const part of mergeIntervalsRaw4(v4)) {
      for (let n = part.start; n <= part.end; n++) {
        yield formatIPv4Fast(n);
      }
    }
  }

  if (v6.length > 0) {
    for (const part of mergeIntervalsRaw6(v6)) {
      for (let num = part.start; num <= part.end; num++) {
        yield stringifyIp({number: num, version: 6});
      }
    }
  }
}

/** Returns a boolean that indicates if `networksA` overlap (intersect) with `networksB`. */
export function overlapCidr(a: Networks, b: Networks): boolean {
  // Fast path for single-vs-single (most common case)
  if (!Array.isArray(a) && !Array.isArray(b)) {
    // Zero-allocation IPv4 fast path
    if (parseIPv4Range(a)) {
      const startA = rangeV4Start, endA = rangeV4End;
      if (parseIPv4Range(b)) {
        return startA <= rangeV4End && rangeV4Start <= endA;
      }
    }
    // Fallback for IPv6 and non-standard IPv4
    const pa = parseCidrLean(a);
    const pb = parseCidrLean(b);
    if (pa.version !== pb.version) return false;
    return pa.start <= pb.end && pb.start <= pa.end;
  }

  const aArr = Array.isArray(a) ? a : [a];
  const bArr = Array.isArray(b) ? b : [b];

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

  // IPv4
  if (v4a.length > 0 && v4b.length > 0) {
    // Linear scan when one side has a single element (avoids sorting)
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
      v4a.sort((x, y) => x.start - y.start);
      v4b.sort((x, y) => x.start - y.start);
      let i = 0, j = 0;
      while (i < v4a.length && j < v4b.length) {
        if (v4a[i].start <= v4b[j].end && v4b[j].start <= v4a[i].end) return true;
        if (v4a[i].end < v4b[j].end) i++; else j++;
      }
    }
  }

  // IPv6
  if (v6a.length > 0 && v6b.length > 0) {
    // Linear scan when one side has a single element (avoids sorting)
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
      v6a.sort((x, y) => x.start > y.start ? 1 : x.start < y.start ? -1 : 0);
      v6b.sort((x, y) => x.start > y.start ? 1 : x.start < y.start ? -1 : 0);
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
  if (!Array.isArray(a) && !Array.isArray(b)) {
    // Zero-allocation IPv4 fast path
    if (parseIPv4Range(a)) {
      const startA = rangeV4Start, endA = rangeV4End;
      if (parseIPv4Range(b)) {
        return startA <= rangeV4Start && endA >= rangeV4End;
      }
    }
    // Fallback for IPv6 and non-standard IPv4
    const pa = parseCidrLean(a);
    const pb = parseCidrLean(b);
    if (pa.version !== pb.version) return false;
    return pa.start <= pb.start && pa.end >= pb.end;
  }

  const aArr = Array.isArray(a) ? a : [a];
  const bArr = Array.isArray(b) ? b : [b];

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

  // IPv4
  if (v4b.length > 0) {
    if (v4a.length === 0) return false;
    v4a.sort((x, y) => x.start - y.start);

    const maxEnd = new Array<number>(v4a.length);
    maxEnd[0] = v4a[0].end;
    for (let i = 1; i < v4a.length; i++) {
      maxEnd[i] = Math.max(v4a[i].end, maxEnd[i - 1]);
    }

    for (const target of v4b) {
      let lo = 0, hi = v4a.length - 1;
      let idx = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (v4a[mid].start <= target.start) {
          idx = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      if (idx < 0 || maxEnd[idx] < target.end) return false;
    }
  }

  // IPv6
  if (v6b.length > 0) {
    if (v6a.length === 0) return false;
    v6a.sort((x, y) => x.start > y.start ? 1 : x.start < y.start ? -1 : 0);

    const maxEnd = new Array<bigint>(v6a.length);
    maxEnd[0] = v6a[0].end;
    for (let i = 1; i < v6a.length; i++) {
      maxEnd[i] = v6a[i].end > maxEnd[i - 1] ? v6a[i].end : maxEnd[i - 1]; // eslint-disable-line unicorn/prefer-math-min-max -- BigInt not supported by Math.max
    }

    for (const target of v6b) {
      let lo = 0, hi = v6a.length - 1;
      let idx = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (v6a[mid].start <= target.start) {
          idx = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      if (idx < 0 || maxEnd[idx] < target.end) return false;
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
