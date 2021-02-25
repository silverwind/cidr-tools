"use strict";

const {merge, exclude, expand, overlap, normalize} = require(".");

test("merge", () => {
  expect(merge(["1.0.0.0", "1.0.0.1"])).toEqual(["1.0.0.0/31"]);
  expect(merge(["1.0.0.0/24", "1.0.1.0/24"])).toEqual(["1.0.0.0/23"]);
  expect(merge(["1.0.0.0/24", "1.0.0.0"])).toEqual(["1.0.0.0/24"]);
  expect(merge(["1.0.0.0/24", "1.0.0.0/12"])).toEqual(["1.0.0.0/12"]);
  expect(merge(["0.0.0.0/8", "1.0.0.0/8"])).toEqual(["0.0.0.0/7"]);
  expect(merge(["4.0.0.0/8", "4.0.0.0/12", "4.0.0.0/16"])).toEqual(["4.0.0.0/8"]);
  expect(merge(["::0/128", "::1/128"])).toEqual(["::/127"]);
  expect(merge(["::0", "::1"])).toEqual(["::/127"]);
  expect(merge(["::0/128", "1.2.3.4/24", "::2/125"])).toEqual(["1.2.3.0/24", "::/125"]);
  expect(merge(["6620:0:1ff2::/70"])).toEqual(["6620:0:1ff2::/70"]);
  expect(merge(["0.0.0.1/32", "0.0.0.2/32"])).toEqual(["0.0.0.1/32", "0.0.0.2/32"]);
  expect(merge(["0.0.1.0/24", "0.0.2.0/24", "0.0.3.0/24", "0.0.4.0/24"])).toEqual(["0.0.1.0/24", "0.0.2.0/23", "0.0.4.0/24"]);
  expect(merge(["0.0.175.0/24", "0.0.176.0/21", "0.0.184.0/21", "0.0.192.0/24"])).toEqual(["0.0.175.0/24", "0.0.176.0/20", "0.0.192.0/24"]);
  expect(merge(["0.0.176.0/21", "0.0.184.0/21", "0.0.192.0/24"])).toEqual(["0.0.176.0/20", "0.0.192.0/24"]);
});

test("exclude", () => {
  expect(exclude(["1.0.0.0/23"], ["1.0.1.0/24"])).toEqual(["1.0.0.0/24"]);
  expect(exclude(["1.0.0.0/24"], ["1.0.0.0/16"])).toEqual([]);
  expect(exclude(["::/127"], ["::1/128"])).toEqual(["::/128"]);
  expect(exclude(["::/120"], ["::1/112"])).toEqual([]);
  expect(exclude(["::0/127", "1.2.3.0/24"], ["::/128"])).toEqual(["1.2.3.0/24", "::1/128"]);
  expect(exclude(["::0/127", "1.2.3.0/24"], ["::/0", "0.0.0.0/0"])).toEqual([]);
  expect(exclude(["1.0.0.0/24"], ["1.0.0.0"])).toEqual(["1.0.0.1/32", "1.0.0.2/31", "1.0.0.4/30", "1.0.0.8/29", "1.0.0.16/28", "1.0.0.32/27", "1.0.0.64/26", "1.0.0.128/25"]);
  expect(exclude(["10.11.0.0/16"], ["10.11.70.0/24"])).toEqual(["10.11.0.0/18", "10.11.64.0/22", "10.11.68.0/23", "10.11.71.0/24", "10.11.72.0/21", "10.11.80.0/20", "10.11.96.0/19", "10.11.128.0/17"]);
  expect(exclude("0.0.0.0/30", ["0.0.0.1/32", "0.0.0.2/32"])).toEqual(["0.0.0.0/32", "0.0.0.3/32"]);
});

test("expand", () => {
  expect(expand(["1.2.3.0/31"])).toEqual(["1.2.3.0", "1.2.3.1"]);
  expect(expand(["1::/126"])).toEqual(["1::", "1::1", "1::2", "1::3"]);
  expect(expand(["2008:db1::/127"])).toEqual(["2008:db1::", "2008:db1::1"]);
  expect(expand("2008:db1::/127")).toEqual(["2008:db1::", "2008:db1::1"]);
});

test("overlap", () => {
  expect(overlap("1.0.0.0/24", "1.0.0.0/30")).toEqual(true);
  expect(overlap("2::/8", "1::/8")).toEqual(true);
  expect(overlap("1.0.0.0/25", "1.0.0.128/25")).toEqual(false);
  expect(overlap("0.0.0.0/0", "::0/0")).toEqual(false);
  expect(overlap("2::/64", "1::/64")).toEqual(false);
  expect(overlap(["1.0.0.0/24"], ["1.0.0.0/30"])).toEqual(true);
  expect(overlap(["1.0.0.0", "2.0.0.0"], ["0.0.0.0/6"])).toEqual(true);
  expect(overlap("::1", "0.0.0.1")).toEqual(false);
  expect(overlap("fe80:1:0:0:0:0:0:0", "fe80::/10")).toEqual(true);
  expect(overlap("::1", ["0.0.0.1", "0.0.0.2"])).toEqual(false);
});

test("normalize", () => {
  expect(normalize("0:0:0:0:0:0:0:0")).toEqual("::");
  expect(normalize("0:0:0:0:0:0:0:0/0")).toEqual("::/0");
  expect(normalize("1.2.3.4")).toEqual("1.2.3.4");
  expect(normalize("1.2.3.4/0")).toEqual("1.2.3.4/0");
});
