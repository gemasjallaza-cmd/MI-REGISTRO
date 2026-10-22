# Mi Registro — instrucciones

Aplicación web instalable (PWA) para controlar faltantes, sobrantes y cruces.

## Arquitectura elegida
- **Datos en el propio teléfono** (almacenamiento local del navegador). Sin cuentas, sin servidor, sin claves.
- Funciona **sin conexión** tras la primera carga.
- **Limitación importante:** los datos quedan SOLO en el dispositivo donde los guardas. No se sincronizan con tu computadora.
  Si borras los datos de Chrome o desinstalas la app, se pierden: haz copias de seguridad con regularidad (menú ⋮ → Crear copia de seguridad).
- Si más adelante necesitas sincronizar PC y teléfono, el siguiente paso sería Firebase Authentication + Cloud Firestore (requiere un proyecto de Firebase, reglas de seguridad y un inicio de sesión). No está incluido para no añadir complejidad innecesaria.

## Publicar gratis con Firebase Hosting (HTTPS incluido)
1. Crea un proyecto en https://console.firebase.google.com (plan gratuito Spark).
2. En tu computadora instala Node.js (https://nodejs.org) y en una terminal ejecuta:
   `npm install -g firebase-tools`
3. Entra en la carpeta de la app (donde está index.html) y ejecuta:
   `firebase login`
   `firebase init hosting` → elige tu proyecto; carpeta pública: `.` ; "single-page app": No ; NO sobrescribas index.html ni firebase.json.
4. `firebase deploy --only hosting`
5. Firebase te dará una dirección tipo `https://tu-proyecto.web.app`.

(Alternativas sin terminal: Netlify Drop https://app.netlify.com/drop — arrastra la carpeta — o GitHub Pages.)

## Instalar en Android
1. Abre la dirección HTTPS en **Google Chrome** del teléfono y espera a que cargue por completo.
2. Menú ⋮ de Chrome → **Instalar aplicación** (o «Añadir a la pantalla principal»). También aparece la opción en el menú ⋮ de la app.
3. Abre «Mi Registro» desde el icono: se verá a pantalla completa, sin barra del navegador.

## Probar en local (opcional)
`python3 -m http.server 8080` en esta carpeta y abrir http://localhost:8080 (localhost cuenta como seguro para pruebas).

## Notas de uso
- La app abre en **Pendientes**. Pulsa − para descontar de uno en uno, ＋ para corregir, o toca el número para escribir la cantidad.
- Al llegar a 0 el registro pasa solo a **Resueltos** (no se borra). En Resueltos puedes **Reabrir**.
- Estado = según la cantidad: 0 es Resuelto, más de 0 es Pendiente.
- CSV: separador «;» y codificación para abrir directo en Excel en español.
- Al actualizar la app, cambia `CACHE = 'mi-registro-v1'` en sw.js (v2, v3…) antes de volver a publicar.

## Historial por fecha (versión 2)
- Cada registro guarda la cantidad pendiente de cada día en que se modificó (si cambias varias veces el mismo día, queda la cantidad final de ese día).
- Se ve con el botón «Historial» de cada tarjeta, y va incluido en el CSV y en la copia de seguridad (.json).
- Si ya habías publicado la versión 1, sube todos los archivos de nuevo; los datos guardados en tu teléfono se conservan.
