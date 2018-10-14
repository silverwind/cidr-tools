"use strict";

const cidrTools = module.exports = {};
const IPCIDR = require("ip-cidr");
const isCidr = require("is-cidr");
const ipv6Normalize = require("ipv6-normalize");
const naturalCompare = require("string-natural-compare");
const Address4 = require("ip-address").Address4;
const Address6 = require("ip-address").Address6;
const BigInteger = require("jsbn").BigInteger;

const bits = {
  "v4": 32,
  "v6": 128,
};

function bigint(numberstring) {
  return new BigInteger(numberstring);
}

function parse(str) {
  if (isCidr(str)) {
    return new IPCIDR(cidrTools.normalize(str));
  } else {
    const parsed = new IPCIDR(cidrTools.normalize(str));
    if (parsed && parsed.address) {
      return new IPCIDR(cidrTools.normalize(`${str}/${bits[parsed.address.v4 ? "v4" : "v6"]}`));
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

function prefix(size, v) {
  return bits[v] - (bigint(String(size)).toString(2).match(/0/g) || []).length;
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

function exclude(a, b, v) {
  const aStart = a.start({type: "bigInteger"});
  const bStart = b.start({type: "bigInteger"});
  const aEnd = a.end({type: "bigInteger"});
  const bEnd = b.end({type: "bigInteger"});
  const parts = [];

  // compareTo returns negative if left is less than right

  //   aaa
  //       bbb
  //       aaa
  //   bbb
  if (aEnd.compareTo(bStart) < 0 || aStart.compareTo(bEnd) > 0) {
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
      end: bStart.subtract(bigint("1")),
    });
  }

  //    aaa
  //   bbb
  //   aaaa
  //   bbb
  if (aStart.compareTo(bStart) >= 0 && aEnd.compareTo(bEnd) > 0) {
    parts.push({
      start: bEnd.add(bigint("1")),
      end: aEnd,
    });
  }

  //  aaaa
  //   bb
  if (aStart.compareTo(bStart) < 0 && aEnd.compareTo(bEnd) > 0) {
    parts.push({
      start: aStart,
      end: bStart.subtract(bigint("1")),
    });
    parts.push({
      start: bEnd.add(bigint("1")),
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
  if (num.compareTo(bigint("0")) === 0) return bigint("0");
  const power = bigint(String(num.toString(2).length - 1));
  return bigint("2").pow(power);
}

function subparts(part) {
  const size = bigint(diff(part.end, part.start));
  const biggest = biggestPowerOfTwo(size);

  if (size.equals(biggest)) return [part];

  const start = part.start.add(biggest).divide(biggest).multiply(biggest);
  const end = start.add(biggest).subtract(bigint("1"));
  let parts = [{start, end}];

  // // additional subnets on left side
  if (!start.equals(part.start)) {
    parts = parts.concat(subparts({start: part.start, end: start.subtract(bigint("1"))}));
  }

  // additional subnets on right side
  if (!end.equals(part.end)) {
    parts = parts.concat(subparts({start: part.start, end: start.subtract(bigint("1"))}));
  }

  return parts;
}

function diff(a, b) {
  if (a.constructor.name !== "BigInteger") a = bigint(a);
  if (b.constructor.name !== "BigInteger") b = bigint(b);
  a = a.add(bigint("1"));
  return a.subtract(b).toString();
}

function formatPart(part, v) {
  const d = diff(part.end, part.start);
  return format(part.start, v) + "/" + prefix(d, v);
}

cidrTools.normalize = (cidr) => {
  const cidrVersion = isCidr(cidr);
  if (cidrVersion === 4) {
    return cidr;
  } else if (cidrVersion === 6) {
    const [ip, prefix] = cidr.split("/");
    return `${ipv6Normalize(ip)}/${prefix}`;
  }

  const parsed = new IPCIDR(cidr);
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
      const excl = parse(exclcidr);
      for (const [index, basecidr] of bases[v].entries()) {
        const base = parse(basecidr);
        const remainders = exclude(base, excl, v);
        bases[v] = bases[v].concat(remainders);
        bases[v].splice(index, 1);
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
  a = parse(a);
  b = parse(b);

  if (a.address.v4 !== b.address.v4) return false;
  return overlap(a, b);
};
