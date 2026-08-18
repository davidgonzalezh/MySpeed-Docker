# MySpeed Docker Classroom Edition

Adaptación **no oficial** de [MySpeed](https://github.com/gnmyt/MySpeed) para
construir, ejecutar y explicar la aplicación usando Docker Compose. El
repositorio incluye el código necesario, una imagen multi-stage, persistencia
con SQLite, acceso desde otros equipos y un curso completo en español.

Esta adaptación mantiene una historia Git independiente para que sus cambios
de Docker y documentación queden en commits propios. Eso no convierte el
código importado en código de autoría propia: se conserva la licencia MIT y la
atribución al proyecto original. Consulta [UPSTREAM.md](UPSTREAM.md).

## Qué necesitas

- Git, para clonar y mantener el repositorio.
- Docker Engine con Docker Compose v2, o Docker Desktop.
- Conexión a Internet durante la construcción y el primer arranque de cada
  contenedor nuevo.

No necesitas instalar Bun, Node.js, npm, MySQL ni Nginx en el host. El modo
predeterminado usa SQLite dentro del volumen Docker.

Comprueba las herramientas:

```bash
git --version
docker version
docker compose version
```

## Inicio rápido

Clona tu repositorio y entra en él:

```bash
git clone https://github.com/davidgonzalezh/MySpeed-Docker.git
cd MySpeed-Docker
```

Crea el archivo local de configuración. En Linux, macOS o Git Bash:

```bash
cp .env.example .env
```

En PowerShell:

```powershell
Copy-Item .env.example .env
```

Valida la configuración efectiva y construye el servicio:

```bash
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs -f --tail=100 myspeed
```

El primer arranque puede tardar varios minutos. MySpeed descarga dentro del
contenedor los CLI de LibreSpeed, Ookla y Cloudflare antes de empezar a
escuchar. Pulsa `Ctrl+C` para salir de los logs; el contenedor seguirá activo.

## Cómo acceder

- Desde el mismo servidor: <http://localhost:5216>
- Desde otro equipo: `http://IP_DEL_SERVIDOR:5216`

Por ejemplo, si la IP del servidor es `192.168.1.50`, abre
`http://192.168.1.50:5216`.

`MYSPEED_BIND_IP=0.0.0.0` es el valor predeterminado de `.env.example`, por lo
que Docker publica el puerto en todas las interfaces IPv4 del host. Esto solo
hace que el proceso escuche: **no abre el firewall, no configura el router o
NAT, no crea DNS y no activa HTTPS**.

> **Advertencia de seguridad:** MySpeed inicia sin contraseña. Configura una
> contraseña desde la interfaz antes de permitir acceso desde una red no
> confiable. Para Internet usa además TLS y una capa de protección, como un
> proxy inverso con autenticación o una VPN. No expongas directamente el puerto
> `5216` a Internet. Lee
> [Acceso externo y seguridad](docs/05-acceso-externo-y-seguridad.md).

Si solo deseas acceso local, cambia en `.env`:

```dotenv
MYSPEED_BIND_IP=127.0.0.1
```

Después aplica el cambio con `docker compose up -d`; un simple
`docker compose restart` no vuelve a leer la configuración de Compose.

## Operación diaria

```bash
# Ver estado y salud
docker compose ps

# Seguir registros
docker compose logs -f --tail=100 myspeed

# Detener y conservar datos
docker compose down

# Volver a iniciar
docker compose up -d
```

Los datos viven en el volumen nombrado `myspeed-data`. `docker compose down`
conserva ese volumen. En cambio, `docker compose down -v` **elimina la base de
datos, la configuración, las pruebas, los certificados y los demás datos
persistentes**; no lo uses salvo que quieras un borrado total y tengas copia de
seguridad.

El directorio `/myspeed/bin` no está en el volumen. Detener e iniciar el mismo
contenedor conserva sus ejecutables, pero recrearlo —por ejemplo con
`--force-recreate`, después de `down` o tras cambiar la imagen— obliga a
descargarlos de nuevo. Por eso un arranque posterior a una recreación también
necesita salida a Internet.

## Qué incluye Docker

- `Dockerfile`: tres etapas para compilar React, instalar dependencias de
  producción y producir una imagen de ejecución sin privilegios.
- `compose.yaml`: construcción, publicación de puertos, variables, volumen,
  política de reinicio y endurecimiento básico, todo comentado en español.
- `.env.example`: catálogo comentado de las variables admitidas.
- `.dockerignore`: evita enviar secretos, dependencias y artefactos al build.
- `.github/workflows/docker.yml`: valida Compose y construye la imagen en cada
  cambio de `main` o pull request, sin publicar imágenes ni usar secretos.
- `docs/`: arquitectura, instalación, seguridad, operación, GitHub y material
  para una clase de 60–75 minutos.

## Documentación completa

Empieza por el [índice del curso](docs/00-indice.md), o entra directamente en
un capítulo:

1. [Origen, licencia y separación](docs/01-origen-licencia-y-separacion.md)
2. [Arquitectura](docs/02-arquitectura.md)
3. [Dockerfile](docs/03-dockerfile.md)
4. [Compose y `.env`](docs/04-compose-y-env.md)
5. [Acceso externo y seguridad](docs/05-acceso-externo-y-seguridad.md)
6. [Instalación y despliegue](docs/06-instalacion-y-despliegue.md)
7. [Operación, persistencia y backup](docs/07-operacion-persistencia-y-backup.md)
8. [Solución de problemas](docs/08-solucion-de-problemas.md)
9. [Publicar y mantener en GitHub](docs/09-publicar-y-mantener-en-github.md)
10. [Guion de clase](docs/10-guion-de-clase.md)
11. [Ejercicios](docs/11-ejercicios.md)
12. [Referencia de comandos](docs/12-referencia-de-comandos.md)

## Origen y licencia

El código base fue exportado de `gnmyt/MySpeed`, rama `development`, commit
`501c99f2cb9c41531e7375375b682d5e1ba5371c`. El proyecto original pertenece a
sus autores y se distribuye bajo licencia MIT. Esta adaptación conserva
[LICENSE](LICENSE), registra el origen en [UPSTREAM.md](UPSTREAM.md) y mantiene
separadas las contribuciones de Docker y documentación.

MySpeed Docker Classroom Edition no está afiliado ni respaldado oficialmente
por el proyecto MySpeed.
