import {parseIp, stringifyIp, normalizeIp, ipVersion} from "ip-bigint";

const bits = {4: 32, 6: 128};

type IPv4Address = string;
type IPv6Address = string;
type IPv4CIDR = string;
type IPv6CIDR = string;
type CIDR = string;
type Network = IPv4Address | IPv4CIDR | IPv6Address | IPv6CIDR;
type Networks = Network | Network[];
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

function uniq<T extends any[]>(arr: T): T {
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
export function normalizeCidr<T extends Network | Network[]>(cidr: T, opts?: NormalizeOpts): T {
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
      throw new Error(`Network is not a CIDR or IP: ${str}`);
    }
  }

  const [ipAndMisc, prefix]: string[] = cidr.split("/");

  if (!/^[0-9]+$/.test(prefix)) {
    throw new Error(`Network is not a CIDR or IP: ${str}`);
  }

  const {number, version, ipv4mapped, scopeid} = parseIp(ipAndMisc);
  parsed.ip = stringifyIp({number, version, ipv4mapped, scopeid});
  parsed.cidr = `${parsed.ip}/${prefix}`;
  parsed.prefix = prefix;
  parsed.prefixPresent = Boolean(cidrVer);

  const numBits = bits[version as ValidIpVersion];
  const ipBits = number.toString(2).padStart(numBits, "0");
  const prefixLen = Number(numBits - Number(prefix));
  const startBits = ipBits.substring(0, numBits - prefixLen);
  parsed.start = BigInt(`0b${startBits}${"0".repeat(prefixLen)}`);
  parsed.end = BigInt(`0b${startBits}${"1".repeat(prefixLen)}`);
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
function excludeNets(a: ParsedCidr, b: ParsedCidr, v: IpVersion): CIDR[] {
  const parts: Part[] = [];

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

  const remaining = [];
  for (const part of parts) {
    for (const subpart of subparts(part)) {
      remaining.push(formatPart(subpart, v));
    }
  }

  return mergeCidr(remaining);
}

function biggestPowerOfTwo(num: bigint): bigint {
  if (num === 0n) return 0n;
  return 2n ** BigInt(String(num.toString(2).length - 1));
}

function subparts(part: Part): Part[] {
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
  const ip = normalizeCidr(stringifyIp({number: BigInt(part.start.toString()), version}));
  const zeroes = diff(part.end, part.start).toString(2);
  const prefix = bits[version as ValidIpVersion] - (zeroes.match(/0/g) || []).length;
  return `${ip}/${prefix}`;
}

type NetMapObj = {
  [num: string]: {
    start: number,
    end: number,
  },
};

type NetMap = {
  4: NetMapObj,
  6: NetMapObj,
};

function mapNets(nets: ParsedCidr[]): NetMap {
  const maps: NetMap = {4: {}, 6: {}}; // TODO: use Map with BigInt key
  for (const {start, end, version} of nets) {
    if (!maps[version][String(start)]) maps[version][String(start)] = {start: 0, end: 0};
    if (!maps[version][String(end)]) maps[version][String(end)] = {start: 0, end: 0};
    maps[version][String(start)].start += 1;
    maps[version][String(end)].end += 1;
  }
  return maps;
}

function doMerge(maps: NetMapObj): Part[] {
  let start = null;
  let end = null;
  const numbers = Object.keys(maps);
  let depth = 0;
  const merged: Part[] = [];

  for (const [index, number] of numbers.entries()) {
    const marker = maps[String(number)];

    if (start === null && marker.start) start = BigInt(number);
    if (marker.end) end = BigInt(number);
    if (start === null) continue;

    if (marker.start) depth += marker.start;
    if (marker.end) depth -= marker.end;

    const next = numbers[index + 1];
    if (marker.end && depth === 0 && next && ((BigInt(next) - BigInt(number)) > 1)) {
      // when there is a end and the next part is more than one number away, we cut a part
      for (const sub of subparts({start, end})) {
        merged.push(sub);
      }
      start = null;
      end = null;
    } else if (index === (numbers.length - 1)) {
      // cut the final part
      for (const sub of subparts({start, end})) {
        merged.push(sub);
      }
    }
  }
  return merged;
}

type CidrsByVersion = {
  4: [...cidr: CIDR[]],
  6: [...cidr: CIDR[]],
};

/** Returns an array of merged networks */
export function mergeCidr(nets: Networks): Network[] {
  // sort to workaround https://github.com/silverwind/cidr-tools/issues/17
  const arr: ParsedCidr[] = uniq((Array.isArray(nets) ? nets : [nets]).sort(compare).map(parseCidr));
  const maps = mapNets(arr);

  const merged: CidrsByVersion = {4: [], 6: []};
  for (const v of [4, 6] as ValidIpVersion[]) {
    merged[v] = doMerge(maps[v]).map(part => formatPart(part, v));
  }

  return [...merged[4].sort(compare), ...merged[6].sort(compare)];
}

/** Returns an array of merged remaining networks of the subtraction of `excludeNetworks` from `baseNetworks`. */
export function excludeCidr(base: Networks, excl: Networks): Network[] {
  const basenets: Network[] = mergeCidr(uniq(Array.isArray(base) ? base : [base]));
  const exclnets: Network[] = mergeCidr(uniq(Array.isArray(excl) ? excl : [excl]));

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

  for (const v of [4, 6] as ValidIpVersion[]) {
    for (const exclcidr of excls[v]) {
      for (const [index, basecidr] of bases[v].entries()) {
        const base = parseCidr(basecidr);
        const excl = parseCidr(exclcidr);
        const remainders = excludeNets(base, excl, v);
        if (base.cidr !== remainders.toString()) {
          bases[v] = bases[v].concat(remainders);
          bases[v].splice(index, 1);
        }
      }
    }
  }

  return bases[4].concat(bases[6]).sort(compare);
}

/* Returns a generator for individual IPs contained in the networks. */
export function* expandCidr(nets: Networks): Generator<Network> {
  const arr: Network[] = uniq(Array.isArray(nets) ? nets : [nets]);

  for (const net of mergeCidr(arr)) {
    const {start, end, version} = parseCidr(net);
    for (let number = start; number <= end; number++) {
      yield normalizeCidr(stringifyIp({number, version}));
    }
  }
}

/** Returns a boolean that indicates if `networksA` overlap (intersect) with `networksB`. */
export function overlapCidr(a: Networks, b: Networks): boolean {
  const aNets: Network[] = uniq(Array.isArray(a) ? a : [a]);
  const bNets: Network[] = uniq(Array.isArray(b) ? b : [b]);

  for (const a of aNets) {
    const aParsed = parseCidr(a);
    for (const b of bNets) {
      const bParsed = parseCidr(b);

      // version mismatch
      if (aParsed.version !== bParsed.version) {
        continue;
      }

      if (doNetsOverlap(aParsed, bParsed)) {
        return true;
      }
    }
  }

  return false;
}

/** Returns a boolean that indicates whether `networksA` fully contain all `networksB`. */
export function containsCidr(a: Networks, b: Networks): boolean {
  const aNets: Network[] = uniq(Array.isArray(a) ? a : [a]);
  const bNets: Network[] = uniq(Array.isArray(b) ? b : [b]);

  const numExpected = bNets.length;
  let numFound = 0;
  for (const a of aNets) {
    const aParsed = parseCidr(a);
    for (const b of bNets) {
      const bParsed = parseCidr(b);

      // version mismatch
      if (aParsed.version !== bParsed.version) {
        continue;
      }

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
