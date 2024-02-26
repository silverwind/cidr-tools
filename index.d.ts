type IPv4Address = string;
type IPv4CIDR = string;
type IPv6Address = string;
type IPv6CIDR = string;
type Network = IPv4Address | IPv4CIDR | IPv6Address | IPv6CIDR;
type Networks = Network | Network[];

type Parsed = {
  cidr: string;
  ip: string;
  version: number;
  prefix: string;
  start: bigint;
  end: bigint;
};

type NormalizeOpts = {
  compress?: boolean;
  hexify?: boolean;
};

export function mergeCidr(networks: Networks): Network[];
export function excludeCidr(baseNetworks: Networks, excludeNetworks: Networks): Network[];
export function expandCidr(networks: Networks): Network[];
export function overlapCidr(networksA: Networks, networksB: Networks): boolean;
export function normalizeCidr(cidr: Networks, opts?: NormalizeOpts): Networks;
export function containsCidr(networksA: Networks, networksB: Networks): boolean;
export function parseCidr(network: Network): Parsed;

declare const _default: {
  mergeCidr: typeof mergeCidr;
  excludeCidr: typeof excludeCidr;
  expandCidr: typeof expandCidr;
  overlapCidr: typeof overlapCidr;
  normalizeCidr: typeof normalizeCidr;
  containsCidr: typeof containsCidr;
  parseCidr: typeof parseCidr;
};
export default _default;
