#!/bin/bash

PYTHONUSERBASE="$PWD" pip3 install -I --no-binary --upgrade --user netaddr
rm -rf bin
