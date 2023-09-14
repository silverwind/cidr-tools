import ipRegex from "ip-regex";
import cidrRegex from "cidr-regex";
import naturalCompare from "string-natural-compare";
import {parseIp, stringifyIp, normalizeIp} from "ip-bigint";

const bits = {
  4: 32,
  6: 128,
};

const uniq = arr => Array.from(new Set(arr));

export function isIP(ip) {
  if (ipRegex.v4({exact: true}).test(ip)) return 4;
  if (ipRegex.v6({exact: true}).test(ip)) return 6;
  return 0;
}

function isCidr(ip) {
  if (cidrRegex.v4({exact: true}).test(ip)) return 4;
  if (cidrRegex.v6({exact: true}).test(ip)) return 6;
  return 0;
}

function doNormalize(cidr, {compress = true, hexify = false} = {}) {
  const {start, prefix, single, version} = parse(cidr);
  if (!single) { // cidr
    // set network address to first address
    const ip = normalizeIp(stringifyIp({number: start, version}), {compress, hexify});
    return `${ip}/${prefix}`;
  } else { // single ip
    return normalizeIp(cidr, {compress, hexify});
  }
}

export function normalize(cidr, {compress = true, hexify = false} = {}) {
  if (Array.isArray(cidr)) {
    return cidr.map(entry => normalize(entry, {compress, hexify}));
  } else {
    return doNormalize(cidr, {compress, hexify});
  }
}

export function parse(str) {
  const cidrVersion = isCidr(str);
  const parsed = Object.create(null);
  parsed.single = false;

  if (cidrVersion) {
    parsed.cidr = str;
    parsed.version = cidrVersion;
  } else {
    const version = isIP(str);
    if (version) {
      parsed.cidr = `${str}/${bits[version]}`;
      parsed.version = version;
      parsed.single = true;
    } else {
      throw new Error(`Network is not a CIDR or IP: ${str}`);
    }
  }

  const [ip, prefix] = parsed.cidr.split("/");
  parsed.prefix = prefix;
  const {number, version} = parseIp(ip);
  const numBits = bits[version];
  const ipBits = number.toString(2).padStart(numBits, "0");
  const prefixLen = Number(numBits - prefix);
  const startBits = ipBits.substring(0, numBits - prefixLen);
  parsed.start = BigInt(`0b${startBits}${"0".repeat(prefixLen)}`);
  parsed.end = BigInt(`0b${startBits}${"1".repeat(prefixLen)}`);
  return parsed;
}

// returns whether networks fully or partially overlap
function doNetsOverlap(a, b) {
  //    aaa
  // bbb
  if (a.start > b.end) return false; // a starts after b

  // aaa
  //    bbb
  if (b.start > a.end) return false; // b starts after a

  return true;
}

// returns whether network a fully contains network b;
function netContains(a, b) {
  //  aaa
  // bbbb
  if (b.start < a.start) return false; // a starts after b

  // aaa
  // bbbb
  if (b.end > a.end) return false; // b starts after a

  return true;
}

// exclude b from a and return remainder cidrs
function excludeNets(a, b, v) {
  const parts = [];

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

  return merge(remaining);
}

function biggestPowerOfTwo(num) {
  if (num === 0n) return 0n;
  return 2n ** BigInt(String(num.toString(2).length - 1));
}

function subparts(part) {
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

  let start, end;
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

function diff(a, b) {
  if (typeof a !== "bigint") a = BigInt(a);
  if (typeof b !== "bigint") b = BigInt(b);
  a += 1n;
  return a - b;
}

function formatPart(part, v) {
  const ip = normalize(stringifyIp({
    number: BigInt(part.start.toString()),
    version: v,
  }));
  const zeroes = diff(part.end, part.start).toString(2);
  const prefix = bits[v] - (zeroes.match(/0/g) || []).length;
  return `${ip}/${prefix}`;
}

function mapNets(nets) {
  const maps = {4: {}, 6: {}};
  for (const {start, end, version: v} of nets) {
    if (!maps[v][start]) maps[v][start] = {};
    if (!maps[v][end]) maps[v][end] = {};

    if (maps[v][start].start) {
      maps[v][start].start += 1;
    } else {
      maps[v][start].start = 1;
    }

    if (maps[v][end].end) {
      maps[v][end].end += 1;
    } else {
      maps[v][end].end = 1;
    }
  }
  return maps;
}

export function merge(nets) {
  nets = uniq((Array.isArray(nets) ? nets : [nets]).map(parse));
  const maps = mapNets(nets);

  const merged = {4: [], 6: []};
  const start = {4: null, 6: null};
  const end = {4: null, 6: null};

  for (const v of [4, 6]) {
    const numbers = Object.keys(maps[v]).sort(naturalCompare);
    let depth = 0;

    for (const [index, number] of numbers.entries()) {
      const marker = maps[v][number];

      if (start[v] === null && marker.start) {
        start[v] = BigInt(number);
      }
      if (marker.end) {
        end[v] = BigInt(number);
      }

      if (marker.start) depth += marker.start;
      if (marker.end) depth -= marker.end;

      if (marker.end && depth === 0 && ((numbers[index + 1] - numbers[index]) > 1)) {
        for (const sub of subparts({start: start[v], end: end[v]})) {
          merged[v].push(formatPart(sub, v));
        }
        start[v] = null;
        end[v] = null;
      } else if (index === (numbers.length - 1)) {
        for (const sub of subparts({start: start[v], end: end[v]})) {
          merged[v].push(formatPart(sub, v));
        }
      }
    }
  }

  return [...merged[4].sort(naturalCompare), ...merged[6].sort(naturalCompare)];
}

export function exclude(basenets, exclnets) {
  basenets = uniq(Array.isArray(basenets) ? basenets : [basenets]);
  exclnets = uniq(Array.isArray(exclnets) ? exclnets : [exclnets]);

  basenets = merge(basenets);
  exclnets = merge(exclnets);

  const bases = {4: [], 6: []};
  const excls = {4: [], 6: []};

  for (const basenet of basenets) {
    bases[isCidr(basenet)].push(basenet);
  }

  for (const exclnet of exclnets) {
    excls[isCidr(exclnet)].push(exclnet);
  }

  for (const v of [4, 6]) {
    for (const exclcidr of excls[v]) {
      for (const [index, basecidr] of bases[v].entries()) {
        const base = parse(basecidr);
        const excl = parse(exclcidr);
        const remainders = excludeNets(base, excl, v);
        if (base.cidr !== remainders.toString()) {
          bases[v] = bases[v].concat(remainders);
          bases[v].splice(index, 1);
        }
      }
    }
  }

  return bases[4].concat(bases[6]);
}

export function expand(nets) {
  nets = uniq(Array.isArray(nets) ? nets : [nets]);

  const ips = [];
  for (const net of merge(nets)) {
    const {start, end, version} = parse(net);
    for (let number = start; number <= end; number++) {
      ips.push(stringifyIp({number, version}));
    }
  }
  return ips.map(normalize);
}

export function overlap(a, b) {
  const aNets = uniq(Array.isArray(a) ? a : [a]);
  const bNets = uniq(Array.isArray(b) ? b : [b]);

  for (const a of aNets) {
    const aParsed = parse(a);
    for (const b of bNets) {
      const bParsed = parse(b);

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

export function contains(a, b) {
  const aNets = uniq(Array.isArray(a) ? a : [a]);
  const bNets = uniq(Array.isArray(b) ? b : [b]);

  const numExpected = bNets.length;
  let numFound = 0;
  for (const a of aNets) {
    const aParsed = parse(a);
    for (const b of bNets) {
      const bParsed = parse(b);

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
  merge,
  exclude,
  expand,
  overlap,
  contains,
  normalize,
  parse,
};
