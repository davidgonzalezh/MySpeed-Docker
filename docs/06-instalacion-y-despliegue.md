# Instalación y despliegue con Docker Compose

El objetivo de esta edición es que el equipo anfitrión no necesite instalar
Bun, Node.js, npm, Vite, SQLite ni las herramientas de prueba de velocidad.
Docker construye y ejecuta todo dentro de contenedores.

La única dependencia de ejecución es Docker con el complemento Compose. Para
obtener el código se necesita Git o, alternativamente, descargar y extraer el
ZIP del repositorio.

## 1. Requisitos

### Hardware y sistema

- Un equipo Linux, Windows o macOS capaz de ejecutar contenedores Linux.
- Acceso de administrador para instalar Docker y ajustar el firewall.
- Espacio para imágenes, cachés de compilación y el volumen persistente.
- Una arquitectura soportada por la imagen de Bun y por los tres CLI que
  descarga MySpeed. Si un proveedor no publica un binario para la plataforma,
  el primer arranque mostrará un error de plataforma no soportada.
- Conectividad a Internet durante el build y durante el primer arranque de cada
  contenedor nuevo.

La medición refleja la conectividad de red del host y de Docker. Ejecutar varias
pruebas a la vez en un aula puede saturar la salida compartida y alterar los
resultados.

### Opción A: Docker Desktop

En Windows y macOS, Docker Desktop incluye Docker Engine y Docker Compose. En
Windows suele utilizar WSL 2; la virtualización debe estar habilitada.

Instala [Docker Desktop desde la documentación oficial](https://docs.docker.com/desktop/),
inícialo y espera a que el motor esté listo. No basta con instalar el cliente
si el daemon no está iniciado.

### Opción B: Docker Engine en Linux

Instala [Docker Engine](https://docs.docker.com/engine/install/) y el
[complemento Docker Compose](https://docs.docker.com/compose/install/linux/)
desde el repositorio de paquetes indicado por Docker para tu distribución. Esta
guía usa el comando moderno:

```bash
docker compose
```

El binario antiguo `docker-compose` no es el objetivo de esta edición. Si el
usuario se añade al grupo `docker`, recuerda que ese grupo equivale en la
práctica a privilegios administrativos sobre el host. Cierra y abre la sesión
para que un cambio de grupo tenga efecto.

### Validación de la instalación

En Bash o PowerShell:

```text
docker version
docker compose version
docker info
```

Los tres comandos deben terminar correctamente. Si `docker version` muestra el
cliente pero no el servidor, el daemon o Docker Desktop no está disponible.

## 2. Obtener el repositorio independiente

Clona el repositorio independiente publicado:

```bash
git clone https://github.com/davidgonzalezh/MySpeed-Docker.git
cd MySpeed-Docker
```

En PowerShell:

```powershell
git clone https://github.com/davidgonzalezh/MySpeed-Docker.git
Set-Location MySpeed-Docker
```

Si se usa el ZIP de GitHub, extráelo y abre una terminal en la carpeta que
contiene [`compose.yaml`](../compose.yaml). Los siguientes comandos deben
ejecutarse desde esa carpeta; Compose busca allí `.env` y el contexto del build.

## 3. Crear y entender `.env`

No edites [`.env.example`](../.env.example) para cada máquina. Cópialo a `.env`:

### Bash

```bash
cp .env.example .env
```

### PowerShell

```powershell
Copy-Item .env.example .env
```

`.env` está ignorado por Git. Compose lo usa para sustituir las expresiones
`${VARIABLE}` de `compose.yaml`; el archivo completo no se inyecta al
contenedor. Solo entran las variables declaradas en la sección `environment`.

Configuración mínima para acceso desde la LAN:

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
DB_HOST=
DB_NAME=
DB_USER=
DB_PASS=
PREVIEW_MODE=false
PREVIEW_MESSAGE=
```

Para un país o ciudad concreta, usa una zona IANA, por ejemplo
`America/Bogota`, `America/Mexico_City` o `Europe/Madrid`. No uses una
abreviatura ambigua como `CST`.

El valor predeterminado `MYSPEED_BIND_IP=0.0.0.0` publica el servicio en todas
las interfaces IPv4. Lee [Acceso externo y seguridad](05-acceso-externo-y-seguridad.md)
antes de permitir tráfico de redes no confiables.

## 4. Validar Compose antes de crear recursos

```bash
docker compose config
```

Este comando:

- analiza el YAML;
- aplica los valores de `.env`;
- muestra el modelo efectivo que Docker utilizará;
- detecta muchas variables o estructuras incorrectas antes del build.

Busca especialmente:

- `published: "5216"` o el puerto elegido;
- `host_ip: 0.0.0.0` para acceso externo;
- la ruta `/myspeed/data` en el volumen;
- `DB_TYPE: sqlite` para el despliegue autocontenido.

> `docker compose config` puede mostrar `DB_PASS` si se configura MySQL. No
> publiques ni pegues su salida completa en un ticket sin censurar secretos.

Para listar solo servicios e imágenes, sin volcar toda la configuración:

```bash
docker compose config --services
docker compose config --images
```

## 5. Construir la imagen

```bash
docker compose build --pull
```

`--pull` comprueba si existe una versión más reciente de la imagen base fijada
por el Dockerfile. Durante el build, Docker:

1. descarga la imagen de Bun si no está en caché;
2. instala dependencias del frontend con su lockfile;
3. compila React/Vite;
4. instala solo dependencias de producción del backend;
5. genera los índices de migraciones e integraciones;
6. crea una imagen final sin las herramientas del frontend;
7. configura el proceso para ejecutarse como el usuario no privilegiado `bun`.

Consulta el [`Dockerfile`](../Dockerfile) para ver los comentarios línea a línea.

En una compilación normal se reutilizan capas. Para investigar una caché
posiblemente corrupta, se puede forzar excepcionalmente un build completo:

```bash
docker compose build --no-cache --pull
```

No es necesario usar `--no-cache` en cada despliegue; aumenta tiempo y tráfico.

## 6. Iniciar el servicio

```bash
docker compose up -d
```

También puede construirse e iniciarse en una sola orden:

```bash
docker compose up -d --build
```

`-d` deja el servicio en segundo plano. Comprueba su estado:

```bash
docker compose ps
docker compose logs --tail=100 myspeed
```

Para seguir los logs en tiempo real:

```bash
docker compose logs -f myspeed
```

`Ctrl+C` deja de seguir los logs, pero no detiene un contenedor iniciado con
`-d`.

## 7. Qué ocurre en el primer arranque

Antes de abrir el puerto HTTP, MySpeed realiza migraciones, inicializa datos y
descarga secuencialmente tres ejecutables:

- LibreSpeed CLI;
- Ookla Speedtest CLI;
- Cloudflare speed test CLI.

Los guarda en `/myspeed/bin`. Ese directorio pertenece a la capa escribible del
contenedor y **no** al volumen `myspeed-data`.

Consecuencias operativas:

- El primer arranque de un contenedor nuevo necesita DNS, HTTPS y salida a
  Internet hacia los proveedores de esos archivos.
- Mientras descarga, el contenedor puede estar ejecutándose pero todavía no
  aceptar peticiones HTTP.
- El `HEALTHCHECK` concede un período inicial de 120 segundos para esta fase.
- `docker compose restart myspeed` reutiliza el mismo contenedor y conserva
  `/myspeed/bin`.
- `docker compose down`, `docker compose up --force-recreate`, una actualización
  de imagen o cualquier recreación eliminan esa capa; el contenedor nuevo vuelve
  a descargar los tres CLI.
- El volumen de datos puede estar intacto aunque los CLI deban descargarse otra
  vez.

El build también requiere Internet para imágenes, paquetes del sistema y
dependencias Bun. Por tanto, esta edición no promete una instalación inicial
sin conexión. Para un aula sin Internet habría que preparar y distribuir con
antelación una imagen modificada que incorpore los CLI, además de comprobar sus
licencias y arquitecturas.

`PREVIEW_MODE=true` omite las descargas, pero no es un sustituto para producción:
usa otra base de datos, limita escrituras y omite la comprobación de contraseña.

## 8. Esperar a que esté saludable

Estado resumido:

```bash
docker compose ps
```

Estado exacto en Bash:

```bash
CONTAINER_ID="$(docker compose ps -q myspeed)"
docker inspect --format '{{.State.Health.Status}}' "$CONTAINER_ID"
```

En PowerShell:

```powershell
$ContainerId = docker compose ps -q myspeed
docker inspect --format '{{.State.Health.Status}}' $ContainerId
```

El ciclo esperado es `starting` y después `healthy`. Si termina en `unhealthy`
o el contenedor se reinicia, consulta inmediatamente:

```bash
docker compose logs --tail=250 myspeed
```

No concluyas que ha fallado durante los primeros segundos de descarga. Si no
avanza después del período inicial, sigue el diagnóstico de
[Solución de problemas](08-solucion-de-problemas.md).

## 9. Abrir MySpeed

Desde el host Docker:

```text
http://localhost:5216
```

Desde otro equipo de la LAN:

```text
http://IP_DEL_HOST_DOCKER:5216
```

No uses `http://0.0.0.0:5216`: `0.0.0.0` es la dirección de escucha, no la
dirección del servidor para los clientes.

En la primera visita, configura inmediatamente una contraseña desde la interfaz
de MySpeed antes de abrir el firewall a redes adicionales.

El puerto `5217` solo responde si se han instalado un certificado y una clave
en `/myspeed/data/certs`. Su publicación no activa HTTPS automáticamente.

## 10. Comandos cotidianos

### Estado y logs

```bash
docker compose ps
docker compose logs --tail=100 myspeed
docker compose logs -f --since=10m myspeed
```

### Entrar en el contenedor

```bash
docker compose exec myspeed sh
```

Comprobaciones no interactivas:

```bash
docker compose exec myspeed id
docker compose exec myspeed sh -c 'ls -la /myspeed/data /myspeed/bin'
docker compose exec myspeed sh -c 'wget --help >/dev/null 2>&1 || true'
```

No edites el código dentro del contenedor: los cambios se pierden al recrearlo.
El estado durable debe residir en `/myspeed/data`.

### Parar y reanudar el mismo contenedor

```bash
docker compose stop myspeed
docker compose start myspeed
```

### Reiniciar el proceso conservando el contenedor

```bash
docker compose restart myspeed
```

### Eliminar contenedor y red, conservando los datos

```bash
docker compose down
```

Al volver a ejecutar `docker compose up -d`, Compose crea un contenedor nuevo;
los datos del volumen vuelven, pero los tres CLI se descargan otra vez.

### Aplicar cambios de `.env` o Compose

```bash
docker compose up -d --force-recreate
```

La recreación es necesaria para cambios de puertos, bind, entorno o política de
reinicio. Un `restart` no vuelve a interpretar esa configuración.

### Detener y borrar también el volumen

```bash
docker compose down -v
```

> **Peligro:** `-v` elimina la base SQLite, configuración, historial,
> integraciones, certificados, servidores y logs del volumen. No lo uses para
> una parada normal. Haz y verifica una copia antes; consulta
> [Operación, persistencia y backup](07-operacion-persistencia-y-backup.md).

## 11. Varias instalaciones en el mismo host

Cada grupo necesita un nombre de proyecto y puertos de host diferentes. Ejemplo
para un segundo laboratorio:

```dotenv
COMPOSE_PROJECT_NAME=myspeed-grupo-b
MYSPEED_HTTP_PORT=5316
MYSPEED_HTTPS_PORT=5317
```

El nombre del proyecto separa contenedores, redes y volúmenes. Los puertos deben
ser únicos porque dos procesos no pueden publicar la misma combinación de IP y
puerto del host.

Comprueba siempre qué proyecto está activo:

```bash
docker compose ls
docker compose ps
docker volume ls --filter label=com.docker.compose.project=myspeed-grupo-b
```

## 12. Comprobación final del despliegue

- [ ] `docker version`, `docker compose version` y `docker info` funcionan.
- [ ] Se creó `.env` a partir de `.env.example`.
- [ ] `docker compose config` refleja los puertos y variables esperados.
- [ ] `docker compose build --pull` termina sin errores.
- [ ] `docker compose up -d` crea el servicio.
- [ ] Los logs muestran conexión a la base y escucha en el puerto HTTP.
- [ ] El estado cambia a `healthy`.
- [ ] `http://localhost:5216` funciona desde el host.
- [ ] La IP LAN funciona desde otro equipo si ese acceso es necesario.
- [ ] Se configuró la contraseña inicial.
- [ ] El firewall limita los orígenes permitidos.
- [ ] Se creó y probó una copia de seguridad.

## Siguiente lectura

- [Acceso externo y seguridad](05-acceso-externo-y-seguridad.md)
- [Operación, persistencia y copias de seguridad](07-operacion-persistencia-y-backup.md)
- [Solución de problemas](08-solucion-de-problemas.md)
