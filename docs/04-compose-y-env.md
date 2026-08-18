# Compose y `.env`, completamente documentados

[`compose.yaml`](../compose.yaml) describe el servicio; [`.env.example`](../.env.example) documenta todos los valores configurables. El alumno copia la plantilla a `.env`, valida la interpolacion y levanta el mismo despliegue sin instalar Bun, Node.js, SQLite ni MySQL en el host.

## Flujo correcto

```bash
cp .env.example .env
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs -f myspeed
```

En PowerShell, la primera orden es:

```powershell
Copy-Item .env.example .env
```

`.env` esta ignorado por Git; `.env.example` se versiona porque es documentacion sin secretos.

## Como utiliza Compose el archivo `.env`

Compose carga el `.env` del proyecto para sustituir expresiones como:

```yaml
image: "${MYSPEED_IMAGE:-myspeed:local}"
```

La forma `:-` usa el valor predeterminado si la variable esta ausente **o vacia**. Esto evita que una linea accidentalmente vacia produzca, por ejemplo, una etiqueta de imagen vacia.

Este proyecto no declara `env_file:`. Por tanto, Compose no inyecta todo `.env` en el contenedor. Solo entran las variables enumeradas bajo `services.myspeed.environment`; las variables como `MYSPEED_HTTP_PORT` se consumen en el host para construir la configuracion Docker.

Para este flujo, la precedencia practica de interpolacion es:

1. variable exportada en la shell que ejecuta `docker compose`;
2. archivo indicado expresamente con `--env-file` (si hay varios, los posteriores reemplazan a los anteriores);
3. si no se indico `--env-file`, `.env` del directorio del proyecto;
4. valor predeterminado escrito en `${VARIABLE:-predeterminado}`.

El directorio del proyecto se determina con `--project-directory`, con el primer archivo indicado por `-f` o, si no se usa ninguno, con el directorio actual. Para evitar ambiguedad en clase, los comandos se ejecutan desde la raiz de este repositorio. La shell sigue teniendo prioridad al interpolar.

En los archivos de entorno, los valores sin comillas y con comillas dobles permiten interpolacion. Las comillas simples conservan el texto literalmente, algo importante si `DB_PASS` contiene `$`, `#` o espacios. Por ejemplo:

```dotenv
DB_PASS='un valor con $ y # literal'
```

No muestres despues `docker compose config` en una captura o ticket: la salida resuelta puede contener ese secreto.

Una variable de shell puede sorprender porque domina al archivo:

```bash
MYSPEED_HTTP_PORT=8080 docker compose config
```

Esa orden usa `8080` aunque `.env` diga `5216`. Para diagnosticar, Compose moderno permite:

```bash
docker compose config --environment
```

Dentro del contenedor, los valores de `environment:` de Compose prevalecen sobre los `ENV` de la imagen. Aqui `SERVER_PORT` y `HTTPS_PORT` quedan intencionadamente fijos en `5216` y `5217`; solo cambia su lado host.

## Servicio `myspeed`

### `image`

```yaml
image: "${MYSPEED_IMAGE:-myspeed:local}"
```

Nombra la imagen construida localmente. No descarga una imagen oficial preconstruida de MySpeed. Cambiar el nombre es util para un registro propio, por ejemplo `ghcr.io/usuario/myspeed-docker:1.0.9`.

### `build`

El contexto es la raiz del repositorio y usa `Dockerfile`. El argumento `APP_VERSION` solo alimenta una etiqueta OCI. Si se cambia, se debe reconstruir.

### `init`

`init: true` inserta un proceso init minimo que reenvia senales y recoge procesos hijos. Complementa `STOPSIGNAL SIGTERM`.

### `restart`

El valor predeterminado es `unless-stopped`: Docker reinicia el servicio tras fallos y al reiniciar el daemon, salvo que el operador lo haya detenido de forma manual. La politica no corrige configuraciones invalidas; un error persistente puede crear un bucle de reinicios visible en `docker compose ps` y `logs`.

### `ports`

```yaml
- "${MYSPEED_BIND_IP:-0.0.0.0}:${MYSPEED_HTTP_PORT:-5216}:5216"
- "${MYSPEED_BIND_IP:-0.0.0.0}:${MYSPEED_HTTPS_PORT:-5217}:5217"
```

Cada entrada usa `IP_HOST:PUERTO_HOST:PUERTO_CONTENEDOR`.

- `0.0.0.0:5216:5216`: accesible por cualquier IPv4 del host que la red/firewall permita.
- `127.0.0.1:5216:5216`: accesible solo desde el propio host.
- `192.168.1.50:8080:5216`: accesible en una interfaz concreta mediante `http://192.168.1.50:8080`.

El puerto HTTPS se publica, pero solo responde cuando hay `cert.pem` y `key.pem` validos en `data/certs`.

### `environment`

Compose pasa las variables de aplicacion de forma explicita. Las cadenas booleanas deben escribirse en minusculas: el codigo activa los modos solo cuando el valor es exactamente `"true"`.

### `volumes`

```yaml
- myspeed-data:/myspeed/data
```

Es un volumen nombrado administrado por Docker. Compose antepone `COMPOSE_PROJECT_NAME`, por lo que normalmente se llama `myspeed-docker_myspeed-data`.

`docker compose down` lo conserva. `docker compose down -v` lo borra; esta ultima orden es destructiva para resultados, configuracion, logs y certificados.

### Seguridad y parada

`no-new-privileges:true` impide ganar privilegios adicionales. `stop_grace_period: 30s` da al proceso 30 segundos despues de `SIGTERM` antes de forzar su terminacion.

## Referencia completa de `.env`

### Variables del proyecto y de la imagen

| Variable | Predeterminado | Consumidor | Explicacion y validacion |
| --- | --- | --- | --- |
| `COMPOSE_PROJECT_NAME` | `myspeed-docker` | Compose | Prefija contenedor, red y volumen. Use minusculas, numeros, guiones y guiones bajos; debe empezar por minuscula o numero. Cambiarlo crea otro conjunto logico y otro volumen. La opcion CLI `-p NOMBRE` tiene prioridad. |
| `MYSPEED_IMAGE` | `myspeed:local` | Compose | Nombre y etiqueta de la imagen local. Debe ser una referencia Docker valida. |
| `APP_VERSION` | `1.0.9-docker` | Build | Metadato OCI de la imagen. No cambia `package.json`. Requiere reconstruccion para aplicarse. |
| `MYSPEED_RESTART_POLICY` | `unless-stopped` | Docker | Valores habituales: `no`, `always`, `on-failure`, `unless-stopped`. Se valida al procesar Compose. |

### Red

| Variable | Predeterminado | Consumidor | Explicacion y validacion |
| --- | --- | --- | --- |
| `MYSPEED_BIND_IP` | `0.0.0.0` | Docker host | Direccion local donde Docker publica ambos puertos. `0.0.0.0` escucha en todas las interfaces IPv4; `127.0.0.1` limita al host; tambien acepta una IP asignada realmente al servidor. |
| `MYSPEED_HTTP_PORT` | `5216` | Docker host | Puerto HTTP del host, normalmente entero entre 1 y 65535 y libre. El contenedor sigue usando `5216`. |
| `MYSPEED_HTTPS_PORT` | `5217` | Docker host | Puerto HTTPS del host. Publicarlo no crea certificados; el contenedor sigue usando `5217`. |

`0.0.0.0` no configura firewall, NAT, IP publica, DNS ni TLS. Tampoco es la direccion que usa el navegador remoto. Se debe obtener la IP real del servidor y entrar a `http://IP_DEL_SERVIDOR:MYSPEED_HTTP_PORT`.

### Aplicacion

| Variable | Predeterminado | Consumidor | Explicacion y validacion |
| --- | --- | --- | --- |
| `TZ` | `Etc/UTC` | Contenedor/MySpeed | Zona horaria IANA, por ejemplo `Europe/Madrid` o `America/Bogota`. Afecta programacion y presentacion temporal. Validar con una zona existente. |
| `RUN_TEST_ON_STARTUP` | `false` | MySpeed | Solo `true` ejecuta una prueba en cada inicio del proceso. Un reinicio repetido puede consumir ancho de banda. |

`SERVER_PORT` y `HTTPS_PORT` aparecen en `compose.yaml`, pero no en `.env.example`: son internos y estan fijados a `5216`/`5217` para mantener coherente el mapeo. Para cambiar lo visible en el host se usan las variables `MYSPEED_*_PORT`.

### Base de datos

| Variable | Predeterminado | Obligatoria | Explicacion y validacion |
| --- | --- | --- | --- |
| `DB_TYPE` | `sqlite` | Si | Acepta `sqlite` o `mysql` en minusculas. Otro valor termina el arranque con `Invalid database type`. |
| `DB_HOST` | vacio | No para MySQL | Vacio hace que la aplicacion use `localhost`. En Docker eso apunta al mismo contenedor y normalmente no sirve para una BD externa. |
| `DB_NAME` | vacio | Si con MySQL | Nombre de la base existente/accesible. |
| `DB_USER` | vacio | Si con MySQL | Usuario con permisos adecuados. |
| `DB_PASS` | vacio | Si con MySQL | Contrasena. Es un secreto: debe quedar solo en `.env`. La aplicacion exige un valor no vacio. |

La aplicacion no admite `DB_PORT`; MySQL usa su puerto predeterminado `3306`. Con SQLite se crea `data/storage.db`. No se necesita instalar SQLite en el host.

Ejemplo avanzado de MySQL:

```dotenv
DB_TYPE=mysql
DB_HOST=mysql.ejemplo.interno
DB_NAME=myspeed
DB_USER=myspeed
DB_PASS=CAMBIAR_POR_UN_SECRETO
```

Antes de usarlo hay que garantizar DNS/ruta desde el contenedor, puerto 3306, credenciales y permisos. Este servidor MySQL es una dependencia externa y queda fuera del despliegue autocontenido de la clase.

### Preview

| Variable | Predeterminado | Consumidor | Explicacion y validacion |
| --- | --- | --- | --- |
| `PREVIEW_MODE` | `false` | MySpeed | Solo `true` activa el modo demostracion. Usa `storage_preview.db`, no descarga CLI, genera datos de prueba sinteticos, restringe varias escrituras y omite la comprobacion de contrasena. |
| `PREVIEW_MESSAGE` | vacio | MySpeed | Texto mostrado solo en preview. Vacio hace que la aplicacion use su mensaje generico en ingles. |

`PREVIEW_MODE=true` **no es una medida de seguridad**. Como el middleware de contrasena deja pasar las solicitudes en ese modo, no debe usarse para proteger una instancia productiva. Su finalidad es una demostracion controlada y desechable.

Si se cambia entre normal y preview con SQLite, ambos archivos pueden coexistir en el mismo volumen:

```text
storage.db
storage_preview.db
```

## Ejemplos de configuracion

### Acceso desde la LAN, configuracion solicitada

```dotenv
MYSPEED_BIND_IP=0.0.0.0
MYSPEED_HTTP_PORT=5216
MYSPEED_HTTPS_PORT=5217
TZ=America/Bogota
DB_TYPE=sqlite
PREVIEW_MODE=false
```

Acceso desde otro equipo: `http://IP_REAL_DEL_SERVIDOR:5216`.

### Solo loopback para usar con proxy local

```dotenv
MYSPEED_BIND_IP=127.0.0.1
MYSPEED_HTTP_PORT=5216
```

Esta opcion bloquea el acceso directo desde otros equipos; un proxy en el mismo host puede conectarse a `127.0.0.1:5216`.

### Puerto alternativo

```dotenv
MYSPEED_BIND_IP=0.0.0.0
MYSPEED_HTTP_PORT=8080
```

Acceso: `http://IP_REAL_DEL_SERVIDOR:8080`. No se debe cambiar `SERVER_PORT`.

## Validacion antes de arrancar

### 1. Validacion sintactica e interpolacion

```bash
docker compose config --quiet
docker compose config
docker compose config --environment
```

`config --quiet` comprueba que Compose pueda resolver el modelo. `config` permite revisar especialmente `ports`, `environment`, `image` y el volumen. No valida que una IP pertenezca al host, que un puerto este libre, que una zona horaria exista o que MySQL acepte las credenciales.

### 2. Build

```bash
docker compose build --pull
```

Si falla en `bun install --frozen-lockfile`, revisar manifests/lockfiles y conectividad. Si falla al obtener `oven/bun`, revisar acceso al registro Docker.

### 3. Estado y logs

```bash
docker compose up -d
docker compose ps
docker compose logs --tail=200 myspeed
```

El primer arranque puede tardar mientras descarga CLI. Esperar el healthcheck y buscar mensajes de conexion a base y escucha del servidor.

### 4. Valores realmente aplicados

```bash
docker compose port myspeed 5216
docker compose exec myspeed sh -lc 'env | sort'
docker inspect "$(docker compose ps -q myspeed)" --format '{{json .State.Health}}'
```

No publique la salida completa de `env` si usa `DB_PASS`: contiene el secreto.

## Problemas frecuentes de `.env`

- Ejecutar Compose desde otra carpeta y cargar un `.env` distinto.
- Exportar una variable en la shell y olvidar que prevalece sobre `.env`.
- Escribir `TRUE` o `True`: el codigo compara exactamente con `true`.
- Poner `MYSPEED_BIND_IP` en la IP del cliente en vez de una IP del servidor.
- Cambiar el puerto host y seguir navegando al anterior.
- Suponer que `0.0.0.0` abre el firewall o configura el router.
- Activar HTTPS sin colocar ambos certificados.
- Usar `DB_HOST=localhost` para una base que esta en el host o en otro contenedor.
- Ejecutar `docker compose down -v` y eliminar datos que no tenian copia.

## Seguridad de secretos

`.env` puede contener `DB_PASS`, pero no es un gestor de secretos. Para una clase local resulta sencillo; en produccion se debe restringir sus permisos y valorar Docker secrets o el gestor del entorno.

Comprobaciones antes de un commit:

```bash
git check-ignore -v .env
git status --short
git grep -n 'CAMBIAR_POR_UN_SECRETO' -- ':!docs/*'
```

No se deben guardar contrasenas reales, claves privadas, `storage.db`, certificados ni backups en Git.

## Referencias oficiales de Compose

- [Interpolacion y archivos `.env`](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)
- [Precedencia de variables](https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/)
- [Referencia de `docker compose config`](https://docs.docker.com/reference/cli/docker/compose/config/)
