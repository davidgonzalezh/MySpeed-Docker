# Operación, persistencia y copias de seguridad

La imagen se puede reconstruir; los datos no. Este capítulo identifica el
estado persistente, presenta un procedimiento de backup y restauración para
SQLite, y separa ese procedimiento del necesario cuando se usa MySQL.

## 1. Qué persiste y qué no

[`compose.yaml`](../compose.yaml) monta un volumen nombrado:

```yaml
volumes:
  - myspeed-data:/myspeed/data
```

Dentro de `/myspeed/data` se encuentran, según el modo y el uso:

| Ruta | Contenido | Persistente |
| --- | --- | --- |
| `storage.db` | Base SQLite normal: configuración, historial, integraciones y otros registros | Sí |
| `storage_preview.db` | Base SQLite separada para `PREVIEW_MODE=true` | Sí |
| `certs/cert.pem` | Certificado del HTTPS nativo | Sí |
| `certs/key.pem` | Clave privada del HTTPS nativo | Sí; debe protegerse |
| `servers/*.json` | Listas y selecciones auxiliares de servidores | Sí |
| `logs/error.log` | Errores escritos por la aplicación | Sí |
| Otros archivos bajo `data/` | Estado creado por la versión ejecutada | Sí |

No se monta `/myspeed/bin`. Los ejecutables LibreSpeed, Ookla y Cloudflare se
guardan en la capa escribible del contenedor:

- sobreviven a `stop`, `start` y `restart` del mismo contenedor;
- se pierden cuando el contenedor se elimina o recrea;
- vuelven a descargarse antes de escuchar HTTP en el contenedor nuevo.

El código y las dependencias pertenecen a la imagen. Nunca guardes información
importante modificando el interior del contenedor.

## 2. Nombre real del volumen

Compose combina `COMPOSE_PROJECT_NAME` con el nombre lógico `myspeed-data`. Con
el `.env.example`, el nombre habitual es:

```text
myspeed-docker_myspeed-data
```

No lo supongas en scripts. Obtén el volumen que está realmente montado.

### Bash

```bash
CONTAINER_ID="$(docker compose ps -q myspeed)"
DATA_VOLUME="$(docker inspect "$CONTAINER_ID" \
  --format '{{range .Mounts}}{{if eq .Destination "/myspeed/data"}}{{.Name}}{{end}}{{end}}')"
printf '%s\n' "$DATA_VOLUME"
docker volume inspect "$DATA_VOLUME"
```

### PowerShell

```powershell
$ContainerId = docker compose ps -q myspeed
$DataVolume = docker inspect $ContainerId --format '{{range .Mounts}}{{if eq .Destination "/myspeed/data"}}{{.Name}}{{end}}{{end}}'
$DataVolume
docker volume inspect $DataVolume
```

Ejecuta estas órdenes mientras el contenedor está en ejecución. Si está parado,
usa `docker compose ps --all -q myspeed`.

Si la variable queda vacía, no continúes con una operación de backup o restore:
confirma el directorio actual, el nombre del proyecto y el estado con
`docker compose ps --all`.

## 3. Qué hace cada orden de ciclo de vida

| Orden | Contenedor | Imagen | Volumen `myspeed-data` | CLI en `/myspeed/bin` |
| --- | --- | --- | --- | --- |
| `docker compose stop` | Se conserva, parado | Se conserva | Se conserva | Se conserva |
| `docker compose start` | Se reutiliza | Se conserva | Se conserva | Se conserva |
| `docker compose restart` | Se reutiliza | Se conserva | Se conserva | Se conserva |
| `docker compose down` | Se elimina | Se conserva | Se conserva | Se elimina con el contenedor |
| `docker compose up --force-recreate` | Se reemplaza | Se conserva o actualiza | Se conserva | Se vuelve a descargar |
| `docker compose down -v` | Se elimina | Se conserva | **Se elimina** | Se elimina |

> Para una parada normal usa `stop` o `down` sin `-v`. La opción `-v` es una
> operación destructiva y no tiene deshacer si no existe una copia externa.

## 4. Backup consistente de SQLite con Docker

Copiar un archivo SQLite mientras la aplicación escribe puede producir una
instantánea inconsistente. El procedimiento seguro de clase detiene MySpeed,
archiva todo el volumen y lo vuelve a iniciar.

Se usa una imagen auxiliar `busybox:1.37`. Docker la descargará la primera vez
si no está en caché; después el proceso no requiere herramientas de backup
instaladas en el host.

### Procedimiento en Bash

1. Resuelve el volumen **antes** de detener el servicio:

   ```bash
   CONTAINER_ID="$(docker compose ps -q myspeed)"
   DATA_VOLUME="$(docker inspect "$CONTAINER_ID" \
     --format '{{range .Mounts}}{{if eq .Destination "/myspeed/data"}}{{.Name}}{{end}}{{end}}')"
   test -n "$DATA_VOLUME"
   ```

2. Prepara un directorio del host y un nombre UTC:

   ```bash
   BACKUP_DIR="$PWD/backups"
   BACKUP_FILE="myspeed-data-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
   mkdir -p "$BACKUP_DIR"
   ```

3. Detén las escrituras y crea el archivo:

   ```bash
   docker compose stop myspeed
   docker run --rm \
     --mount "type=volume,src=$DATA_VOLUME,dst=/source,readonly" \
     --mount "type=bind,src=$BACKUP_DIR,dst=/backup" \
     busybox:1.37 \
     tar -C /source -czf "/backup/$BACKUP_FILE" .
   ```

4. Verifica que el archivo existe y que el tar se puede listar:

   ```bash
   ls -lh "$BACKUP_DIR/$BACKUP_FILE"
   docker run --rm \
     --mount "type=bind,src=$BACKUP_DIR,dst=/backup,readonly" \
     busybox:1.37 \
     tar -tzf "/backup/$BACKUP_FILE"
   ```

5. Inicia MySpeed y comprueba salud:

   ```bash
   docker compose start myspeed
   docker compose ps
   docker compose logs --tail=50 myspeed
   ```

Si cualquier paso del backup falla después de `stop`, conserva el mensaje de
error y ejecuta `docker compose start myspeed`; no borres el volumen.

### Procedimiento equivalente en PowerShell

```powershell
$ContainerId = docker compose ps -q myspeed
$DataVolume = docker inspect $ContainerId --format '{{range .Mounts}}{{if eq .Destination "/myspeed/data"}}{{.Name}}{{end}}{{end}}'
if ([string]::IsNullOrWhiteSpace($DataVolume)) { throw 'No se encontró el volumen de datos' }

$BackupDir = Join-Path (Get-Location) 'backups'
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$BackupFile = 'myspeed-data-{0}.tar.gz' -f (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')

docker compose stop myspeed
docker run --rm --mount "type=volume,src=$DataVolume,dst=/source,readonly" --mount "type=bind,src=$BackupDir,dst=/backup" busybox:1.37 tar -C /source -czf "/backup/$BackupFile" .
docker run --rm --mount "type=bind,src=$BackupDir,dst=/backup,readonly" busybox:1.37 tar -tzf "/backup/$BackupFile"
docker compose start myspeed
docker compose ps
```

El directorio `backups/` está ignorado por Git. Muévelo o cópialo a un destino
externo; una copia que solo vive en el mismo disco no protege contra la pérdida
del host.

## 5. Verificación e inventario de copias

Una política útil debe indicar frecuencia, retención, cifrado, responsable y
prueba de restauración. Como mínimo registra:

- fecha y hora UTC;
- versión o commit de la aplicación;
- `COMPOSE_PROJECT_NAME`;
- modo de base de datos (`sqlite` o `mysql`);
- tamaño del archivo;
- suma SHA-256;
- ubicación de la copia;
- resultado de una restauración de prueba.

En Linux:

```bash
sha256sum "backups/NOMBRE_DEL_BACKUP.tar.gz"
```

En PowerShell:

```powershell
Get-FileHash .\backups\NOMBRE_DEL_BACKUP.tar.gz -Algorithm SHA256
```

La copia puede contener historial, configuración de integraciones y la clave
privada TLS. Trátala como información sensible: limita permisos, cifra el
almacenamiento y no la subas al repositorio.

## 6. Restaurar una copia SQLite

Una restauración reemplaza el estado actual. Haz primero una copia de seguridad
del volumen actual, incluso si se sospecha que está dañado.

### Preparación

1. Coloca el archivo en `./backups`.
2. Verifica su suma y lista su contenido sin extraerlo.
3. Comprueba que corresponde a una versión compatible de MySpeed.
4. Asegúrate de que existe el contenedor; si no, créalo sin iniciarlo:

   ```bash
   docker compose create myspeed
   ```

5. Resuelve el volumen:

   ```bash
   CONTAINER_ID="$(docker compose ps --all -q myspeed)"
   DATA_VOLUME="$(docker inspect "$CONTAINER_ID" \
     --format '{{range .Mounts}}{{if eq .Destination "/myspeed/data"}}{{.Name}}{{end}}{{end}}')"
   test -n "$DATA_VOLUME"
   ```

### Restauración en Bash

Define el nombre exacto, valida y detén el servicio:

```bash
BACKUP_DIR="$PWD/backups"
BACKUP_FILE="myspeed-data-AAAAMMDDTHHMMSSZ.tar.gz"

docker run --rm \
  --mount "type=bind,src=$BACKUP_DIR,dst=/backup,readonly" \
  busybox:1.37 \
  tar -tzf "/backup/$BACKUP_FILE"

docker compose stop myspeed
```

El siguiente comando **vacía únicamente el volumen resuelto** y extrae la
copia. Revisa visualmente `DATA_VOLUME` y `BACKUP_FILE` antes de ejecutarlo:

```bash
printf 'Volumen a reemplazar: %s\nCopia: %s\n' "$DATA_VOLUME" "$BACKUP_FILE"

docker run --rm \
  --env "BACKUP_FILE=$BACKUP_FILE" \
  --mount "type=volume,src=$DATA_VOLUME,dst=/target" \
  --mount "type=bind,src=$BACKUP_DIR,dst=/backup,readonly" \
  busybox:1.37 \
  sh -c 'find /target -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && tar -C /target -xzf "/backup/$BACKUP_FILE"'
```

Restaura la propiedad para el usuario `bun` usando la misma imagen de la
aplicación:

```bash
APP_IMAGE="$(docker compose images -q myspeed | head -n 1)"
docker run --rm --user root \
  --mount "type=volume,src=$DATA_VOLUME,dst=/myspeed/data" \
  --entrypoint sh \
  "$APP_IMAGE" \
  -c 'chown -R bun:bun /myspeed/data'
```

Finalmente:

```bash
docker compose start myspeed
docker compose logs --tail=150 myspeed
docker compose ps
```

Comprueba en la interfaz configuración, historial y una prueba conocida. No
consideres válido un backup hasta haber completado una restauración de prueba.

### Restauración en PowerShell

Después de calcular `$DataVolume` como en la sección anterior:

```powershell
$BackupDir = Join-Path (Get-Location) 'backups'
$BackupFile = 'myspeed-data-AAAAMMDDTHHMMSSZ.tar.gz'

docker run --rm --mount "type=bind,src=$BackupDir,dst=/backup,readonly" busybox:1.37 tar -tzf "/backup/$BackupFile"
docker compose stop myspeed

Write-Host "Volumen a reemplazar: $DataVolume"
Write-Host "Copia: $BackupFile"
docker run --rm --env "BACKUP_FILE=$BackupFile" --mount "type=volume,src=$DataVolume,dst=/target" --mount "type=bind,src=$BackupDir,dst=/backup,readonly" busybox:1.37 sh -c 'find /target -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && tar -C /target -xzf "/backup/$BACKUP_FILE"'

$AppImage = (docker compose images -q myspeed | Select-Object -First 1)
docker run --rm --user root --mount "type=volume,src=$DataVolume,dst=/myspeed/data" --entrypoint sh $AppImage -c 'chown -R bun:bun /myspeed/data'

docker compose start myspeed
docker compose logs --tail=150 myspeed
docker compose ps
```

Si la restauración falla, no improvises borrando volúmenes. Conserva tanto el
backup como el estado previo y revisa el error por capas.

## 7. Actualizar la aplicación

Una actualización segura es una transacción operativa: inventario, backup,
imagen nueva, verificación y una ruta de vuelta.

### Antes de actualizar

```bash
git status --short
git rev-parse HEAD
docker compose ps
docker compose images
```

No ejecutes `git pull` sobre cambios locales sin revisar. Crea y verifica un
backup como en la sección anterior.

Conserva además la imagen actual bajo otro tag:

```bash
CURRENT_IMAGE="$(docker compose images -q myspeed | head -n 1)"
ROLLBACK_TAG="myspeed:rollback-$(date -u +%Y%m%dT%H%M%SZ)"
docker image tag "$CURRENT_IMAGE" "$ROLLBACK_TAG"
printf '%s\n' "$ROLLBACK_TAG"
```

### Construir y desplegar la nueva versión

```bash
git pull --ff-only
docker compose build --pull
docker compose up -d
docker compose ps
docker compose logs --tail=150 myspeed
```

MySpeed ejecuta migraciones al arrancar. Espera a `healthy` y valida historial,
configuración, proveedor y una prueba. El contenedor nuevo descargará de nuevo
los tres CLI porque `/myspeed/bin` no es persistente.

### Rollback

Un rollback de imagen no garantiza compatibilidad con una base que ya recibió
migraciones nuevas. La pareja recuperable es:

```text
imagen anterior + backup de datos anterior a la actualización
```

Procedimiento conceptual:

1. Detén MySpeed.
2. Restaura el backup anterior mediante el procedimiento controlado.
3. Ejecuta la imagen guardada sin reconstruir.

En Bash, después de restaurar los datos:

```bash
MYSPEED_IMAGE="$ROLLBACK_TAG" \
  docker compose up -d --no-build --force-recreate
```

En PowerShell:

```powershell
$env:MYSPEED_IMAGE = 'myspeed:rollback-AAAAMMDDTHHMMSSZ'
docker compose up -d --no-build --force-recreate
Remove-Item Env:\MYSPEED_IMAGE
```

Confirma en `docker compose images` que se ejecuta el identificador esperado.
No borres la imagen anterior ni el backup hasta cerrar la ventana de validación.

## 8. Particularidades de MySQL

Si `.env` contiene `DB_TYPE=mysql`, la base de datos **no** está en
`myspeed-data`. El volumen continúa almacenando certificados, logs y listas de
servidores, pero las tablas viven en el servidor indicado por `DB_HOST`.

Implicaciones:

- el tar del volumen no respalda las tablas MySQL;
- se necesita un backup nativo, normalmente `mysqldump` o la herramienta
  gestionada del proveedor;
- para una instantánea coherente, detén MySpeed o coordina el modo transaccional
  con el administrador de base de datos;
- cifra y protege el dump;
- restaura primero la base compatible y después inicia la imagen elegida;
- prueba las credenciales desde la red Docker, no solo desde el host.

La aplicación exige `DB_NAME`, `DB_USER` y `DB_PASS`. `DB_HOST` vacío utiliza
`localhost`, que dentro del contenedor significa **el propio contenedor**, no el
host Docker. Esta versión no expone `DB_PORT`; el controlador usa el puerto
MySQL predeterminado `3306`.

Este Compose no crea un servicio MySQL. Si se añade uno, debe tener su propio
volumen, healthcheck, política de backup y credenciales; no reutilices
`myspeed-data` como si fuera el almacenamiento de MySQL.

## 9. Particularidades de `PREVIEW_MODE`

Con `PREVIEW_MODE=true`:

- se usa `data/storage_preview.db` en vez de `data/storage.db`;
- no se descargan los tres CLI;
- varias operaciones de escritura están restringidas;
- el middleware omite la comprobación de contraseña.

No es un modo seguro de solo lectura ni una configuración productiva. Está
destinado a demostraciones controladas. Al volver a `false`, MySpeed abre
`storage.db`; si los datos parecen desaparecer, comprueba ambos archivos antes
de asumir pérdida. El backup completo del volumen conserva los dos.

## 10. Mantenimiento periódico

### Diario o según criticidad

- revisa `docker compose ps`;
- inspecciona errores recientes con `docker compose logs --since=24h myspeed`;
- confirma espacio disponible en el host;
- verifica que las pruebas programadas se ejecutan en la zona horaria correcta.

### Antes de cada cambio

- registra commit e imagen;
- crea un backup consistente;
- comprueba su contenido y hash;
- define criterios de éxito y rollback.

### Periódicamente

- realiza una restauración de prueba en un proyecto Compose aislado y con otros
  puertos;
- renueva certificados antes de vencer;
- elimina copias antiguas según una política, nunca de forma improvisada;
- revisa usuarios, contraseña, firewall y exposición externa;
- actualiza imágenes y dependencias en una ventana controlada.

## 11. Errores que deben evitarse

- Usar `docker compose down -v` como orden habitual de parada.
- Copiar `storage.db` mientras se está escribiendo.
- Suponer que el volumen respalda MySQL.
- Guardar la única copia en el mismo disco del servidor.
- Subir backups, `.env` o claves privadas a Git.
- Cambiar `COMPOSE_PROJECT_NAME` y creer que el volumen anterior desapareció.
- Restaurar sin conservar antes el estado actual.
- Volver a una imagen antigua sobre una base migrada sin evaluar compatibilidad.
- Confundir la descarga nueva de CLI con pérdida del volumen.
- Considerar una copia válida sin haber probado la restauración.

## Siguiente lectura

- [Instalación y despliegue](06-instalacion-y-despliegue.md)
- [Acceso externo y seguridad](05-acceso-externo-y-seguridad.md)
- [Solución de problemas](08-solucion-de-problemas.md)
