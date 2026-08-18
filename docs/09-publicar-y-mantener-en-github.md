# Publicar y mantener el repositorio en GitHub

Este capítulo explica cómo se separó el código del repositorio oficial, cómo se
creó una historia propia sin atribuirse trabajo ajeno y cómo publicar el
resultado en `davidgonzalezh/MySpeed-Docker`.

## 1. Fork frente a historia independiente

Un **fork de GitHub** conserva una relación visible con el repositorio padre.
Es la opción normal para enviar pull requests al proyecto original. Sus ramas
y comparaciones se entienden como continuación de la misma historia.

Este proyecto usa una **historia independiente**. Se exportó el contenido de un
commit concreto, sin copiar `.git`, y se inicializó un repositorio nuevo. El
primer commit propio registra qué código se importó; los siguientes registran
la adaptación Docker y la documentación.

| Aspecto | Fork de GitHub | Historia independiente |
| --- | --- | --- |
| Relación visual con upstream | Sí | No |
| Historia inicial | La del proyecto original | Un commit de importación propio |
| Enviar cambios a upstream | Directo mediante pull request | Requiere preparar un parche o rama aparte |
| Autoría del código original | Sigue siendo de sus autores | Sigue siendo de sus autores |
| Licencia y atribución | Deben conservarse | Deben conservarse |
| Uso en este curso | No | Sí |

La independencia de la historia no elimina la procedencia. `LICENSE` y
`UPSTREAM.md` son parte esencial del repositorio.

## 2. Exportación reproducible usada en este proyecto

El repositorio oficial estaba en `/home/itm/MySpeed`. Se creó un destino vacío:

```bash
mkdir /home/itm/MySpeed-Docker
```

Desde `/home/itm/MySpeed` se exportaron únicamente los archivos rastreados del
commit conocido y necesarios para la aplicación:

```bash
git archive 501c99f2 LICENSE package.json bun.lock client server scripts \
  | tar -x -C /home/itm/MySpeed-Docker
```

`git archive` tiene tres ventajas didácticas:

1. Exporta exactamente el árbol del commit indicado.
2. No incluye el directorio `.git` ni remotos, ramas o credenciales.
3. No incluye archivos locales no rastreados, builds, bases de datos o
   dependencias instaladas.

Después, en el directorio nuevo, se creó la historia independiente:

```bash
cd /home/itm/MySpeed-Docker
git init -b main
git config --local user.name "David Gonzalez"
git config --local user.email \
  "167497481+davidgonzalezh@users.noreply.github.com"
```

La dirección `noreply` pertenece a la cuenta de GitHub y evita publicar el
correo personal. La identidad es local a este repositorio; no cambia la
configuración global del equipo.

Antes del primer commit se creó `UPSTREAM.md` para registrar repositorio, rama,
SHA, autoría y licencia. El primer bloque se registró así:

```bash
git add LICENSE UPSTREAM.md package.json bun.lock client server scripts
git commit -m "chore: import MySpeed source from upstream 501c99f2"
```

El bloque Docker se registró en un commit separado:

```bash
git add Dockerfile compose.yaml .dockerignore .env.example .gitignore \
  client/bun.lock
git commit -m "feat(docker): add standalone external deployment"
```

La validación de GitHub Actions se aisló también:

```bash
git add .github/workflows/docker.yml
git commit -m "ci: validate the Docker image on GitHub Actions"
```

Finalmente, la documentación forma otro cambio lógico:

```bash
git add README.md docs
git commit -m "docs: add complete Spanish Docker course"
```

Los commits separados permiten explicar qué vino del upstream, qué adapta el
despliegue y qué añade el material didáctico.

El workflow [`.github/workflows/docker.yml`](../.github/workflows/docker.yml)
se ejecuta en cambios de `main`, pull requests y lanzamientos manuales. Con
permisos de solo lectura valida el modelo Compose, construye la imagen y
comprueba el usuario `bun` y la etiqueta MIT. No inicia MySpeed, no publica la
imagen y no necesita secretos del repositorio.

Comprueba el resultado:

```bash
git status --short
git log --oneline --decorate --reverse
git remote -v
```

Antes de publicar, `git status --short` debe quedar vacío y no debe existir un
`origin` que apunte por accidente al proyecto oficial.

## 3. Crear el repositorio público con GitHub CLI

Primero confirma la cuenta autenticada:

```bash
gh auth status
gh api user --jq '{login: .login, id: .id}'
```

Desde `/home/itm/MySpeed-Docker`, crea un repositorio **vacío** y publica la
rama local en una sola operación:

```bash
gh repo create davidgonzalezh/MySpeed-Docker \
  --public \
  --source=. \
  --remote=origin \
  --push \
  --description "Adaptación no oficial de MySpeed para Docker con curso en español"
```

`--source=.` usa este repositorio local, `--remote=origin` registra el nuevo
destino y `--push` publica `main`. No inicialices el repositorio remoto con otro
README, `.gitignore` o licencia: esos archivos ya existen localmente.

Verifica el resultado:

```bash
git remote -v
git branch -vv
git status
gh repo view davidgonzalezh/MySpeed-Docker --web
```

Si el repositorio ya fue creado en GitHub pero no hay remoto local, usa:

```bash
git remote add origin git@github.com:davidgonzalezh/MySpeed-Docker.git
git push -u origin main
```

Si `origin` existe pero apunta a una URL equivocada, inspecciónalo antes de
cambiarlo:

```bash
git remote get-url origin
git remote set-url origin git@github.com:davidgonzalezh/MySpeed-Docker.git
git push -u origin main
```

## 4. Flujo normal de trabajo

Antes de editar:

```bash
git switch main
git pull --ff-only origin main
git status --short
```

Crea una rama con un propósito único:

```bash
git switch -c docs/mejorar-guia-seguridad
```

Revisa y valida antes del commit:

```bash
docker compose config
docker compose build
git diff --check
git diff --stat
git diff
```

Registra únicamente el bloque intencional:

```bash
git add README.md docs/05-acceso-externo-y-seguridad.md
git diff --cached
git commit -m "docs: clarify external access security"
git push -u origin docs/mejorar-guia-seguridad
```

Después puedes abrir un pull request desde GitHub o con:

```bash
gh pr create --draft --fill
```

Evita commits genéricos como `cambios` o `final`. Un mensaje breve en
imperativo facilita reconstruir la evolución del curso.

## 5. Secretos y archivos que nunca se publican

`.env` está excluido mediante `.gitignore`; `.env.example` sí se publica porque
solo contiene valores didácticos. Aun así, verifica cada commit:

```bash
git status --short
git diff --cached
git check-ignore -v .env
```

No guardes en Git:

- `DB_PASS`, tokens de integraciones o contraseñas reales.
- Certificados privados, en especial `key.pem`.
- `storage.db`, copias de seguridad o datos exportados.
- Archivos dentro de `data/`, `backups/` o volúmenes Docker.
- Credenciales de GitHub o contenido de `~/.config/gh/hosts.yml`.

Si un secreto llega a un commit, borrarlo en el commit siguiente no basta: el
valor permanece en la historia. Revócalo o rótalo primero y después limpia la
historia con un procedimiento específico.

## 6. Actualizar desde el proyecto original

Una historia independiente no debe recibir un `git pull` del upstream. El
proceso correcto es importar de forma deliberada un nuevo árbol y crear un
commit que registre el SHA de origen.

### 6.1 Preparar una actualización aislada

Empieza desde una rama limpia:

```bash
git switch main
git pull --ff-only origin main
git status --short
git switch -c chore/update-upstream
```

Clona temporalmente el upstream y registra su SHA:

```bash
MYSPEED_UPSTREAM_DIR=$(mktemp -d)
git clone --depth 1 --branch development \
  https://github.com/gnmyt/MySpeed.git "$MYSPEED_UPSTREAM_DIR"
git -C "$MYSPEED_UPSTREAM_DIR" rev-parse HEAD
```

No copies `"$MYSPEED_UPSTREAM_DIR/.git"`. Compara primero los árboles:

```bash
diff -ru --exclude=.git --exclude=node_modules \
  client "$MYSPEED_UPSTREAM_DIR/client" || true
diff -ru --exclude=.git --exclude=node_modules \
  server "$MYSPEED_UPSTREAM_DIR/server" || true
```

Después copia de forma explícita solo el código que se desea actualizar. Una
forma segura es crear otro directorio de preparación con `git archive`, revisar
el resultado y aplicar los cambios de manera controlada:

```bash
MYSPEED_STAGE_DIR=$(mktemp -d)
git -C "$MYSPEED_UPSTREAM_DIR" archive HEAD \
  LICENSE package.json bun.lock client server scripts \
  | tar -x -C "$MYSPEED_STAGE_DIR"
```

Desde ese staging se comparan y trasladan los archivos necesarios. No uses una
copia ciega con `--delete`: podría borrar adaptaciones deliberadas.

### 6.2 Validar y registrar la actualización

Después de integrar los cambios:

```bash
docker compose config
docker compose build --no-cache
docker compose up -d
docker compose ps
docker compose logs --tail=200 myspeed
git diff --check
git diff --stat
```

Actualiza en `UPSTREAM.md` el SHA y la rama importados. Conserva cualquier
cambio de licencia que llegue del upstream. Registra todo en un commit
identificable:

```bash
git add LICENSE UPSTREAM.md package.json bun.lock client server scripts
git commit -m "chore: update MySpeed source to upstream <SHA_CORTO>"
```

Si la actualización necesita cambios en Docker, es preferible registrarlos en
un segundo commit para que la revisión sea comprensible.

## 7. Por qué no usar `--allow-unrelated-histories`

No ejecutes:

```text
git pull upstream development --allow-unrelated-histories
```

Las dos historias se crearon con raíces diferentes. Forzar su mezcla añade de
golpe todo el historial upstream, provoca conflictos difíciles de explicar y
rompe el objetivo didáctico de mantener un repositorio independiente. Importar
un árbol concreto y registrar su SHA conserva trazabilidad sin fingir que ambas
historias siempre fueron una sola.

## 8. Lista de comprobación antes de cada publicación

- `git status --short` no contiene bases de datos, `.env` ni backups.
- `git diff --cached` muestra exactamente lo que se quiere publicar.
- `docker compose config` termina sin errores.
- La imagen se construye y el contenedor alcanza el estado `healthy`.
- El acceso local y el acceso por IP se prueban desde la red prevista.
- `LICENSE` y `UPSTREAM.md` siguen presentes y actualizados.
- Los cambios de seguridad no exponen contraseñas ni claves privadas.
- El mensaje del commit describe una sola intención.
- `origin` apunta a `davidgonzalezh/MySpeed-Docker`, no a `gnmyt/MySpeed`.

[Volver al índice](00-indice.md)
