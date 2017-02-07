# cidr-tools
> Tools to work with IPv4 and IPv6 CIDR network lists

## Install

With `python3` and `pip3` available:

````bash
$ npm i --save cidr-tools
```
## Usage

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
