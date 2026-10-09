# Política de contraseñas y seguridad de la cuenta

- **Responsable:** Equipo de Seguridad de la Información
- **Versión:** 2.0
- **Última revisión:** 2026-09-15
- **Aplica a:** todas las cuentas de Toka User Platform

## Requisitos de la contraseña

Toda contraseña debe cumplir, a la vez:

- Entre **8 y 128 caracteres**.
- Al menos **una letra minúscula**.
- Al menos **una letra mayúscula**.
- Al menos **un número**.
- Al menos **un símbolo** (cualquier carácter que no sea letra ni número, por ejemplo `! @ # $ % - _`).

La validación se hace en el formulario y también en el servidor. Si la contraseña no cumple, el mensaje indica qué requisito falta.

Recomendaciones adicionales (no obligatorias, pero muy recomendables):

- Usar una frase de contraseña de 14 caracteres o más, por ejemplo cuatro palabras no relacionadas con un número y un símbolo.
- No reutilizar la contraseña de otros servicios.
- Usar un gestor de contraseñas.

## Almacenamiento

Las contraseñas nunca se guardan en texto plano ni se pueden recuperar. Se almacenan con el algoritmo de hash **argon2**. Ningún administrador, ni el equipo de soporte, ni el Asistente IA puede ver la contraseña de un usuario. Nadie de Toka te pedirá tu contraseña por correo, chat o teléfono.

## Bloqueo por intentos fallidos

- Tras **5 intentos fallidos de inicio de sesión en 15 minutos**, la cuenta se bloquea temporalmente.
- Mientras dura el bloqueo, cualquier intento devuelve un error de "demasiados intentos", incluso con la contraseña correcta.
- El bloqueo se levanta solo cuando termina la ventana de 15 minutos. No hace falta contactar a soporte.
- Cada bloqueo genera el evento de auditoría `auth.login.locked`, y cada intento fallido el evento `auth.login.failed`, con la IP y el navegador de origen.

Si recibes bloqueos sin haber intentado entrar, alguien podría estar probando tu cuenta: avisa a seguridad.

## Sesiones y tokens

- Al iniciar sesión se emite un **token de acceso válido por 15 minutos** y un **token de renovación válido por 7 días**.
- El token de acceso vive solo en la memoria del navegador; al recargar la página la sesión se restaura con el token de renovación, que se guarda en una cookie protegida (`httpOnly`) que el código de la página no puede leer.
- El token de renovación **rota en cada uso**. Si un token de renovación ya usado se vuelve a presentar, el sistema lo interpreta como un posible robo y **revoca todas las sesiones** de esa cuenta.
- **Cerrar sesión** invalida inmediatamente el token de acceso y el de renovación.
- Si un administrador **desactiva** una cuenta, todas sus sesiones se revocan.

## Cambio y recuperación de contraseña

En la versión actual de la plataforma **no existe** un flujo de autoservicio para cambiar o recuperar la contraseña. Si la olvidaste o crees que está comprometida:

1. Contacta a soporte desde el canal oficial indicado en la FAQ.
2. Soporte verificará tu identidad con tu responsable directo.
3. Un administrador desactivará la cuenta (cortando las sesiones activas) y gestionará el restablecimiento.

## Buenas prácticas de seguridad

- Cierra sesión en equipos compartidos.
- No compartas tu cuenta. Cada acción queda auditada a nombre de quien inició sesión.
- No pegues contraseñas, tokens ni datos personales de terceros en el Asistente IA.
- Reporta de inmediato correos o mensajes que pidan tus credenciales.

## Reporte de incidentes de seguridad

Cualquier sospecha de acceso indebido se reporta a **seguridad@toka.local** dentro de las primeras 24 horas, indicando fecha aproximada, usuario afectado y qué se observó. No intentes investigar por tu cuenta accediendo a datos de otros usuarios.
