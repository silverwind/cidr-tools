import cidrTools, {
  mergeCidr, excludeCidr, expandCidr, overlapCidr, normalizeCidr, containsCidr, parseCidr,
} from "./index.ts";

test("exports", () => {
  expect(cidrTools.mergeCidr).toEqual(mergeCidr);
  expect(cidrTools.excludeCidr).toEqual(excludeCidr);
  expect(cidrTools.expandCidr).toEqual(expandCidr);
  expect(cidrTools.overlapCidr).toEqual(overlapCidr);
  expect(cidrTools.containsCidr).toEqual(containsCidr);
  expect(cidrTools.normalizeCidr).toEqual(normalizeCidr);
  expect(cidrTools.parseCidr).toEqual(parseCidr);
});

test("mergeCidr", () => {
  expect(mergeCidr(["0.0.0.0", "0.0.0.1"])).toMatchInlineSnapshot(`
    [
      "0.0.0.0/31",
    ]
  `);
  expect(mergeCidr(["0.0.0.0", "0.0.0.2"])).toMatchInlineSnapshot(`
    [
      "0.0.0.0/32",
      "0.0.0.2/32",
    ]
  `);
  expect(mergeCidr(["1.0.0.0", "1.0.0.1"])).toMatchInlineSnapshot(`
    [
      "1.0.0.0/31",
    ]
  `);
  expect(mergeCidr(["1.0.0.0/24", "1.0.1.0/24"])).toMatchInlineSnapshot(`
    [
      "1.0.0.0/23",
    ]
  `);
  expect(mergeCidr(["1.0.0.0/24", "1.0.0.0"])).toMatchInlineSnapshot(`
    [
      "1.0.0.0/24",
    ]
  `);
  expect(mergeCidr(["1.0.0.0/24", "1.0.0.0/12"])).toMatchInlineSnapshot(`
    [
      "1.0.0.0/12",
    ]
  `);
  expect(mergeCidr(["0.0.0.0/8", "1.0.0.0/8"])).toMatchInlineSnapshot(`
    [
      "0.0.0.0/7",
    ]
  `);
  expect(mergeCidr(["4.0.0.0/8", "4.0.0.0/12", "4.0.0.0/16"])).toMatchInlineSnapshot(`
    [
      "4.0.0.0/8",
    ]
  `);
  expect(mergeCidr(["::0/128", "::1/128"])).toMatchInlineSnapshot(`
    [
      "::/127",
    ]
  `);
  expect(mergeCidr(["::0", "::1"])).toMatchInlineSnapshot(`
    [
      "::/127",
    ]
  `);
  expect(mergeCidr(["::0/128", "1.2.3.4/24", "::2/125"])).toMatchInlineSnapshot(`
    [
      "1.2.3.0/24",
      "::/125",
    ]
  `);
  expect(mergeCidr(["6620:0:1ff2::/70"])).toMatchInlineSnapshot(`
    [
      "6620:0:1ff2::/70",
    ]
  `);
  expect(mergeCidr(["0.0.0.1/32", "0.0.0.2/32"])).toMatchInlineSnapshot(`
    [
      "0.0.0.1/32",
      "0.0.0.2/32",
    ]
  `);
  expect(mergeCidr(["0.0.1.0/24", "0.0.2.0/24", "0.0.3.0/24", "0.0.4.0/24"])).toMatchInlineSnapshot(`
    [
      "0.0.1.0/24",
      "0.0.2.0/23",
      "0.0.4.0/24",
    ]
  `);
  expect(mergeCidr(["0.0.175.0/24", "0.0.176.0/21", "0.0.184.0/21", "0.0.192.0/24"])).toMatchInlineSnapshot(`
    [
      "0.0.175.0/24",
      "0.0.176.0/20",
      "0.0.192.0/24",
    ]
  `);
  expect(mergeCidr(["0.0.176.0/21", "0.0.184.0/21", "0.0.192.0/24"])).toMatchInlineSnapshot(`
    [
      "0.0.176.0/20",
      "0.0.192.0/24",
    ]
  `);
  expect(mergeCidr(["1:1:1:1::/128", "1:1:1:2::/128"])).toMatchInlineSnapshot(`
    [
      "1:1:1:1::/128",
      "1:1:1:2::/128",
    ]
  `);
  expect(mergeCidr(["1:1:1:2::/128", "1:1:1:1::/128"])).toMatchInlineSnapshot(`
    [
      "1:1:1:1::/128",
      "1:1:1:2::/128",
    ]
  `);
  expect(mergeCidr(["::2:0:0/128", "::1:0:0/128"])).toMatchInlineSnapshot(`
    [
      "::1:0:0/128",
      "::2:0:0/128",
    ]
  `);
  expect(mergeCidr(["::2:0:0/128", "::1:0:0/128", "::2:0:1/128"])).toMatchInlineSnapshot(`
    [
      "::1:0:0/128",
      "::2:0:0/127",
    ]
  `);
  expect(mergeCidr(["0:0:0:0:0:100:0:0:1/128", "0:0:0:0:0:100:0:0:3/128"])).toMatchInlineSnapshot(`
    [
      "::100:0:0:1/128",
      "::100:0:0:3/128",
    ]
  `);
  expect(mergeCidr(["2001:2160:7:30e::f8/128", "2001:2160:7:30e::fe/128"])).toMatchInlineSnapshot(`
    [
      "2001:2160:7:30e::f8/128",
      "2001:2160:7:30e::fe/128",
    ]
  `);
});

test("excludeCidr", () => {
  expect(excludeCidr(["1.0.0.0/23"], ["1.0.1.0/24"])).toMatchInlineSnapshot(`
    [
      "1.0.0.0/24",
    ]
  `);
  expect(excludeCidr(["1.0.0.0/24"], ["1.0.0.0/16"])).toMatchInlineSnapshot(`[]`);
  expect(excludeCidr(["::/127"], ["::1/128"])).toMatchInlineSnapshot(`
    [
      "::/128",
    ]
  `);
  expect(excludeCidr(["::/120"], ["::1/112"])).toMatchInlineSnapshot(`[]`);
  expect(excludeCidr(["::0/127", "1.2.3.0/24"], ["::/128"])).toMatchInlineSnapshot(`
    [
      "1.2.3.0/24",
      "::1/128",
    ]
  `);
  expect(excludeCidr(["::0/127", "1.2.3.0/24"], ["::/0", "0.0.0.0/0"])).toMatchInlineSnapshot(`[]`);
  expect(excludeCidr(["1.0.0.0/24"], ["1.0.0.0"])).toMatchInlineSnapshot(`
    [
      "1.0.0.1/32",
      "1.0.0.2/31",
      "1.0.0.4/30",
      "1.0.0.8/29",
      "1.0.0.16/28",
      "1.0.0.32/27",
      "1.0.0.64/26",
      "1.0.0.128/25",
    ]
  `);
  expect(excludeCidr(["10.11.0.0/16"], ["10.11.70.0/24"])).toMatchInlineSnapshot(`
    [
      "10.11.0.0/18",
      "10.11.64.0/22",
      "10.11.68.0/23",
      "10.11.71.0/24",
      "10.11.72.0/21",
      "10.11.80.0/20",
      "10.11.96.0/19",
      "10.11.128.0/17",
    ]
  `);
  expect(excludeCidr("0.0.0.0/30", ["0.0.0.1/32", "0.0.0.2/32"])).toMatchInlineSnapshot(`
    [
      "0.0.0.0/32",
      "0.0.0.3/32",
    ]
  `);

  // Test case from issue #24 - division by zero with large IP lists
  // This previously caused "RangeError: Division by zero" with the full
  // list of Google IPs. Simplified to test the edge case guards.
  const allIpRanges = ["34.0.0.0/15", "2001:4860::/32"];
  const gcpIpRanges = ["34.80.0.0/15", "2600:1900:8000::/44"];
  const result = excludeCidr(allIpRanges, gcpIpRanges);
  expect(result.length).toBeGreaterThan(0);
  expect(result).toContain("34.0.0.0/15");
  expect(result).toContain("2001:4860::/32");
});

test("expandCidr", () => {
  expect(Array.from(expandCidr(["1.2.3.0/31"]))).toMatchInlineSnapshot(`
    [
      "1.2.3.0",
      "1.2.3.1",
    ]
  `);
  expect(Array.from(expandCidr(["1::/126"]))).toMatchInlineSnapshot(`
    [
      "1::",
      "1::1",
      "1::2",
      "1::3",
    ]
  `);
  expect(Array.from(expandCidr(["2008:db1::/127"]))).toMatchInlineSnapshot(`
    [
      "2008:db1::",
      "2008:db1::1",
    ]
  `);
  expect(Array.from(expandCidr("2008:db1::/127"))).toMatchInlineSnapshot(`
    [
      "2008:db1::",
      "2008:db1::1",
    ]
  `);
});

test("overlapCidr", () => {
  expect(overlapCidr("1.0.0.0/24", "1.0.0.0/30")).toMatchInlineSnapshot(`true`);
  expect(overlapCidr("2::/8", "1::/8")).toMatchInlineSnapshot(`true`);
  expect(overlapCidr("1.0.0.0/25", "1.0.0.128/25")).toMatchInlineSnapshot(`false`);
  expect(overlapCidr("0.0.0.0/0", "::0/0")).toMatchInlineSnapshot(`false`);
  expect(overlapCidr("2::/64", "1::/64")).toMatchInlineSnapshot(`false`);
  expect(overlapCidr(["1.0.0.0/24"], ["1.0.0.0/30"])).toMatchInlineSnapshot(`true`);
  expect(overlapCidr(["1.0.0.0", "2.0.0.0"], ["0.0.0.0/6"])).toMatchInlineSnapshot(`true`);
  expect(overlapCidr("::1", "0.0.0.1")).toMatchInlineSnapshot(`false`);
  expect(overlapCidr("fe80:1:0:0:0:0:0:0", "fe80::/10")).toMatchInlineSnapshot(`true`);
  expect(overlapCidr("::1", ["0.0.0.1", "0.0.0.2"])).toMatchInlineSnapshot(`false`);
});

test("normalizeCidr", () => {
  expect(normalizeCidr("::0")).toMatchInlineSnapshot(`"::"`);
  expect(normalizeCidr("::0/0")).toMatchInlineSnapshot(`"::/0"`);
  expect(normalizeCidr("::0/128")).toMatchInlineSnapshot(`"::/128"`);
  expect(normalizeCidr("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff")).toMatchInlineSnapshot(`"ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff"`);
  expect(normalizeCidr("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff/0")).toMatchInlineSnapshot(`"::/0"`);
  expect(normalizeCidr("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff/128")).toMatchInlineSnapshot(`"ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff/128"`);
  expect(normalizeCidr("::FF")).toMatchInlineSnapshot(`"::ff"`);
  expect(normalizeCidr("::FF/2")).toMatchInlineSnapshot(`"::/2"`);
  expect(normalizeCidr("0:0:0:0:0:0:0:0")).toMatchInlineSnapshot(`"::"`);
  expect(normalizeCidr("0:0:0:0:0:FF:0:0")).toMatchInlineSnapshot(`"::ff:0:0"`);
  expect(normalizeCidr("0:0:0:0:0:FF:0:0/16")).toMatchInlineSnapshot(`"::/16"`);
  expect(normalizeCidr("FF:00:0:0:0:00:0:EE/16")).toMatchInlineSnapshot(`"ff::/16"`);
  expect(normalizeCidr("0:0:0:0:0:0:0:0/0")).toMatchInlineSnapshot(`"::/0"`);
  expect(normalizeCidr("0.0.0.0")).toMatchInlineSnapshot(`"0.0.0.0"`);
  expect(normalizeCidr("0.0.0.0/0")).toMatchInlineSnapshot(`"0.0.0.0/0"`);
  expect(normalizeCidr("0.0.0.0/32")).toMatchInlineSnapshot(`"0.0.0.0/32"`);
  expect(normalizeCidr("255.255.255.255")).toMatchInlineSnapshot(`"255.255.255.255"`);
  expect(normalizeCidr("255.255.255.255/0")).toMatchInlineSnapshot(`"0.0.0.0/0"`);
  expect(normalizeCidr("255.255.255.255/32")).toMatchInlineSnapshot(`"255.255.255.255/32"`);
  expect(normalizeCidr("1.2.3.4")).toMatchInlineSnapshot(`"1.2.3.4"`);
  expect(normalizeCidr("1.2.3.4/24")).toMatchInlineSnapshot(`"1.2.3.0/24"`);
  expect(normalizeCidr("1.2.3.4/32")).toMatchInlineSnapshot(`"1.2.3.4/32"`);
  expect(normalizeCidr("1.2.3.255/28")).toMatchInlineSnapshot(`"1.2.3.240/28"`);
  expect(normalizeCidr("1.2.3.4/0")).toMatchInlineSnapshot(`"0.0.0.0/0"`);
  expect(normalizeCidr("255.255.255.255/1")).toMatchInlineSnapshot(`"128.0.0.0/1"`);
  expect(normalizeCidr("255.255.255.255/6")).toMatchInlineSnapshot(`"252.0.0.0/6"`);
  expect(normalizeCidr(["0:0:0:0:0:0:0:0"])).toMatchInlineSnapshot(`
    [
      "::",
    ]
  `);
  expect(normalizeCidr("::0001")).toMatchInlineSnapshot(`"::1"`);
  expect(normalizeCidr("::FFFF:34.90.242.162")).toMatchInlineSnapshot(`"::ffff:34.90.242.162"`);
  expect(normalizeCidr("::1", {compress: false})).toMatchInlineSnapshot(`"0:0:0:0:0:0:0:1"`);
  expect(normalizeCidr("::1/128", {compress: false})).toMatchInlineSnapshot(`"0:0:0:0:0:0:0:1/128"`);
  expect(normalizeCidr("1::1", {compress: false})).toMatchInlineSnapshot(`"1:0:0:0:0:0:0:1"`);
  expect(normalizeCidr(["1::1"], {compress: false})).toMatchInlineSnapshot(`
    [
      "1:0:0:0:0:0:0:1",
    ]
  `);
  expect(normalizeCidr(["1::/64"], {compress: false})).toMatchInlineSnapshot(`
    [
      "1:0:0:0:0:0:0:0/64",
    ]
  `);
  expect(normalizeCidr(["1.2.3.4/0"], {compress: false})).toMatchInlineSnapshot(`
    [
      "0.0.0.0/0",
    ]
  `);
  expect(normalizeCidr(["1.2.3.4/24"], {compress: false})).toMatchInlineSnapshot(`
    [
      "1.2.3.0/24",
    ]
  `);
  expect(normalizeCidr("::FFFF:34.90.242.162", {hexify: true})).toMatchInlineSnapshot(`"::ffff:225a:f2a2"`);
  expect(normalizeCidr("::FFFF:34.90.242.162/64", {hexify: true})).toMatchInlineSnapshot(`"::/64"`);
  expect(normalizeCidr(["::FFFF:34.90.242.162"], {hexify: true})).toMatchInlineSnapshot(`
    [
      "::ffff:225a:f2a2",
    ]
  `);
  expect(normalizeCidr(["::FFFF:34.90.242.162/32"], {hexify: true})).toMatchInlineSnapshot(`
    [
      "::/32",
    ]
  `);
});

test("containsCidr", () => {
  expect(containsCidr("1.0.0.0", "1.0.0.0")).toMatchInlineSnapshot(`true`);
  expect(containsCidr("1.0.0.0", "1.0.0.1")).toMatchInlineSnapshot(`false`);
  expect(containsCidr("1.0.0.0", "1.0.0.1/24")).toMatchInlineSnapshot(`false`);
  expect(containsCidr("1.0.0.0/24", "1.0.0.1/24")).toMatchInlineSnapshot(`true`);
  expect(containsCidr("1.0.0.0/24", "1.0.0.1")).toMatchInlineSnapshot(`true`);
  expect(containsCidr("1.0.0.0/24", "1.0.0.1")).toMatchInlineSnapshot(`true`);
  expect(containsCidr("1.0.0.0/24", "1.0.1.1")).toMatchInlineSnapshot(`false`);
  expect(containsCidr("0.0.0.0/24", "::")).toMatchInlineSnapshot(`false`);
  expect(containsCidr("0.0.0.0/0", "::")).toMatchInlineSnapshot(`false`);
  expect(containsCidr("0.0.0.0/0", "::1")).toMatchInlineSnapshot(`false`);
  expect(containsCidr("0.0.0.0/0", "0.0.0.0/0")).toMatchInlineSnapshot(`true`);
  expect(containsCidr("::/64", "::")).toMatchInlineSnapshot(`true`);
  expect(containsCidr("::/64", "::/64")).toMatchInlineSnapshot(`true`);
  expect(containsCidr("::/64", "::/96")).toMatchInlineSnapshot(`true`);
  expect(containsCidr("::/96", "::/64")).toMatchInlineSnapshot(`false`);
  expect(containsCidr("::/128", "::1")).toMatchInlineSnapshot(`false`);
  expect(containsCidr("::/128", "::")).toMatchInlineSnapshot(`true`);
  expect(containsCidr("::/128", "::/128")).toMatchInlineSnapshot(`true`);
  expect(containsCidr("::/120", "::/128")).toMatchInlineSnapshot(`true`);
  expect(containsCidr("::/128", "0.0.0.0")).toMatchInlineSnapshot(`false`);
  expect(containsCidr("::/128", "0.0.0.1")).toMatchInlineSnapshot(`false`);
  expect(containsCidr(["::/128"], ["::/128"])).toMatchInlineSnapshot(`true`);
  expect(containsCidr(["1.0.0.0/24"], ["1.0.0.1"])).toMatchInlineSnapshot(`true`);
  expect(containsCidr("1.0.0.0/24", ["1.0.0.1"])).toMatchInlineSnapshot(`true`);
  expect(containsCidr(["1.0.0.0/24"], "1.0.0.1")).toMatchInlineSnapshot(`true`);
  expect(containsCidr(["1.0.0.0/24", "2.0.0.0"], "1.0.0.1")).toMatchInlineSnapshot(`true`);
  expect(containsCidr(["1.0.0.0/24", "2.0.0.0"], "3.0.0.1")).toMatchInlineSnapshot(`false`);
  expect(containsCidr(["1.0.0.0/24", "::/0"], "3.0.0.1")).toMatchInlineSnapshot(`false`);
  expect(containsCidr(["1.0.0.0/24", "::/0", "3.0.0.0/24"], "3.0.0.1")).toMatchInlineSnapshot(`true`);
  expect(containsCidr(["1.0.0.0/24", "::/0", "3.0.0.0/24"], "::1")).toMatchInlineSnapshot(`true`);
  expect(containsCidr(["1.0.0.0/24", "::/0", "3.0.0.0/24"], ["::1"])).toMatchInlineSnapshot(`true`);
  expect(containsCidr(["1.0.0.0/24", "::/0", "3.0.0.0/24"], ["::1", "::2"])).toMatchInlineSnapshot(`true`);
  expect(containsCidr(["1.0.0.0/24", "::/128", "3.0.0.0/24"], "::1")).toMatchInlineSnapshot(`false`);
  expect(containsCidr(["1.0.0.0/24", "::/128", "3.0.0.0/24"], ["::1", "::2"])).toMatchInlineSnapshot(`false`);
  expect(containsCidr(["fe80::%int"], ["fe80::"])).toMatchInlineSnapshot(`true`);
  expect(containsCidr(["fe80::%int"], ["fe80::%int"])).toMatchInlineSnapshot(`true`);
  expect(containsCidr(["fe80::"], ["fe80::%int"])).toMatchInlineSnapshot(`true`);
  expect(containsCidr(["fe80::%int/64"], ["fe80::/64"])).toMatchInlineSnapshot(`true`);
  expect(containsCidr(["fe80::%int/64"], ["fe80::%int/64"])).toMatchInlineSnapshot(`true`);
  expect(containsCidr(["fe80::/64"], ["fe80::%int/64"])).toMatchInlineSnapshot(`true`);

  const privates = [
    "10.0.0.0/8",
    "100.64.0.0/10",
    "127.0.0.1/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "::1/128",
    "fc00::/7",
    "fe80::/64",
  ];

  expect(containsCidr(privates, "127.0.0.1")).toMatchInlineSnapshot(`true`);
  expect(containsCidr(privates, "127.255.255.255")).toMatchInlineSnapshot(`true`);
  expect(containsCidr(privates, "100.64.0.0/24")).toMatchInlineSnapshot(`true`);
  expect(containsCidr(privates, "::1")).toMatchInlineSnapshot(`true`);
  expect(containsCidr(privates, "::2")).toMatchInlineSnapshot(`false`);
  expect(containsCidr(privates, "fe80::1")).toMatchInlineSnapshot(`true`);
  expect(containsCidr(privates, ["127.0.0.1", "::1"])).toMatchInlineSnapshot(`true`);
  expect(containsCidr(privates, ["127.0.0.1", "::1/64"])).toMatchInlineSnapshot(`false`);
  expect(containsCidr(privates, ["127.0.0.1", "::2"])).toMatchInlineSnapshot(`false`);
  expect(containsCidr(privates, ["128.0.0.0", "::1"])).toMatchInlineSnapshot(`false`);
  expect(containsCidr(privates, ["127.0.0.1", "fc00::"])).toMatchInlineSnapshot(`true`);
  expect(containsCidr(privates, ["127.0.0.1", "192.168.255.255", "fe80::2"])).toMatchInlineSnapshot(`true`);
});

test("parseCidr", () => {
  expect(parseCidr("::/64")).toMatchInlineSnapshot(`
    {
      "cidr": "::/64",
      "end": 18446744073709551615n,
      "ip": "::",
      "prefix": "64",
      "prefixPresent": true,
      "start": 0n,
      "version": 6,
    }
  `);
  expect(parseCidr("1.2.3.4/24")).toMatchInlineSnapshot(`
    {
      "cidr": "1.2.3.4/24",
      "end": 16909311n,
      "ip": "1.2.3.4",
      "prefix": "24",
      "prefixPresent": true,
      "start": 16909056n,
      "version": 4,
    }
  `);
  expect(parseCidr("2001:db8::")).toMatchInlineSnapshot(`
    {
      "cidr": "2001:db8::/128",
      "end": 42540766411282592856903984951653826560n,
      "ip": "2001:db8::",
      "prefix": "128",
      "prefixPresent": false,
      "start": 42540766411282592856903984951653826560n,
      "version": 6,
    }
  `);
  expect(parseCidr("2001:db8::/128")).toMatchInlineSnapshot(`
    {
      "cidr": "2001:db8::/128",
      "end": 42540766411282592856903984951653826560n,
      "ip": "2001:db8::",
      "prefix": "128",
      "prefixPresent": true,
      "start": 42540766411282592856903984951653826560n,
      "version": 6,
    }
  `);
  expect(parseCidr("2001:db8::%eth2")).toMatchInlineSnapshot(`
    {
      "cidr": "2001:db8::%eth2/128",
      "end": 42540766411282592856903984951653826560n,
      "ip": "2001:db8::%eth2",
      "prefix": "128",
      "prefixPresent": false,
      "start": 42540766411282592856903984951653826560n,
      "version": 6,
    }
  `);
  expect(parseCidr("2001:db8::%eth2/128")).toMatchInlineSnapshot(`
    {
      "cidr": "2001:db8::%eth2/128",
      "end": 42540766411282592856903984951653826560n,
      "ip": "2001:db8::%eth2",
      "prefix": "128",
      "prefixPresent": true,
      "start": 42540766411282592856903984951653826560n,
      "version": 6,
    }
  `);
  expect(parseCidr("::FFFF:34.90.242.162/80")).toMatchInlineSnapshot(`
    {
      "cidr": "::ffff:34.90.242.162/80",
      "end": 281474976710655n,
      "ip": "::ffff:34.90.242.162",
      "prefix": "80",
      "prefixPresent": true,
      "start": 0n,
      "version": 6,
    }
  `);
  expect(parseCidr("1.2.3.4/32")).toMatchInlineSnapshot(`
    {
      "cidr": "1.2.3.4/32",
      "end": 16909060n,
      "ip": "1.2.3.4",
      "prefix": "32",
      "prefixPresent": true,
      "start": 16909060n,
      "version": 4,
    }
  `);

  expect(() => parseCidr("2001:db8::/128%eth2")).toThrow();
});
