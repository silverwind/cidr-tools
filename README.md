# cidr-tools
[![](https://img.shields.io/npm/v/cidr-tools.svg?style=flat)](https://www.npmjs.org/package/cidr-tools) [![](https://img.shields.io/npm/dm/cidr-tools.svg)](https://www.npmjs.org/package/cidr-tools) [![](https://img.shields.io/bundlephobia/minzip/cidr-tools.svg)](https://bundlephobia.com/package/cidr-tools) [![](https://packagephobia.com/badge?p=cidr-tools)](https://packagephobia.com/result?p=cidr-tools)
> Tools to work with IPv4 and IPv6 CIDR

## Usage

```js
import {merge, exclude, expand, overlap, contains, normalize, parse} from "cidr-tools";

merge(["1.0.0.0/24", "1.0.1.0/24"]); //=> ["1.0.0.0/23"]
exclude(["::1/127"], "::1/128") //=> ["::/128"]
expand(["2001:db8::/126"]) //=> ["2001:db8::", "2001:db8::1", "2001:db8::2", "2001:db8::3"]
overlap("1.0.0.0/24", "1.0.0.128/25") //=> true
contains(["1.0.0.0/24", "2.0.0.0/24"], "1.0.0.1") //=> true
normalize("::ffff/64") //=> "::/64"
parse("::/64"); // => {cidr: "::/64", version: 6, prefix: "64", start: 0n, end: 18446744073709551615n}
```

## API

All functions take CIDR addresses or single IP addresses. On single addresses, a prefix of `/32` or `/128` is assumed. Function that return networks will return a merged and sorted set of networks with IPv4 sorted before IPv6.

This module requires [BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt#browser_compatibility) support in your environment.

### merge(networks)

- `networks` *String* or *Array*: One or more CIDR or IP addresses.

Returns an array of merged networks.

### exclude(baseNetworks, excludeNetworks)

- `baseNetworks` *String* or *Array*: One or more CIDR or IP addresses.
- `excludeNetworks` *String* or *Array*: One or more CIDR or IP addresses to exclude from `baseNetworks`.

Returns an array of merged remaining networks.

### expand(networks)

- `networks` *String* or *Array*: One or more CIDR or IP addresses.

Returns an array of individual IPs contained in the networks.

### overlap(networksA, networksB)

- `networksA` *String* or *Array*: One or more CIDR or IP address.
- `networksB` *String* or *Array*: One or more CIDR or IP address.

Returns a boolean that indicates if `networksA` overlap (intersect) with `networksB`.

### contains(networksA, networksB)

- `networksA` *String* or *Array*: One or more CIDR or IP address.
- `networksB` *String* or *Array*: One or more CIDR or IP address.

Returns a boolean that indicates whether `networksA` fully contain all `networksB`.

### normalize(networks, [opts])

- `networks` *String* or *Array*: One or more CIDR or IP address.

Returns a string or array (depending on input) with a normalized representation. Will not include a prefix on single IPs.

`opts`: Options `Object`
  - `compress`: Whether to compress the IP. For IPv6, this means the "best representation" all-lowercase shortest possible form. Default: `true`.
  - `hexify`: Whether to convert IPv4-Mapped IPv6 addresses to hex. Default: `false`.

### parse(network)

- `network` *String*: A CIDR or IP address.

Returns a `parsed` Object which is used internally by this module. It can be used to test whether the passed network is IPv4 or IPv6 or work with the BigInts directly.

`parsed`: `Object`
  - `cidr` String: The CIDR of the network.
  - `version` Number: Either `4` or `6`.
  - `prefix` String: The network prefix, e.g. `/64`.
  - `start` BigInt: Start of the network.
  - `end` BigInt: Start of the network.
  - `single` Boolean: `true` when is a single IP.


© [silverwind](https://github.com/silverwind), distributed under BSD licence.
