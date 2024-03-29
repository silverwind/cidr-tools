import {parseIp, stringifyIp, normalizeIp, ipVersion} from "ip-bigint";

const bits = {4: 32, 6: 128};
const uniq = arr => Array.from(new Set(arr));
const cidrVersion = cidr => cidr.includes("/") ? ipVersion(cidr) : 0;

// TODO: pass parsed objects in here
function compare(a, b) {
  const {number: aNum, version: aVersion} = parseIp(a.replace(/\/.+/, ""));
  const {number: bNum, version: bVersion} = parseIp(b.replace(/\/.+/, ""));
  if (aVersion === bVersion) {
    return aNum - bNum > 0n ? 1 : aNum - bNum < 0n ? -1 : 0;
  } else {
    return aVersion > bVersion;
  }
}

function doNormalize(cidr, {compress = true, hexify = false} = {}) {
  const {start, end, prefix, version} = parseCidr(cidr);
  if (start !== end) { // cidr
    // set network address to first address
    const ip = normalizeIp(stringifyIp({number: start, version}), {compress, hexify});
    return `${ip}/${prefix}`;
  } else { // single ip
    return normalizeIp(cidr, {compress, hexify});
  }
}

export function normalizeCidr(cidr, {compress = true, hexify = false} = {}) {
  if (Array.isArray(cidr)) {
    return cidr.map(entry => normalizeCidr(entry, {compress, hexify}));
  } else {
    return doNormalize(cidr, {compress, hexify});
  }
}

export function parseCidr(str) {
  const cidrVer = cidrVersion(str);
  const parsed = Object.create(null);

  let cidr;
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

  const [ipAndMisc, prefix] = cidr.split("/");

  if (!/^[0-9]+$/.test(prefix)) {
    throw new Error(`Network is not a CIDR or IP: ${str}`);
  }

  const {number, version, ipv4mapped, scopeid} = parseIp(ipAndMisc);
  parsed.ip = stringifyIp({number, version, ipv4mapped, scopeid});
  parsed.cidr = `${parsed.ip}/${prefix}`;
  parsed.prefix = prefix;

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

  return mergeCidr(remaining);
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

function formatPart(part, version) {
  const ip = normalizeCidr(stringifyIp({number: BigInt(part.start.toString()), version}));
  const zeroes = diff(part.end, part.start).toString(2);
  const prefix = bits[version] - (zeroes.match(/0/g) || []).length;
  return `${ip}/${prefix}`;
}

function mapNets(nets) {
  const maps = {4: {}, 6: {}}; // TODO: use Map with BigInt key
  for (const {start, end, version} of nets) {
    if (!maps[version][start]) maps[version][start] = {};
    if (!maps[version][end]) maps[version][end] = {};

    if (maps[version][start].start) {
      maps[version][start].start += 1;
    } else {
      maps[version][start].start = 1;
    }

    if (maps[version][end].end) {
      maps[version][end].end += 1;
    } else {
      maps[version][end].end = 1;
    }
  }
  return maps;
}

function doMerge(maps) {
  let start = null;
  let end = null;
  const numbers = Object.keys(maps);
  let depth = 0;
  const merged = [];

  for (const [index, number] of numbers.entries()) {
    const marker = maps[number];

    if (start === null && marker.start) {
      start = BigInt(number);
    }
    if (marker.end) {
      end = BigInt(number);
    }

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

export function mergeCidr(nets) {
  // sort to workaround https://github.com/silverwind/cidr-tools/issues/17
  nets = uniq((Array.isArray(nets) ? nets : [nets]).sort(compare).map(parseCidr));
  const maps = mapNets(nets);

  const merged = {4: [], 6: []};
  for (const v of [4, 6]) {
    merged[v] = doMerge(maps[v]).map(part => formatPart(part, v));
  }

  return [...merged[4].sort(compare), ...merged[6].sort(compare)];
}

export function excludeCidr(basenets, exclnets) {
  basenets = uniq(Array.isArray(basenets) ? basenets : [basenets]);
  exclnets = uniq(Array.isArray(exclnets) ? exclnets : [exclnets]);

  basenets = mergeCidr(basenets);
  exclnets = mergeCidr(exclnets);

  const bases = {4: [], 6: []};
  const excls = {4: [], 6: []};

  for (const basenet of basenets) {
    bases[cidrVersion(basenet)].push(basenet);
  }

  for (const exclnet of exclnets) {
    excls[cidrVersion(exclnet)].push(exclnet);
  }

  for (const v of [4, 6]) {
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

export function expandCidr(nets) {
  nets = uniq(Array.isArray(nets) ? nets : [nets]);

  const ips = [];
  for (const net of mergeCidr(nets)) {
    const {start, end, version} = parseCidr(net);
    for (let number = start; number <= end; number++) {
      ips.push(stringifyIp({number, version}));
    }
  }
  return ips.map(normalizeCidr);
}

export function overlapCidr(a, b) {
  const aNets = uniq(Array.isArray(a) ? a : [a]);
  const bNets = uniq(Array.isArray(b) ? b : [b]);

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

export function containsCidr(a, b) {
  const aNets = uniq(Array.isArray(a) ? a : [a]);
  const bNets = uniq(Array.isArray(b) ? b : [b]);

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
