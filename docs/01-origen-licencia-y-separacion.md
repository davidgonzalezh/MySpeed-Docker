# Origen, licencia y separacion del repositorio

Este repositorio es una adaptacion independiente de MySpeed orientada a Docker y a una clase en espanol. La aplicacion base procede del proyecto oficial; la imagen, Compose y el material docente se mantienen aqui con un historial Git nuevo y legible.

## Datos verificables del origen

| Dato | Valor |
| --- | --- |
| Proyecto original | <https://github.com/gnmyt/MySpeed> |
| Rama importada | `development` |
| Commit importado | `501c99f2cb9c41531e7375375b682d5e1ba5371c` |
| Version de la aplicacion importada | `1.0.9` |
| Licencia | MIT |
| Registro local del origen | [`UPSTREAM.md`](../UPSTREAM.md) |
| Texto legal conservado | [`LICENSE`](../LICENSE) |

El commit largo es importante: una rama puede avanzar, pero un SHA identifica exactamente el estado que se uso como punto de partida.

## Que significa "repositorio independiente"

La carpeta oficial y esta carpeta son dos repositorios distintos:

```text
MySpeed/                 clon de trabajo del proyecto oficial
MySpeed-Docker/          adaptacion independiente para la clase
  .git/                  historial nuevo, iniciado en main
  client/                codigo importado
  server/                codigo importado
  scripts/               codigo importado
  Dockerfile             adaptacion Docker
  compose.yaml           despliegue Docker
  docs/                   documentacion de la clase
```

No se copio el directorio `.git` original. En su lugar se importaron los archivos necesarios y se ejecuto `git init` en la nueva carpeta. El resultado tiene:

- su propia rama `main`;
- sus propios commits;
- sus propios remotos, cuando se configure GitHub;
- ninguna dependencia del remoto oficial para construir o ejecutar;
- una referencia explicita al origen para poder auditar y actualizar el codigo.

Esto es distinto de pulsar **Fork** en GitHub. Un fork conserva una relacion visible con el repositorio padre dentro de GitHub. Una importacion con historial limpio es un repositorio independiente, aunque legal y tecnicamente el codigo importado siga teniendo un origen.

## Historial propio no significa autoria total

Un commit propio registra quien hizo una importacion o una adaptacion. No convierte automaticamente a esa persona en autora del codigo previo.

La separacion correcta mantiene las dos ideas a la vez:

1. Los commits de Docker, Compose y documentacion pertenecen al historial de esta adaptacion.
2. El codigo importado conserva su autoria y licencia originales.

La licencia MIT permite usar, copiar, modificar, publicar y distribuir el software, pero exige conservar el aviso de copyright y el texto de licencia en las copias sustanciales. Por eso no se deben borrar `LICENSE` ni `UPSTREAM.md`.

> Para una exposicion: "El historial es nuestro; el codigo base no deja de ser del proyecto del que procede".

## Como comprobar la separacion

Desde `MySpeed-Docker`:

```bash
git rev-parse --show-toplevel
git branch --show-current
git log --oneline --decorate --graph --all
git remote -v
```

La primera orden debe terminar en `MySpeed-Docker`; la rama debe ser `main`. `git remote -v` puede estar vacio antes de publicar o debe apuntar al repositorio personal despues de hacerlo. No debe apuntar a `gnmyt/MySpeed` como `origin`.

Tambien se puede comprobar que el clon oficial conserva un repositorio diferente:

```bash
cd ../MySpeed
git rev-parse --show-toplevel
git remote -v
```

## Remotos recomendados

Al publicar, `origin` debe representar el repositorio personal:

```bash
git remote add origin git@github.com:USUARIO/MySpeed-Docker.git
git push -u origin main
```

No es obligatorio agregar el oficial como remoto. Si se desea consultarlo sin confundirlo con el destino de publicacion, se puede llamar `upstream-source`:

```bash
git remote add upstream-source https://github.com/gnmyt/MySpeed.git
git fetch upstream-source
```

Los historiales no comparten un antepasado porque esta adaptacion se inicio con una importacion limpia. Por ello no conviene ejecutar a ciegas `git merge upstream-source/development`: puede producir una mezcla de historiales y muchos conflictos. El procedimiento seguro es comparar una version concreta, importar solo los cambios requeridos, actualizar `UPSTREAM.md`, reconstruir y crear un commit explicito.

## Patron para actualizar desde el proyecto oficial

1. Guardar o confirmar primero los cambios locales.
2. Consultar la version/commit oficial que se quiere adoptar.
3. Descargarla en otra carpeta o inspeccionarla mediante el remoto de consulta.
4. Comparar `client/`, `server/`, `scripts/`, `package.json`, `bun.lock` y `client/bun.lock`.
5. Aplicar conscientemente los cambios sin sustituir `.git`, Docker ni la documentacion local.
6. Actualizar el SHA y la version en `UPSTREAM.md`.
7. Ejecutar las validaciones Docker y funcionales.
8. Crear un commit como `chore(upstream): update MySpeed to <SHA>`.

## Que se necesita en el equipo del alumno

Para usar esta edicion no hace falta instalar Bun, Node.js, npm, SQLite ni MySQL en el host. El flujo normal solo requiere:

- Git, para descargar y versionar el repositorio;
- Docker Engine o Docker Desktop;
- Docker Compose v2, disponible como `docker compose`.

La imagen contiene Bun y compila el frontend y el backend. La configuracion predeterminada usa SQLite dentro del volumen Docker. El build necesita Internet para obtener imagenes y paquetes; el primer arranque de cada contenedor nuevo necesita salida para descargar los CLI de pruebas de velocidad.

## Errores que hay que evitar

- Borrar `LICENSE` o presentar todo el codigo como propio.
- Copiar `.git` desde el repositorio oficial y creer que el historial quedo separado.
- Configurar el oficial como `origin` y publicar por accidente al destino equivocado.
- Subir `.env`, una base SQLite, certificados o copias de seguridad.
- hacer un `push --force` para "limpiar" un repositorio compartido.
- mezclar una actualizacion upstream sin registrar el commit exacto importado.

El archivo [`.gitignore`](../.gitignore) excluye `.env`, `data/`, `bin/`, builds y copias. Antes de cada publicacion se debe verificar igualmente:

```bash
git status --short
git diff --cached --name-only
```
