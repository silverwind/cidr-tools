import m, {
  mergeCidr, excludeCidr, expandCidr, overlapCidr, normalizeCidr, containsCidr, parseCidr,
} from "./index.js";
import {inspect} from "node:util";

inspect.defaultOptions.depth = null;

test("exports", () => {
  expect(m.mergeCidr).toEqual(mergeCidr);
  expect(m.excludeCidr).toEqual(excludeCidr);
  expect(m.expandCidr).toEqual(expandCidr);
  expect(m.overlapCidr).toEqual(overlapCidr);
  expect(m.containsCidr).toEqual(containsCidr);
  expect(m.normalizeCidr).toEqual(normalizeCidr);
  expect(m.parseCidr).toEqual(parseCidr);
});

test("mergeCidr", () => {
  // expect(mergeCidr(["0.0.0.0", "0.0.0.1"])).toEqual(["0.0.0.0/31"]);
  // expect(mergeCidr(["0.0.0.0", "0.0.0.2"])).toEqual(["0.0.0.0/32", "0.0.0.2/32"]);
  // expect(mergeCidr(["1.0.0.0", "1.0.0.1"])).toEqual(["1.0.0.0/31"]);
  // expect(mergeCidr(["1.0.0.0/24", "1.0.1.0/24"])).toEqual(["1.0.0.0/23"]);
  // expect(mergeCidr(["1.0.0.0/24", "1.0.0.0"])).toEqual(["1.0.0.0/24"]);
  // expect(mergeCidr(["1.0.0.0/24", "1.0.0.0/12"])).toEqual(["1.0.0.0/12"]);
  // expect(mergeCidr(["0.0.0.0/8", "1.0.0.0/8"])).toEqual(["0.0.0.0/7"]);
  expect(mergeCidr(["4.0.0.0/8", "4.0.0.0/12", "4.0.0.0/16"])).toEqual(["4.0.0.0/8"]);
  // expect(mergeCidr(["::0/128", "::1/128"])).toEqual(["::/127"]);
  // expect(mergeCidr(["::0", "::1"])).toEqual(["::/127"]);
  // expect(mergeCidr(["::0/128", "1.2.3.4/24", "::2/125"])).toEqual(["1.2.3.0/24", "::/125"]);
  // expect(mergeCidr(["6620:0:1ff2::/70"])).toEqual(["6620:0:1ff2::/70"]);
  // expect(mergeCidr(["0.0.0.1/32", "0.0.0.2/32"])).toEqual(["0.0.0.1/32", "0.0.0.2/32"]);
  // expect(mergeCidr(["0.0.1.0/24", "0.0.2.0/24", "0.0.3.0/24", "0.0.4.0/24"])).toEqual(["0.0.1.0/24", "0.0.2.0/23", "0.0.4.0/24"]);
  // expect(mergeCidr(["0.0.175.0/24", "0.0.176.0/21", "0.0.184.0/21", "0.0.192.0/24"])).toEqual(["0.0.175.0/24", "0.0.176.0/20", "0.0.192.0/24"]);
  // expect(mergeCidr(["0.0.176.0/21", "0.0.184.0/21", "0.0.192.0/24"])).toEqual(["0.0.176.0/20", "0.0.192.0/24"]);
  // expect(mergeCidr(["1:1:1:1::/128", "1:1:1:2::/128"])).toEqual(["1:1:1:1::/128", "1:1:1:2::/128"]);
  // expect(mergeCidr(["::2:0:0/128", "::1:0:0/128"])).toEqual(["::1:0:0/128", "::2:0:0/128"]);
  // expect(mergeCidr(["::2:0:0/128", "::1:0:0/128", "::2:0:1/128"])).toEqual(["::1:0:0/128", "::2:0:0/127"]);
  // expect(mergeCidr(["0:0:0:0:0:100:0:0:1/128", "0:0:0:0:0:100:0:0:3/128"])).toEqual(["::100:0:0:1/128", "::100:0:0:3/128"]);
  // expect(mergeCidr(["2001:2160:7:30e::f8/128", "2001:2160:7:30e::fe/128"])).toEqual(["2001:2160:7:30e::f8/128", "2001:2160:7:30e::fe/128"]);
});

// test("excludeCidr", () => {
//   expect(excludeCidr(["1.0.0.0/23"], ["1.0.1.0/24"])).toEqual(["1.0.0.0/24"]);
//   expect(excludeCidr(["1.0.0.0/24"], ["1.0.0.0/16"])).toEqual([]);
//   expect(excludeCidr(["::/127"], ["::1/128"])).toEqual(["::/128"]);
//   expect(excludeCidr(["::/120"], ["::1/112"])).toEqual([]);
//   expect(excludeCidr(["::0/127", "1.2.3.0/24"], ["::/128"])).toEqual(["1.2.3.0/24", "::1/128"]);
//   expect(excludeCidr(["::0/127", "1.2.3.0/24"], ["::/0", "0.0.0.0/0"])).toEqual([]);
//   expect(excludeCidr(["1.0.0.0/24"], ["1.0.0.0"])).toEqual(["1.0.0.1/32", "1.0.0.2/31", "1.0.0.4/30", "1.0.0.8/29", "1.0.0.16/28", "1.0.0.32/27", "1.0.0.64/26", "1.0.0.128/25"]);
//   expect(excludeCidr(["10.11.0.0/16"], ["10.11.70.0/24"])).toEqual(["10.11.0.0/18", "10.11.64.0/22", "10.11.68.0/23", "10.11.71.0/24", "10.11.72.0/21", "10.11.80.0/20", "10.11.96.0/19", "10.11.128.0/17"]);
//   expect(excludeCidr("0.0.0.0/30", ["0.0.0.1/32", "0.0.0.2/32"])).toEqual(["0.0.0.0/32", "0.0.0.3/32"]);
// });

// test("expandCidr", () => {
//   expect(expandCidr(["1.2.3.0/31"])).toEqual(["1.2.3.0", "1.2.3.1"]);
//   expect(expandCidr(["1::/126"])).toEqual(["1::", "1::1", "1::2", "1::3"]);
//   expect(expandCidr(["2008:db1::/127"])).toEqual(["2008:db1::", "2008:db1::1"]);
//   expect(expandCidr("2008:db1::/127")).toEqual(["2008:db1::", "2008:db1::1"]);
// });

// test("overlapCidr", () => {
//   expect(overlapCidr("1.0.0.0/24", "1.0.0.0/30")).toEqual(true);
//   expect(overlapCidr("2::/8", "1::/8")).toEqual(true);
//   expect(overlapCidr("1.0.0.0/25", "1.0.0.128/25")).toEqual(false);
//   expect(overlapCidr("0.0.0.0/0", "::0/0")).toEqual(false);
//   expect(overlapCidr("2::/64", "1::/64")).toEqual(false);
//   expect(overlapCidr(["1.0.0.0/24"], ["1.0.0.0/30"])).toEqual(true);
//   expect(overlapCidr(["1.0.0.0", "2.0.0.0"], ["0.0.0.0/6"])).toEqual(true);
//   expect(overlapCidr("::1", "0.0.0.1")).toEqual(false);
//   expect(overlapCidr("fe80:1:0:0:0:0:0:0", "fe80::/10")).toEqual(true);
//   expect(overlapCidr("::1", ["0.0.0.1", "0.0.0.2"])).toEqual(false);
// });

// test("normalizeCidr", () => {
//   expect(normalizeCidr("::0")).toEqual("::");
//   expect(normalizeCidr("::FF")).toEqual("::ff");
//   expect(normalizeCidr("::FF/2")).toEqual("::/2");
//   expect(normalizeCidr("0:0:0:0:0:0:0:0")).toEqual("::");
//   expect(normalizeCidr("0:0:0:0:0:FF:0:0")).toEqual("::ff:0:0");
//   expect(normalizeCidr("0:0:0:0:0:FF:0:0/16")).toEqual("::/16");
//   expect(normalizeCidr("FF:00:0:0:0:00:0:EE/16")).toEqual("ff::/16");
//   expect(normalizeCidr("0:0:0:0:0:0:0:0/0")).toEqual("::/0");
//   expect(normalizeCidr("1.2.3.4")).toEqual("1.2.3.4");
//   expect(normalizeCidr("1.2.3.4/0")).toEqual("0.0.0.0/0");
//   expect(normalizeCidr("255.255.255.255/1")).toEqual("128.0.0.0/1");
//   expect(normalizeCidr("255.255.255.255/6")).toEqual("252.0.0.0/6");
//   expect(normalizeCidr(["0:0:0:0:0:0:0:0"])).toEqual(["::"]);
//   expect(normalizeCidr("::0001")).toEqual("::1");
//   expect(normalizeCidr("::FFFF:34.90.242.162")).toEqual("::ffff:34.90.242.162");
//   expect(normalizeCidr("::1", {compress: false})).toEqual("0:0:0:0:0:0:0:1");
//   expect(normalizeCidr("1::1", {compress: false})).toEqual("1:0:0:0:0:0:0:1");
//   expect(normalizeCidr(["1::1"], {compress: false})).toEqual(["1:0:0:0:0:0:0:1"]);
//   expect(normalizeCidr(["1::/64"], {compress: false})).toEqual(["1:0:0:0:0:0:0:0/64"]);
//   expect(normalizeCidr(["1.2.3.4/0"], {compress: false})).toEqual(["0.0.0.0/0"]);
//   expect(normalizeCidr("::FFFF:34.90.242.162", {hexify: true})).toEqual("::ffff:225a:f2a2");
//   expect(normalizeCidr("::FFFF:34.90.242.162/64", {hexify: true})).toEqual("::/64");
//   expect(normalizeCidr(["::FFFF:34.90.242.162"], {hexify: true})).toEqual(["::ffff:225a:f2a2"]);
//   expect(normalizeCidr(["::FFFF:34.90.242.162/32"], {hexify: true})).toEqual(["::/32"]);
// });

// test("containsCidr", () => {
//   expect(containsCidr("1.0.0.0", "1.0.0.0")).toEqual(true);
//   expect(containsCidr("1.0.0.0", "1.0.0.1")).toEqual(false);
//   expect(containsCidr("1.0.0.0", "1.0.0.1/24")).toEqual(false);
//   expect(containsCidr("1.0.0.0/24", "1.0.0.1/24")).toEqual(true);
//   expect(containsCidr("1.0.0.0/24", "1.0.0.1")).toEqual(true);
//   expect(containsCidr("1.0.0.0/24", "1.0.0.1")).toEqual(true);
//   expect(containsCidr("1.0.0.0/24", "1.0.1.1")).toEqual(false);
//   expect(containsCidr("0.0.0.0/24", "::")).toEqual(false);
//   expect(containsCidr("0.0.0.0/0", "::")).toEqual(false);
//   expect(containsCidr("0.0.0.0/0", "::1")).toEqual(false);
//   expect(containsCidr("0.0.0.0/0", "0.0.0.0/0")).toEqual(true);
//   expect(containsCidr("::/64", "::")).toEqual(true);
//   expect(containsCidr("::/64", "::/64")).toEqual(true);
//   expect(containsCidr("::/64", "::/96")).toEqual(true);
//   expect(containsCidr("::/96", "::/64")).toEqual(false);
//   expect(containsCidr("::/128", "::1")).toEqual(false);
//   expect(containsCidr("::/128", "::")).toEqual(true);
//   expect(containsCidr("::/128", "::/128")).toEqual(true);
//   expect(containsCidr("::/120", "::/128")).toEqual(true);
//   expect(containsCidr("::/128", "0.0.0.0")).toEqual(false);
//   expect(containsCidr("::/128", "0.0.0.1")).toEqual(false);
//   expect(containsCidr(["::/128"], ["::/128"])).toEqual(true);
//   expect(containsCidr(["1.0.0.0/24"], ["1.0.0.1"])).toEqual(true);
//   expect(containsCidr("1.0.0.0/24", ["1.0.0.1"])).toEqual(true);
//   expect(containsCidr(["1.0.0.0/24"], "1.0.0.1")).toEqual(true);
//   expect(containsCidr(["1.0.0.0/24", "2.0.0.0"], "1.0.0.1")).toEqual(true);
//   expect(containsCidr(["1.0.0.0/24", "2.0.0.0"], "3.0.0.1")).toEqual(false);
//   expect(containsCidr(["1.0.0.0/24", "::/0"], "3.0.0.1")).toEqual(false);
//   expect(containsCidr(["1.0.0.0/24", "::/0", "3.0.0.0/24"], "3.0.0.1")).toEqual(true);
//   expect(containsCidr(["1.0.0.0/24", "::/0", "3.0.0.0/24"], "::1")).toEqual(true);
//   expect(containsCidr(["1.0.0.0/24", "::/0", "3.0.0.0/24"], ["::1"])).toEqual(true);
//   expect(containsCidr(["1.0.0.0/24", "::/0", "3.0.0.0/24"], ["::1", "::2"])).toEqual(true);
//   expect(containsCidr(["1.0.0.0/24", "::/128", "3.0.0.0/24"], "::1")).toEqual(false);
//   expect(containsCidr(["1.0.0.0/24", "::/128", "3.0.0.0/24"], ["::1", "::2"])).toEqual(false);
//   expect(containsCidr(["fe80::%int"], ["fe80::"])).toEqual(true);
//   expect(containsCidr(["fe80::%int"], ["fe80::%int"])).toEqual(true);
//   expect(containsCidr(["fe80::"], ["fe80::%int"])).toEqual(true);
//   expect(containsCidr(["fe80::%int/64"], ["fe80::/64"])).toEqual(true);
//   expect(containsCidr(["fe80::%int/64"], ["fe80::%int/64"])).toEqual(true);
//   expect(containsCidr(["fe80::/64"], ["fe80::%int/64"])).toEqual(true);

//   const privates = [
//     "10.0.0.0/8",
//     "100.64.0.0/10",
//     "127.0.0.1/8",
//     "172.16.0.0/12",
//     "192.168.0.0/16",
//     "::1/128",
//     "fc00::/7",
//     "fe80::/64",
//   ];

//   expect(containsCidr(privates, "127.0.0.1")).toEqual(true);
//   expect(containsCidr(privates, "127.255.255.255")).toEqual(true);
//   expect(containsCidr(privates, "100.64.0.0/24")).toEqual(true);
//   expect(containsCidr(privates, "::1")).toEqual(true);
//   expect(containsCidr(privates, "::2")).toEqual(false);
//   expect(containsCidr(privates, "fe80::1")).toEqual(true);
//   expect(containsCidr(privates, ["127.0.0.1", "::1"])).toEqual(true);
//   expect(containsCidr(privates, ["127.0.0.1", "::1/64"])).toEqual(false);
//   expect(containsCidr(privates, ["127.0.0.1", "::2"])).toEqual(false);
//   expect(containsCidr(privates, ["128.0.0.0", "::1"])).toEqual(false);
//   expect(containsCidr(privates, ["127.0.0.1", "fc00::"])).toEqual(true);
//   expect(containsCidr(privates, ["127.0.0.1", "192.168.255.255", "fe80::2"])).toEqual(true);
// });

// test("parseCidr", () => {
//   expect(parseCidr("::/64")).toEqual({
//     cidr: "::/64",
//     version: 6,
//     prefix: "64",
//     start: 0n,
//     end: 18446744073709551615n,
//   });
//   expect(parseCidr("1.2.3.4/24")).toEqual({
//     cidr: "1.2.3.4/24",
//     version: 4,
//     prefix: "24",
//     start: 16909056n,
//     end: 16909311n,
//   });
//   expect(parseCidr("2001:db8::")).toEqual({
//     cidr: "2001:db8::/128",
//     version: 6,
//     prefix: "128",
//     start: 42540766411282592856903984951653826560n,
//     end: 42540766411282592856903984951653826560n,
//   });
//   expect(parseCidr("2001:db8::/128")).toEqual({
//     cidr: "2001:db8::/128",
//     version: 6,
//     prefix: "128",
//     start: 42540766411282592856903984951653826560n,
//     end: 42540766411282592856903984951653826560n,
//   });
//   expect(parseCidr("2001:db8::%eth2")).toEqual({
//     cidr: "2001:db8::%eth2/128",
//     version: 6,
//     prefix: "128",
//     start: 42540766411282592856903984951653826560n,
//     end: 42540766411282592856903984951653826560n,
//   });
//   expect(parseCidr("2001:db8::%eth2/128")).toEqual({
//     cidr: "2001:db8::%eth2/128",
//     version: 6,
//     prefix: "128",
//     start: 42540766411282592856903984951653826560n,
//     end: 42540766411282592856903984951653826560n,
//   });

//   expect(() => parseCidr("2001:db8::/128%eth2")).toThrow();
// });
