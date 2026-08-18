# Solución de problemas por capas

El diagnóstico más rápido empieza dentro y avanza hacia fuera. Si se prueba todo
a la vez, un fallo de firewall puede confundirse con un fallo de aplicación o
una descarga lenta con un contenedor bloqueado.

```text
1. Archivos y Compose
2. Build e imagen
3. Proceso y logs
4. Healthcheck dentro del contenedor
5. Puerto publicado en el host
6. Acceso local
7. LAN, firewall, NAT o security group
8. DNS, reverse proxy y TLS
9. Proveedores de velocidad y base de datos
```

No uses `docker compose down -v`, no borres `storage.db` y no elimines volúmenes
como intento de reparación. Esas acciones destruyen evidencia y datos.

## 1. Recoger el estado mínimo

Ejecuta desde la carpeta que contiene [`compose.yaml`](../compose.yaml):

```bash
docker version
docker compose version
docker compose config --services
docker compose config --images
docker compose ps --all
docker compose images
docker compose logs --tail=250 myspeed
```

Para ver la configuración efectiva:

```bash
docker compose config
```

Revisa su salida localmente, pero no la publiques sin censurar: si se usa MySQL,
puede incluir `DB_PASS` ya sustituido.

Registra también:

```bash
git rev-parse HEAD
git status --short
```

En una solicitud de ayuda indica sistema operativo, arquitectura, Docker,
Compose, commit, modo de base de datos, estado del contenedor y el error exacto.
Oculta contraseñas, tokens, direcciones sensibles y claves.

## 2. Compose no encuentra el archivo o ignora `.env`

### Síntomas

- `no configuration file provided`;
- aparecen puertos o nombres inesperados;
- se crea otro volumen aparentemente vacío;
- Compose avisa de variables no definidas.

### Comprobaciones

```bash
pwd
ls -la compose.yaml .env .env.example
docker compose config
docker compose ls
```

En PowerShell:

```powershell
Get-Location
Get-ChildItem -Force compose.yaml,.env,.env.example
docker compose config
docker compose ls
```

`.env` debe estar junto a `compose.yaml`. Un nombre como `.env.txt` no sirve.
En Windows, activa la visualización de extensiones para comprobarlo.

Si cambiaste `COMPOSE_PROJECT_NAME`, Compose creó deliberadamente otro conjunto
de contenedor, red y volumen. Localiza los anteriores sin borrarlos:

```bash
docker volume ls --filter label=com.docker.compose.volume=myspeed-data
docker ps -a --filter label=com.docker.compose.service=myspeed
```

## 3. El build falla

### Confirmar el error real

```bash
docker compose build --pull --progress=plain
```

Las causas frecuentes son:

- Docker daemon detenido;
- falta de espacio;
- DNS o salida HTTPS bloqueados;
- límites de descarga del registro;
- proxy corporativo no configurado para Docker;
- certificado de inspección TLS no confiable dentro del daemon/build;
- lockfile incoherente con `package.json`;
- arquitectura no soportada por una dependencia nativa.

Comprueba espacio e inventario:

```bash
docker system df
docker buildx ls
```

No ejecutes una limpieza global automáticamente en un host compartido. Primero
identifica qué imágenes, cachés y volúmenes pertenecen a otros proyectos.

Si sospechas de la caché y ya conservaste el log del primer fallo:

```bash
docker compose build --no-cache --pull --progress=plain
```

El Dockerfile usa `bun install --frozen-lockfile`; modificar un manifiesto sin
actualizar su lockfile debe fallar, porque esa protección hace el build
repetible. La solución es corregir y versionar el lockfile con la versión de Bun
indicada, no quitar `--frozen-lockfile` sin análisis.

## 4. El contenedor sale o se reinicia

```bash
docker compose ps --all
docker compose logs --tail=300 myspeed
CONTAINER_ID="$(docker compose ps --all -q myspeed)"
docker inspect --format '{{json .State}}' "$CONTAINER_ID"
```

En PowerShell:

```powershell
$ContainerId = docker compose ps --all -q myspeed
docker inspect --format '{{json .State}}' $ContainerId
```

Busca el primer error, no solo las consecuencias repetidas. Ejemplos:

- error al conectar o abrir la base;
- variables MySQL ausentes;
- descarga de un CLI fallida;
- plataforma no soportada;
- permiso denegado en `/myspeed/data` o `/myspeed/bin`;
- puerto interno inválido tras una modificación no documentada.

La política `unless-stopped` puede crear un ciclo de reinicios que repite el
mensaje. Para investigarlo sin borrar nada:

```bash
docker compose stop myspeed
docker compose logs --tail=300 myspeed
```

Corrige la causa y después ejecuta `docker compose up -d`.

## 5. Estado `starting` durante mucho tiempo

En un contenedor nuevo, MySpeed descarga LibreSpeed, Ookla y Cloudflare antes de
empezar a escuchar HTTP. El healthcheck tiene `start-period: 120s`, así que
`starting` es normal inicialmente.

Sigue el progreso:

```bash
docker compose logs -f myspeed
```

En otra terminal:

```bash
docker compose exec myspeed sh -c 'ls -la /myspeed/bin'
```

Si se recreó el contenedor, `/myspeed/bin` empieza vacío aunque
`/myspeed/data` siga intacto. Un `restart` conserva los binarios; `down` seguido
de `up`, `--force-recreate` y las actualizaciones crean un contenedor nuevo.

Prueba resolución y HTTPS desde el mismo entorno del contenedor:

```bash
docker compose exec myspeed bun -e "fetch('https://github.com').then(r=>console.log(r.status)).catch(e=>{console.error(e);process.exit(1)})"
docker compose exec myspeed bun -e "fetch('https://install.speedtest.net').then(r=>console.log(r.status)).catch(e=>{console.error(e);process.exit(1)})"
```

Un código HTTP demuestra conectividad aunque no sea `200`. Un error de DNS,
certificado, timeout o conexión orienta hacia proxy, firewall de salida o
inspección TLS.

Las variables de proxy escritas solo en `.env` no entran automáticamente al
contenedor: `compose.yaml` transmite únicamente las claves declaradas en
`environment`. Un entorno corporativo que exige proxy necesita una adaptación
explícita tanto para el build como para el runtime.

`PREVIEW_MODE=true` omite las descargas, pero también cambia la base, restringe
escrituras y desactiva la comprobación de contraseña. No lo uses para ocultar un
problema de red en producción.

## 6. Estado `unhealthy`

Obtén el historial del healthcheck:

```bash
CONTAINER_ID="$(docker compose ps -q myspeed)"
docker inspect --format '{{json .State.Health}}' "$CONTAINER_ID"
```

Ejecuta manualmente una petición interna usando Bun, que sí forma parte de la
imagen:

```bash
docker compose exec myspeed bun -e "fetch('http://127.0.0.1:5216/').then(r=>{console.log(r.status);process.exit(r.ok?0:1)}).catch(e=>{console.error(e);process.exit(1)})"
```

Si esta petición falla, el problema está antes de la publicación del host:
revisa proceso, logs, base de datos y descargas. Si funciona pero el healthcheck
no, compara las variables internas:

```bash
docker compose exec myspeed sh -c 'printf "SERVER_PORT=%s HTTPS_PORT=%s\n" "$SERVER_PORT" "$HTTPS_PORT"'
```

El healthcheck solo prueba HTTP interno en `5216`. Un estado `healthy` no prueba
el puerto del host, el firewall, HTTPS en `5217`, DNS ni el reverse proxy.

## 7. Conflicto de puerto

### Síntomas

- `address already in use`;
- `port is already allocated`;
- Compose no puede crear el endpoint.

### Confirmar la publicación

```bash
docker compose port myspeed 5216
docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

En Linux:

```bash
sudo ss -lntp | grep ':5216'
```

En PowerShell como administrador:

```powershell
Get-NetTCPConnection -LocalPort 5216 -ErrorAction SilentlyContinue
```

No detengas un proceso desconocido. Cambia el puerto del **host** en `.env`:

```dotenv
MYSPEED_HTTP_PORT=5316
MYSPEED_HTTPS_PORT=5317
```

Aplica la nueva publicación recreando:

```bash
docker compose up -d --force-recreate
```

La URL pasa a `http://IP_DEL_HOST:5316`; el puerto interno permanece en `5216`.

## 8. Funciona dentro del contenedor, pero no en el host

Comprueba en este orden:

```bash
docker compose exec myspeed bun -e "fetch('http://127.0.0.1:5216/').then(r=>console.log(r.status)).catch(e=>{console.error(e);process.exit(1)})"
docker compose port myspeed 5216
curl -I http://127.0.0.1:5216
```

En PowerShell, la última prueba es:

```powershell
Invoke-WebRequest http://127.0.0.1:5216 -Method Head
```

Si la prueba interna funciona y no existe publicación, revisa
`docker compose config`. Si se modificó `.env`, un `restart` no actualiza
puertos: usa `docker compose up -d --force-recreate`.

Si la publicación existe pero la petición local falla, revisa el firewall del
host, software de seguridad y el backend de red de Docker Desktop. Reiniciar
Docker Desktop puede recuperar un daemon bloqueado, pero conserva antes logs y
estado para no ocultar la causa.

## 9. Funciona en `localhost`, pero no desde la LAN

`localhost` en el navegador de otro equipo significa **ese otro equipo**, no el
servidor Docker. Usa `http://IP_LAN_DEL_SERVIDOR:5216`.

Lista de comprobación:

1. En `.env`, `MYSPEED_BIND_IP` es `0.0.0.0` o una IP real del servidor, no
   `127.0.0.1`.
2. Se recreó el contenedor después del cambio.
3. `docker compose ps` muestra `0.0.0.0:5216->5216/tcp`.
4. Se eligió la IP de Ethernet/Wi-Fi del host, no `docker0`, loopback ni una IP
   antigua.
5. Cliente y servidor tienen ruta entre sí.
6. El firewall permite TCP `5216` desde la subred autorizada.
7. El punto de acceso no usa aislamiento entre clientes.
8. Una VPN del cliente o servidor no bloquea la red local.

Desde otro equipo:

```bash
curl -v http://IP_LAN_DEL_SERVIDOR:5216/
```

Interpretación básica:

- `Connection refused`: se llegó al host, pero no hay escucha permitida en ese
  puerto o una regla rechaza explícitamente.
- Timeout: suele indicar firewall que descarta, ruta incorrecta o aislamiento.
- Respuesta `401`: la red funciona y MySpeed está exigiendo autenticación.
- Respuesta HTML/`200`: la ruta básica funciona; investiga navegador, proxy o
  contenido específico.

Consulta [Acceso externo y seguridad](05-acceso-externo-y-seguridad.md) para
reglas de firewall limitadas por subred.

## 10. No funciona desde Internet

Que la LAN funcione no configura Internet. Revisa cada capa:

- ¿el proveedor entrega una IP pública o usa CGNAT?;
- ¿el router reenvía el puerto correcto al host correcto?;
- ¿la VM cloud tiene una regla de entrada/security group?;
- ¿el firewall del sistema permite el origen?;
- ¿el DNS resuelve la IP pública actual?;
- ¿el reverse proxy apunta al backend correcto?;
- ¿el proveedor bloquea puertos entrantes?;
- ¿se está probando realmente desde una red externa y no por una ruta NAT no
  compatible con hairpin?

No abras `5216` a todo Internet como prueba permanente. Prefiere VPN o reverse
proxy en `443` con TLS y control de acceso, y cierra el camino directo al
backend cuando termine la prueba.

Si el DNS solo publica un registro IPv6 (`AAAA`), recuerda que este Compose
publica explícitamente en una dirección IPv4. Usa un registro `A`/IPv4 o diseña
de forma intencional la publicación IPv6 y su firewall.

## 11. HTTPS en `5217` no responde

El puerto se publica siempre, pero el proceso HTTPS solo se crea al arrancar si
existen ambos archivos:

```text
/myspeed/data/certs/cert.pem
/myspeed/data/certs/key.pem
```

Comprueba:

```bash
docker compose exec myspeed sh -c 'ls -l /myspeed/data/certs/cert.pem /myspeed/data/certs/key.pem'
docker compose logs --tail=150 myspeed
curl -vk https://127.0.0.1:5217/
```

Casos comunes:

- falta uno de los archivos;
- el usuario `bun` no puede leer la clave;
- el certificado o la clave están dañados o no corresponden entre sí;
- se copiaron después del arranque y no se reinició el servicio;
- se abre `https://...:5216` en vez de `https://...:5217`;
- el certificado no incluye el nombre DNS utilizado;
- el firewall permite `5216` pero no `5217`.

Instala permisos y reinicia como se explica en
[HTTPS nativo](05-acceso-externo-y-seguridad.md#8-https-nativo-en-el-puerto-5217).

`curl -k` ignora la validación y solo sirve para un laboratorio. No convierte
un certificado inválido en una solución productiva.

## 12. El reverse proxy devuelve 502 o 504

Prueba primero el backend desde el lugar donde se ejecuta el proxy.

- Si el proxy corre en el host, puede usar `http://127.0.0.1:5216` cuando
  MySpeed está ligado a loopback.
- Si el proxy corre en otro contenedor, `127.0.0.1` apunta al proxy, no a
  MySpeed. Ambos necesitan una red común y el upstream debe usar el nombre del
  servicio y puerto interno, por ejemplo `http://myspeed:5216` dentro de esa red.
- Si el proxy corre en otra máquina, MySpeed debe escuchar en una interfaz
  alcanzable y el firewall debe permitir solo la IP del proxy.

Un `504` suele indicar timeout o falta de ruta. Un `502` suele indicar conexión
rechazada o respuesta inválida del upstream. Verifica además cabeceras,
protocolos (`http` frente a `https`) y certificados del upstream.

## 13. SQLite no abre o aparece vacío

Primero conserva evidencia:

```bash
docker compose stop myspeed
docker compose ps --all
docker volume ls --filter label=com.docker.compose.volume=myspeed-data
```

No borres la base. Comprueba volumen y permisos:

```bash
docker compose start myspeed
docker compose exec myspeed id
docker compose exec myspeed sh -c 'ls -lan /myspeed/data; test -w /myspeed/data && echo escribible'
docker compose logs --tail=200 myspeed
```

Si el servicio no permanece activo para usar `exec`, inspecciona el volumen con
un contenedor auxiliar en modo solo lectura:

```bash
CONTAINER_ID="$(docker compose ps --all -q myspeed)"
DATA_VOLUME="$(docker inspect "$CONTAINER_ID" \
  --format '{{range .Mounts}}{{if eq .Destination "/myspeed/data"}}{{.Name}}{{end}}{{end}}')"
docker run --rm \
  --mount "type=volume,src=$DATA_VOLUME,dst=/data,readonly" \
  busybox:1.37 \
  ls -lan /data
```

Un estado aparentemente nuevo suele deberse a:

- cambio de `COMPOSE_PROJECT_NAME`, que seleccionó otro volumen;
- ejecución desde otro directorio/proyecto Compose;
- uso de `PREVIEW_MODE=true`, que abre `storage_preview.db`;
- un `down -v` anterior;
- restauración en el volumen equivocado.

Si los logs indican corrupción, crea primero un backup del volumen detenido.
Restaura una copia verificada según
[Operación, persistencia y backup](07-operacion-persistencia-y-backup.md). No
intentes reparar el único ejemplar sin una copia forense.

## 14. MySQL no conecta

Confirma únicamente la presencia de valores, sin imprimir la contraseña:

```bash
docker compose exec myspeed sh -c 'printf "DB_TYPE=%s DB_HOST=%s DB_NAME=%s DB_USER=%s DB_PASS_SET=" "$DB_TYPE" "$DB_HOST" "$DB_NAME" "$DB_USER"; test -n "$DB_PASS" && echo yes || echo no'
```

Puntos críticos:

- `DB_NAME`, `DB_USER` y `DB_PASS` son obligatorios.
- `DB_HOST` vacío usa `localhost`; dentro del contenedor, `localhost` es el
  propio contenedor.
- El Compose de esta edición no crea MySQL.
- No existe variable `DB_PORT`; se usa el puerto predeterminado `3306`.
- El nombre DNS del servidor debe resolverse desde la red Docker.
- MySQL debe escuchar en una interfaz accesible y permitir el origen/red del
  contenedor.
- El usuario necesita permisos sobre la base indicada.
- TLS o políticas del servidor pueden requerir una configuración adicional no
  incluida en este Compose.

Revisa el error exacto de Sequelize/MySQL en los logs. `Access denied` apunta a
credenciales o privilegios; `ECONNREFUSED` a host/puerto/escucha; un timeout a
ruta o firewall; `ENOTFOUND` a DNS.

El volumen `myspeed-data` no contiene las tablas MySQL. Restaurarlo no arregla
una base MySQL perdida; usa la copia nativa administrada por MySQL.

## 15. Confusión con `PREVIEW_MODE`

`PREVIEW_MODE=true` tiene tres efectos que pueden parecer averías:

- abre `storage_preview.db`, por lo que no aparece el historial de
  `storage.db`;
- no descarga ni ejecuta los CLI normales;
- omite contraseña y bloquea varias escrituras.

Comprueba el valor efectivo:

```bash
docker compose exec myspeed sh -c 'printf "%s\n" "$PREVIEW_MODE"'
```

Después de cambiar `.env`, recrea:

```bash
docker compose up -d --force-recreate
```

No uses preview en un servicio expuesto. No es una capa de seguridad.

## 16. La contraseña no funciona o aparece un `401`

Un `401` demuestra que la petición alcanzó MySpeed. Distingue un problema de
credenciales de uno de red.

- Comprueba mayúsculas, espacios y gestor de contraseñas.
- Prueba en una ventana privada para descartar estado antiguo del navegador.
- Si existe reverse proxy, confirma que no elimina las cabeceras de
  autenticación utilizadas por la aplicación.
- No configures `PREVIEW_MODE=true` para saltar la contraseña.
- No edites hashes directamente en SQLite.

La contraseña se almacena como hash en la base. Si se perdió, conserva una copia
del volumen y utiliza un procedimiento de recuperación soportado por la versión
de MySpeed o restaura un backup conocido. Borrar el volumen reinicia todo el
estado, no solo la contraseña.

## 17. Pruebas programadas a una hora incorrecta

Comprueba la zona horaria efectiva:

```bash
docker compose exec myspeed sh -c 'printf "TZ=%s\n" "$TZ"; date'
```

Usa un identificador IANA válido en `.env`, recrea el contenedor y revisa el
cron configurado desde MySpeed. `RUN_TEST_ON_STARTUP=true` ejecuta una prueba en
cada arranque del proceso; puede confundir el análisis si la política de
reinicio está actuando.

## 18. Matriz rápida de síntomas

| Síntoma | Primera comprobación | Causa probable |
| --- | --- | --- |
| Build no conecta | `docker compose build --progress=plain` | DNS, proxy, registro o daemon |
| Contenedor reinicia | `docker compose logs --tail=300` | BD, permisos, variables o descarga |
| `starting` inicialmente | logs y `/myspeed/bin` | Descarga normal de tres CLI |
| `unhealthy` | petición Bun a `127.0.0.1:5216` | Aplicación interna no responde |
| Puerto ocupado | `docker compose port` y `ss`/PowerShell | Otro proceso usa el puerto del host |
| Local funciona, LAN no | bind y firewall | `127.0.0.1`, regla o ruta LAN |
| LAN funciona, Internet no | NAT/security group/DNS | Falta una capa externa |
| HTTP funciona, HTTPS no | archivos en `data/certs` | Certificado/clave ausente o ilegible |
| Proxy da 502 | upstream desde el proxy | `localhost` equivocado o red Docker |
| Datos parecen nuevos | proyecto, volumen, preview | Otro volumen o otra base SQLite |
| MySQL rechaza | logs + `DB_HOST` | Credenciales, `localhost`, permisos o red |
| Tras recrear tarda otra vez | `/myspeed/bin` efímero | Redescarga prevista de CLI |

## 19. Evidencia segura para pedir ayuda

Incluye:

- descripción de lo esperado y lo observado;
- comandos exactos ejecutados;
- sistema operativo y arquitectura;
- salida de `docker version` y `docker compose version`;
- commit (`git rev-parse HEAD`);
- `docker compose ps --all`;
- últimas líneas de logs desde el primer error;
- si falla desde host, LAN o Internet;
- si se usa SQLite, MySQL o preview;
- cambios realizados en Dockerfile/Compose.

No incluyas:

- `.env` completo;
- `DB_PASS`;
- backups o bases de datos;
- `key.pem`;
- tokens de integraciones;
- salida de `docker compose config` sin censurar.

## 20. Orden de recuperación recomendado

1. Detén los cambios y conserva logs.
2. Identifica proyecto, contenedor, imagen y volumen exactos.
3. Si hay riesgo para datos, detén MySpeed y crea un backup.
4. Reproduce la prueba en la capa más interna que pueda fallar.
5. Avanza una capa cada vez hasta encontrar la primera diferencia.
6. Aplica el cambio mínimo y reversible.
7. Recrea solo si la configuración lo exige.
8. Valida salud, acceso, historial, contraseña y una prueba funcional.
9. Documenta causa y solución para la clase.

## Lecturas relacionadas

- [Instalación y despliegue](06-instalacion-y-despliegue.md)
- [Acceso externo y seguridad](05-acceso-externo-y-seguridad.md)
- [Operación, persistencia y copias de seguridad](07-operacion-persistencia-y-backup.md)
