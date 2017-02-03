#/usr/bin/env python3
import argparse
from ipaddress import ip_network

parser = argparse.ArgumentParser(
  description="Exclude a list of IPv4/IPv6 CIDR subnets from another"
)
parser.add_argument('basefile', help='Path to a file containing base subnets')
parser.add_argument('excludefile', help='Path to a file containing subnets to exclude')
args = parser.parse_args()

# read input
with open(args.basefile) as f: bases = f.readlines()
with open(args.excludefile) as f: excludes = f.readlines()

# trim an filter
bases = list(filter(None, [base.strip() for base in bases]))
excludes = list(filter(None, [exclude.strip() for exclude in excludes]))

# generate ip_network objects
bases = list(map(lambda net: (ip_network(net, strict=False)), bases))
excludes = list(map(lambda net: (ip_network(net, strict=False)), excludes))

# loop through bases and exclude what overlaps
for base in bases:
  printed = False;
  for exclude in excludes:
    if exclude.overlaps(base):
      try:
        for remainder in list(base.address_exclude(exclude)):
          printed = True;
          print(remainder)
      except ValueError:
        printed = False;

  if not printed:
    print(base)
