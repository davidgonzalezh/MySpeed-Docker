# syntax=docker/dockerfile:1.7

# Bun queda fijado a una version concreta para que los builds sean repetibles.
# Se puede cambiar de forma explicita con --build-arg BUN_VERSION=x.y.z.
ARG BUN_VERSION=1.3.14

# -----------------------------------------------------------------------------
# Etapa 1: compila React/Vite. Esta etapa y sus dependencias no llegan a la
# imagen final; solo se copia el directorio /client/build.
# -----------------------------------------------------------------------------
FROM oven/bun:${BUN_VERSION} AS client-build

WORKDIR /client

# Copiar manifests antes que el codigo permite reutilizar la cache de paquetes.
COPY client/package.json client/bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

COPY client/ ./
RUN bun run build


# -----------------------------------------------------------------------------
# Etapa 2: instala solo dependencias de produccion y genera los indices que el
# backend necesita. Tampoco se conserva esta etapa completa en la imagen final.
# -----------------------------------------------------------------------------
FROM oven/bun:${BUN_VERSION} AS server-build

WORKDIR /myspeed

COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production

COPY server/ ./server/
COPY scripts/ ./scripts/

RUN bun run generate-migrations \
    && bun run generate-integrations


# -----------------------------------------------------------------------------
# Etapa 3: runtime minimo. Express sirve la API y tambien el frontend compilado;
# por eso no hacen falta Nginx ni un segundo contenedor.
# -----------------------------------------------------------------------------
FROM oven/bun:${BUN_VERSION} AS runtime

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ca-certificates \
        openssl \
        tzdata \
    && rm -rf /var/lib/apt/lists/*

ARG APP_VERSION=1.0.9-docker

LABEL org.opencontainers.image.title="MySpeed Docker Classroom Edition" \
      org.opencontainers.image.description="Independent Docker adaptation of MySpeed with Spanish course material" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.source="https://github.com/davidgonzalezh/MySpeed-Docker" \
      org.opencontainers.image.documentation="https://github.com/davidgonzalezh/MySpeed-Docker/tree/main/docs" \
      org.opencontainers.image.licenses="MIT"

# Estos son puertos internos del contenedor. Los puertos del host se configuran
# en compose.yaml/.env sin necesidad de reconstruir la imagen.
ENV NODE_ENV=production \
    TZ=Etc/UTC \
    SERVER_PORT=5216 \
    HTTPS_PORT=5217

WORKDIR /myspeed

# COPY conserva los permisos de los artefactos de las etapas anteriores. En un
# host con umask restrictivo esos archivos pueden llegar como 0600/0700 y quedar
# propiedad de root. Como el runtime se ejecuta con USER bun, se asigna bun:bun
# explicitamente para que la imagen no dependa de los permisos del host de build.
COPY --chown=bun:bun --from=server-build /myspeed/server ./server
COPY --chown=bun:bun --from=server-build /myspeed/package.json ./package.json
COPY --chown=bun:bun --from=server-build /myspeed/node_modules ./node_modules
COPY --chown=bun:bun --from=client-build /client/build ./build

# Solo data/ y bin/ necesitan escritura en runtime. El codigo y las dependencias
# son legibles por bun gracias a --chown, pero no se modifican durante ejecucion.
RUN mkdir -p data bin \
    && chown -R bun:bun data bin

USER bun

# /myspeed/data contiene SQLite, configuracion, logs y certificados.
VOLUME ["/myspeed/data"]

# EXPOSE documenta los puertos; no los publica. Compose realiza la publicacion.
EXPOSE 5216 5217

# La comprobacion ocurre dentro del contenedor y no depende del puerto del host.
# El periodo inicial amplio permite descargar los CLI de los proveedores.
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
    CMD ["bun", "-e", "const port=process.env.SERVER_PORT||'5216';fetch('http://127.0.0.1:'+port+'/').then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"]

STOPSIGNAL SIGTERM

CMD ["bun", "server/index.js"]
