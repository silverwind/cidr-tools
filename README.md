# cidr-tools
[![](https://img.shields.io/npm/v/cidr-tools.svg?style=flat)](https://www.npmjs.org/package/cidr-tools)
[![](https://img.shields.io/npm/dm/cidr-tools.svg)](https://www.npmjs.org/package/cidr-tools)
[![](https://api.travis-ci.org/silverwind/cidr-tools.svg?style=flat)](https://travis-ci.org/silverwind/cidr-tools)
> Tools to work with IPv4 and IPv6 CIDR network lists

## install

```bash
$ npm i cidr-tools
```
## Example

```js
const cidrTools = require('cidr-tools');

cidrTools.merge(['1.0.0.0/24', '1.0.1.0/24']); //=> ['1.0.0.0/23']
cidrTools.exclude(['::1/127'], ['::1/128']) //=> ['::/128']
cidrTools.expand(['2001:db8::/126']) //=> ['2001:db8::', '2001:db8::1', '2001:db8::2', '2001:db8::3']
cidrTools.overlap('1.0.0.0/24', '1.0.0.128/25') //=> true
```

## API

All functions take CIDR addresses or single IP addresses. On single addresses, a size of `/32` or `/128` is assumed. The return values will always be a aggregated set of networks, sorted human-readable, with IPv4 sorted before IPv6.

### cidrTools.merge(networks)

- `networks` *String* or *Array*: A list of IPv4 and IPv6 networks.

Returns an array of merged networks.

### cidrTools.exclude(baseNetworks, excludeNetworks)

- `baseNetworks` *String* or *Array*: A list of IPv4 and IPv6 networks.
- `excludeNetworks` *String* or *Array*: A list of IPv4 and IPv6 networks to exclude from `baseNetworks`.

Returns an array of merged remaining networks.

### cidrTools.expand(networks)

- `networks` *String* or *Array*: A list of IPv4 and IPv6 networks.

Returns an array of individual IPs contained in the networks.

### cidrTools.overlap(networkA, networkB)

- `networkA` *String*: A IPv4 and IPv6 network.
- `networkB` *String*: A IPv4 and IPv6 network.

Returns a boolean that indicates if the networks overlap (intersect) each other.

© [silverwind](https://github.com/silverwind), distributed under BSD licence.
