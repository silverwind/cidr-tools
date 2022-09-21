import IPCIDR from "ip-cidr";
import ipRegex from "ip-regex";
import isCidr from "is-cidr";
import naturalCompare from "string-natural-compare";
import {parseIp, stringifyIp} from "ip-bigint";

const bits = {
  "v4": 32,
  "v6": 128,
};

const normalizeIp = str => stringifyIp(parseIp(str));
const uniq = arr => [...new Set(arr)];

function isIP(ip) {
  if (ipRegex.v4({exact: true}).test(ip)) return 4;
  if (ipRegex.v6({exact: true}).test(ip)) return 6;
  return 0;
}

function doNormalize(cidr) {
  const cidrVersion = isCidr(cidr);

  // cidr
  if (cidrVersion) {
    // set network address to first address
    let start = (new IPCIDR(cidr)).start();
    if (cidrVersion === 6) start = normalizeIp(start);
    if (start) {
      return `${start}${cidr.match(/\/.+/)}`.toLowerCase();
    }
  }

  // single ip
  const parsed = parse(cidr);
  if (parsed?.address?.v4) {
    return cidr;
  } else if (parsed?.address?.v4 === false) {
    return normalizeIp(cidr);
  }

  throw new Error(`Invalid network: ${cidr}`);
}

export function normalize(cidr) {
  return Array.isArray(cidr) ? cidr.map(doNormalize) : doNormalize(cidr);
}

function parse(str) {
  if (isCidr(str)) {
    return new IPCIDR(normalize(str));
  } else {
    const version = isIP(str);
    if (version) {
      return new IPCIDR(normalize(`${str}/${bits[`v${version}`]}`));
    } else {
      throw new Error(`Network is not a CIDR or IP: ${str}`);
    }
  }
}

function format(number, version) {
  if (!(number instanceof BigInt)) number = BigInt(number);

  return normalize(stringifyIp({
    number: BigInt(number.toString()),
    version: Number(version.substring(1)),
  }));
}

// utility function that returns boundaries of two networks
function getBoundaries(a, b) {
  const aStart = BigInt(a.start({type: "bigInteger"}).toString());
  const bStart = BigInt(b.start({type: "bigInteger"}).toString());
  const aEnd = BigInt(a.end({type: "bigInteger"}).toString());
  const bEnd = BigInt(b.end({type: "bigInteger"}).toString());
  return {aStart, bStart, aEnd, bEnd};
}

// returns whether networks fully or partially overlap
function doNetsOverlap(a, b) {
  const {aStart, bStart, aEnd, bEnd} = getBoundaries(a, b);

  //    aaa
  // bbb
  if (aStart > bEnd) return false; // a starts after b

  // aaa
  //    bbb
  if (bStart > aEnd) return false; // b starts after a

  return true;
}

// returns whether network a fully contains network b;
function netContains(a, b) {
  const {aStart, bStart, aEnd, bEnd} = getBoundaries(a, b);

  //  aaa
  // bbbb
  if (bStart < aStart) return false; // a starts after b

  // aaa
  // bbbb
  if (bEnd > aEnd) return false; // b starts after a

  return true;
}

// exclude b from a and return remainder cidrs
function excludeNets(a, b, v) {
  const {aStart, bStart, aEnd, bEnd} = getBoundaries(a, b);
  const parts = [];

  // compareTo returns negative if left is less than right

  //       aaa
  //   bbb
  //   aaa
  //       bbb
  if (aStart > bEnd || aEnd < bStart) {
    return [a.cidr];
  }

  //   aaa
  //   bbb
  if (aStart === bStart && aEnd === bEnd) {
    return [];
  }

  //   aa
  //  bbbb
  if (aStart > bStart && aEnd < bEnd) {
    return [];
  }

  // aaaa
  //   bbbb
  // aaaa
  //   bb
  if (aStart < bStart && aEnd <= bEnd) {
    parts.push({start: aStart, end: bStart - 1n});
  }

  //    aaa
  //   bbb
  //   aaaa
  //   bbb
  if (aStart >= bStart && aEnd > bEnd) {
    parts.push({start: bEnd + 1n, end: aEnd});
  }

  //  aaaa
  //   bb
  if (aStart < bStart && aEnd > bEnd) {
    parts.push(
      {start: aStart, end: bStart - 1n},
      {start: bEnd + 1n, end: aEnd},
    );
  }

  const remaining = [];
  for (const part of parts) {
    for (const subpart of subparts(part, v)) {
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
  const ip = format(part.start, v);
  const zeroes = diff(part.end, part.start).toString(2);
  const prefix = bits[v] - (zeroes.match(/0/g) || []).length;
  return `${ip}/${prefix}`;
}

function mapNets(nets) {
  const maps = {v4: {}, v6: {}};
  for (const net of nets) {
    const start = BigInt(net.start({type: "bigInteger"}).toString());
    const end = BigInt(net.end({type: "bigInteger"}).toString());
    const v = `v${isCidr(net)}`;

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

  const merged = {v4: [], v6: []};
  const start = {v4: null, v6: null};
  const end = {v4: null, v6: null};

  for (const v of ["v4", "v6"]) {
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

  merged.v4 = merged.v4.sort(naturalCompare);
  merged.v6 = merged.v6.sort(naturalCompare);
  return merged.v4.concat(merged.v6);
}

export function exclude(basenets, exclnets) {
  basenets = uniq(Array.isArray(basenets) ? basenets : [basenets]);
  exclnets = uniq(Array.isArray(exclnets) ? exclnets : [exclnets]);

  basenets = merge(basenets);
  exclnets = merge(exclnets);

  const bases = {v4: [], v6: []};
  const excls = {v4: [], v6: []};

  for (const basenet of basenets) {
    bases[`v${isCidr(basenet)}`].push(basenet);
  }

  for (const exclnet of exclnets) {
    excls[`v${isCidr(exclnet)}`].push(exclnet);
  }

  for (const v of ["v4", "v6"]) {
    for (const exclcidr of excls[v]) {
      for (const [index, basecidr] of bases[v].entries()) {
        const base = parse(basecidr);
        const excl = parse(exclcidr);
        const remainders = excludeNets(base, excl, v);
        if (base.toString() !== remainders.toString()) {
          bases[v] = bases[v].concat(remainders);
          bases[v].splice(index, 1);
        }
      }
    }
  }

  return bases.v4.concat(bases.v6);
}

export function expand(nets) {
  nets = uniq(Array.isArray(nets) ? nets : [nets]);

  let ips = [];
  for (const net of merge(nets)) {
    ips = ips.concat((new IPCIDR(net)).toArray());
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
      if (aParsed.address.v4 !== bParsed.address.v4) {
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
      if (aParsed.address.v4 !== bParsed.address.v4) {
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
