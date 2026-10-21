FROM eclipse-temurin:21-jre

ARG PHOTON_VERSION=1.3.0
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl bzip2 pbzip2 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /photon
RUN curl -fsSL -o photon.jar \
    "https://github.com/komoot/photon/releases/download/${PHOTON_VERSION}/photon-${PHOTON_VERSION}.jar"
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 2322
ENTRYPOINT ["/entrypoint.sh"]
