# Acceso externo y seguridad

Este capítulo explica qué significa publicar MySpeed fuera del contenedor, cómo
acceder desde otro equipo y qué controles deben añadirse antes de exponerlo a
una red no confiable.

> **Advertencia importante:** MySpeed crea su configuración inicial con la
> contraseña en `none`. El valor predeterminado de este repositorio publica HTTP
> en `0.0.0.0:5216`. Configura una contraseña y limita el acceso con firewall
> antes de abrir el puerto fuera de una red de laboratorio autorizada.

## 1. El recorrido de una conexión

Una petición desde un navegador remoto atraviesa varias capas independientes:

```text
Navegador remoto
    │  http://IP_O_DNS:5216
    ▼
Firewall / security group / router NAT
    │
    ▼
IP y puerto publicados por Docker en el host
    │  0.0.0.0:5216 -> contenedor:5216
    ▼
Aplicación MySpeed dentro del contenedor
```

Que una capa funcione no implica que las demás estén configuradas. En
particular, `0.0.0.0` solo controla dónde escucha Docker en el host.

## 2. Qué hace realmente `MYSPEED_BIND_IP`

La línea HTTP de [`compose.yaml`](../compose.yaml) tiene esta forma:

```yaml
ports:
  - "${MYSPEED_BIND_IP:-0.0.0.0}:${MYSPEED_HTTP_PORT:-5216}:5216"
```

El formato es:

```text
IP_DEL_HOST:PUERTO_DEL_HOST:PUERTO_DEL_CONTENEDOR
```

Valores útiles:

| Valor | Alcance | Uso habitual |
| --- | --- | --- |
| `127.0.0.1` | Solo el propio host | Desarrollo local o reverse proxy instalado en ese mismo host |
| `0.0.0.0` | Todas las interfaces IPv4 del host | Acceso desde LAN; es el valor predeterminado de este repositorio |
| Una IP concreta, por ejemplo `192.168.1.50` | Solo esa interfaz del host | Servidores con varias interfaces o redes |

`0.0.0.0` **no es una dirección para escribir en el navegador**. Es una
dirección de escucha. Usa una dirección real:

- Desde el mismo servidor: `http://localhost:5216` o
  `http://127.0.0.1:5216`.
- Desde otro equipo de la LAN: `http://IP_LAN_DEL_SERVIDOR:5216`, por ejemplo
  `http://192.168.1.50:5216`.
- Desde Internet: `https://NOMBRE_DNS`, después de configurar todas las capas
  de seguridad descritas más adelante.

Cambiar `MYSPEED_BIND_IP` **no** realiza ninguna de estas acciones:

- abrir el firewall del sistema operativo;
- crear una regla de entrada en AWS, Azure, Google Cloud u otro proveedor;
- configurar el reenvío de puertos del router o NAT;
- contratar o actualizar una IP pública;
- crear un registro DNS;
- obtener un certificado TLS;
- activar HTTPS;
- configurar una contraseña de MySpeed.

## 3. Comprobar la publicación de Docker

Desde el directorio del repositorio:

```bash
docker compose config
docker compose ps
docker compose port myspeed 5216
```

El resultado de `docker compose ps` debería mostrar una publicación equivalente
a `0.0.0.0:5216->5216/tcp`. Comprueba también desde el propio host:

```bash
curl -I http://127.0.0.1:5216
```

En PowerShell:

```powershell
Invoke-WebRequest http://127.0.0.1:5216 -Method Head
```

Una respuesta HTTP demuestra que contenedor, aplicación y publicación Docker
funcionan. Todavía no demuestra que el firewall o la red externa permitan el
acceso.

## 4. Encontrar la IP real del servidor

### Linux

```bash
ip -brief address
```

Busca una dirección privada de la interfaz conectada, normalmente dentro de
`10.0.0.0/8`, `172.16.0.0/12` o `192.168.0.0/16`. No uses la dirección de la
interfaz Docker (`docker0`) ni `127.0.0.1` desde otro equipo.

### Windows

```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' }
```

También se puede ejecutar `ipconfig` y localizar la dirección IPv4 del
adaptador Wi-Fi o Ethernet activo.

### macOS

```bash
ifconfig
```

Después, desde **otro equipo de la misma LAN**, prueba:

```bash
curl -I http://IP_LAN_DEL_SERVIDOR:5216
```

o abre `http://IP_LAN_DEL_SERVIDOR:5216` en el navegador.

## 5. Firewall: permitir solo el origen necesario

Abrir un puerto a toda Internet es más simple, pero no es el diseño recomendado.
Cuando sea posible, permite únicamente la subred del aula, una VLAN de gestión
o las direcciones del reverse proxy/VPN.

### Ejemplo con UFW en Ubuntu

Permitir solo la LAN `192.168.1.0/24`:

```bash
sudo ufw allow from 192.168.1.0/24 to any port 5216 proto tcp
sudo ufw status numbered
```

Para retirar posteriormente esa regla, identifica primero su número con
`sudo ufw status numbered` y elimina exactamente esa entrada.

### Ejemplo con firewalld

El siguiente ejemplo crea una regla para una subred concreta:

```bash
sudo firewall-cmd --permanent \
  --add-rich-rule='rule family="ipv4" source address="192.168.1.0/24" port protocol="tcp" port="5216" accept'
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

### Ejemplo con Windows Defender Firewall

En una consola de PowerShell ejecutada como administrador:

```powershell
New-NetFirewallRule `
  -DisplayName 'MySpeed HTTP desde LAN' `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 5216 `
  -RemoteAddress 192.168.1.0/24 `
  -Action Allow
```

Comprueba la regla:

```powershell
Get-NetFirewallRule -DisplayName 'MySpeed HTTP desde LAN'
```

Adapta la subred a tu entorno. No copies `192.168.1.0/24` si tu red usa otro
rango.

## 6. Contraseña de MySpeed

En el primer arranque, MySpeed inserta el valor `password=none`; por tanto, no
hay protección de aplicación hasta que el administrador la configure.

Secuencia recomendada:

1. Arranca el servicio sin abrir todavía firewall, NAT ni security groups.
2. Entra localmente mediante `http://127.0.0.1:5216` o desde una red de gestión.
3. Abre la configuración de MySpeed y establece una contraseña larga y única.
   El nombre exacto del menú puede variar con el idioma o la versión de la
   interfaz.
4. Cierra la sesión o usa una ventana privada y verifica que las operaciones
   protegidas solicitan la contraseña.
5. Solo entonces habilita el acceso para los orígenes autorizados.

La contraseña se guarda como hash en la base de datos. El archivo `.env` no
contiene esa contraseña. Por eso, cambiar o perder el volumen también cambia o
elimina esa configuración.

La contraseña de la aplicación es una defensa necesaria, pero no sustituye:

- TLS, porque HTTP transmite tráfico sin cifrar;
- el firewall, porque reduce la superficie expuesta;
- una VPN o un control de acceso del reverse proxy;
- actualizaciones, copias de seguridad y monitorización.

## 7. Acceso desde Internet

Para una demostración en Internet, la opción preferida es:

```text
Internet
   │ HTTPS 443
   ▼
VPN o reverse proxy con TLS y control de acceso
   │ red privada
   ▼
MySpeed HTTP 5216
```

### Opción recomendada: VPN

Una VPN evita publicar MySpeed directamente. El usuario se conecta primero a la
red privada y después abre la IP interna del servidor. Es apropiada para aulas,
equipos de administración y laboratorios permanentes.

### Opción recomendada: reverse proxy HTTPS

Un reverse proxy como Caddy, Nginx, Traefik o un proxy gestionado puede:

- escuchar en `443`;
- gestionar certificados válidos y renovación;
- redirigir HTTP a HTTPS;
- añadir autenticación o listas de direcciones permitidas;
- limitar solicitudes y registrar accesos;
- reenviar las peticiones a MySpeed en `http://HOST:5216`.

Si el proxy se ejecuta en el mismo host **fuera de Docker**, se puede cambiar
`MYSPEED_BIND_IP=127.0.0.1` para que solo él alcance el backend. Si el proxy se
ejecuta en otro contenedor, ambos deben compartir una red Docker y el diseño del
Compose debe adaptarse; `127.0.0.1` dentro de un contenedor siempre se refiere a
ese mismo contenedor.

No publiques simultáneamente el backend HTTP a Internet si el proxy ya lo
protege. La regla externa debería apuntar al proxy (`443`), no a `5216`.

### NAT y routers domésticos

Para recibir conexiones desde Internet puede ser necesario crear un reenvío de
puerto en el router. Eso solo funciona si el proveedor entrega una IP pública
alcanzable; con CGNAT puede no ser posible. Evita reenviar `5216` directamente.
Reenvía `443` al reverse proxy o utiliza una VPN.

### Security groups en la nube

En una VM cloud deben coincidir, como mínimo:

- la regla del security group o firewall de red;
- el firewall del sistema operativo;
- la publicación Docker;
- la dirección IP pública o balanceador;
- el DNS, si se usa un nombre;
- TLS y el control de acceso.

Restringe el origen a direcciones conocidas cuando la clase lo permita.

## 8. HTTPS nativo en el puerto 5217

El Compose publica `5217`, pero MySpeed solo crea el servidor HTTPS si encuentra
los dos archivos siguientes dentro del volumen persistente:

```text
/myspeed/data/certs/cert.pem
/myspeed/data/certs/key.pem
```

Publicar `5217:5217` **no activa HTTPS por sí solo**. Si falta cualquiera de los
archivos, HTTP puede estar sano mientras `https://...:5217` no responde.

### Instalar un certificado existente en el volumen

Supón que el host tiene `./certs/cert.pem` y `./certs/key.pem`. Mantén la clave
privada fuera de Git; el directorio local `certs/` no debe publicarse.

```bash
docker compose exec --user root myspeed mkdir -p /myspeed/data/certs
docker compose cp ./certs/cert.pem myspeed:/myspeed/data/certs/cert.pem
docker compose cp ./certs/key.pem myspeed:/myspeed/data/certs/key.pem
docker compose exec --user root myspeed chown -R bun:bun /myspeed/data/certs
docker compose exec --user root myspeed chmod 750 /myspeed/data/certs
docker compose exec --user root myspeed chmod 640 \
  /myspeed/data/certs/cert.pem /myspeed/data/certs/key.pem
docker compose restart myspeed
docker compose logs --tail=100 myspeed
```

En PowerShell se usan los mismos comandos Docker; cambia las continuaciones de
línea o ejecuta `chmod` en una sola línea:

```powershell
docker compose exec --user root myspeed chmod 640 /myspeed/data/certs/cert.pem /myspeed/data/certs/key.pem
```

En los logs debe aparecer que el servidor HTTPS escucha en `5217`. Prueba:

```bash
curl -vk https://127.0.0.1:5217/
```

`-k` es aceptable únicamente para comprobar un certificado autofirmado de
laboratorio. Un servicio real debe presentar un certificado cuyo nombre sea el
DNS usado por el cliente y cuya cadena sea confiable.

### Limitaciones del HTTPS nativo

- No automatiza la emisión ni renovación del certificado.
- La clave privada forma parte del volumen y debe incluirse en el modelo de
  respaldo y acceso.
- La aplicación lee los archivos al arrancar; tras renovarlos hay que reiniciar
  el servicio.
- El puerto continúa siendo `5217` salvo que se publique otro puerto del host,
  por ejemplo `443:5217`. Usar `443` puede requerir detener otro servicio que ya
  ocupe ese puerto.

Para una exposición permanente suele ser más sencillo y seguro terminar TLS en
un reverse proxy.

## 9. DNS y TLS son capas distintas

Un registro DNS solo traduce un nombre a una dirección. No abre puertos y no
cifra tráfico. Un certificado TLS prueba un nombre y permite cifrar; no crea el
registro DNS ni configura NAT. Antes de dar por finalizado el despliegue,
comprueba desde una red externa:

1. que el DNS resuelve la IP esperada;
2. que el puerto externo llega al proxy o servidor correcto;
3. que el certificado es válido para ese nombre y no está vencido;
4. que HTTP redirige a HTTPS, si existe HTTP público;
5. que MySpeed solicita la contraseña;
6. que no existe un camino alternativo directo a `5216`.

## 10. Lista de seguridad previa a una clase

- [ ] Se ha cambiado la contraseña inicial `none`.
- [ ] `.env` no está versionado ni contiene secretos publicados.
- [ ] El firewall permite únicamente las redes necesarias.
- [ ] No se confunde `0.0.0.0` con una URL de acceso.
- [ ] La publicación se ha probado desde el host y desde otro equipo.
- [ ] Si hay Internet, se usa VPN o reverse proxy HTTPS.
- [ ] El certificado y su clave no están en Git.
- [ ] La clave privada tiene permisos restrictivos.
- [ ] El DNS apunta al destino correcto.
- [ ] No hay una exposición paralela de `5216` que evite el proxy.
- [ ] Existe una copia de seguridad restaurable del volumen o de MySQL.
- [ ] Se sabe cómo cerrar la exposición al terminar la demostración.

## 11. Cerrar temporalmente el acceso externo

Para detener la aplicación sin borrar datos:

```bash
docker compose stop myspeed
```

Para mantenerla accesible solo desde el host, cambia en `.env`:

```dotenv
MYSPEED_BIND_IP=127.0.0.1
```

y recrea el contenedor para aplicar la publicación nueva:

```bash
docker compose up -d --force-recreate
```

Un simple `docker compose restart` no cambia la configuración de puertos del
contenedor existente.

## Siguiente lectura

- [Instalación y despliegue](06-instalacion-y-despliegue.md)
- [Operación, persistencia y copias de seguridad](07-operacion-persistencia-y-backup.md)
- [Solución de problemas](08-solucion-de-problemas.md)
