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

function uniq<T extends Array<any>>(arr: T): T {
  return Array.from(new Set(arr)) as T;
}

function cidrVersion(cidr: Network): IpVersion {
  return cidr.includes("/") ? ipVersion(cidr) : 0;
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

// Lightweight internal parser returning only {start, end, version}.
// Skips stringifyIp() and string field construction.
function parseCidrLean(str: Network): LeanParsedCidr {
  const cidrVer = cidrVersion(str);
  let version: ValidIpVersion;
  let cidr: string;

  if (cidrVer) {
    cidr = str;
    version = cidrVer as ValidIpVersion;
  } else {
    const v = ipVersion(str);
    if (v) {
      version = v as ValidIpVersion;
      cidr = `${str}/${bits[version]}`;
    } else {
      throw new Error(`Network is not a CIDR or IP: "${str}"`);
    }
  }

  const [ipAndMisc, prefix] = cidr.split("/");

  if (!/^[0-9]+$/.test(prefix)) {
    throw new Error(`Network is not a CIDR or IP: "${str}"`);
  }

  const {number, version: parsedVersion} = parseIp(ipAndMisc);
  const numBits = bits[parsedVersion as ValidIpVersion];
  const hostBits = BigInt(numBits - Number(prefix));
  const mask = hostBits > 0n ? (1n << hostBits) - 1n : 0n;
  return {
    start: number & ~mask,
    end: number | mask,
    version,
  };
}

// exclude b from a and return remainder parts
function excludeNetsParts(a: Part, b: Part): Array<Part> {
  //       aaa
  //   bbb
  //   aaa
  //       bbb
  if (a.start > b.end || a.end < b.start) {
    return [a];
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

  const parts: Array<Part> = [];

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

  const remaining: Array<Part> = [];
  for (const part of parts) {
    subparts(part, remaining);
  }
  return remaining;
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

function subparts(part: Part, output?: Array<Part>): Array<Part> {
  if (!output) output = [];

  // Guard against invalid ranges where end < start
  if (part.end < part.start) {
    return output;
  }

  // special case for when part is a single IP
  if (part.end === part.start) {
    output.push(part);
    return output;
  }

  // special case for when part is length 1
  if ((part.end - part.start) === 1n) {
    if (part.end % 2n === 0n) {
      output.push({start: part.start, end: part.start}, {start: part.end, end: part.end});
    } else {
      output.push({start: part.start, end: part.end});
    }
    return output;
  }

  const size = diff(part.end, part.start);
  let biggest = biggestPowerOfTwo(size);

  let start: bigint;
  let end: bigint;
  if (size === biggest && part.start + size === part.end) {
    output.push(part);
    return output;
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

  // left side first (ascending order)
  if (start !== part.start) {
    subparts({start: part.start, end: start - 1n}, output);
  }

  // biggest chunk in the middle
  output.push({start, end});

  // right side last
  if (end !== part.end) {
    subparts({start: end + 1n, end: part.end}, output);
  }

  return output;
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

function mapNets(nets: Array<LeanParsedCidr>): NetMap {
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
      subparts({start, end: end!}, merged);
      start = null;
      end = null;
    } else if (index === (numbers.length - 1)) {
      subparts({start, end: end!}, merged);
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
  const arr = uniq(Array.isArray(nets) ? nets : [nets]).map(parseCidrLean);
  const maps = mapNets(arr);

  const merged: CidrsByVersion = {4: [], 6: []};
  for (const v of [4, 6] as Array<ValidIpVersion>) {
    merged[v] = doMerge(maps[v]).map(part => formatPart(part, v));
  }

  return [...merged[4], ...merged[6]];
}

/** Returns an array of merged remaining networks of the subtraction of `excludeNetworks` from `baseNetworks`. */
export function excludeCidr(base: Networks, excl: Networks): Array<Network> {
  const baseArr = uniq(Array.isArray(base) ? base : [base]).map(parseCidrLean);
  const exclArr = uniq(Array.isArray(excl) ? excl : [excl]).map(parseCidrLean);

  // Merge base and excl networks into Part objects
  const baseMaps = mapNets(baseArr);
  const exclMaps = mapNets(exclArr);

  const bases: {4: Array<Part>, 6: Array<Part>} = {4: [], 6: []};
  const excls: {4: Array<Part>, 6: Array<Part>} = {4: [], 6: []};

  for (const v of [4, 6] as Array<ValidIpVersion>) {
    bases[v] = doMerge(baseMaps[v]);
    excls[v] = doMerge(exclMaps[v]);
  }

  // Perform exclusions with Part objects
  for (const v of [4, 6] as Array<ValidIpVersion>) {
    for (const exclPart of excls[v]) {
      const newBases: Array<Part> = [];
      for (const basePart of bases[v]) {
        newBases.push(...excludeNetsParts(basePart, exclPart));
      }
      bases[v] = newBases;
    }
  }

  // Format to strings at the end
  const result: Array<Network> = [];
  for (const v of [4, 6] as Array<ValidIpVersion>) {
    for (const part of bases[v]) {
      result.push(formatPart(part, v));
    }
  }
  return result;
}

/* Returns a generator for individual IPs contained in the networks. */
export function* expandCidr(nets: Networks): Generator<Network> {
  const arr: Array<Network> = uniq(Array.isArray(nets) ? nets : [nets]);

  for (const net of mergeCidr(arr)) {
    const {start, end, version} = parseCidrLean(net);
    for (let number = start; number <= end; number++) {
      yield normalizeIp(stringifyIp({number, version}));
    }
  }
}

/** Returns a boolean that indicates if `networksA` overlap (intersect) with `networksB`. */
export function overlapCidr(a: Networks, b: Networks): boolean {
  const aNets = uniq(Array.isArray(a) ? a : [a]).map(parseCidrLean);
  const bNets = uniq(Array.isArray(b) ? b : [b]).map(parseCidrLean);

  for (const v of [4, 6] as Array<ValidIpVersion>) {
    const aVer = aNets.filter(n => n.version === v).sort((x, y) => x.start > y.start ? 1 : x.start < y.start ? -1 : 0);
    const bVer = bNets.filter(n => n.version === v).sort((x, y) => x.start > y.start ? 1 : x.start < y.start ? -1 : 0);

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
  const aNets = uniq(Array.isArray(a) ? a : [a]).map(parseCidrLean);
  const bNets = uniq(Array.isArray(b) ? b : [b]).map(parseCidrLean);

  for (const v of [4, 6] as Array<ValidIpVersion>) {
    const containers = aNets.filter(n => n.version === v).sort((x, y) => x.start > y.start ? 1 : x.start < y.start ? -1 : 0);
    const targets = bNets.filter(n => n.version === v);

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
