type IPv4Address = string;
type IPv4CIDR = string;
type IPv6Address = string;
type IPv6CIDR = string;

type Network = IPv4Address | IPv4CIDR | IPv6Address | IPv6CIDR;

type Networks = Network | Network[];

interface CIDRTools {
  merge(networks: Networks): Network[];
  exclude(baseNetworks: Networks, excludeNetworks: Networks): Network[];
  expand(networks: Networks): Network[];
  overlap(networksA: Networks, networksB: Networks): boolean;
  normalize(cidr: Network): Network;
  contains(networkA: Network, networkB: Network): boolean;
}

declare const cidrTools : CIDRTools;

declare module "cidr-tools" {
  export = cidrTools;
}
