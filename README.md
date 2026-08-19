# cidr-tools
[![](https://img.shields.io/npm/v/cidr-tools.svg?style=flat)](https://www.npmjs.org/package/cidr-tools) [![](https://img.shields.io/npm/dm/cidr-tools.svg)](https://www.npmjs.org/package/cidr-tools) [![](https://img.shields.io/bundlephobia/minzip/cidr-tools.svg)](https://bundlephobia.com/package/cidr-tools) [![](https://packagephobia.com/badge?p=cidr-tools)](https://packagephobia.com/result?p=cidr-tools) [![](https://depx.co/api/badge/cidr-tools)](https://depx.co/pkg/cidr-tools)
> Tools to work with IPv4 and IPv6 CIDR

## Usage

```js
import {mergeCidr, excludeCidr, expandCidr, overlapCidr, containsCidr, normalizeCidr, parseCidr} from "cidr-tools";

mergeCidr(["1.0.0.0/24", "1.0.1.0/24"]);
//=> ["1.0.0.0/23"]

excludeCidr(["::1/127"], "::1/128");
//=> ["::/128"]

Array.from(expandCidr(["2001:db8::/126"]));
//=> ["2001:db8::", "2001:db8::1", "2001:db8::2", "2001:db8::3"]

overlapCidr("1.0.0.0/24", "1.0.0.128/25");
//=> true

containsCidr(["1.0.0.0/24", "2.0.0.0/24"], "1.0.0.1");
//=> true

normalizeCidr("::ffff/64");
//=> "::/64"

parseCidr("::/64");
//=> {cidr: "::/64", version: 6, prefix: "64", start: 0n, end: 18446744073709551615n}
```

## API

All functions take CIDR addresses or single IP addresses. On single addresses, a prefix of `/32` or `/128` is assumed. Function that return networks will return a merged and sorted set of networks with IPv4 sorted before IPv6.

Networks are validated with [cidr-regex](https://github.com/silverwind/cidr-regex) and anything that is not a CIDR or IP address throws, including out-of-family prefixes like `1.2.3.4/33` and ambiguous zero-padded octets like `010.0.0.1`.

Every function takes a trailing `[opts]` *Object*:
  - `validate`: Whether to reject networks that are not a CIDR or IP address. `false` skips the check for input already known to be valid, and then malformed input is parsed on a best-effort basis. Default: `true`.

This module requires [BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt#browser_compatibility) support in your environment.

### mergeCidr(networks, [opts])

- `networks` *String* or *Array*: One or more CIDR or IP addresses.

Returns an array of merged networks.

### excludeCidr(baseNetworks, excludeNetworks, [opts])

- `baseNetworks` *String* or *Array*: One or more CIDR or IP addresses.
- `excludeNetworks` *String* or *Array*: One or more CIDR or IP addresses to exclude from `baseNetworks`.

Returns an array of merged remaining networks of the subtraction of `excludeNetworks` from `baseNetworks`.

### expandCidr(networks, [opts])

- `networks` *String* or *Array*: One or more CIDR or IP addresses.

Returns a generator for individual IPs contained in the networks.

Be aware that passing large networks that contain millions of IPs can result in memory exhaustion and slow execution time. It's recommended to validate the amount of IPs first, for example, like this:

```js
import {parseCidr} from "cidr-tools";

const {start, end} = parseCidr("1.2.3.4/2");
if (end - start >= 1000000n) {
  throw new Error("Too many IPs");
}
```

### overlapCidr(networksA, networksB, [opts])

- `networksA` *String* or *Array*: One or more CIDR or IP address.
- `networksB` *String* or *Array*: One or more CIDR or IP address.

Returns a boolean that indicates if `networksA` overlap (intersect) with `networksB`.

### containsCidr(networksA, networksB, [opts])

- `networksA` *String* or *Array*: One or more CIDR or IP address.
- `networksB` *String* or *Array*: One or more CIDR or IP address.

Returns a boolean that indicates whether `networksA` fully contain all `networksB`.

### normalizeCidr(networks, [opts])

- `networks` *String* or *Array*: One or more CIDR or IP address.

Returns a string or array (depending on input) with a normalized representation. Will not include a prefix on single IPs. Will set network address to the start of the network.

`opts`: *Object*, additionally to `validate`:
  - `compress`: Whether to compress the IP. For IPv6, this means the "best representation" all-lowercase shortest possible form. Default: `true`.
  - `hexify`: Whether to convert IPv4-Mapped IPv6 addresses to hex. Default: `false`.

### parseCidr(network, [opts])

- `network` *String*: A CIDR or IP address.

Returns a `parsed` Object which is used internally by this module. It can be used to test whether the passed network is IPv4 or IPv6 or to work with the BigInts directly.

`parsed`: *Object*
  - `cidr` String: The CIDR of the network.
  - `ip` String: The IP address inside the CIDR, including any `%scopeid` if present.
  - `version` Number: IP protocol version. Either `4` or `6`.
  - `prefix` String: The network prefix, e.g. `64`.
  - `prefixPresent` Boolean: Whether the passed string has a network prefix.
  - `start` BigInt: Start number of the network.
  - `end` BigInt: End number of the network.

## Related

- [ip-bigint](https://github.com/silverwind/ip-bigint) - Convert IPv4 and IPv6 addresses to native BigInt and vice-versa
- [is-cidr](https://github.com/silverwind/is-cidr) - Check if a string is an IP address in CIDR notation
- [cidr-regex](https://github.com/silverwind/cidr-regex) - Regular expression for matching IP addresses in CIDR notation and bare IP addresses

© [silverwind](https://github.com/silverwind), distributed under BSD licence.
