#!/bin/sh
# Downloads the prebuilt Photon index once (India by default), then serves it.
set -e
cd /photon/data

if [ ! -d photon_data ]; then
  echo "Downloading Photon index: ${PHOTON_DUMP_URL}"
  curl -fL "${PHOTON_DUMP_URL}" | pbzip2 -cd | tar x
fi

exec java ${JAVA_OPTS} -jar /photon/photon.jar -data-dir /photon/data -listen-ip 0.0.0.0 -cors-any
