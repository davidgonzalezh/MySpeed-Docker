# Guion de clase: Dockerizar y publicar MySpeed

Duración propuesta: **60–75 minutos**. El objetivo no es memorizar comandos,
sino comprender cómo una aplicación web pasa del código fuente a un servicio
repetible, persistente y accesible desde la red.

## Objetivos de aprendizaje

Al terminar, el alumnado podrá:

1. Diferenciar repositorio, imagen, contenedor, puerto y volumen.
2. Explicar las tres etapas del `Dockerfile`.
3. Interpretar `compose.yaml` y la sustitución desde `.env`.
4. Construir y operar MySpeed sin instalar Bun o Node.js en el host.
5. Distinguir acceso por loopback, LAN e Internet.
6. Demostrar persistencia tras recrear un contenedor.
7. Separar una historia Git conservando licencia y atribución.

## Preparación del docente

Realiza esta preparación antes de entrar al aula:

- Comprueba `git --version`, `docker version` y `docker compose version`.
- Clona el repositorio y copia `.env.example` a `.env`.
- Usa una red de laboratorio autorizada; confirma la IP del equipo docente.
- Ejecuta al menos una vez `docker compose up -d --build`.
- Espera a que `docker compose ps` muestre `healthy`.
- Abre la aplicación localmente y desde un segundo dispositivo.
- Prepara una copia de seguridad según el capítulo 7.
- Comprueba que el proyector no muestre secretos, tokens o `.env` reales.

El build descarga imágenes y paquetes. Además, cada contenedor nuevo descarga
los CLI de LibreSpeed, Ookla y Cloudflare en `/myspeed/bin`. Ese directorio no
es persistente. Para una clase con Internet inestable, construye y arranca el
contenedor con antelación y usa `docker compose stop` / `start`; no ejecutes
`down`, `--force-recreate` ni una reconstrucción durante la demostración.

## Cronograma de 70 minutos

| Minutos | Bloque | Resultado visible |
| ---: | --- | --- |
| 0–5 | Problema y objetivos | Por qué “funciona en mi equipo” no basta |
| 5–12 | Origen y Git | Historia independiente con atribución |
| 12–22 | Arquitectura | Flujo navegador → host → contenedor → volumen |
| 22–34 | `Dockerfile` | Build multi-stage e imagen final |
| 34–45 | Compose y `.env` | Configuración efectiva y publicación de puertos |
| 45–55 | Build y arranque | Servicio `healthy`, logs y acceso web |
| 55–63 | Persistencia | Datos sobreviven a una recreación |
| 63–68 | Seguridad externa | `0.0.0.0` no equivale a Internet seguro |
| 68–70 | Cierre | Resumen, preguntas y ejercicio asignado |

Con 60 minutos, reduce el bloque de Git y deja la persistencia como ejercicio.
Con 75 minutos, añade la publicación en GitHub y la inspección de la imagen.

## Bloque 1 — El problema (0–5 min)

Pregunta inicial:

> Si una aplicación requiere una versión concreta de Bun, dependencias,
> puertos y carpetas escribibles, ¿cómo hacemos que veinte alumnos obtengan el
> mismo resultado?

Presenta la respuesta en cuatro objetos:

- El repositorio contiene la receta y el código.
- La imagen es el artefacto inmutable construido con esa receta.
- El contenedor es una ejecución concreta de la imagen.
- El volumen conserva los datos que no deben depender del contenedor.

## Bloque 2 — Origen e historia propia (5–12 min)

Muestra la historia corta:

```bash
git log --oneline --decorate --reverse
```

Explica que `git archive` exportó el commit upstream `501c99f2` sin copiar su
`.git`. El primer commit identifica la importación y el siguiente identifica la
adaptación Docker. Abre `UPSTREAM.md` y `LICENSE`.

Idea clave:

> Tener commits propios significa responsabilizarse de las modificaciones
> propias; no significa apropiarse de la autoría del código importado.

## Bloque 3 — Arquitectura (12–22 min)

Abre [el capítulo de arquitectura](02-arquitectura.md) y sigue el recorrido:

```text
Navegador
  → IP del servidor:puerto del host
  → publicación de puertos de Docker
  → Express/Bun en el contenedor:5216
  → SQLite y configuración en /myspeed/data
  → volumen nombrado myspeed-data
```

Aclara que React no usa un contenedor separado: Vite compila los archivos
estáticos durante el build y Express los sirve junto con la API.

Haz tres preguntas rápidas:

1. ¿Qué se pierde al borrar solo el contenedor? Los cambios no persistentes,
   incluido `/myspeed/bin`.
2. ¿Qué se conserva? El contenido de `/myspeed/data` en el volumen.
3. ¿Qué hace `EXPOSE 5216`? Documenta el puerto; `ports` en Compose lo publica.

## Bloque 4 — Lectura del Dockerfile (22–34 min)

Recorre las etapas sin leer cada línea:

1. `client-build`: instala dependencias bloqueadas y compila React/Vite.
2. `server-build`: instala dependencias de producción y genera índices.
3. `runtime`: copia únicamente el resultado necesario, añade certificados de
   sistema, usa el usuario `bun` y define salud, señales y puertos.

Comandos para acompañar la explicación:

```bash
docker compose build
docker image ls myspeed
docker image inspect myspeed:local --format '{{json .Config.Labels}}'
```

Señala por qué copiar primero `package.json` y `bun.lock` mejora la caché, y por
qué `--frozen-lockfile` impide resolver versiones diferentes accidentalmente.

## Bloque 5 — Compose y `.env` (34–45 min)

Crea la configuración local:

```bash
cp .env.example .env
docker compose config
```

En PowerShell, sustituye la primera línea por:

```powershell
Copy-Item .env.example .env
```

Explica estas relaciones:

| `.env` | Compose | Resultado |
| --- | --- | --- |
| `MYSPEED_BIND_IP=0.0.0.0` | `ports` | Escucha en todas las interfaces IPv4 |
| `MYSPEED_HTTP_PORT=5216` | `ports` | Puerto HTTP del host |
| `TZ=Etc/UTC` | `environment` | Zona horaria dentro del contenedor |
| `DB_TYPE=sqlite` | `environment` | Base autocontenida en el volumen |
| `COMPOSE_PROJECT_NAME=myspeed-docker` | proyecto | Prefijo de red, contenedor y volumen |

Subraya que Compose usa `.env` para interpolar. Solo las variables declaradas
en `environment` entran al contenedor. `docker compose config` muestra el
resultado efectivo y puede mostrar secretos, así que no se pega en foros sin
revisarlo.

## Bloque 6 — Construcción y acceso (45–55 min)

Ejecuta:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f --tail=100 myspeed
```

En los logs identifica conexión a la base de datos, descargas de proveedores y
el mensaje `Server listening on port 5216`. Sal con `Ctrl+C`.

Abre:

- `http://localhost:5216` desde el servidor.
- `http://IP_DEL_SERVIDOR:5216` desde otro equipo de la misma red.

Si el segundo acceso falla, pregunta por capas: ¿el contenedor está sano?, ¿la
IP es correcta?, ¿el puerto está publicado en `0.0.0.0`?, ¿el firewall permite
TCP 5216?, ¿ambos equipos pueden comunicarse?

## Bloque 7 — Persistencia (55–63 min)

Crea una marca controlada en el volumen:

```bash
docker compose exec myspeed sh -c \
  'printf "clase-docker\n" > /myspeed/data/marca-clase.txt'
docker compose exec myspeed cat /myspeed/data/marca-clase.txt
```

Recrea el contenedor sin borrar el volumen:

```bash
docker compose up -d --force-recreate
docker compose exec myspeed cat /myspeed/data/marca-clase.txt
```

La marca continúa porque `/myspeed/data` está montado. Advierte que la
recreación vuelve a descargar los CLI; espera a que la salud se recupere.

No demuestres `docker compose down -v` con datos que quieras conservar. Ese
comando elimina el volumen y constituye un borrado total.

## Bloque 8 — Acceso externo y seguridad (63–68 min)

Escribe en la pizarra:

```text
0.0.0.0 = escuchar en todas las interfaces
0.0.0.0 ≠ abrir firewall
0.0.0.0 ≠ configurar NAT o DNS
0.0.0.0 ≠ cifrar ni autenticar
```

MySpeed inicia sin contraseña. Para una LAN de laboratorio, configura primero
la contraseña y limita el firewall a la red necesaria. Para Internet, añade
TLS y un proxy inverso con control de acceso o usa VPN. El puerto 5217 solo
responde si existen certificados válidos en `/myspeed/data/certs`.

## Bloque opcional — Publicar en GitHub (5 min extra)

Muestra, pero no vuelvas a ejecutar si el repositorio ya existe:

```bash
gh repo create davidgonzalezh/MySpeed-Docker \
  --public --source=. --remote=origin --push
```

Comprueba `origin`, identidad y atribución:

```bash
git remote -v
git config --local user.name
git config --local user.email
git log --oneline --reverse
```

## Cierre y evaluación rápida

Pide respuestas de una frase:

1. ¿Qué archivo convierte código fuente en una imagen? `Dockerfile`.
2. ¿Qué archivo coordina ejecución y persistencia? `compose.yaml`.
3. ¿Dónde se guardan los datos? En `/myspeed/data`, montado en un volumen.
4. ¿Por qué se puede acceder desde otra máquina? El puerto se publica en
   `0.0.0.0` y la red/firewall lo permiten.
5. ¿Qué comando borra también los datos? `docker compose down -v`.
6. ¿Por qué hay un commit de importación? Para registrar procedencia y separar
   la historia propia.

Termina asignando uno de los [ejercicios](11-ejercicios.md) y entrega la
[referencia de comandos](12-referencia-de-comandos.md).

[Volver al índice](00-indice.md)
