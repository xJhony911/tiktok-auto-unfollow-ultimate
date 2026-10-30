# TikTok Auto-Unfollow Ultimate

Userscript experimental para gestionar tu lista de seguidos de TikTok Web. Versión 1.1.0, derivada del script de xjhony911. No afiliado a TikTok.

## Instalación

1. Instala Tampermonkey desde su [sitio oficial](https://www.tampermonkey.net/), que enlaza a las tiendas de extensiones.
2. Desactiva versiones anteriores de este script para evitar dos procesos simultáneos.
3. En Tampermonkey, crea un script, reemplaza el contenido por `tiktok-auto-unfollow.user.js` y guarda.
4. Si la extensión indica que necesita permiso para ejecutar userscripts, consulta su [guía oficial](https://www.tampermonkey.net/faq.php#Q209).
5. Abre directamente tu perfil en `https://www.tiktok.com/@tu_usuario`. Inicia sesión normalmente en TikTok.
6. Abre **Siguiendo**. Revisa la lista blanca y los filtros, pulsa **Iniciar** y confirma que estás en TU lista.

No necesitas pegar código en la consola ni compartir contraseñas o cookies.

## Uso

- Inicio manual después de cada recarga. Alt+P inicia/pausa y Alt+H oculta el panel.
- Mantén visible la pestaña. Ocultarla, navegar o cerrar la lista detiene la ejecución.
- Cada tanda termina al alcanzar su límite. No se reanuda automáticamente.
- Los perfiles ajustan el tamaño de tanda. El intervalo mínimo efectivo es 5 segundos; ningún intervalo garantiza evitar restricciones.
- Lista blanca: nombres de usuario separados por coma, con o sin @.
- Conserva opcionalmente amigos o verificados. La detección de insignias depende del DOM y puede fallar; usa la lista blanca para cuentas importantes.
- El historial CSV registra cambios observados en pantalla, NO confirmación del servidor. Recarga al terminar y verifica algunos perfiles.
- Para desinstalar, elimina el script desde Tampermonkey. Su configuración e historial permanecen en el almacenamiento local de TikTok hasta borrar esos datos.

## Si solo aparece una cuenta

La versión anterior recargaba todo el perfil después de cada grupo y asumía que llegarían 27 cuentas. La nueva conserva el modal y desplaza su contenedor para solicitar más filas; hace como máximo cinco intentos de carga de dos segundos antes de detenerse.

Esto corrige la recarga innecesaria, pero no puede obligar a TikTok a entregar más resultados. Una lista de una sola fila puede deberse a carga parcial, cambios de interfaz o restricciones; no demuestra por sí sola un bloqueo. Si ocurre, pausa, comprueba la lista manualmente y revisa posibles avisos. Si ni un cambio manual persiste tras recargar el perfil del usuario, resuelve primero ese problema en TikTok.

## Cambios y límites

- Botones restringidos al modal y a filas con usuario identificable.
- Se busca un botón nuevo después de cada cambio de React.
- Un clic sin cambio reconocido pausa la ejecución; no se pulsa automáticamente un diálogo de confirmación.
- Bloqueo de ejecuciones simultáneas con Web Locks en pestañas del mismo origen.
- CAPTCHA detectado: pausa para intervención manual. Detección heurística, no exhaustiva.
- Sin peticiones a APIs privadas, telemetría ni envío de historial fuera del navegador.
- El almacenamiento local es accesible al sitio TikTok. Evita exportar o publicar tu historial accidentalmente.
- Un cambio visual puede revertirse por rechazo del servidor. No se garantiza quitar todos los seguidos.
- El contador acumulado conserva el antiguo contador local; no significa «quitados hoy». ETA orientativa.

## Desarrollo y validación

Node.js 20 o posterior, sin dependencias:

```sh
npm test
```

Las pruebas comprueban selección y filtrado de botones con DOM simulado y sintaxis. No sustituyen pruebas en TikTok real. Prueba manual recomendada: lista con una fila, lista con scroll, lista blanca, pausa, pestaña oculta, respuesta sin cambio, captcha, dos pestañas. No se han ejecutado acciones en cuentas reales para validar esta versión.

## Publicación

El archivo incluye URLs de actualización para `xjhony911/tiktok-auto-unfollow-ultimate`. Si publicas un fork, cambia namespace, updateURL y downloadURL a TU repositorio antes de distribuirlo. Revisa esos destinos antes de instalar actualizaciones.

Reporta problemas con versión del navegador, idioma y mensaje del panel. No adjuntes cookies, tokens, archivos HAR ni HTML de tu sesión.
