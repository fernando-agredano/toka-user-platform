# Preguntas frecuentes de soporte

- **Responsable:** Mesa de Soporte
- **Versión:** 1.4
- **Última revisión:** 2026-10-01

## Contacto y horario de soporte

- Canal oficial: **soporte@toka.local**.
- Horario: lunes a viernes de 9:00 a 18:00 (hora del centro de México).
- Tiempo de primera respuesta: 4 horas hábiles; incidentes de seguridad, 1 hora hábil.
- Incluye siempre tu correo de acceso, la hora aproximada del problema y, si aparece, el **identificador de correlación** del mensaje de error. Nunca incluyas tu contraseña.

## No puedo iniciar sesión

**¿Dice "credenciales inválidas"?** Revisa mayúsculas (Bloq Mayús) y que el correo sea el correcto. Tras 5 intentos fallidos en 15 minutos la cuenta se bloquea.

**¿Dice "demasiados intentos"?** La cuenta está bloqueada temporalmente. Espera 15 minutos desde el último intento fallido y vuelve a probar. Soporte no puede desbloquearla antes.

**¿Dice "cuenta desactivada" o no te deja entrar aunque la contraseña es correcta?** Un administrador desactivó tu cuenta. Pide a tu responsable que solicite la reactivación.

**¿El servicio no está disponible (error 503)?** El sistema de permisos puede estar temporalmente caído. Espera un par de minutos; si persiste, avisa a soporte con el identificador de correlación.

## Olvidé mi contraseña

Hoy no existe recuperación de contraseña de autoservicio. Escribe a soporte; verificaremos tu identidad con tu responsable y un administrador gestionará el restablecimiento. Ver la política de contraseñas.

## Mi sesión se cierra sola

- Si recargas la página, la sesión se restaura sola. Si te lleva al inicio de sesión, tu token de renovación expiró (7 días) o fue revocado.
- Si usas la misma cuenta en varios navegadores y uno de ellos tenía un token antiguo, el sistema puede detectar un reuso y cerrar **todas** las sesiones por seguridad. Vuelve a iniciar sesión.
- Si un administrador te desactivó, todas tus sesiones se cierran.

## No veo una sección del menú o recibo "No tienes permiso"

Las secciones aparecen según tus permisos. Pide el rol adecuado siguiendo la política de roles y permisos. Si ya te asignaron el rol, **cierra sesión y vuelve a entrar** para que el permiso se cargue.

## Me registré pero no puedo usar el Asistente IA

El rol `USER` (que incluye `ai:use`) se asigna de forma automática unos segundos después del registro. Cierra sesión y vuelve a entrar. Si tras 5 minutos sigue sin funcionar, contacta a soporte.

## El Asistente IA dice que espere / "límite de solicitudes"

Cada usuario puede hacer 5 preguntas por minuto, y el asistente también comparte un límite global con el proveedor del modelo. Espera unos segundos antes de reintentar. Las preguntas repetidas sobre políticas suelen responderse desde caché y son instantáneas.

## El Asistente IA respondió "modo degradado"

El modelo de lenguaje no estaba disponible y el asistente te mostró directamente los fragmentos de documentación más relevantes. Puedes reintentar en un minuto.

## ¿Puedo cambiar mi correo?

No. El correo identifica la cuenta y no se puede editar. Si cambió tu correo corporativo, soporte creará una cuenta nueva y un administrador desactivará la anterior; el historial de auditoría de la anterior se conserva.

## ¿Puedo eliminar mi cuenta?

La plataforma no elimina cuentas, solo las desactiva, para conservar el historial de auditoría durante 365 días. Solicita la desactivación a tu responsable.

## ¿Quién puede ver mis datos?

Tu perfil (nombre, apellido, correo, estado) lo pueden ver quienes tengan `users:read` (roles `MANAGER` y `ADMIN`). Tus roles, quienes tengan `roles:read`. Tus inicios de sesión y acciones, quienes tengan `audit:read`. El Asistente IA aplica exactamente los mismos permisos que tu sesión: nunca muestra a un usuario datos que no podría ver en la interfaz.

## ¿Qué significa el identificador de correlación?

Es un código único que acompaña a cada petición en todos los servicios. Con él, soporte puede encontrar exactamente qué ocurrió en los registros. Cópialo del mensaje de error y adjúntalo a tu reporte.
