#!/usr/bin/env python3
import argparse
import netaddr

parser = argparse.ArgumentParser(
  description="Exclude a list of IPv4/IPv6 CIDR networks from another")
parser.add_argument("basefile", help="A file containing base networks, one per line")
parser.add_argument("excludefile", help="A file containing networks to exclude, one per line")

args = parser.parse_args()

# read input
with open(args.basefile) as f:
  bases = f.readlines()
with open(args.excludefile) as f:
  excludes = f.readlines()

# trim and filter
bases = list(filter(None, [base.strip() for base in bases]))
excludes = list(filter(None, [exclude.strip() for exclude in excludes]))

# split up into two lists, netaddr can get confused otherwise
def netlist(nets):
  v4nets = []
  v6nets = []
  for net in nets:
    ipNetwork = netaddr.IPNetwork(net)
    parts = str(ipNetwork).split("/")
    ip = parts[0]
    mask = parts[1]
    if netaddr.valid_ipv4(ip) and int(mask) <= 32:
      v4nets.append(ipNetwork)
    elif netaddr.valid_ipv6(ip) and int(mask) <= 128:
      v6nets.append(ipNetwork)
  return v4nets, v6nets

v4bases, v6bases = netlist(bases)
v4excludes, v6excludes = netlist(excludes)

# loop through bases, exclude and print remainder
if len(v4excludes) == 0:
  for v4base in v4bases:
    print(v4base)
else:
  for v4base in v4bases:
    for v4exclude in v4excludes:
      for v4remainder in list(netaddr.cidr_exclude(v4base, v4exclude)):
        print(v4remainder)

if len(v6excludes) == 0:
  for v6base in v6bases:
    print(v6base)
else:
  for v6base in v6bases:
    for v6exclude in v6excludes:
      for v6remainder in list(netaddr.cidr_exclude(v6base, v6exclude)):
        print(v6remainder)
