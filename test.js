"use strict";

const m = require(".");
const assert = require("assert");

async function main() {
  assert.deepStrictEqual(await m.merge(["1.0.0.0", "1.0.0.1"]), ["1.0.0.0/31"]);
  assert.deepStrictEqual(await m.merge(["1.0.0.0/24", "1.0.1.0/24"]), ["1.0.0.0/23"]);
  assert.deepStrictEqual(await m.merge(["1.0.0.0/24", "1.0.0.0"]), ["1.0.0.0/24"]);
  assert.deepStrictEqual(await m.merge(["1.0.0.0/24", "1.0.0.0/12"]), ["1.0.0.0/12"]);
  assert.deepStrictEqual(await m.merge(["0.0.0.0/8", "1.0.0.0/8"]), ["0.0.0.0/7"]);
  assert.deepStrictEqual(await m.merge(["4.0.0.0/8", "4.0.0.0/12", "4.0.0.0/16"]), ["4.0.0.0/8"]);
  assert.deepStrictEqual(await m.merge(["::0/128", "::1/128"]), ["::/127"]);
  assert.deepStrictEqual(await m.merge(["::0", "::1"]), ["::/127"]);
  assert.deepStrictEqual(await m.merge(["::0/128", "1.2.3.4/24", "::2/125"]), ["1.2.3.0/24", "::/125"]);
  assert.deepStrictEqual(await m.merge(["6620:0:1ff2::/70"]), ["6620:0:1ff2::/70"]);
  assert.deepStrictEqual(await m.merge(["0.0.0.1/32", "0.0.0.2/32"]), ["0.0.0.1/32", "0.0.0.2/32"]);
  assert.deepStrictEqual(await m.merge(["0.0.1.0/24", "0.0.2.0/24", "0.0.3.0/24", "0.0.4.0/24"]), ["0.0.1.0/24", "0.0.2.0/23", "0.0.4.0/24"]);
  assert.deepStrictEqual(await m.merge(["0.0.175.0/24", "0.0.176.0/21", "0.0.184.0/21", "0.0.192.0/24"]), ["0.0.175.0/24", "0.0.176.0/20", "0.0.192.0/24"]);
  assert.deepStrictEqual(await m.merge(["0.0.176.0/21", "0.0.184.0/21", "0.0.192.0/24"]), ["0.0.176.0/20", "0.0.192.0/24"]);
  assert.deepStrictEqual(await m.exclude(["1.0.0.0/23"], ["1.0.1.0/24"]), ["1.0.0.0/24"]);
  assert.deepStrictEqual(await m.exclude(["1.0.0.0/24"], ["1.0.0.0/16"]), []);
  assert.deepStrictEqual(await m.exclude(["::/127"], ["::1/128"]), ["::/128"]);
  assert.deepStrictEqual(await m.exclude(["::/120"], ["::1/112"]), []);
  assert.deepStrictEqual(await m.exclude(["::0/127", "1.2.3.0/24"], ["::/128"]), ["1.2.3.0/24", "::1/128"]);
  assert.deepStrictEqual(await m.exclude(["::0/127", "1.2.3.0/24"], ["::/0", "0.0.0.0/0"]), []);
  assert.deepStrictEqual(await m.exclude(["1.0.0.0/24"], ["1.0.0.0"]), ["1.0.0.1/32", "1.0.0.2/31", "1.0.0.4/30", "1.0.0.8/29", "1.0.0.16/28", "1.0.0.32/27", "1.0.0.64/26", "1.0.0.128/25"]);
  assert.deepStrictEqual(await m.exclude(["10.11.0.0/16"], ["10.11.70.0/24"]), ["10.11.0.0/18", "10.11.64.0/22", "10.11.68.0/23", "10.11.71.0/24", "10.11.72.0/21", "10.11.80.0/20", "10.11.96.0/19", "10.11.128.0/17"]);
  assert.deepStrictEqual(await m.exclude("0.0.0.0/30", ["0.0.0.1/32", "0.0.0.2/32"]), ["0.0.0.0/32", "0.0.0.3/32"]);
  assert.deepStrictEqual(await m.expand(["1.2.3.0/31"]), ["1.2.3.0", "1.2.3.1"]);
  assert.deepStrictEqual(await m.expand(["1::/126"]), ["1::", "1::1", "1::2", "1::3"]);
  assert.deepStrictEqual(await m.expand(["2008:db1::/127"]), ["2008:db1::", "2008:db1::1"]);
  assert.deepStrictEqual(await m.expand("2008:db1::/127"), ["2008:db1::", "2008:db1::1"]);
  assert.deepStrictEqual(await m.overlap("1.0.0.0/24", "1.0.0.0/30"), true);
  assert.deepStrictEqual(await m.overlap("2::/8", "1::/8"), true);
  assert.deepStrictEqual(await m.overlap("1.0.0.0/25", "1.0.0.128/25"), false);
  assert.deepStrictEqual(await m.overlap("0.0.0.0/0", "::0/0"), false);
  assert.deepStrictEqual(await m.overlap("2::/64", "1::/64"), false);
  assert.deepStrictEqual(await m.overlap(["1.0.0.0/24"], ["1.0.0.0/30"]), true);
  assert.deepStrictEqual(await m.overlap(["1.0.0.0", "2.0.0.0"], ["0.0.0.0/6"]), true);
  assert.deepStrictEqual(await m.overlap("::1", "0.0.0.1"), false);
  assert.deepStrictEqual(await m.overlap("fe80:1:0:0:0:0:0:0", "fe80::/10"), true);
  assert.deepStrictEqual(await m.overlap("::1", ["0.0.0.1", "0.0.0.2"]), false);
  assert.deepStrictEqual(await m.normalize("0:0:0:0:0:0:0:0"), "::");
  assert.deepStrictEqual(await m.normalize("0:0:0:0:0:0:0:0/0"), "::/0");
}

function exit(err) {
  if (err) console.info(err);
  process.exit(err ? 1 : 0);
}

main().then(exit).catch(exit);
