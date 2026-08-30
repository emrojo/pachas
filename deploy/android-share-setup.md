# Configurar Pachas como destino de compartir en Android nativo

## Requisitos previos

- JDK 17+ instalado
- Android Studio instalado
- `npx cap add android` ejecutado al menos una vez (genera la carpeta `android/`)

---

## Paso 1 — Generar el proyecto Android (solo la primera vez)

```bash
npm run build         # genera la carpeta out/
npx cap add android   # genera android/
npx cap sync          # copia los assets al proyecto nativo
```

---

## Paso 2 — Instalar el plugin de recepción de archivos compartidos

```bash
npm install @capacitor-community/receive-sharing-intent
npx cap sync
```

---

## Paso 3 — Modificar AndroidManifest.xml

Abre el archivo:
```
android/app/src/main/AndroidManifest.xml
```

Dentro del bloque `<activity android:name=".MainActivity" ...>`, añade estos `intent-filter` **antes del cierre** `</activity>`:

```xml
<!-- Recibir PDF compartido desde otra app (Gmail, Drive, WhatsApp...) -->
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="application/pdf" />
</intent-filter>

<!-- Recibir imagen compartida desde otra app -->
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="image/*" />
</intent-filter>

<!-- Recibir múltiples imágenes a la vez -->
<intent-filter>
    <action android:name="android.intent.action.SEND_MULTIPLE" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="image/*" />
</intent-filter>
```

---

## Paso 4 — Sincronizar y abrir en Android Studio

```bash
npx cap sync
npx cap open android
```

Desde Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**

---

## Paso 5 — Verificación manual

1. Instala el APK en el dispositivo.
2. Abre Gmail → adjunto PDF → icono de compartir.
3. Debe aparecer **Pachas** en la lista.
4. Al seleccionarlo, se abre Pachas con el modal "Factura recibida".
5. Elige el grupo → pulsa "Escanear y añadir gasto".
6. El gasto aparece en el grupo con los datos del PDF.

---

## iOS (Share Extension)

El plugin `@capacitor-community/receive-sharing-intent` también crea automáticamente
una Share Extension en iOS al hacer `cap sync`. Para iOS:

```bash
npx cap open ios
# En Xcode: Product → Build
```

No requiere cambios manuales en archivos de configuración iOS.
