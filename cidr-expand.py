#!/usr/bin/env python3
import argparse
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "python_modules"))
import netaddr

parser = argparse.ArgumentParser(description="Expand a list of IPv4/IPv6 CIDR networks")
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

# print ips
for net in netaddr.cidr_merge(v4nets) + netaddr.cidr_merge(v6nets):
  for ip in net:
    print(ip)
