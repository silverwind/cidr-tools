"use strict";

const cidrTools = module.exports = {};
const IPCIDR = require("ip-cidr");
const isCIDR = require("is-cidr");
const ipaddr = require("ipaddr.js");
const naturalCompare = require("string-natural-compare");
const Address4 = require("ip-address").Address4;
const Address6 = require("ip-address").Address6;
const BigInteger = require("jsbn").BigInteger;

function parse(net) {
  if (!isCIDR(net)) {
    throw new Error(`Network is not a CIDR: ${net}`);
  }
  return new IPCIDR(cidrTools.normalize(net));
}

function format(number, v) {
  const cls = v === "v6" ? Address6 : Address4;
  const ip = cls.fromBigInteger(new BigInteger(number)).address;
  return ipaddr.parse(ip).toString();
}

function prefix(size, v) {
  const base = v === "v6" ? 128 : 32;
  return base - (new BigInteger(size).toString(2).match(/0/g) || []).length;
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

// exclude b from a end return remainder numbers
function exclude(a, b, v) {
  const aStart = a.start({type: "bigInteger"});
  const bStart = b.start({type: "bigInteger"});
  const aEnd = a.end({type: "bigInteger"});
  const bEnd = b.end({type: "bigInteger"});

  // compareTo returns negative if left is less than right
  const parts = [];

  //   aaa
  //   bbb
  if (aStart.compareTo(bStart) === 0 && aEnd.compareTo(bEnd) === 0) {
    return a.cidr;
  }

  //   aa
  //  bbbb
  if (aStart.compareTo(bStart) > 0 && aEnd.compareTo(bEnd) < 0) {
    return a.cidr;
  }

  // aaaa
  //   bbbb
  // aaaa
  //   bb
  if (aStart.compareTo(bStart) < 0 && aEnd.compareTo(bEnd) <= 0) {
    parts.push({
      start: aStart,
      end: bStart.subtract(new BigInteger("1")),
    });
  }

  //    aaa
  //   bbb
  //   aaaa
  //   bbb
  if (aStart.compareTo(bStart) >= 0 && aEnd.compareTo(bEnd) > 0) {
    parts.push({
      start: bEnd.add(new BigInteger("1")),
      end: aEnd,
    });
  }

  //  aaaa
  //   bb
  if (aStart.compareTo(bStart) < 0 && aEnd.compareTo(bEnd) > 0) {
    parts.push({
      start: aStart,
      end: bStart.subtract(new BigInteger("1")),
    });
    parts.push({
      start: bEnd.add(new BigInteger("1")),
      end: aEnd,
    });
  }

  return parts.map(part => {
    const ip = format(part.start.toString(), v);
    const pref = prefix(subBI(part.end, part.start), v);
    return `${ip}/${pref}`;
  });
}

function sub(a, b) {
  a = new BigInteger(a);
  b = new BigInteger(b);
  return subBI(a, b);
}

function subBI(a, b) {
  a = a.add(new BigInteger("1"));
  return a.subtract(b).toString();
}

cidrTools.normalize = cidr => {
  return ipaddr.parseCIDR(cidr).toString();
};

function mapNets(nets) {
  const maps = {v4: {}, v6: {}};
  for (const net of nets) {
    const start = net.start({type: "bigInteger"}).toString();
    const end = net.end({type: "bigInteger"}).toString();
    const v = isCIDR.v4(net) ? "v4" : "v6";

    if (!maps[v][start]) maps[v][start] = {};
    if (!maps[v][end]) maps[v][end] = {};

    maps[v][start].start = true;
    maps[v][end].end = true;
  }
  return maps;
}

cidrTools.merge = function(nets) {
  nets = (Array.isArray(nets) ? nets : [nets]).map(parse);
  const maps = mapNets(nets);

  const merged = {v4: [], v6: []};
  const start = {v4: null, v6: null};
  const end = {v4: null, v6: null};

  for (const v of ["v4", "v6"]) {
    const numbers = Object.keys(maps[v]).sort(naturalCompare);
    let depth = 0;

    for (const [index, number] of numbers.entries()) {
      const marker = maps[v][number];
      if (!start[v] && marker.start) start[v] = number;
      if (marker.end) end[v] = number;

      if (marker.start) depth += 1;
      if (marker.end) depth -= 1;

      if (marker.end && depth === 0 && ((numbers[index + 1] - numbers[index]) > 1)) {
        merged[v].push(format(start[v], v) + "/" + prefix(sub(end[v], start[v]), v));
        start[v] = null;
        end[v] = null;
      } else if (index === (numbers.length - 1)) {
        merged[v].push(format(start[v], v) + "/" + prefix(sub(end[v], start[v]), v));
      }
    }
  }

  return merged.v4.concat(merged.v6);
};

cidrTools.exclude = function(basenets, exclnets) {
  basenets = Array.isArray(basenets) ? basenets : [basenets];
  exclnets = Array.isArray(exclnets) ? exclnets : [exclnets];

  basenets = cidrTools.merge(basenets);
  exclnets = cidrTools.merge(exclnets);

  const bases = {v4: [], v6: []};
  const excls = {v4: [], v6: []};

  for (const basenet of basenets) {
    bases[isCIDR.v4(basenet) ? "v4" : "v6"].push(basenet);
  }

  for (const exclnet of exclnets) {
    excls[isCIDR.v4(exclnet) ? "v4" : "v6"].push(exclnet);
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
  nets = Array.isArray(nets) ? nets : [nets];

  let ips = [];
  for (const net of cidrTools.merge(nets)) {
    ips = ips.concat((new IPCIDR(net)).toArray());
  }
  return ips;
};

cidrTools.overlap = (netA, netB) => {
  const a = new IPCIDR(parse(netA));
  const b = new IPCIDR(parse(netB));

  if (a.address.v4 !== b.address.v4) {
    return false;
  }

  return overlap(a, b);
};
