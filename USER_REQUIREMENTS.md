# 📋 Registro de Requisitos de Usuario y Funcionalidades — Pachas

Este documento es el registro oficial y permanente de todos los **requisitos de usuario**, decisiones de diseño y funcionalidades solicitadas para la aplicación **Pachas**. Se mantendrá actualizado de forma continua con cada nueva petición, ajuste o retirada de funcionalidad.

---

## 📌 1. Requisitos Funcionales (RF)

### 👥 RF-01: Gestión de Grupos Temáticos de Vacaciones
- **RF-01.1**: El usuario puede crear grupos específicos para cada viaje o escapada indicando: nombre, descripción, selector visual de emojis temáticos (🏖️, 🏔️, 🍕, ✈️, etc.) o subida de foto de portada, y moneda base del grupo.
- **RF-01.2**: Panel de control con listado de viajes activos, total gastado y estado de saldo neto personal.
- **RF-01.3**: **Edición de Icono, Portada y Ajustes del Viaje**: Posibilidad de modificar en cualquier momento el icono/emoji del grupo, su nombre, descripción y moneda base, así como **subir una fotografía o imagen personalizada** desde el dispositivo o seleccionar fotos temáticas de galería para usar como imagen de portada y cabecera del viaje.

### 🔗 RF-02: Invitaciones y Adhesión al Grupo
- **RF-02.1**: Generación de un enlace de invitación único por grupo (`/join/[inviteCode]`).
- **RF-02.2**: Generación de un **código QR** escaneable directamente desde la cámara del móvil.
- **RF-02.3**: Botón de acceso directo para **compartir la invitación por WhatsApp** con mensaje preformateado.
- **RF-02.4**: Opción para invitar o añadir amigos manualmente mediante su correo electrónico.

### 🔐 RF-03: Modelo de Autenticación y Perfil
- **RF-03.1**: Registro e inicio de sesión obligatorio con correo electrónico / contraseña o Google OAuth.
- **RF-03.2**: Perfil de usuario con nombre completo, avatar y campo para **teléfono de Bizum** (para facilitar los cobros de deudas).
- **RF-03.3**: Herramienta de cambio rápido entre usuarios demo para simular la experiencia multiusuario.

### 🧾 RF-04: Publicación y Formulario de Gastos
- **RF-04.1**: Formulario optimizado para escritorio y móvil con **separación en 2 líneas principales**:
  - *Línea 1*: Campo amplio para el **Concepto / Título** del gasto.
  - *Línea 2*: Fila dedicada y prominente para el **Importe numérico y selector de Divisa**.
- **RF-04.2**: **Secciones colapsadas por defecto** para ahorrar espacio visual:
  - *¿Quién pagó el gasto?*: Colapsada por defecto mostrando el pagador activo (tú por defecto); expandible para cambiar de pagador o dividir entre varios.
  - *¿Con quién se comparte?*: Colapsada por defecto indicando que está compartido con todos a partes iguales; expandible para personalizar participantes o modo de reparto.
- **RF-04.3**: Clasificación por categorías con emojis (Comida 🍽️, Alojamiento 🏨, Transporte 🚗, Ocio 🎟️, Supermercado 🛒, Otros 💡).
- **RF-04.4**: Adjuntar foto del ticket/recibo como justificante fotográfico con visor a pantalla completa.
- **RF-04.5**: **Comportamiento Multidivisa**:
  - En el **listado de gastos**: Las entradas en moneda extranjera muestran directamente el **valor en su moneda original** (ej. `150,00 $` o `22.000 ¥`) con una etiqueta de divisa, sin convertirlo en la tarjeta principal.
  - En la **vista de detalle / edición**: Se muestra un panel con el **valor en la moneda original**, el **tipo de cambio aplicado** (editable) y el **valor equivalente convertido en la moneda base del grupo** (ej. `138,89 €`).

### 🍕 RF-05: Reparto Flexible de Gastos
- **RF-05.1**: **Partes iguales**: División equitativa entre todos los amigos o seleccionando solo a quienes participaron (con distribución exacta de céntimos residuales sin pérdidas).
- **RF-05.2**: **Cantidades exactas (€)**: Asignación de importes específicos a cada participante.
- **RF-05.3**: **Porcentajes (%)**: Asignación porcentual asegurando la suma del 100%.
- **RF-05.4**: **Raciones / Partes**: Asignación por raciones ponderadas (ideal para parejas, familias o consumos desiguales).
- **RF-05.5**: **Múltiples pagadores**: Posibilidad de que varios amigos abonen diferentes partes de un mismo ticket.

### ✏️ RF-06: Edición y Control de Permisos (Creador)
- **RF-06.1**: Posibilidad de editar cualquier gasto registrado (concepto, importe, categoría, fecha, pagadores, reparto, foto y ubicación).
- **RF-06.2**: **Restricción estricta de edición**: Solo el usuario que creó el gasto puede editarlo. Para los demás miembros los controles de edición permanecen ocultos e inaccesibles.
- **RF-06.3**: **Restricción estricta de borrado**: Solo el usuario que creó el gasto puede eliminarlo.

### 🧠 RF-07: Algoritmo de Liquidación y Saldos (Debt Simplification)
- **RF-07.1**: Cálculo en tiempo real del balance neto individual de cada miembro ($\sum \text{Pagado} - \sum \text{Consumido} + \sum \text{Saldado}$).
- **RF-07.2**: **Algoritmo de simplificación de deudas**: Minimiza el número total de pagos necesarios para saldar todas las cuentas del viaje ($O(N)$ transacciones).
- **RF-07.3**: Modal de **Saldar Deuda** con sugerencia automática del número de Bizum del beneficiario, botón de copia rápida y registro de la liquidación.
- **RF-07.4**: Animación festiva de confetti al confirmar un pago de liquidación.

### 🇪🇺 RF-08: Estándares Europeos (Fechas y Cantidades)
- **RF-08.1**: **Cantidades numéricas en formato europeo**: Uso de **coma (`,`) para decimales** y punto (`.`) para millares (ej. `1.250,50 €`).
- **RF-08.2**: **Entrada flexible de decimales**: Acepta tanto coma `,` como punto `.` en cualquier campo de texto o importe numérico.
- **RF-08.3**: **Formato de fecha europeo**: Presentación estándar `DD/MM/YYYY` (ej. `15/08/2026`) y `DD/MM/YYYY HH:mm` en registros y reportes.

### 📄 RF-09: Exportación de Informes
- **RF-09.1**: **Descarga de informe completo en PDF con Gráficas Vectoriales y Desglose Individual**:
  - *Página 1*: Cabecera oficial del viaje, tarjetas de métricas/KPIs clave, **Gráfica de Evolución Temporal de Gastos por Día** (barras vectoriales nítidas con importes y fechas) y **Gráfica de Distribución de Gastos por Categoría** (barras de porcentaje y totales).
  - *Página 2*: **Gráfica Comparativa por Amigo (Total Pagado vs Consumido)**, Tabla completa de saldos por participante y Propuesta de Liquidación con Bizum.
  - *Página 3*: **Historial General de Gastos**: Tabla completa con todos los gastos del viaje (fecha, concepto, categoría, pagador, importes en moneda original y convertida).
  - *Página 4 en adelante*: **Desglose Individual de Gastos por Persona**: Sección dedicada para cada amigo del grupo con su tarjeta de resumen (Total Pagado, Total Consumido, Saldo Neto) y una tabla detallada con todos los gastos en los que participó o pagó, indicando el total del ticket, lo que pagó esa persona y su consumo/reparto exacto para verificación personal.
- **RF-09.2**: Descarga en formato **CSV / Excel europeo** con separador de columnas punto y coma (`;`) y decimales con coma (`,`).

### 📍 RF-10: Geolocalización y Mapas de Gastos (Google Maps)
- **RF-10.1**: **Detección de presencia física**: Checkbox *"Me encuentro físicamente en el sitio del pago"* que captura con alta precisión las coordenadas GPS del dispositivo móvil/navegador y autocompleta el nombre del establecimiento o dirección mediante geocodificación inversa.
- **RF-10.2**: **Geolocalización manual**: Buscador de lugares, restaurantes y calles para ubicar gastos a posteriori.
- **RF-10.3**: **Visor y edición de ubicación**: Al editar un gasto, muestra un mapa interactivo con la ubicación guardada y permite cambiarla, actualizarla con la posición actual o eliminarla.
- **RF-10.4**: **Acceso rápido desde el listado**: Cada gasto con ubicación muestra un chip/botón con icono de pin 📍 para abrir el mapa interactivo y un enlace directo para abrir el punto exacto en la app nativa de Google Maps.

### 📥 RF-11: Importación Masiva de Gastos desde Excel / CSV
- **RF-11.1**: Carga de archivos `.csv`, `.txt`, `.tsv` o pegado directo de texto desde hojas de cálculo (Excel, Numbers, Google Sheets).
- **RF-11.2**: Soporte automático de separadores (`;`, `,`, tabulaciones) y comas decimales europeas.
- **RF-11.3**: Botón de **descarga de plantilla oficial en CSV** con las cabeceras predefinidas (`Fecha;Concepto;Categoría;Importe;Divisa;Pagado Por;Repartir Entre;Notas`) y sugerencias personalizadas con los nombres de los miembros del grupo.
- **RF-11.4**: Normalización automática de categorías, fechas y tipos de cambio.
- **RF-11.5**: **Tabla interactiva de vista previa**: Validación visual de filas con estado de errores/advertencias y posibilidad de eliminar o ajustar filas antes de confirmar.
- **RF-11.6**: **Validación Estricta y Reconocimiento de "Todos"**: Comprobación estricta de miembros del grupo; si se indica `"Todos"`, `"All"`, `"todos los miembros"` o se deja vacío el campo de participantes, se asigna automáticamente a la totalidad de amigos registrados en el grupo sin generar error.
- **RF-11.7**: **Bloqueo Preventivo de Importación**: La importación queda inhabilitada y falla si se intenta ejecutar habiendo filas con errores sin corregir o eliminar.
- **RF-11.8**: **Opción de Deshacer Importación (Undo Import)**: Posibilidad de revertir el último lote importado con un solo clic eliminando los gastos creados y recalculando los balances del grupo.
- **RF-11.9**: **Popup / Modal de Detalle Completo de Errores**: Permite hacer clic en cualquier celda o botón de error en la tabla de vista previa para abrir un modal con la explicación detallada de por qué falló la fila, sus valores originales, sugerencias de solución y un botón para eliminar la fila directamente desde el popup.
- **RF-11.10**: **Soporte de Múltiples Pagadores en Importación**: Capacidad de procesar gastos pagados por varios usuarios indicando cantidades desglosadas (ej. `Eduardo: 350 + Carlos: 250` o `Eduardo: 350; Carlos: 250`) o a partes iguales (ej. `Eduardo + Carlos`), repartiéndose entre `Todos` o participantes concretos.

### 👥 RF-12: Creación de Usuarios de Prueba y Simulación Local
- **RF-12.1**: **Modal de creación de usuarios locales**: Permite crear perfiles ficticios para pruebas indicando nombre completo, correo electrónico, teléfono de Bizum, selector de avatar fotográfico y opción de inclusión automática en todos los grupos existentes.
- **RF-12.2**: **Selector rápido de usuario en Navbar**: Desplegable accesible desde cualquier pantalla para cambiar de sesión con 1 clic entre todos los usuarios disponibles o crear uno nuevo.
- **RF-12.3**: **Gestión desde Perfil y Login**: Pantalla de perfil (`/profile`) y login (`/login`) con acceso directo a todos los usuarios de prueba y botón para eliminar perfiles creados localmente.
- **RF-12.4**: **Persistencia Local**: Los usuarios creados se guardan en `localStorage` manteniéndose disponibles en futuras sesiones.
- **RF-12.5**: **Persistencia del Usuario Activo entre Recargas**: Al cambiar de usuario activo (mediante el selector de la barra de navegación, la pantalla de login o perfil), el usuario seleccionado se persiste inmediatamente en `localStorage`, de modo que al recargar la página (F5) o volver a abrir la aplicación se mantiene logueado el mismo usuario seleccionado.

### 🧭 RF-13: Registro de Hora con Timezone e Itinerario Histórico en Mapa
- **RF-13.1**: **Registro de Hora y Timezone**: Al crear o editar un gasto se registra la hora exacta por defecto (hora actual) preservando el huso horario / timezone ISO (`YYYY-MM-DDTHH:mm:ss±HH:MM`) con visualización de la zona horaria del usuario.
- **RF-13.2**: **Visualización de Hora en Listado**: Las tarjetas de gasto muestran la fecha y hora (`d MMM, HH:mm`, ej: `20 ago, 20:44`).
- **RF-13.3**: **Itinerario de Pagos en Mapa (`TripRouteMapModal`)**: Visor interactivo que ordena cronológicamente todos los gastos geolocalizados del viaje, muestra las paradas numeradas (1, 2, 3...), el mapa interactivo con la posición seleccionada y un botón para abrir la **ruta completa de navegación en Google Maps** con waypoints.
- **RF-13.4**: **Línea de Tiempo del Viaje**: Feed cronológico de paradas con desglose de importe, moneda, concepto, pagador y hora exacta.

### ⏱️ RF-14: Ordenación Temporal de Gastos en el Listado
- **RF-14.1**: **Ordenación por defecto (Más recientes primero)**: Las entradas de gastos del grupo se presentan ordenadas cronológicamente de forma descendente por fecha de gasto (`expense_date` / `created_at`) mostrando los gastos más recientes arriba.
- **RF-14.2**: **Selector interactivo de orden**: Botones de conmutación integrados junto a la barra de búsqueda para alternar en cualquier momento entre **"Más recientes"** y **"Más antiguas"** (ascendente), plenamente compatible con filtros de categoría y búsquedas por texto.

### 👤 RF-15: Baja y Eliminación de Miembros del Grupo
- **RF-15.1**: **Quitar amigos del grupo**: Los administradores del viaje pueden eliminar participantes del grupo directamente desde la pestaña de *"Amigos"*, así como los miembros pueden abandonar el grupo.
- **RF-15.2**: **Modal de confirmación**: Cuadro de diálogo de confirmación preventiva antes de proceder a la eliminación del miembro para evitar bajas accidentales.

### 📦 RF-16: Archivado y Restauración de Grupos (Solo Administrador)
- **RF-16.1**: **Control exclusivo de Administrador**: Solo los administradores de un viaje tienen permisos para archivar o restaurar el grupo.
- **RF-16.2**: **Ocultación de la vista principal**: Los viajes archivados desaparecen del panel principal de grupos activos y no se contabilizan en los saldos generales.
- **RF-16.3**: **Bloqueo de acceso a miembros**: Si un miembro no administrador intenta acceder directamente a la URL de un grupo archivado, la aplicación muestra una pantalla de bloqueo informativo.
- **RF-16.4**: **Sección separada en Dashboard**: Los grupos archivados se muestran en una sección independiente en el Dashboard (*"Viajes Archivados"*) visible únicamente para el administrador, con fecha de archivado, enlace al historial y botón de **"Restaurar"** directo.
- **RF-16.5**: **Banner informativo y gestión desde Ajustes**: Al entrar el administrador a un grupo archivado se muestra un banner superior para restaurarlo, y en el modal de Ajustes del Grupo (`EditGroupModal`) se incluye la *"Zona de Administrador"* para archivar/restaurar con 1 clic.

### 📊 RF-17: Gráficas y Estadísticas de Gastos (Temporales y por Persona)
- **RF-17.1**: **Pestaña y Modal de Estadísticas y Gráficas (`ExpenseChartsView` / `ExpenseChartsModal`)**: Accesible tanto como pestaña principal (*"Gráficas & Análisis"*) en el panel del viaje como mediante el botón de acceso directo *"Gráficas"* en la cabecera.
- **RF-17.2**: **Selector de Granularidad Temporal**:
  - *Por Horas*: Agrupa los gastos en franjas horarias (`HH:00 - HH:00`) y día.
  - *Por Días*: Evolución y desembolso día a día de todo el viaje.
  - *Por Semanas*: Comparativa agrupada por semanas de calendario.
  - *En Total*: Resumen global acumulado del viaje con distribución porcentual por categorías (comida, hotel, ocio, transporte...).
- **RF-17.3**: **Desglose de Totales y por Persona**:
  - *Por Pagador*: Gráfica de barras apiladas con colores asignados que muestra quién adelantó el dinero en cada intervalo.
  - *Por Consumo*: Gráfica de barras apiladas con el consumo/reparto asignado a cada amigo en cada tramo.
  - *Total Global*: Gráfica con las barras del importe total del grupo sin desglosar.
- **RF-17.4**: **Filtro interactivo de amigos**: Leyenda con chips interactivos para activar/desactivar amigos específicos en la gráfica y comparar gastos individuales.
- **RF-17.5**: **Detalle interactivo (Drill-down)**: Al hacer clic sobre cualquier barra o intervalo temporal, se despliega una tarjeta de desglose con el detalle de cantidades por persona y la lista de gastos individuales incluidos en esa franja.
- **RF-17.6**: **Tarjetas de KPIs**: Resumen superior con gasto total del viaje, media por participante, pico de gasto máximo y número de intervalos con actividad.

### 📱 RF-18: Navegación de Pestañas con Controles de Flechas para Móvil
- **RF-18.1**: **Botones de Navegación Rápida Anterior/Siguiente**: Inclusión de botones con flechas (<kbd>&lt;</kbd> y <kbd>&gt;</kbd>) a ambos lados de la barra de pestañas para cambiar de sección con 1 toque sin necesidad de arrastre táctil forzado.
- **RF-18.2**: **Desplazamiento Automático y Centrado**: Al cambiar de pestaña (manualmente o mediante las flechas), la barra se desplaza de forma fluida (`scrollIntoView` suave) para mantener la pestaña seleccionada siempre visible y centrada en pantalla.
- **RF-18.3**: **Indicadores Visuales y Estados Deshabilitados**: Las flechas indican claramente el límite de navegación (deshabilitadas en el primer y último elemento) y las pestañas cuentan con bordes redondeados y fondos táctiles adaptados para dispositivos móviles y pantallas táctiles.

---

## ⚙️ 2. Requisitos No Funcionales (RNF)

- **RNF-01**: **Diseño Mobile-First**: Experiencia nativa fluida en teléfonos móviles con barra de navegación inferior (`BottomNav`) y compatibilidad total con pantallas de escritorio.
- **RNF-02**: **PWA (Progressive Web App)**: Manifiesto configurado para permitir la instalación de la aplicación en la pantalla de inicio del móvil.
- **RNF-03**: **Seguridad y RLS**: Políticas de Row Level Security en PostgreSQL para garantizar que ningún usuario ajeno a un grupo pueda ver o modificar sus datos.
- **RNF-04**: **Persistencia y Modo Offline**: Almacenamiento interactivo con `localStorage` como fallback inmediato y sincronización con Supabase.

---

## 📜 3. Historial de Cambios y Versiones (Changelog)

| Fecha | Tipo | Requisito / Cambio | Descripción |
|---|---|---|---|
| **20/08/2026** | ✨ Añadido | **RF-01 a RF-05** | Creación inicial de la app: Grupos temáticos, invitaciones por enlace/QR/WhatsApp, reparto flexible (igual, exacto, %, raciones), múltiples pagadores y fotos de tickets. |
| **20/08/2026** | ✨ Añadido | **RF-07 & RF-09** | Algoritmo de minimización de deudas, modal de liquidación con Bizum + confetti y exportación a PDF/CSV. |
| **20/08/2026** | 🎨 Modificado | **RF-04.1 & RF-04.2** | Separación del formulario de gastos en dos líneas independientes (Concepto e Importe) y colapso por defecto de las secciones "¿Quién pagó?" y "¿Con quién se comparte?". |
| **20/08/2026** | 🇪🇺 Modificado | **RF-08** | Adaptación al estándar europeo: coma decimal (`,`), fechas en formato `DD/MM/YYYY` y soporte de entrada con `,` y `.`. |
| **20/08/2026** | 🔒 Añadido | **RF-06** | Funcionalidad de edición de gastos y restricción de permisos: solo el creador original de un gasto puede editarlo o borrarlo. |
| **20/08/2026** | 🌍 Modificado | **RF-04.5** | Visualización en listado del valor original en moneda extranjera sin convertir, y desglose en edición con valor original, tipo de cambio aplicado y valor en la moneda del viaje. |
| **20/08/2026** | 🐛 Corregido | **RF-04.5 & RF-05** | Corrección en la validación y cálculo de repartos multidivisa: el reparto se valida en la divisa de la transacción y se convierte coherentemente a la moneda base del grupo para saldos y deudas. |
| **20/08/2026** | 📍 Añadido | **RF-10** | Geolocalización GPS automática (checkbox presencial), geocodificación inversa de nombres de locales, buscador manual de direcciones, visor embebido de Google Maps y opción de visualización/edición al modificar un gasto. |
| **20/08/2026** | 🐛 Corregido | **RF-09** | Corrección en el cálculo y visualización de multidivisas en informes descargados (PDF y CSV): conversión precisa de cada gasto a la moneda base del grupo con desglose de importe original y tipo de cambio. |
| **20/08/2026** | 📥 Añadido | **RF-11** | Importación masiva de gastos mediante subida de archivos CSV/Excel o pegado de tabla, con descarga de plantilla oficial, detección inteligente de separadores y vista previa interactiva. |
| **20/08/2026** | 🛡️ Modificado | **RF-11.6 - RF-11.8** | Validación estricta de usuarios del grupo al importar (bloqueo y fallo si hay usuarios desconocidos o filas con error) y funcionalidad para **Deshacer Importación** completa. |
| **20/08/2026** | 👥 Añadido | **RF-12** | Creación y gestión de usuarios de prueba en modo local con selector rápido en Navbar, perfil y login, auto-adhesión a grupos y persistencia en localStorage. |
| **20/08/2026** | 🎨 Añadido | **RF-01.3** | Edición de icono y fotografía del grupo: soporte para subida de fotos personalizadas desde el dispositivo, galería temática, cambio de emojis y modal de ajustes (`EditGroupModal`). |
| **20/08/2026** | 🧭 Añadido | **RF-13** | Registro de hora con timezone por defecto e itinerario histórico de paradas de pago en mapa (`TripRouteMapModal`) con ruta multietapa en Google Maps. |
| **20/08/2026** | 📥 Modificado | **RF-11.6** | Soporte para alias `"Todos"` / `"All"` al importar gastos en Excel/CSV, asociando el reparto automáticamente a todos los amigos del grupo. |
| **20/08/2026** | 🔍 Añadido | **RF-11.9** | Modal emergente (popup) para ver el texto completo del error de cualquier fila en la vista previa de importación con sugerencias de solución y acción de borrado directo. |
| **20/08/2026** | 💰 Añadido | **RF-11.10** | Soporte de múltiples pagadores en importación CSV/Excel con importes desglosados (`Eduardo: 350 + Carlos: 250`) o a partes iguales (`Eduardo + Carlos`). |
| **20/08/2026** | ⏱️ Añadido | **RF-14** | Selector de ordenación temporal de gastos en la vista de detalle del grupo (más recientes por defecto vs más antiguas). |
| **20/08/2026** | 👤 Añadido | **RF-15** | Opción para quitar amigos del grupo con modal de confirmación y permisos de administrador. |
| **20/08/2026** | 📦 Añadido | **RF-16** | Archivado y restauración de grupos solo para administradores: ocultación de la vista principal, bloqueo a miembros y sección dedicada en Dashboard. |
| **20/08/2026** | 💾 Modificado | **RF-12.5** | Persistencia inmediata del usuario seleccionado en `localStorage` para mantener la sesión tras recargar la página. |
| **20/08/2026** | 📊 Añadido | **RF-17** | Gráficas interactivas y estadísticas de gastos integradas en pestaña principal y modal, con soporte para horas, días, semanas y total, filtros de amigos y KPIs. |
| **20/08/2026** | 🐛 Corregido | **RF-17** | Corrección en el renderizado y alturas de las barras apiladas de la gráfica: cálculo explícito de altura de pista (`CHART_TRACK_HEIGHT`) y dimensionamiento de segmentos con `flex-grow`. |
| **20/08/2026** | 📱 Añadido | **RF-18** | Controles de flechas de navegación previa/siguiente y auto-scroll centrado en la barra de pestañas para facilitar la navegación en dispositivos móviles. |
| **20/08/2026** | 📊 Añadido | **RF-09.1** | Inclusión de gráficas vectoriales completas en el informe PDF descargable: evolución temporal de gastos por día, distribución porcentual por categorías y comparativa pagado vs consumido por amigo. |
| **20/08/2026** | 👤 Añadido | **RF-09.1** | Desglose individualizado de gastos por persona en el informe PDF para verificación personal: tablas dedicadas por participante con total del ticket, importe pagado, consumo asignado y saldo neto. |
| **20/08/2026** | 📋 Actualizado | **Documentación** | Actualización continua del registro de Requisitos de Usuario (`USER_REQUIREMENTS.md`) con todas las nuevas funcionalidades y correcciones. |
