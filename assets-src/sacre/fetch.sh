#!/bin/sh
# The photograph of the whole painting, public domain (Wikimedia Commons, see refs/SOURCES.md), 27 MB.
set -e
cd "$(dirname "$0")"
mkdir -p raw
[ -f raw/sacre.jpg ] || curl -sL -A "vrtor-replica/1.0 (https://vrtor.io)" -o raw/sacre.jpg \
  "https://upload.wikimedia.org/wikipedia/commons/a/a0/Le_Sacre_de_Napol%C3%A9on_-_Jacques-Louis_David_-_Mus%C3%A9e_du_Louvre_Peintures_INV_3699_%3B_MR_1437.jpg"
