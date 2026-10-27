#!/bin/sh
# The C2RMF scan of the whole panel, public domain (Wikimedia Commons, see refs/SOURCES.md), 60 MB.
set -e
cd "$(dirname "$0")"
mkdir -p raw
[ -f raw/c2rmf.jpg ] || curl -sL -A "vrtor-replica/1.0 (https://vrtor.io)" -o raw/c2rmf.jpg \
  "https://upload.wikimedia.org/wikipedia/commons/b/b1/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF.jpg"
