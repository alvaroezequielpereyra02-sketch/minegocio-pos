# 🔔 Configuración de Notificaciones Push (App Cerrada)

## Cómo funciona
1. El admin abre la app → se pide permiso de notificaciones → se guarda el token FCM en Firestore
2. Cuando un cliente hace un pedido → una Cloud Function detecta el nuevo documento en Firestore
3. La Cloud Function lee los tokens FCM de todos los admins y envía el push
4. El celular del admin recibe la notificación **aunque la app esté cerrada**

---

## Paso 1: Obtener la VAPID Key

1. Ir a [Firebase Console](https://console.firebase.google.com)
2. Seleccionar tu proyecto → ⚙️ Project Settings → Cloud Messaging
3. En la sección **Web Push certificates**, hacer clic en **Generate key pair**
4. Copiar la clave y pegarla en `.env` como `VITE_FIREBASE_VAPID_KEY`

---

## Paso 2: Configurar `firebase-messaging-sw.js`

Editar el archivo `public/firebase-messaging-sw.js` y reemplazar los `__REPLACE_*__`
con los valores reales de tu proyecto Firebase (los mismos que están en tu `.env`).

> ⚠️ Este archivo no puede usar `import.meta.env`, ya que es un Service Worker.
> Los valores deben escribirse directamente.

---

## Paso 3: Deployar la Cloud Function

```bash
# Instalar Firebase CLI (si no lo tenés)
npm install -g firebase-tools

# Loguear
firebase login

# Inicializar (solo la primera vez)
firebase init functions

# Instalar dependencias de las funciones
cd functions && npm install && cd ..

# Deploy solo de las funciones
firebase deploy --only functions
```

---

## Paso 4: Variable de entorno en la función

Si tu `VITE_STORE_ID` es distinto de `tienda-principal`, configurar en Firebase:

```bash
firebase functions:config:set store.id="tu_store_id"
```

Y en `functions/index.js` cambiá:
```js
const STORE_ID = process.env.STORE_ID || 'tienda-principal';
```

---

## Verificar que funciona

1. Abrí la app en Chrome/Android como admin
2. Debería aparecer un popup pidiendo permiso de notificaciones → **Permitir**
3. Cerrar la app completamente
4. Desde otro dispositivo/cuenta de cliente, hacer un pedido
5. El admin debe recibir la notificación push en su celular ✅
