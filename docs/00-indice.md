# Documentacion completa de MySpeed con Docker

Este directorio es el manual tecnico y el material de clase de **MySpeed Docker Classroom Edition**. Explica desde la procedencia legal del codigo hasta la construccion multi-stage, Compose, acceso desde otros equipos, persistencia, backups y publicacion en un GitHub propio.

La configuracion de referencia es intencionadamente sencilla para el alumno:

- el host solo necesita Git, Docker Engine/Docker Desktop y Docker Compose v2;
- Bun 1.3.14, Express, React/Vite y SQLite quedan dentro del flujo Docker;
- Express sirve tanto la API como la SPA desde un unico contenedor;
- SQLite persiste en un volumen nombrado;
- el servicio se publica en `0.0.0.0` de forma predeterminada para acceso exterior al host;
- el usuario remoto navega a `http://IP_DEL_SERVIDOR:5216`, nunca a `0.0.0.0`;
- exponer una interfaz no configura firewall, NAT, DNS, TLS ni seguridad por si solo.

## Ruta de lectura

| Orden | Documento | Para que sirve |
| ---: | --- | --- |
| 1 | [Origen, licencia y separacion](01-origen-licencia-y-separacion.md) | Entender la importacion limpia, la licencia MIT, la atribucion y los historiales separados. |
| 2 | [Arquitectura](02-arquitectura.md) | Seguir la solicitud desde el navegador hasta Express, SQLite, volumen y CLI. |
| 3 | [Dockerfile](03-dockerfile.md) | Explicar cada etapa de build, permisos, healthcheck y runtime. |
| 4 | [Compose y `.env`](04-compose-y-env.md) | Conocer cada clave, variable, valor predeterminado, precedencia y validacion. |
| 5 | [Acceso exterior y seguridad](05-acceso-externo-y-seguridad.md) | Abrir acceso por LAN/cloud de forma consciente y distinguir escucha de exposicion segura. |
| 6 | [Instalacion y despliegue](06-instalacion-y-despliegue.md) | Preparar el equipo, construir, iniciar y verificar el servicio paso a paso. |
| 7 | [Operacion, persistencia y backup](07-operacion-persistencia-y-backup.md) | Reiniciar, recrear, actualizar, respaldar y restaurar sin perder datos. |
| 8 | [Solucion de problemas](08-solucion-de-problemas.md) | Diagnosticar puertos, healthcheck, permisos, descargas, base de datos y red. |
| 9 | [Publicar y mantener en GitHub](09-publicar-y-mantener-en-github.md) | Crear el remoto propio, publicar commits y mantener la relacion con upstream. |
| 10 | [Guion de clase](10-guion-de-clase.md) | Impartir la sesion con tiempos, demostraciones, preguntas y resultados esperados. |
| 11 | [Ejercicios](11-ejercicios.md) | Practicar configuracion, red, persistencia, diagnostico y Git. |
| 12 | [Referencia de comandos](12-referencia-de-comandos.md) | Consultar rapidamente las ordenes seguras mas utilizadas. |

## Objetivos de aprendizaje

Al terminar el recorrido, el alumno deberia poder:

1. explicar por que un repositorio con historial propio sigue debiendo atribuir el codigo importado;
2. diferenciar una imagen, un contenedor, una red, un volumen y un proyecto Compose;
3. describir las tres etapas del `Dockerfile` y por que Bun queda fijado en `1.3.14`;
4. interpretar `0.0.0.0:5216:5216` como `IP_HOST:PUERTO_HOST:PUERTO_CONTENEDOR`;
5. cambiar un valor en `.env` y comprobar el resultado con `docker compose config`;
6. explicar por que el healthcheck usa `127.0.0.1` aunque el servicio se publique externamente;
7. demostrar que `/myspeed/data` persiste y `/myspeed/bin` se vuelve a crear al reemplazar el contenedor;
8. realizar una copia y restauracion del volumen sin confundir `down` con `down -v`;
9. diagnosticar un servicio que no es accesible desde otro equipo;
10. publicar el repositorio independiente sin sobrescribir el origen ni subir secretos.

## Arquitectura en una imagen

![Arquitectura resumida](assets/arquitectura.svg)

El diagrama distingue deliberadamente:

- `0.0.0.0`, que es la direccion de escucha del host Docker;
- `IP_DEL_SERVIDOR`, que es la direccion real usada por otro equipo;
- `127.0.0.1`, que pertenece al interior del contenedor cuando lo usa el healthcheck.

## Puesta en marcha minima

Desde la raiz del repositorio:

```bash
cp .env.example .env
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs -f myspeed
```

Cuando el estado sea `healthy`, abrir desde otro equipo de la misma red:

```text
http://IP_DEL_SERVIDOR:5216
```

La IP se obtiene en el servidor, no dentro del contenedor. En Linux suele consultarse con `ip address`; en Windows, con `ipconfig`.

## Fuentes de verdad del repositorio

La documentacion explica los archivos, pero la implementacion ejecutable sigue siendo la fuente final:

| Tema | Fuente de verdad |
| --- | --- |
| Construccion de la imagen | [`Dockerfile`](../Dockerfile) |
| Servicios, puertos, volumen y entorno | [`compose.yaml`](../compose.yaml) |
| Variables disponibles y ejemplos seguros | [`.env.example`](../.env.example) |
| Exclusiones del contexto Docker | [`.dockerignore`](../.dockerignore) |
| Archivos que Git no debe versionar | [`.gitignore`](../.gitignore) |
| Licencia original | [`LICENSE`](../LICENSE) |
| Commit y rama de procedencia | [`UPSTREAM.md`](../UPSTREAM.md) |
| Dependencias del backend | [`package.json`](../package.json) y [`bun.lock`](../bun.lock) |
| Dependencias del frontend | [`client/package.json`](../client/package.json) y [`client/bun.lock`](../client/bun.lock) |
| Validacion automatica | [`.github/workflows/docker.yml`](../.github/workflows/docker.yml) |

Si un cambio modifica `Dockerfile`, `compose.yaml` o `.env.example`, se debe actualizar en el mismo commit la seccion documental correspondiente.

## Tres conceptos que no deben confundirse

### Escuchar

`MYSPEED_BIND_IP=0.0.0.0` indica a Docker que acepte conexiones en todas las interfaces IPv4 del host.

### Ser alcanzable

El cliente necesita ruta, IP real, puerto permitido por el firewall y, segun el entorno, una regla cloud o NAT.

### Estar protegido

Una aplicacion alcanzable no esta automaticamente protegida. Para redes no confiables hacen falta contrasena de la aplicacion, TLS y preferiblemente proxy inverso, VPN o control de acceso adicional.

## Estado persistente y estado efimero

| Ruta | Tipo | Que contiene | Al recrear el contenedor |
| --- | --- | --- | --- |
| `/myspeed/data` | Volumen `myspeed-data` | SQLite, configuracion, pruebas, logs, servidores y certificados | Se conserva |
| `/myspeed/bin` | Capa escribible del contenedor | CLI de LibreSpeed, Ookla y Cloudflare | Se pierde y vuelve a descargarse |
| `/myspeed/build` | Imagen | SPA compilada | Se reemplaza con la imagen nueva |
| `/myspeed/server` | Imagen | Backend Express | Se reemplaza con la imagen nueva |

El primer arranque y cada recreacion pueden tardar por las descargas de CLI. Un simple `docker compose restart` reutiliza el mismo contenedor y conserva `bin`.

## Configuracion predeterminada de la clase

```dotenv
COMPOSE_PROJECT_NAME=myspeed-docker
MYSPEED_IMAGE=myspeed:local
APP_VERSION=1.0.9-docker
MYSPEED_RESTART_POLICY=unless-stopped
MYSPEED_BIND_IP=0.0.0.0
MYSPEED_HTTP_PORT=5216
MYSPEED_HTTPS_PORT=5217
TZ=Etc/UTC
RUN_TEST_ON_STARTUP=false
DB_TYPE=sqlite
PREVIEW_MODE=false
```

Las variables MySQL y el mensaje preview permanecen vacios. Todas, incluidas sus restricciones y precedencia, se explican en [Compose y `.env`](04-compose-y-env.md).

## Advertencias antes de la demostracion

- MySpeed inicia sin contrasena configurada; establecerla desde la interfaz antes de abrir redes no confiables.
- `0.0.0.0` facilita el laboratorio, pero no debe interpretarse como una publicacion segura a Internet.
- `PREVIEW_MODE=true` omite la proteccion por contrasena; es demostrativo, no productivo.
- `RUN_TEST_ON_STARTUP=true` consume ancho de banda en cada arranque.
- `docker compose down -v` elimina el volumen persistente.
- `.env` puede contener secretos y no debe entrar en Git.
- El build y las descargas iniciales requieren conectividad saliente.

## Ruta corta para una clase de 30 minutos

1. Mostrar la separacion Git y `UPSTREAM.md`.
2. Explicar el diagrama de arquitectura.
3. Recorrer las tres etapas del Dockerfile.
4. Copiar `.env.example`, destacar `0.0.0.0` y validar Compose.
5. Construir/iniciar y observar el healthcheck.
6. entrar desde otro equipo mediante la IP real del servidor.
7. cerrar explicando volumen persistente, `bin` efimero y seguridad.

Para una sesion completa, seguir el [guion de clase](10-guion-de-clase.md) y terminar con los [ejercicios](11-ejercicios.md).

## Convenciones de comandos

- Los comandos se ejecutan desde la raiz de `MySpeed-Docker`, salvo que se indique otra carpeta.
- `docker compose` se refiere a Compose v2; no al binario antiguo `docker-compose`.
- Sustituir `IP_DEL_SERVIDOR`, `USUARIO` y otros marcadores; no copiarlos literalmente.
- Revisar el efecto de cualquier orden que incluya `-v`, `--force`, `prune` o eliminacion.
- Nunca publicar salidas que revelen `DB_PASS`, claves privadas o tokens.

## Criterio de finalizacion del laboratorio

El despliegue esta listo cuando:

```bash
docker compose config --quiet
docker compose ps
```

terminan sin errores, `myspeed` aparece como `healthy`, la interfaz responde desde el host y desde un segundo equipo autorizado, y una recreacion conserva los datos de `/myspeed/data`.
