"use strict";

const cidrTools = module.exports = {};
const IPCIDR = require("ip-cidr");
const isIp = require("is-ip");
const isCidr = require("is-cidr");
const ipv6Normalize = require("ipv6-normalize");
const naturalCompare = require("string-natural-compare");
const {Address4, Address6} = require("ip-address");
const {BigInteger} = require("jsbn");

const bits = {
  "v4": 32,
  "v6": 128,
};

const bigint = numberstring => new BigInteger(numberstring);

const zero = bigint("0");
const one = bigint("1");
const two = bigint("2");

function parse(str) {
  if (isCidr(str)) {
    return new IPCIDR(cidrTools.normalize(str));
  } else {
    const version = isIp.version(str);
    if (version) {
      return new IPCIDR(cidrTools.normalize(`${str}/${bits[`v${version}`]}`));
    } else {
      throw new Error(`Network is not a CIDR or IP: ${str}`);
    }
  }
}

function format(number, v) {
  const cls = v === "v6" ? Address6 : Address4;
  if (number.constructor.name !== "BigInteger") number = bigint(number);
  return cidrTools.normalize(cls.fromBigInteger(number).address);
}

function uniq(arr) {
  return [...new Set(arr)];
}

function overlap(a, b) {
  const aStart = a.start({type: "bigInteger"});
  const bStart = b.start({type: "bigInteger"});
  const aEnd = a.end({type: "bigInteger"});
  const bEnd = b.end({type: "bigInteger"});

  //    aaa
  // bbb
  if (aStart.compareTo(bEnd) > 0) return false; // a starts after b

  // aaa
  //    bbb
  if (bStart.compareTo(aEnd) > 0) return false; // b starts after a

  return true;
}

// exclude b from a and return remainder cidrs
function exclude(a, b, v) {
  const aStart = a.start({type: "bigInteger"});
  const bStart = b.start({type: "bigInteger"});
  const aEnd = a.end({type: "bigInteger"});
  const bEnd = b.end({type: "bigInteger"});
  const parts = [];

  // compareTo returns negative if left is less than right

  //       aaa
  //   bbb
  //   aaa
  //       bbb
  if (aStart.compareTo(bEnd) > 0 || aEnd.compareTo(bStart) < 0) {
    return [a.cidr];
  }

  //   aaa
  //   bbb
  if (aStart.compareTo(bStart) === 0 && aEnd.compareTo(bEnd) === 0) {
    return [];
  }

  //   aa
  //  bbbb
  if (aStart.compareTo(bStart) > 0 && aEnd.compareTo(bEnd) < 0) {
    return [];
  }

  // aaaa
  //   bbbb
  // aaaa
  //   bb
  if (aStart.compareTo(bStart) < 0 && aEnd.compareTo(bEnd) <= 0) {
    parts.push({
      start: aStart,
      end: bStart.subtract(one),
    });
  }

  //    aaa
  //   bbb
  //   aaaa
  //   bbb
  if (aStart.compareTo(bStart) >= 0 && aEnd.compareTo(bEnd) > 0) {
    parts.push({
      start: bEnd.add(one),
      end: aEnd,
    });
  }

  //  aaaa
  //   bb
  if (aStart.compareTo(bStart) < 0 && aEnd.compareTo(bEnd) > 0) {
    parts.push({
      start: aStart,
      end: bStart.subtract(one),
    });
    parts.push({
      start: bEnd.add(one),
      end: aEnd,
    });
  }

  const remaining = [];
  for (const part of parts) {
    for (const subpart of subparts(part, v)) {
      remaining.push(formatPart(subpart, v));
    }
  }

  return cidrTools.merge(remaining);
}

function biggestPowerOfTwo(num) {
  if (num.compareTo(zero) === 0) return zero;
  const power = bigint(String(num.toString(2).length - 1));
  return two.pow(power);
}

function subparts(part) {
  // special case for when part is length 1
  if (part.end.subtract(part.start).compareTo(one) === 0) {
    if (part.end.remainder(two).equals(zero)) {
      return [{start: part.start, end: part.start}, {start: part.end, end: part.end}];
    } else {
      return [{start: part.start, end: part.end}];
    }
  }

  const size = diff(part.end, part.start);
  let biggest = biggestPowerOfTwo(size);

  let start, end;
  if (size.equals(biggest) && part.start.add(size).compareTo(part.end) === 0) {
    return [part];
  } else if (part.start.remainder(biggest).equals(zero)) {
    // start is matching on the size-defined boundary - ex: 0-12, use 0-8
    start = part.start;
    end = start.add(biggest).subtract(one);
  } else {
    start = part.end.divide(biggest).multiply(biggest);

    // start is not matching on the size-defined boundary - 4-16, use 8-16
    if (start.add(biggest).subtract(one).compareTo(part.end) > 0) {
      // divide will floor to nearest integer
      start = part.end.divide(biggest).subtract(one).multiply(biggest);

      while (start.compareTo(part.start) < 0) {
        biggest = biggest.divide(two);
        start = part.end.divide(biggest).subtract(one).multiply(biggest);
      }

      end = start.add(biggest).subtract(one);
    } else {
      start = part.end.divide(biggest).multiply(biggest);
      end = start.add(biggest).subtract(one);
    }
  }

  let parts = [{start, end}];

  // additional subnets on left side
  if (!start.equals(part.start)) {
    parts = parts.concat(subparts({start: part.start, end: start.subtract(one)}));
  }

  // additional subnets on right side
  if (!end.equals(part.end)) {
    parts = parts.concat(subparts({start: end.add(one), end: part.end}));
  }

  return parts;
}

function diff(a, b) {
  if (a.constructor.name !== "BigInteger") a = bigint(a);
  if (b.constructor.name !== "BigInteger") b = bigint(b);
  a = a.add(one);
  return a.subtract(b);
}

function formatPart(part, v) {
  const ip = format(part.start, v);
  const zeroes = diff(part.end, part.start).toString(2);
  const prefix = bits[v] - (zeroes.match(/0/g) || []).length;
  return `${ip}/${prefix}`;
}

cidrTools.normalize = (cidr) => {
  const cidrVersion = isCidr(cidr);
  if (cidrVersion === 4) {
    return cidr;
  } else if (cidrVersion === 6) {
    const [ip, prefix] = cidr.split("/");
    return `${ipv6Normalize(ip)}/${prefix}`;
  }

  const parsed = parse(cidr);
  if (parsed && parsed.address && parsed.address.v4) {
    return cidr;
  } else if (parsed && parsed.address && parsed.address.v4 === false) {
    return ipv6Normalize(cidr);
  }

  throw new Error(`Invalid network: ${cidr}`);
};

function mapNets(nets) {
  const maps = {v4: {}, v6: {}};
  for (const net of nets) {
    const start = net.start({type: "bigInteger"}).toString();
    const end = net.end({type: "bigInteger"}).toString();
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

cidrTools.merge = function(nets) {
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

      if (!start[v] && marker.start) {
        start[v] = bigint(number);
      }
      if (marker.end) {
        end[v] = bigint(number);
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
};

cidrTools.exclude = function(basenets, exclnets) {
  basenets = uniq(Array.isArray(basenets) ? basenets : [basenets]);
  exclnets = uniq(Array.isArray(exclnets) ? exclnets : [exclnets]);

  basenets = cidrTools.merge(basenets);
  exclnets = cidrTools.merge(exclnets);

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
        const remainders = exclude(base, excl, v);
        if (base.toString() !== remainders.toString()) {
          bases[v] = bases[v].concat(remainders);
          bases[v].splice(index, 1);
        }
      }
    }
  }

  return bases.v4.concat(bases.v6);
};

cidrTools.expand = function(nets) {
  nets = uniq(Array.isArray(nets) ? nets : [nets]);

  let ips = [];
  for (const net of cidrTools.merge(nets)) {
    ips = ips.concat((new IPCIDR(net)).toArray());
  }
  return ips.map(cidrTools.normalize);
};

cidrTools.overlap = (a, b) => {
  const aNets = uniq(Array.isArray(a) ? a : [a]);
  const bNets = uniq(Array.isArray(b) ? b : [b]);

  for (const a of aNets) {
    const aParsed = parse(a);
    for (const b of bNets) {
      const bParsed = parse(b);

      if (aParsed.address.v4 !== bParsed.address.v4) {
        continue;
      }

      if (overlap(aParsed, bParsed)) {
        return true;
      }
    }
  }

  return false;
};
