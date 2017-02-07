#!/bin/bash

pushd "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )" >/dev/null
PYTHONUSERBASE="$PWD" pip3 install -I --no-binary --upgrade --user netaddr
rm -rf bin
popd >/dev/null
