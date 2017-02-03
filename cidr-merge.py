#/usr/bin/env python3
import argparse
import netaddr

parser = argparse.ArgumentParser(
  description="Merge a list of IPv4/IPv6 CIDR subnets"
)
parser.add_argument('netfile', help='Path to a file containing CIDR subnets')
args = parser.parse_args()

# read input
with open(args.netfile) as f: nets = f.readlines()

# trim and filter
nets = list(filter(None, [net.strip() for net in nets]))

# generate ip_network objects
nets = list(map(lambda net: (netaddr.IPNetwork(net)), nets))

# merge nets
for net in netaddr.cidr_merge(nets):
  print(net)
