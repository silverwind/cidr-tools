"use strict";

const cidrTools = require(".");

test("merge", () => {
  expect(cidrTools.merge(["1.0.0.0", "1.0.0.1"])).toEqual(["1.0.0.0/31"]);
  expect(cidrTools.merge(["1.0.0.0/24", "1.0.1.0/24"])).toEqual(["1.0.0.0/23"]);
  expect(cidrTools.merge(["1.0.0.0/24", "1.0.0.0"])).toEqual(["1.0.0.0/24"]);
  expect(cidrTools.merge(["1.0.0.0/24", "1.0.0.0/12"])).toEqual(["1.0.0.0/12"]);
  expect(cidrTools.merge(["0.0.0.0/8", "1.0.0.0/8"])).toEqual(["0.0.0.0/7"]);
  expect(cidrTools.merge(["4.0.0.0/8", "4.0.0.0/12", "4.0.0.0/16"])).toEqual(["4.0.0.0/8"]);
  expect(cidrTools.merge(["::0/128", "::1/128"])).toEqual(["::/127"]);
  expect(cidrTools.merge(["::0", "::1"])).toEqual(["::/127"]);
  expect(cidrTools.merge(["::0/128", "1.2.3.4/24", "::2/125"])).toEqual(["1.2.3.0/24", "::/125"]);
  expect(cidrTools.merge(["6620:0:1ff2::/70"])).toEqual(["6620:0:1ff2::/70"]);
  expect(cidrTools.merge(["0.0.0.1/32", "0.0.0.2/32"])).toEqual(["0.0.0.1/32", "0.0.0.2/32"]);
  expect(cidrTools.merge(["0.0.1.0/24", "0.0.2.0/24", "0.0.3.0/24", "0.0.4.0/24"])).toEqual(["0.0.1.0/24", "0.0.2.0/23", "0.0.4.0/24"]);
  expect(cidrTools.merge(["0.0.175.0/24", "0.0.176.0/21", "0.0.184.0/21", "0.0.192.0/24"])).toEqual(["0.0.175.0/24", "0.0.176.0/20", "0.0.192.0/24"]);
  expect(cidrTools.merge(["0.0.176.0/21", "0.0.184.0/21", "0.0.192.0/24"])).toEqual(["0.0.176.0/20", "0.0.192.0/24"]);
});

test("exclude", () => {
  expect(cidrTools.exclude(["1.0.0.0/23"], ["1.0.1.0/24"])).toEqual(["1.0.0.0/24"]);
  expect(cidrTools.exclude(["1.0.0.0/24"], ["1.0.0.0/16"])).toEqual([]);
  expect(cidrTools.exclude(["::/127"], ["::1/128"])).toEqual(["::/128"]);
  expect(cidrTools.exclude(["::/120"], ["::1/112"])).toEqual([]);
  expect(cidrTools.exclude(["::0/127", "1.2.3.0/24"], ["::/128"])).toEqual(["1.2.3.0/24", "::1/128"]);
  expect(cidrTools.exclude(["::0/127", "1.2.3.0/24"], ["::/0", "0.0.0.0/0"])).toEqual([]);
  expect(cidrTools.exclude(["1.0.0.0/24"], ["1.0.0.0"])).toEqual(["1.0.0.1/32", "1.0.0.2/31", "1.0.0.4/30", "1.0.0.8/29", "1.0.0.16/28", "1.0.0.32/27", "1.0.0.64/26", "1.0.0.128/25"]);
  expect(cidrTools.exclude(["10.11.0.0/16"], ["10.11.70.0/24"])).toEqual(["10.11.0.0/18", "10.11.64.0/22", "10.11.68.0/23", "10.11.71.0/24", "10.11.72.0/21", "10.11.80.0/20", "10.11.96.0/19", "10.11.128.0/17"]);
  expect(cidrTools.exclude("0.0.0.0/30", ["0.0.0.1/32", "0.0.0.2/32"])).toEqual(["0.0.0.0/32", "0.0.0.3/32"]);
});

test("expand", () => {
  expect(cidrTools.expand(["1.2.3.0/31"])).toEqual(["1.2.3.0", "1.2.3.1"]);
  expect(cidrTools.expand(["1::/126"])).toEqual(["1::", "1::1", "1::2", "1::3"]);
  expect(cidrTools.expand(["2008:db1::/127"])).toEqual(["2008:db1::", "2008:db1::1"]);
  expect(cidrTools.expand("2008:db1::/127")).toEqual(["2008:db1::", "2008:db1::1"]);
});

test("overlap", () => {
  expect(cidrTools.overlap("1.0.0.0/24", "1.0.0.0/30")).toEqual(true);
  expect(cidrTools.overlap("2::/8", "1::/8")).toEqual(true);
  expect(cidrTools.overlap("1.0.0.0/25", "1.0.0.128/25")).toEqual(false);
  expect(cidrTools.overlap("0.0.0.0/0", "::0/0")).toEqual(false);
  expect(cidrTools.overlap("2::/64", "1::/64")).toEqual(false);
  expect(cidrTools.overlap(["1.0.0.0/24"], ["1.0.0.0/30"])).toEqual(true);
  expect(cidrTools.overlap(["1.0.0.0", "2.0.0.0"], ["0.0.0.0/6"])).toEqual(true);
  expect(cidrTools.overlap("::1", "0.0.0.1")).toEqual(false);
  expect(cidrTools.overlap("fe80:1:0:0:0:0:0:0", "fe80::/10")).toEqual(true);
  expect(cidrTools.overlap("::1", ["0.0.0.1", "0.0.0.2"])).toEqual(false);
});

test("normalize", () => {
  expect(cidrTools.normalize("0:0:0:0:0:0:0:0")).toEqual("::");
  expect(cidrTools.normalize("0:0:0:0:0:0:0:0/0")).toEqual("::/0");
  expect(cidrTools.normalize("1.2.3.4")).toEqual("1.2.3.4");
  expect(cidrTools.normalize("1.2.3.4/0")).toEqual("1.2.3.4/0");
});
