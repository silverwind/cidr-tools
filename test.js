"use strict";

const m = require(".");
const assert = require("assert");

async function main() {
  assert.deepStrictEqual(await m.merge(["1.0.0.0/24", "1.0.1.0/24"]), ["1.0.0.0/23"]);
  assert.deepStrictEqual(await m.merge(["1.0.0.0/24", "1.0.0.0/12"]), ["1.0.0.0/12"]);
  assert.deepStrictEqual(await m.merge(["1.0.0.0/8", "2.0.0.0/8"]), ["1.0.0.0/7"]);
  assert.deepStrictEqual(await m.merge(["4.0.0.0/8", "4.0.0.0/12", "4.0.0.0/16"]), ["4.0.0.0/8"]);
  assert.deepStrictEqual(await m.merge(["::0/128", "::1/128"]), ["::/127"]);
  assert.deepStrictEqual(await m.merge(["::0/128", "1.2.3.4/24", "::2/125"]), ["1.2.3.0/24", "::/125"]);
  assert.deepStrictEqual(await m.exclude(["1.0.0.0/23"], ["1.0.1.0/24"]), ["1.0.0.0/24"]);
  assert.deepStrictEqual(await m.exclude(["1.0.0.0/24"], ["1.0.0.0/16"]), []);
  assert.deepStrictEqual(await m.exclude(["::/127"], ["::1/128"]), ["::/128"]);
  assert.deepStrictEqual(await m.exclude(["::/120"], ["::1/112"]), []);
  assert.deepStrictEqual(await m.exclude(["::0/127", "1.2.3.0/24"], ["::/128"]), ["1.2.3.0/24", "::1/128"]);
  assert.deepStrictEqual(await m.exclude(["::0/127", "1.2.3.0/24"], ["::/0", "0.0.0.0/0"]), []);
  assert.deepStrictEqual(await m.expand(["1.2.3.0/31"]), ["1.2.3.0", "1.2.3.1"]);
  assert.deepStrictEqual(await m.expand(["1::/126"]), ["1::", "1::1", "1::2", "1::3"]);
  assert.deepStrictEqual(await m.expand(["2008:db1::/127"]), ["2008:db1::", "2008:db1::1"]);
  assert.deepStrictEqual(await m.expand("2008:db1::/127"), ["2008:db1::", "2008:db1::1"]);
}

function exit(err) {
  if (err) console.info(err);
  process.exit(err ? 1 : 0);
}

main().then(exit).catch(exit);
