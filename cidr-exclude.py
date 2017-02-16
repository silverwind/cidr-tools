#!/usr/bin/env python3
import sys, os
sys.path.append(os.path.join(sys.path[0], "lib", "python", "site-packages"))

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
def ipset(nets):
  v4nets = netaddr.IPSet()
  v6nets = netaddr.IPSet()
  for net in nets:
    ipNetwork = netaddr.IPNetwork(net)
    parts = str(ipNetwork).split("/")
    ip = parts[0]
    mask = parts[1]
    if netaddr.valid_ipv4(ip) and int(mask) <= 32:
      v4nets.add(ipNetwork)
    elif netaddr.valid_ipv6(ip) and int(mask) <= 128:
      v6nets.add(ipNetwork)
  return v4nets, v6nets

v4bases, v6bases = ipset(bases)
v4excludes, v6excludes = ipset(excludes)

while True:
  try:
    v4exclude = v4excludes.pop()
  except KeyError:
    break
  v4bases.remove(v4exclude)

while True:
  try:
    v6exclude = v6excludes.pop()
  except KeyError:
    break
  v6bases.remove(v6exclude)

while True:
  try:
    v4remain = v4bases.pop()
  except KeyError:
    break
  print(str(v4remain))

while True:
  try:
    v6remain = v6bases.pop()
  except KeyError:
    break
  print(str(v6remain))

