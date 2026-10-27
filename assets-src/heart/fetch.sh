#!/bin/sh
# The CT average heart and its simulation outputs (Rodero et al. 2021, Zenodo 4593739, CC BY 4.0).
set -e
cd "$(dirname "$0")"; mkdir -p raw work
for f in average.tar.gz simulation_output.csv modes_weights.csv; do
  [ -f raw/$f ] || curl -sL -o raw/$f "https://zenodo.org/records/4593739/files/$f?download=1"
done
[ -f raw/average.vtk ] || tar xzf raw/average.tar.gz -C raw
