#!/usr/bin/env python3
import sys, os
sys.path.append(os.path.join(sys.path[0], "lib", "python", "site-packages"))

import argparse
import netaddr

parser = argparse.ArgumentParser(description="Merge a list of IPv4/IPv6 CIDR networks")
parser.add_argument("netfile", help="A file containing CIDR networks, one per line")
args = parser.parse_args()

# read input
with open(args.netfile) as f:
  nets = f.readlines()

# trim and filter
nets = list(filter(None, [net.strip() for net in nets]))

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

v4nets, v6nets = netlist(nets)

# merge nets and print
for v4net in netaddr.cidr_merge(v4nets):
  print(v4net)

for v6net in netaddr.cidr_merge(v6nets):
  print(v6net)
