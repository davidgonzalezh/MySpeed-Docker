# Referencia de comandos

Todos los comandos se ejecutan desde la raíz de `MySpeed-Docker`, salvo que se
indique lo contrario. Se usa `docker compose` —Compose v2— y no el ejecutable
antiguo `docker-compose`.

## Requisitos y clonación

```bash
git --version
docker version
docker compose version

git clone https://github.com/davidgonzalezh/MySpeed-Docker.git
cd MySpeed-Docker
```

Con SSH configurado en GitHub:

```bash
git clone git@github.com:davidgonzalezh/MySpeed-Docker.git
```

## Crear `.env`

Linux, macOS o Git Bash:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Valores de red principales:

```dotenv
# Todas las interfaces IPv4; permite acceso remoto si la red lo admite.
MYSPEED_BIND_IP=0.0.0.0
MYSPEED_HTTP_PORT=5216

# Solo el propio host.
# MYSPEED_BIND_IP=127.0.0.1
```

## Validar Compose

```bash
docker compose config
docker compose config --services
docker compose config --images
docker compose config --volumes
```

`docker compose config` interpola `.env` y puede mostrar `DB_PASS`. Revisa la
salida antes de compartirla.

## Construir e iniciar

```bash
# Construir e iniciar en segundo plano
docker compose up -d --build

# Solo construir
docker compose build

# Descargar bases nuevas y reconstruir desde cero
docker compose build --pull --no-cache
docker compose up -d
```

El build inicial necesita Internet. Cada contenedor nuevo también descarga los
CLI de LibreSpeed, Ookla y Cloudflare; espera a que alcance el estado
`healthy`.

## Estado y registros

```bash
docker compose ps
docker compose ps -a
docker compose logs --tail=200 myspeed
docker compose logs -f --tail=100 myspeed
```

`Ctrl+C` deja de seguir los logs, pero no detiene el contenedor iniciado con
`-d`.

Obtener solo el ID del contenedor:

```bash
docker compose ps -q myspeed
```

Inspeccionar la salud en Bash:

```bash
MYSPEED_CONTAINER_ID=$(docker compose ps -q myspeed)
docker inspect --format '{{.State.Health.Status}}' "$MYSPEED_CONTAINER_ID"
```

## Acceso

```text
Mismo servidor:  http://localhost:5216
Otro equipo:     http://IP_DEL_SERVIDOR:5216
```

Si cambias `MYSPEED_HTTP_PORT`, sustituye `5216` por el puerto del host. El
puerto interno permanece en 5216.

El puerto 5217 solo responde si hay certificados válidos en:

```text
/myspeed/data/certs/cert.pem
/myspeed/data/certs/key.pem
```

Consulta [Acceso externo y seguridad](05-acceso-externo-y-seguridad.md) antes de
abrir reglas de firewall o NAT.

## Detener, iniciar y recrear

```bash
# Conserva el mismo contenedor y su capa escribible
docker compose stop
docker compose start

# Reinicia el proceso en el mismo contenedor
docker compose restart myspeed

# Aplica cambios de compose.yaml o .env y recrea si hace falta
docker compose up -d

# Fuerza un contenedor nuevo; vuelve a descargar los CLI
docker compose up -d --force-recreate

# Elimina contenedor y red, pero conserva el volumen
docker compose down
```

`docker compose restart` no aplica cambios de `.env` o `compose.yaml`. Usa
`docker compose up -d`.

### Borrado total

```text
docker compose down -v
```

**No copies ese comando sin entenderlo.** Elimina también el volumen con la
base SQLite, configuración, resultados, logs y certificados. Solo corresponde
a un reinicio total deliberado y después de verificar el backup.

## Ejecutar diagnósticos dentro del contenedor

```bash
docker compose exec myspeed id
docker compose exec myspeed pwd
docker compose exec myspeed ls -la /myspeed/data
docker compose exec myspeed ls -la /myspeed/bin
docker compose exec myspeed sh
```

Comprobar HTTP desde el propio contenedor, sin requerir `curl` en el host:

```bash
docker compose exec myspeed sh -c \
  'bun -e "fetch(\"http://127.0.0.1:5216/\").then(r=>console.log(r.status)).catch(e=>{console.error(e);process.exit(1)})"'
```

## Imágenes

```bash
docker image ls myspeed
docker image inspect myspeed:local
docker history myspeed:local
```

Etiquetas OCI principales:

```bash
docker image inspect myspeed:local \
  --format '{{index .Config.Labels "org.opencontainers.image.source"}}'
docker image inspect myspeed:local \
  --format '{{index .Config.Labels "org.opencontainers.image.version"}}'
```

Comprobar usuario y puertos declarados:

```bash
docker image inspect myspeed:local \
  --format 'Usuario={{.Config.User}} Puertos={{json .Config.ExposedPorts}}'
```

## Volúmenes y persistencia

```bash
docker compose config --volumes
docker volume ls --filter label=com.docker.compose.project=myspeed-docker
docker volume inspect myspeed-docker_myspeed-data
```

Con `COMPOSE_PROJECT_NAME=myspeed-docker`, el volumen efectivo suele llamarse
`myspeed-docker_myspeed-data`. Confirma siempre el nombre con `docker volume
ls`; si cambias el proyecto, cambia también el prefijo.

Marca de prueba no destructiva:

```bash
docker compose exec myspeed sh -c \
  'printf "persistencia-ok\n" > /myspeed/data/prueba.txt'
docker compose exec myspeed cat /myspeed/data/prueba.txt
```

Para backup y restauración, usa el procedimiento consistente del capítulo
[Operación, persistencia y backup](07-operacion-persistencia-y-backup.md).

## Aplicar cambios

| Cambio | Comando necesario |
| --- | --- |
| Puerto, IP, zona horaria o variable de `.env` | `docker compose up -d` |
| `compose.yaml` | `docker compose up -d` |
| Código, dependencias o `Dockerfile` | `docker compose up -d --build` |
| Solo reiniciar el proceso | `docker compose restart myspeed` |
| Forzar una imagen totalmente nueva | `docker compose build --pull --no-cache` |

Después de cada cambio:

```bash
docker compose config
docker compose ps
docker compose logs --tail=100 myspeed
```

## Git: estado, commits y ramas

```bash
git status --short
git diff --check
git diff
git diff --cached
git log --oneline --decorate --graph --all
```

Crear un cambio aislado:

```bash
git switch main
git pull --ff-only origin main
git switch -c docs/nombre-del-cambio

# Editar y validar
git add <archivos>
git diff --cached
git commit -m "docs: describe the change"
git push -u origin docs/nombre-del-cambio
```

Comprobar identidad local:

```bash
git config --local user.name
git config --local user.email
```

Identidad usada por este repositorio:

```bash
git config --local user.name "David Gonzalez"
git config --local user.email \
  "167497481+davidgonzalezh@users.noreply.github.com"
```

## GitHub

Comprobar autenticación:

```bash
gh auth status
gh api user --jq '{login: .login, id: .id}'
```

Crear y publicar el repositorio local la primera vez:

```bash
gh repo create davidgonzalezh/MySpeed-Docker \
  --public --source=. --remote=origin --push \
  --description "Adaptación no oficial de MySpeed para Docker con curso en español"
```

Comprobar o configurar el remoto:

```bash
git remote -v
git remote get-url origin
git remote add origin git@github.com:davidgonzalezh/MySpeed-Docker.git
git push -u origin main
```

No ejecutes `git remote add origin` si `origin` ya existe. En ese caso, tras
verificar el destino, usa `git remote set-url origin <URL_CORRECTA>`.

## Auditoría antes de publicar

```bash
git status --short
git check-ignore -v .env
git ls-files .env .env.example
git diff --cached
git diff --check
```

Solo `.env.example` debe aparecer en `git ls-files`. No publiques `.env`, bases
de datos, backups, claves privadas, tokens ni credenciales de `gh`.

## Diagnóstico rápido por síntoma

| Síntoma | Primeros comandos |
| --- | --- |
| No abre la web | `docker compose ps`; `docker compose logs --tail=200 myspeed` |
| Solo funciona en localhost | Revisa `MYSPEED_BIND_IP`; `docker compose config`; firewall |
| Cambio de `.env` ignorado | `docker compose up -d`, no `restart` |
| Arranque lento tras recrear | Logs de descarga de CLI; conectividad y DNS |
| Datos desaparecidos | Comprueba proyecto/volumen; revisa si se usó `down -v` |
| Imagen no cambia | `docker compose up -d --build` |
| Puerto ocupado | Cambia `MYSPEED_HTTP_PORT` y ejecuta `up -d` |

Para un diagnóstico completo, consulta
[Solución de problemas](08-solucion-de-problemas.md).

[Volver al índice](00-indice.md)
