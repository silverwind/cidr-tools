import {parseIp, stringifyIp, normalizeIp} from "ip-bigint";

const bits = {4: 32, 6: 128};

type IPv4Address = string;
type IPv6Address = string;
type IPv4CIDR = string;
type IPv6CIDR = string;
type CIDR = string;
type Network = IPv4Address | IPv4CIDR | IPv6Address | IPv6CIDR;
type Networks = Network | Array<Network>;
type IpVersion = 4 | 6 | 0;
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

type LeanParsedCidr = {
  start: bigint;
  end: bigint;
  version: ValidIpVersion;
};

type NormalizeOpts = {
  compress?: boolean;
  hexify?: boolean;
};

type Part = {
  start: bigint,
  end: bigint,
};


// Fast IPv4 parser: returns 32-bit number or -1 on failure
function parseIPv4Fast(s: string): number {
  let num = 0;
  let octet = 0;
  let dots = 0;
  let digits = 0;
  for (let i = 0; i < s.length; i++) {
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

// Fast IPv4 formatter from 32-bit number
function formatIPv4Fast(n: number): string {
  return `${(n >>> 24) & 0xff}.${(n >>> 16) & 0xff}.${(n >>> 8) & 0xff}.${n & 0xff}`;
}

function doNormalize(cidr: Network, {compress = true, hexify = false}: NormalizeOpts = {}): Network {
  const {start, end, prefix, version, prefixPresent} = parseCidr(cidr);
  if (start !== end || prefixPresent) { // cidr
    // set network address to first address
    const ip = normalizeIp(stringifyIp({number: start, version}), {compress, hexify});
    return `${ip}/${prefix}`;
  } else { // single ip
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
  let ipPart: string;
  let prefix: string;
  let prefixPresent: boolean;

  if (slashIndex !== -1) {
    ipPart = str.substring(0, slashIndex);
    prefix = str.substring(slashIndex + 1);
    if (!/^[0-9]+$/.test(prefix)) {
      throw new Error(`Network is not a CIDR or IP: "${str}"`);
    }
    prefixPresent = true;
  } else {
    ipPart = str;
    prefixPresent = false;
    prefix = "";
  }

  const {number, version, ipv4mapped, scopeid} = parseIp(ipPart);
  if (!version) {
    throw new Error(`Network is not a CIDR or IP: "${str}"`);
  }

  if (!prefixPresent) {
    prefix = String(bits[version as ValidIpVersion]);
  }

  const ip = stringifyIp({number, version, ipv4mapped, scopeid});
  const numBits = bits[version as ValidIpVersion];
  const hostBits = numBits - Number(prefix);
  const mask = hostBits > 0 ? (1n << BigInt(hostBits)) - 1n : 0n;
  return {
    cidr: `${ip}/${prefix}`,
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
function parseCidrLean(str: Network): LeanParsedCidr {
  const slashIndex = str.indexOf("/");
  let ipPart: string;
  let prefixNum: number;

  if (slashIndex !== -1) {
    ipPart = str.substring(0, slashIndex);
    // Inline prefix parsing: validate digits and compute number in one pass
    if (slashIndex + 1 >= str.length) throw new Error(`Network is not a CIDR or IP: "${str}"`);
    prefixNum = 0;
    for (let i = slashIndex + 1; i < str.length; i++) {
      const c = str.charCodeAt(i);
      if (c < 48 || c > 57) throw new Error(`Network is not a CIDR or IP: "${str}"`);
      prefixNum = prefixNum * 10 + (c - 48);
    }
  } else {
    ipPart = str;
    prefixNum = -1;
  }

  // Fast path for standard IPv4
  if (!ipPart.includes(":")) {
    const v4num = parseIPv4Fast(ipPart);
    if (v4num !== -1) {
      if (prefixNum === -1) prefixNum = 32;
      const hostBits = 32 - prefixNum;
      if (hostBits >= 32) return {start: 0n, end: 4294967295n, version: 4};
      const mask = hostBits > 0 ? ((1 << hostBits) >>> 0) - 1 : 0;
      return {
        start: BigInt((v4num & ~mask) >>> 0),
        end: BigInt((v4num | mask) >>> 0),
        version: 4,
      };
    }
  }

  const {number, version} = parseIp(ipPart);
  if (!version) {
    throw new Error(`Network is not a CIDR or IP: "${str}"`);
  }

  if (prefixNum === -1) {
    prefixNum = bits[version as ValidIpVersion];
  }

  const numBits = bits[version as ValidIpVersion];
  const hostBits = numBits - prefixNum;
  const mask = hostBits > 0 ? (1n << BigInt(hostBits)) - 1n : 0n;
  return {
    start: number & ~mask,
    end: number | mask,
    version: version as ValidIpVersion,
  };
}


// Count bit length of a bigint using Math.clz32, avoiding toString(2) string allocation.
// Shifts down in 32-bit chunks until the value fits in uint32 for Math.clz32.
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

function subparts(pStart: bigint, pEnd: bigint, output: Array<Part>): void {
  // Guard against invalid ranges where end < start
  if (pEnd < pStart) return;

  // special case for when part is a single IP
  if (pEnd === pStart) {
    output.push({start: pStart, end: pEnd});
    return;
  }

  // special case for when part is length 1
  if ((pEnd - pStart) === 1n) {
    if (pEnd % 2n === 0n) {
      output.push({start: pStart, end: pStart}, {start: pEnd, end: pEnd});
    } else {
      output.push({start: pStart, end: pEnd});
    }
    return;
  }

  const size = diff(pEnd, pStart);

  // Fast path: if size is a power of 2 and start is aligned, emit directly
  if ((size & (size - 1n)) === 0n && pStart % size === 0n) {
    output.push({start: pStart, end: pEnd});
    return;
  }

  let biggest = biggestPowerOfTwo(size);

  let start: bigint;
  let end: bigint;
  if (size === biggest && pStart % biggest === 0n) {
    output.push({start: pStart, end: pEnd});
    return;
  } else if (pStart % biggest === 0n) {
    // start is matching on the size-defined boundary - ex: 0-12, use 0-8
    start = pStart;
    end = start + biggest - 1n;
  } else {
    start = (pEnd / biggest) * biggest;

    // start is not matching on the size-defined boundary - 4-16, use 8-16
    if ((start + biggest - 1n) > pEnd) {
      // divide will floor to nearest integer
      start = ((pEnd / biggest) - 1n) * biggest;

      while (start < pStart) {
        biggest /= 2n;
        start = ((pEnd / biggest) - 1n) * biggest;
      }

      end = start + biggest - 1n;
    } else {
      start = (pEnd / biggest) * biggest;
      end = start + biggest - 1n;
    }
  }

  // left side first (ascending order)
  if (start !== pStart) {
    subparts(pStart, start - 1n, output);
  }

  // biggest chunk in the middle
  output.push({start, end});

  // right side last
  if (end !== pEnd) {
    subparts(end + 1n, pEnd, output);
  }
}

function diff(a: bigint, b: bigint): bigint {
  return a + 1n - b;
}

function formatPart(part: Part, version: IpVersion): CIDR {
  if (version === 4) {
    const ip = formatIPv4Fast(Number(part.start));
    const sizeNum = Number(part.end - part.start) + 1;
    const hostBits = sizeNum <= 1 ? 0 : sizeNum >= 0x100000000 ? 32 : 31 - Math.clz32(sizeNum);
    return `${ip}/${32 - hostBits}`;
  }
  const ip = stringifyIp({number: part.start, version});
  const size = diff(part.end, part.start);
  const hostBits = size <= 1n ? 0 : bigintBitLength(size) - 1;
  const prefix = bits[version as ValidIpVersion] - hostBits;
  return `${ip}/${prefix}`;
}

// Merge overlapping/adjacent intervals into raw (non-CIDR-aligned) intervals
// Sort in-place (all callers pass temporary arrays that aren't reused)
function mergeIntervalsRaw(nets: Array<LeanParsedCidr>): Array<Part> {
  if (nets.length === 0) return [];
  nets.sort((a, b) => a.start > b.start ? 1 : a.start < b.start ? -1 : a.end > b.end ? 1 : a.end < b.end ? -1 : 0);
  const merged: Array<Part> = [];
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

function mergeIntervals(nets: Array<LeanParsedCidr>): Array<Part> {
  const merged: Array<Part> = [];
  for (const part of mergeIntervalsRaw(nets)) {
    subparts(part.start, part.end, merged);
  }
  return merged;
}

// Subtract sorted non-overlapping excl intervals from sorted non-overlapping base intervals.
// Both inputs must be sorted by start. Returns raw (non-CIDR-aligned) intervals.
function subtractSorted(bases: Array<Part>, excls: Array<Part>): Array<Part> {
  if (excls.length === 0) return bases;
  if (bases.length === 0) return [];

  const result: Array<Part> = [];
  let j = 0;

  for (const base of bases) {
    let start = base.start;
    const end = base.end;

    // Skip exclusions that end before this base starts
    while (j < excls.length && excls[j].end < start) {
      j++;
    }

    // Process overlapping exclusions (use temp pointer to not skip excls that span multiple bases)
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
  const arr = (Array.isArray(nets) ? nets : [nets]).map(parseCidrLean);
  const byVersion: {4: Array<LeanParsedCidr>, 6: Array<LeanParsedCidr>} = {4: [], 6: []};
  for (const n of arr) byVersion[n.version].push(n);

  const merged: Array<Network> = [];
  for (const v of [4, 6] as Array<ValidIpVersion>) {
    for (const part of mergeIntervals(byVersion[v])) {
      merged.push(formatPart(part, v));
    }
  }

  return merged;
}

/** Returns an array of merged remaining networks of the subtraction of `excludeNetworks` from `baseNetworks`. */
export function excludeCidr(base: Networks, excl: Networks): Array<Network> {
  const baseArr = (Array.isArray(base) ? base : [base]).map(parseCidrLean);
  const exclArr = (Array.isArray(excl) ? excl : [excl]).map(parseCidrLean);

  // Separate by version
  const baseByVersion: {4: Array<LeanParsedCidr>, 6: Array<LeanParsedCidr>} = {4: [], 6: []};
  const exclByVersion: {4: Array<LeanParsedCidr>, 6: Array<LeanParsedCidr>} = {4: [], 6: []};
  for (const n of baseArr) baseByVersion[n.version].push(n);
  for (const n of exclArr) exclByVersion[n.version].push(n);

  // Merge into raw intervals (no CIDR alignment needed for subtraction)
  // Then subtract using sweep-line, and only CIDR-align the final results
  const result: Array<Network> = [];
  for (const v of [4, 6] as Array<ValidIpVersion>) {
    const baseParts = mergeIntervalsRaw(baseByVersion[v]);
    const exclParts = mergeIntervalsRaw(exclByVersion[v]);
    const remaining = subtractSorted(baseParts, exclParts);
    const aligned: Array<Part> = [];
    for (const part of remaining) {
      subparts(part.start, part.end, aligned);
    }
    for (const p of aligned) {
      result.push(formatPart(p, v));
    }
  }

  return result;
}

/* Returns a generator for individual IPs contained in the networks. */
export function* expandCidr(nets: Networks): Generator<Network> {
  const arr: Array<Network> = Array.isArray(nets) ? nets : [nets];
  const parsed = arr.map(parseCidrLean);
  const byVersion: {4: Array<LeanParsedCidr>, 6: Array<LeanParsedCidr>} = {4: [], 6: []};
  for (const n of parsed) byVersion[n.version].push(n);

  for (const v of [4, 6] as Array<ValidIpVersion>) {
    if (byVersion[v].length === 0) continue;
    const intervals = mergeIntervalsRaw(byVersion[v]);
    if (v === 4) {
      for (const part of intervals) {
        const startNum = Number(part.start);
        const endNum = Number(part.end);
        for (let n = startNum; n <= endNum; n++) {
          yield formatIPv4Fast(n);
        }
      }
    } else {
      for (const part of intervals) {
        for (let num = part.start; num <= part.end; num++) {
          yield stringifyIp({number: num, version: 6});
        }
      }
    }
  }
}

/** Returns a boolean that indicates if `networksA` overlap (intersect) with `networksB`. */
export function overlapCidr(a: Networks, b: Networks): boolean {
  const aNets = (Array.isArray(a) ? a : [a]).map(parseCidrLean);
  const bNets = (Array.isArray(b) ? b : [b]).map(parseCidrLean);

  // Separate by version in a single pass
  const aByVersion: {4: Array<LeanParsedCidr>, 6: Array<LeanParsedCidr>} = {4: [], 6: []};
  const bByVersion: {4: Array<LeanParsedCidr>, 6: Array<LeanParsedCidr>} = {4: [], 6: []};
  for (const n of aNets) aByVersion[n.version].push(n);
  for (const n of bNets) bByVersion[n.version].push(n);

  for (const v of [4, 6] as Array<ValidIpVersion>) {
    const aVer = aByVersion[v].sort((x, y) => x.start > y.start ? 1 : x.start < y.start ? -1 : 0);
    const bVer = bByVersion[v].sort((x, y) => x.start > y.start ? 1 : x.start < y.start ? -1 : 0);

    let i = 0, j = 0;
    while (i < aVer.length && j < bVer.length) {
      const aNet = aVer[i];
      const bNet = bVer[j];
      if (aNet.start <= bNet.end && bNet.start <= aNet.end) return true;
      if (aNet.end < bNet.end) i++;
      else j++;
    }
  }

  return false;
}

/** Returns a boolean that indicates whether `networksA` fully contain all `networksB`. */
export function containsCidr(a: Networks, b: Networks): boolean {
  const aNets = (Array.isArray(a) ? a : [a]).map(parseCidrLean);
  const bNets = (Array.isArray(b) ? b : [b]).map(parseCidrLean);

  // Separate by version in a single pass
  const aByVersion: {4: Array<LeanParsedCidr>, 6: Array<LeanParsedCidr>} = {4: [], 6: []};
  const bByVersion: {4: Array<LeanParsedCidr>, 6: Array<LeanParsedCidr>} = {4: [], 6: []};
  for (const n of aNets) aByVersion[n.version].push(n);
  for (const n of bNets) bByVersion[n.version].push(n);

  for (const v of [4, 6] as Array<ValidIpVersion>) {
    const containers = aByVersion[v].sort((x, y) => x.start > y.start ? 1 : x.start < y.start ? -1 : 0);
    const targets = bByVersion[v];

    if (targets.length === 0) continue;
    if (containers.length === 0) return false;

    // Build max-end prefix array for binary search
    const maxEnd = new Array<bigint>(containers.length);
    maxEnd[0] = containers[0].end;
    for (let i = 1; i < containers.length; i++) {
      if (containers[i].end > maxEnd[i - 1]) {
        maxEnd[i] = containers[i].end;
      } else {
        maxEnd[i] = maxEnd[i - 1];
      }
    }

    for (const target of targets) {
      // Binary search: find rightmost container with start <= target.start
      let lo = 0, hi = containers.length - 1;
      let idx = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (containers[mid].start <= target.start) {
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
