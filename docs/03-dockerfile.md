# Dockerfile explicado linea por linea

El [`Dockerfile`](../Dockerfile) usa una compilacion multi-stage. Separa las herramientas necesarias para construir de lo que debe quedar en produccion, fija Bun 1.3.14 y ejecuta MySpeed sin privilegios de root.

## Vista general de las etapas

| Etapa | Base | Objetivo | Resultado que pasa a runtime |
| --- | --- | --- | --- |
| `client-build` | `oven/bun:1.3.14` | Instalar dependencias y compilar React/Vite | `/client/build` |
| `server-build` | `oven/bun:1.3.14` | Instalar dependencias productivas y generar indices | `server`, `package.json`, `node_modules` |
| `runtime` | `oven/bun:1.3.14` | Ejecutar Express y servir API + SPA | Imagen final |

Las dos primeras etapas no se ejecutan como contenedores del servicio. Docker copia de ellas solo los artefactos necesarios.

## Sintaxis y version de Bun

```dockerfile
# syntax=docker/dockerfile:1.7
ARG BUN_VERSION=1.3.14
```

La directiva habilita funciones modernas de BuildKit, como los cache mounts. `BUN_VERSION` evita que un cambio futuro en la etiqueta general de Bun altere un build sin avisar.

Se puede probar otra version de forma explicita:

```bash
docker build --build-arg BUN_VERSION=1.3.14 -t myspeed:prueba .
```

Compose no expone `BUN_VERSION` como variable de `.env`; su build normal utiliza exactamente `1.3.14`.

## Etapa 1: `client-build`

```dockerfile
FROM oven/bun:${BUN_VERSION} AS client-build
WORKDIR /client
COPY client/package.json client/bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile
COPY client/ ./
RUN bun run build
```

El orden de copiado mejora la cache:

1. Docker copia primero `package.json` y `bun.lock`.
2. Instala exactamente las versiones registradas en el lockfile.
3. Solo despues copia el codigo del cliente.
4. Ejecuta el script Vite y genera `/client/build`.

Con este orden, editar un componente React no obliga a reinstalar paquetes si los manifests no cambiaron. `--frozen-lockfile` hace fallar el build si el manifest y el lockfile no coinciden, en vez de modificar dependencias silenciosamente.

El cache mount acelera instalaciones posteriores, pero no se copia a la imagen final.

## Etapa 2: `server-build`

```dockerfile
FROM oven/bun:${BUN_VERSION} AS server-build
WORKDIR /myspeed
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production
COPY server/ ./server/
COPY scripts/ ./scripts/
RUN bun run generate-migrations \
    && bun run generate-integrations
```

Esta etapa instala solo las dependencias de produccion del backend. Luego copia el servidor y los scripts y genera los archivos indice que importan migraciones e integraciones. Los generados no tienen que guardarse en Git: se crean de manera repetible durante cada build.

`&&` garantiza que la segunda generacion solo se ejecute si la primera termina correctamente.

## Etapa 3: `runtime`

```dockerfile
FROM oven/bun:${BUN_VERSION} AS runtime
```

No se introduce Nginx: `server/index.js` configura rutas `/api/...`, sirve el directorio `build` mediante Express y devuelve `index.html` como fallback de la SPA.

### Paquetes del sistema

La imagen instala:

- `ca-certificates`, para conexiones TLS salientes;
- `openssl`, para operaciones relacionadas con certificados;
- `tzdata`, para zonas horarias y planificacion.

Se usa `--no-install-recommends` y se elimina `/var/lib/apt/lists/*` para no conservar metadatos de APT innecesarios.

### Version y etiquetas OCI

```dockerfile
ARG APP_VERSION=1.0.9-docker
```

`APP_VERSION` se escribe en `org.opencontainers.image.version`. Tambien se etiquetan titulo, descripcion, fuente, documentacion y licencia. Estas etiquetas son metadatos de la imagen: no cambian la version que declara `package.json` ni actualizan el codigo.

Compose permite cambiarlo desde `.env`; para materializar un valor nuevo hay que reconstruir:

```bash
docker compose build --pull
docker image inspect myspeed:local --format '{{json .Config.Labels}}'
```

### Variables internas fijas

```dockerfile
ENV NODE_ENV=production \
    TZ=Etc/UTC \
    SERVER_PORT=5216 \
    HTTPS_PORT=5217
```

Son valores por defecto dentro de la imagen. `compose.yaml` sustituye `TZ` y declara explicitamente los puertos internos. Los puertos del host son otra capa y se cambian con `MYSPEED_HTTP_PORT` y `MYSPEED_HTTPS_PORT` sin reconstruir.

### Copias entre etapas

La imagen final recibe:

- `/myspeed/server` y `package.json` desde `server-build`;
- `/myspeed/node_modules` de produccion desde `server-build`;
- `/myspeed/build` desde `client-build`.

No recibe el codigo fuente del cliente, su `node_modules`, caches de instalacion ni los scripts de construccion.

### Permisos

```dockerfile
RUN mkdir -p data bin \
    && chown -R bun:bun data bin
USER bun
```

El proceso no se ejecuta como root. El codigo queda propiedad de root y no es modificable por la aplicacion. Los dos directorios que el proceso necesita escribir son:

- `data`, para base, configuracion, logs, listas y certificados;
- `bin`, para los CLI descargados durante el arranque.

Compose añade `no-new-privileges:true` como defensa adicional.

### Volumen y puertos

```dockerfile
VOLUME ["/myspeed/data"]
EXPOSE 5216 5217
```

`VOLUME` documenta el punto persistente y Compose le conecta `myspeed-data`. `EXPOSE` solo documenta puertos internos; no abre puertos en el host. La publicacion real esta en `compose.yaml`.

`/myspeed/bin` no es volumen. Los CLI sobreviven un reinicio del mismo contenedor, pero no una recreacion.

### Healthcheck

El healthcheck ejecuta Bun dentro del contenedor y hace un `fetch` a `http://127.0.0.1:<SERVER_PORT>/`:

- intervalo: 30 segundos;
- timeout: 5 segundos;
- periodo inicial: 120 segundos;
- reintentos: 3.

La comprobacion usa el loopback interno intencionadamente. No determina si un firewall externo permite entrar; determina si la aplicacion responde en el contenedor.

El periodo inicial deja tiempo para descargar LibreSpeed CLI, Ookla Speedtest CLI y Cloudflare Speedtest. Si esas descargas fallan, Express puede no empezar a escuchar.

### Parada y comando

```dockerfile
STOPSIGNAL SIGTERM
CMD ["bun", "server/index.js"]
```

Docker envia `SIGTERM`; Compose concede 30 segundos antes de una terminacion forzada. La forma JSON de `CMD` evita una shell intermedia y permite entregar senales al proceso adecuado. `init: true` agrega un init minimo como PID 1 para reenvio de senales y recoleccion de procesos.

## Como inspeccionar el resultado

```bash
docker compose build --pull
docker image inspect myspeed:local
docker compose up -d
docker compose ps
docker compose exec myspeed id
docker compose exec myspeed sh -lc 'ls -ld /myspeed /myspeed/data /myspeed/bin'
```

Se espera un usuario `bun`, un contenedor saludable despues de la inicializacion y permisos de escritura limitados a `data` y `bin`.

## Por que no hay un segundo contenedor web

Separar frontend y backend puede ser adecuado si tienen ciclos de despliegue o escalado distintos. Aqui produciria mas piezas sin aportar a la finalidad de la clase:

- el frontend es estatico despues del build;
- Express ya lo sirve;
- API y SPA comparten origen y puerto;
- un unico servicio simplifica red, CORS, persistencia y explicacion.

Un proxy inverso puede agregarse fuera de este Compose para TLS o autenticacion, pero no es necesario para ejecutar la aplicacion en una red de laboratorio.

## Reproducibilidad y limites

La version de Bun y ambos lockfiles estan fijados, lo que hace el build repetible respecto a dependencias. Aun asi, reproducible no significa totalmente desconectado:

- la primera construccion descarga la imagen base y paquetes;
- `--pull` puede obtener una revision nueva de la imagen con la misma etiqueta;
- el arranque descarga binarios externos cuando `bin` esta vacio.

Para una clase sin Internet se deben precargar la imagen y las caches o preparar una variante que persista/empaquete los CLI, validando antes sus licencias y arquitecturas.
