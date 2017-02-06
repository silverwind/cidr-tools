#!/usr/bin/env python3
import argparse
import netaddr

parser = argparse.ArgumentParser(
  description="Exclude a list of IPv4/IPv6 CIDR subnets from another"
)
parser.add_argument('basefile', help='Path to a file containing base subnets')
parser.add_argument('excludefile', help='Path to a file containing subnets to exclude')
args = parser.parse_args()

# read input
with open(args.basefile) as f: bases = f.readlines()
with open(args.excludefile) as f: excludes = f.readlines()

# trim and filter
bases = list(filter(None, [base.strip() for base in bases]))
excludes = list(filter(None, [exclude.strip() for exclude in excludes]))

# generate IPNetwork objects
bases = list(map(lambda net: (netaddr.IPNetwork(net)), bases))
excludes = list(map(lambda net: (netaddr.IPNetwork(net)), excludes))

# loop through bases, exclude and print remainder
for base in bases:
  for exclude in excludes:
    for remainder in list(netaddr.cidr_exclude(base, exclude)):
      print(remainder)
