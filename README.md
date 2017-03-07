# cidr-tools
[![](https://img.shields.io/npm/v/cidr-tools.svg?style=flat)](https://www.npmjs.org/package/cidr-tools)
[![](https://img.shields.io/npm/dm/cidr-tools.svg)](https://www.npmjs.org/package/cidr-tools)
[![](https://api.travis-ci.org/silverwind/cidr-tools.svg?style=flat)](https://travis-ci.org/silverwind/cidr-tools)
> Tools to work with IPv4 and IPv6 CIDR network lists

With `python3` and `pip3` available:

```bash
$ pip3 install -r requirements.txt
$ npm i --save cidr-tools
```
## Example

```js
const cidrTools = require('cidr-tools');

cidrTools.merge(['1.0.0.0/24', '1.0.1.0/24']).then(r => {
  console.log(r);
  //=> ['1.0.0.0/23']
});

cidrTools.exclude(['::1/127'], ['::1/128']).then(r => {
  console.log(r);
  //=> ['::/128']
});
```

## API

### cidrTools.merge(networks)

- `networks` *array*: A list of IPv4 and IPv6 networks.
- Returns: A promise that resolves to an array of merged networks.

### cidrTools.exclude(baseNetworks, excludeNetworks)

- `baseNetworks` *array*: A list of IPv4 and IPv6 networks.
- `excludeNetworks` *array*: A list of IPv4 and IPv6 networks to exclude from `baseNetworks`.
- Returns: A promise that resolves to an array of merged remaining networks.

## CLI

*CLI is work in progress*

© [silverwind](https://github.com/silverwind), distributed under BSD licence.
