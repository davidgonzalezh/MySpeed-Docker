# Origen y atribucion

Este repositorio es una adaptacion independiente para desplegar y ensenar
MySpeed con Docker. El codigo base de la aplicacion se importo desde:

- Proyecto original: <https://github.com/gnmyt/MySpeed>
- Rama de origen: `development`
- Commit importado: `501c99f2cb9c41531e7375375b682d5e1ba5371c`
- Autor y titular indicado en la licencia: Mathias Wagner
- Licencia: MIT; consulta [`LICENSE`](LICENSE)

El historial Git de este repositorio empieza con un commit de importacion y no
copia el directorio `.git` del proyecto original. Esto permite mantener los
cambios de Docker y la documentacion como commits propios, pero no cambia la
autoria del codigo importado ni elimina la obligacion de conservar la licencia.

## Relacion con el proyecto original

Este repositorio no es un fork conectado mediante la funcion **Fork** de
GitHub, no comparte remotos y no necesita acceder al repositorio original para
construir la imagen. La aplicacion conserva, no obstante, integraciones propias
del codigo upstream: por ejemplo, la consulta de nuevas versiones puede acceder
a las publicaciones oficiales de MySpeed.

Las adaptaciones Docker y la documentacion en espanol se mantienen en este
repositorio. Los problemas del codigo original deben contrastarse primero con
el proyecto upstream; los problemas de esta adaptacion deben registrarse aqui.

## Actualizaciones futuras

Para incorporar una version nueva no se debe reemplazar el historial ni copiar
otro `.git`. El procedimiento documentado consiste en descargar el upstream a
una carpeta temporal, comparar el commit nuevo, copiar deliberadamente los
cambios de `client/`, `server/`, `scripts/` y los manifests, validar Docker y
crear un commit de actualizacion que identifique el nuevo SHA de origen.
