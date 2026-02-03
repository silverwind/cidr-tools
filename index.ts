import {parseIp, stringifyIp, normalizeIp, ipVersion} from "ip-bigint";

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

type NormalizeOpts = {
  compress?: boolean;
  hexify?: boolean;
};

type Part = {
  start: bigint,
  end: bigint,
};

function uniq<T extends Array<any>>(arr: T): T {
  return Array.from(new Set(arr)) as T;
}

function cidrVersion(cidr: Network): IpVersion {
  return cidr.includes("/") ? ipVersion(cidr) : 0;
}

// TODO: pass parsed objects in here
function compare(a: Network, b: Network): number {
  const {number: aNum, version: aVersion} = parseIp(a.replace(/\/.+/, ""));
  const {number: bNum, version: bVersion} = parseIp(b.replace(/\/.+/, ""));
  if (aVersion === bVersion) {
    return aNum - bNum > 0n ? 1 : aNum - bNum < 0n ? -1 : 0;
  } else {
    return aVersion > bVersion ? 1 : 0;
  }
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
  const cidrVer = cidrVersion(str);
  const parsed = Object.create(null);

  let cidr: string;
  if (cidrVer) {
    cidr = str;
    parsed.version = cidrVer;
  } else {
    const version = ipVersion(str);
    if (version) {
      cidr = `${str}/${bits[version]}`;
      parsed.version = version;
    } else {
      throw new Error(`Network is not a CIDR or IP: "${str}"`);
    }
  }

  const [ipAndMisc, prefix] = cidr.split("/");

  if (!/^[0-9]+$/.test(prefix)) {
    throw new Error(`Network is not a CIDR or IP: "${str}"`);
  }

  const {number, version, ipv4mapped, scopeid} = parseIp(ipAndMisc);
  parsed.ip = stringifyIp({number, version, ipv4mapped, scopeid});
  parsed.cidr = `${parsed.ip}/${prefix}`;
  parsed.prefix = prefix;
  parsed.prefixPresent = Boolean(cidrVer);

  const numBits = bits[version as ValidIpVersion];
  const hostBits = BigInt(numBits - Number(prefix));
  const mask = hostBits > 0n ? (1n << hostBits) - 1n : 0n;
  parsed.start = number & ~mask;
  parsed.end = number | mask;
  return parsed;
}

// returns whether networks fully or partially overlap
function doNetsOverlap(a: ParsedCidr, b: ParsedCidr): boolean {
  //    aaa
  // bbb
  if (a.start > b.end) return false; // a starts after b

  // aaa
  //    bbb
  if (b.start > a.end) return false; // b starts after a

  return true;
}

// returns whether network a fully contains network b;
function netContains(a: ParsedCidr, b: ParsedCidr): boolean {
  //  aaa
  // bbbb
  if (b.start < a.start) return false; // a starts after b

  // aaa
  // bbbb
  if (b.end > a.end) return false; // b starts after a

  return true;
}

// exclude b from a and return remainder cidrs
function excludeNets(a: ParsedCidr, b: ParsedCidr, v: IpVersion): Array<CIDR> {
  const parts: Array<Part> = [];

  // compareTo returns negative if left is less than right

  //       aaa
  //   bbb
  //   aaa
  //       bbb
  if (a.start > b.end || a.end < b.start) {
    return [a.cidr];
  }

  //   aaa
  //   bbb
  if (a.start === b.start && a.end === b.end) {
    return [];
  }

  //   aa
  //  bbbb
  if (a.start > b.start && a.end < b.end) {
    return [];
  }

  // aaaa
  //   bbbb
  // aaaa
  //   bb
  if (a.start < b.start && a.end <= b.end) {
    parts.push({start: a.start, end: b.start - 1n});
  }

  //    aaa
  //   bbb
  //   aaaa
  //   bbb
  if (a.start >= b.start && a.end > b.end) {
    parts.push({start: b.end + 1n, end: a.end});
  }

  //  aaaa
  //   bb
  if (a.start < b.start && a.end > b.end) {
    parts.push(
      {start: a.start, end: b.start - 1n},
      {start: b.end + 1n, end: a.end},
    );
  }

  const remaining: Array<CIDR> = [];
  for (const part of parts) {
    for (const subpart of subparts(part)) {
      remaining.push(formatPart(subpart, v));
    }
  }

  return mergeCidr(remaining);
}

function biggestPowerOfTwo(num: bigint): bigint {
  if (num === 0n) return 0n;
  let b = 0n;
  let n = num >> 1n;
  while (n > 0n) {
    b++;
    n >>= 1n;
  }
  return 1n << b;
}

function subparts(part: Part): Array<Part> {
  // Guard against invalid ranges where end < start
  if (part.end < part.start) {
    return [];
  }

  // special case for when part is a single IP
  if (part.end === part.start) {
    return [part];
  }

  // special case for when part is length 1
  if ((part.end - part.start) === 1n) {
    if (part.end % 2n === 0n) {
      return [{start: part.start, end: part.start}, {start: part.end, end: part.end}];
    } else {
      return [{start: part.start, end: part.end}];
    }
  }

  const size = diff(part.end, part.start);
  let biggest = biggestPowerOfTwo(size);

  let start: bigint;
  let end: bigint;
  if (size === biggest && part.start + size === part.end) {
    return [part];
  } else if (part.start % biggest === 0n) {
    // start is matching on the size-defined boundary - ex: 0-12, use 0-8
    start = part.start;
    end = start + biggest - 1n;
  } else {
    start = (part.end / biggest) * biggest;

    // start is not matching on the size-defined boundary - 4-16, use 8-16
    if ((start + biggest - 1n) > part.end) {
      // divide will floor to nearest integer
      start = ((part.end / biggest) - 1n) * biggest;

      while (start < part.start) {
        biggest /= 2n;
        start = ((part.end / biggest) - 1n) * biggest;
      }

      end = start + biggest - 1n;
    } else {
      start = (part.end / biggest) * biggest;
      end = start + biggest - 1n;
    }
  }

  let parts = [{start, end}];

  // additional subnets on left side
  if (start !== part.start) {
    parts = parts.concat(subparts({start: part.start, end: start - 1n}));
  }

  // additional subnets on right side
  if (end !== part.end) {
    parts = parts.concat(subparts({start: end + 1n, end: part.end}));
  }

  return parts;
}

function diff(a: bigint, b: bigint): bigint {
  return a + 1n - b;
}

function formatPart(part: Part, version: IpVersion): CIDR {
  const ip = normalizeIp(stringifyIp({number: part.start, version}));
  const size = diff(part.end, part.start);
  let hostBits = 0;
  let s = size >> 1n;
  while (s > 0n) { s >>= 1n; hostBits++; }
  const prefix = bits[version as ValidIpVersion] - hostBits;
  return `${ip}/${prefix}`;
}

type NetMapEntry = {
  start: number,
  end: number,
};

type NetMapObj = Map<bigint, NetMapEntry>;

type NetMap = {
  4: NetMapObj,
  6: NetMapObj,
};

function mapNets(nets: Array<ParsedCidr>): NetMap {
  const maps: NetMap = {4: new Map(), 6: new Map()};
  for (const {start, end, version} of nets) {
    let startEntry = maps[version].get(start);
    if (!startEntry) { startEntry = {start: 0, end: 0}; maps[version].set(start, startEntry); }
    let endEntry = maps[version].get(end);
    if (!endEntry) { endEntry = {start: 0, end: 0}; maps[version].set(end, endEntry); }
    startEntry.start += 1;
    endEntry.end += 1;
  }
  return maps;
}

function doMerge(maps: NetMapObj): Array<Part> {
  let start: bigint | null = null;
  let end: bigint | null = null;
  const numbers = Array.from(maps.keys()).sort((a, b) => a > b ? 1 : a < b ? -1 : 0);
  let depth = 0;
  const merged: Array<Part> = [];

  for (const [index, number] of numbers.entries()) {
    const marker = maps.get(number)!;

    if (start === null && marker.start) start = number;
    if (marker.end) end = number;
    if (start === null) continue;

    if (marker.start) depth += marker.start;
    if (marker.end) depth -= marker.end;

    const next = numbers[index + 1];
    if (marker.end && depth === 0 && next !== undefined && ((next - number) > 1n)) {
      for (const sub of subparts({start, end: end!})) {
        merged.push(sub);
      }
      start = null;
      end = null;
    } else if (index === (numbers.length - 1)) {
      for (const sub of subparts({start, end: end!})) {
        merged.push(sub);
      }
    }
  }
  return merged;
}

type CidrsByVersion = {
  4: [...cidr: Array<CIDR>],
  6: [...cidr: Array<CIDR>],
};

/** Returns an array of merged networks */
export function mergeCidr(nets: Networks): Array<Network> {
  const arr = uniq(Array.isArray(nets) ? nets : [nets]).map(parseCidr);
  const maps = mapNets(arr);

  const merged: CidrsByVersion = {4: [], 6: []};
  for (const v of [4, 6] as Array<ValidIpVersion>) {
    merged[v] = doMerge(maps[v]).map(part => formatPart(part, v));
  }

  return [...merged[4].sort(compare), ...merged[6].sort(compare)];
}

/** Returns an array of merged remaining networks of the subtraction of `excludeNetworks` from `baseNetworks`. */
export function excludeCidr(base: Networks, excl: Networks): Array<Network> {
  const basenets: Array<Network> = mergeCidr(uniq(Array.isArray(base) ? base : [base]));
  const exclnets: Array<Network> = mergeCidr(uniq(Array.isArray(excl) ? excl : [excl]));

  const bases: CidrsByVersion = {4: [], 6: []};
  const excls: CidrsByVersion = {4: [], 6: []};

  for (const basenet of basenets) {
    const version = cidrVersion(basenet);
    if (version) bases[version].push(basenet);
  }

  for (const exclnet of exclnets) {
    const version = cidrVersion(exclnet);
    if (version) excls[version].push(exclnet);
  }

  for (const v of [4, 6] as Array<ValidIpVersion>) {
    for (const exclcidr of excls[v]) {
      const excl = parseCidr(exclcidr);
      const newBases: Array<CIDR> = [];
      for (const basecidr of bases[v]) {
        newBases.push(...excludeNets(parseCidr(basecidr), excl, v));
      }
      bases[v] = newBases;
    }
  }

  return bases[4].concat(bases[6]).sort(compare);
}

/* Returns a generator for individual IPs contained in the networks. */
export function* expandCidr(nets: Networks): Generator<Network> {
  const arr: Array<Network> = uniq(Array.isArray(nets) ? nets : [nets]);

  for (const net of mergeCidr(arr)) {
    const {start, end, version} = parseCidr(net);
    for (let number = start; number <= end; number++) {
      yield normalizeIp(stringifyIp({number, version}));
    }
  }
}

/** Returns a boolean that indicates if `networksA` overlap (intersect) with `networksB`. */
export function overlapCidr(a: Networks, b: Networks): boolean {
  const aNets = uniq(Array.isArray(a) ? a : [a]).map(parseCidr);
  const bNets = uniq(Array.isArray(b) ? b : [b]).map(parseCidr);

  for (const aParsed of aNets) {
    for (const bParsed of bNets) {
      if (aParsed.version !== bParsed.version) continue;
      if (doNetsOverlap(aParsed, bParsed)) return true;
    }
  }

  return false;
}

/** Returns a boolean that indicates whether `networksA` fully contain all `networksB`. */
export function containsCidr(a: Networks, b: Networks): boolean {
  const aNets = uniq(Array.isArray(a) ? a : [a]).map(parseCidr);
  const bNets = uniq(Array.isArray(b) ? b : [b]).map(parseCidr);

  const numExpected = bNets.length;
  let numFound = 0;
  for (const aParsed of aNets) {
    for (const bParsed of bNets) {
      if (aParsed.version !== bParsed.version) continue;
      if (netContains(aParsed, bParsed)) {
        numFound++;
        continue;
      }
    }
  }

  return numFound === numExpected;
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
