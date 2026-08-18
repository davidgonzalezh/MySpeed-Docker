# Ejercicios prácticos

Todos los ejercicios se realizan desde la raíz del repositorio y requieren
solo Git y Docker Compose. Trabaja en una red autorizada y no publiques el
servicio directamente en Internet.

Antes de empezar:

```bash
docker compose config
docker compose up -d --build
docker compose ps
```

## Ejercicio 1 — Leer la configuración efectiva

**Objetivo:** relacionar `.env` con `compose.yaml`.

1. Localiza en `.env` `MYSPEED_BIND_IP`, `MYSPEED_HTTP_PORT` y `TZ`.
2. Ejecuta `docker compose config`.
3. Encuentra en la salida el puerto publicado y las variables que recibe el
   contenedor.
4. Explica por qué `COMPOSE_PROJECT_NAME` no aparece como variable dentro del
   contenedor.

**Resultado esperado:** el alumno distingue interpolación de Compose y entorno
del proceso. Solo las claves listadas bajo `environment` entran al contenedor.

> La salida de `docker compose config` puede contener `DB_PASS`; no la publiques
> si usas credenciales reales.

## Ejercicio 2 — Cambiar el puerto sin reconstruir

**Objetivo:** separar configuración de ejecución y construcción de imagen.

1. Cambia en `.env` `MYSPEED_HTTP_PORT=8080`.
2. Valida y aplica:

```bash
docker compose config
docker compose up -d
docker compose ps
```

3. Abre `http://localhost:8080` y
   `http://IP_DEL_SERVIDOR:8080`.
4. Comprueba que el puerto interno continúa siendo `5216`.

**Pregunta:** ¿por qué no hizo falta `docker compose build`?

**Respuesta esperada:** el puerto del host pertenece a la configuración del
contenedor, no al contenido de la imagen.

Restaura `MYSPEED_HTTP_PORT=5216` al terminar y vuelve a ejecutar
`docker compose up -d`.

## Ejercicio 3 — Comparar loopback y acceso remoto

**Objetivo:** comprender la dirección de publicación.

1. Cambia `MYSPEED_BIND_IP=127.0.0.1`.
2. Ejecuta `docker compose up -d`.
3. Prueba desde el host y desde otro equipo.
4. Cambia a `MYSPEED_BIND_IP=0.0.0.0` y aplica otra vez.
5. Repite ambas pruebas.

**Resultado esperado:** loopback permite acceso únicamente desde el host;
`0.0.0.0` permite llegar por las interfaces del host si la red y el firewall
lo admiten.

**Reflexión:** explica por qué ninguna de las dos direcciones configura NAT,
DNS, TLS o autenticación.

## Ejercicio 4 — Demostrar persistencia

**Objetivo:** demostrar que contenedor y volumen tienen ciclos de vida
diferentes.

Crea una marca en el volumen:

```bash
docker compose exec myspeed sh -c \
  'printf "persistencia-ok\n" > /myspeed/data/ejercicio.txt'
docker compose exec myspeed cat /myspeed/data/ejercicio.txt
```

Recrea el contenedor:

```bash
docker compose up -d --force-recreate
docker compose ps
docker compose exec myspeed cat /myspeed/data/ejercicio.txt
```

**Resultado esperado:** el archivo sigue existiendo. La recreación puede tardar
porque `/myspeed/bin` no es persistente y los tres CLI se descargan de nuevo.

**Pregunta:** ¿qué ocurriría con `docker compose down -v`?

**Respuesta esperada:** se eliminaría el volumen completo, incluida la base de
datos y la marca. No ejecutes ese comando sobre información que necesites.

## Ejercicio 5 — Diagnosticar salud y logs

**Objetivo:** aplicar un orden de diagnóstico reproducible.

Ejecuta:

```bash
docker compose ps
docker compose logs --tail=200 myspeed
docker compose exec myspeed id
docker compose exec myspeed sh -c \
  'bun -e "fetch(\"http://127.0.0.1:5216/\").then(r=>console.log(r.status))"'
```

Responde:

1. ¿Está `running` y `healthy`?
2. ¿Conectó a la base de datos?
3. ¿terminaron las descargas de CLI?
4. ¿Qué usuario ejecuta la aplicación?
5. ¿La petición interna devuelve estado `200`?

**Resultado esperado:** el proceso usa un usuario sin privilegios y la
comprobación interna no depende del puerto externo elegido.

## Ejercicio 6 — Inspeccionar la imagen

**Objetivo:** identificar decisiones de seguridad y trazabilidad.

```bash
docker image inspect myspeed:local \
  --format 'Usuario={{.Config.User}} Puertos={{json .Config.ExposedPorts}}'
docker image inspect myspeed:local \
  --format '{{index .Config.Labels "org.opencontainers.image.source"}}'
docker history myspeed:local
```

Busca:

- El usuario `bun`.
- Los puertos `5216/tcp` y `5217/tcp`.
- La URL de origen de esta adaptación.
- La separación entre capas de build y runtime.

**Pregunta:** ¿por qué `EXPOSE` no basta para entrar desde el navegador?

**Respuesta esperada:** `EXPOSE` solo documenta; la sección `ports` crea la
publicación host-contenedor.

## Ejercicio 7 — Diseñar una exposición segura

**Objetivo:** razonar antes de abrir un servicio.

Para estos tres escenarios, propone `MYSPEED_BIND_IP`, firewall, autenticación
y cifrado:

1. Uso únicamente en el servidor.
2. Aula dentro de una LAN confiable.
3. Consulta desde Internet.

**Criterios esperados:**

- Servidor local: `127.0.0.1`.
- LAN: `0.0.0.0` o una IP concreta, contraseña y regla limitada a la subred.
- Internet: no publicar 5216 directamente; usar VPN o proxy inverso con TLS y
  control de acceso, además de contraseña de MySpeed.

Incluye en la explicación por qué `MYSPEED_HTTPS_PORT=5217` no crea certificados
por sí solo.

## Ejercicio 8 — Auditar secretos antes de un commit

**Objetivo:** evitar publicar configuración privada.

```bash
git status --short
git check-ignore -v .env
git diff
git diff --cached
```

Comprueba que `.env` esté ignorado y `.env.example` esté rastreado:

```bash
git ls-files .env .env.example
```

**Resultado esperado:** solo aparece `.env.example`. Busca además bases de
datos, backups, certificados privados o tokens antes de cada commit.

## Ejercicio 9 — Reconstruir la separación Git en un laboratorio

**Objetivo:** crear una raíz Git nueva sin copiar la historia oficial.

Usa directorios temporales, no el repositorio de trabajo. Primero clona el
repositorio oficial, porque el SHA upstream no forma parte de esta historia
independiente:

```bash
MYSPEED_OFFICIAL_DIR=$(mktemp -d)
MYSPEED_EXPORT_DIR=$(mktemp -d)

git clone https://github.com/gnmyt/MySpeed.git "$MYSPEED_OFFICIAL_DIR"
git -C "$MYSPEED_OFFICIAL_DIR" cat-file -e 501c99f2^{commit}
git -C "$MYSPEED_OFFICIAL_DIR" archive 501c99f2 \
  LICENSE package.json bun.lock client server scripts \
  | tar -x -C "$MYSPEED_EXPORT_DIR"
git -C "$MYSPEED_EXPORT_DIR" init -b main
git -C "$MYSPEED_EXPORT_DIR" status --short
```

Comprueba que existe un `.git` nuevo y que no hay remoto:

```bash
git -C "$MYSPEED_EXPORT_DIR" remote -v
git -C "$MYSPEED_EXPORT_DIR" log --oneline
```

El segundo comando todavía debe indicar que no hay commits. No completes el
commit si no has configurado una identidad de laboratorio.

**Pregunta:** ¿por qué esta técnica conserva trazabilidad aunque no conserve la
historia original?

**Respuesta esperada:** el commit de importación y `UPSTREAM.md` registran el
repositorio, rama y SHA exactos, mientras `LICENSE` conserva las condiciones y
atribución.

## Ejercicio 10 — Preparar una actualización upstream

**Objetivo:** planificar una actualización sin mezclar historias.

1. Crea una rama `chore/update-upstream`.
2. Clona `gnmyt/MySpeed` en un directorio temporal.
3. Registra el nuevo SHA.
4. Compara `client/`, `server/`, `scripts/` y manifests.
5. Enumera qué pruebas Docker ejecutarías.

No copies `.git`, no uses una copia ciega con `--delete` y no ejecutes
`git pull --allow-unrelated-histories`.

**Entrega esperada:** una lista de diferencias, riesgos, archivos que cambiarían
y validaciones; no es necesario modificar el repositorio real.

## Rúbrica sugerida

| Criterio | 0 puntos | 1 punto | 2 puntos |
| --- | --- | --- | --- |
| Comandos | No funcionan | Funcionan parcialmente | Son reproducibles y explicados |
| Docker | Confunde imagen/contenedor | Reconoce objetos | Explica también volumen y puertos |
| Red | Asume que `0.0.0.0` abre Internet | Distingue loopback/LAN | Añade firewall, TLS y autenticación |
| Persistencia | Borra o ignora datos | Identifica el volumen | Demuestra recreación y backup |
| Git | Omite procedencia | Conserva licencia | Registra SHA, atribución y commits lógicos |
| Seguridad | Publica secretos | Usa `.gitignore` | Audita staging y propone rotación |

[Volver al índice](00-indice.md)
