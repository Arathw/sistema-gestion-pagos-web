# Sistema de Gestión de Pagos - Aplicación Web

## 🚀 Despliegue en Vercel

### Opción 1: Despliegue Automático (Recomendado)

1. **Fork este repositorio** en GitHub
2. **Ve a [vercel.com](https://vercel.com)** y crea una cuenta
3. **Conecta tu repositorio** de GitHub con Vercel
4. **Selecciona el directorio** `web-app` como directorio raíz
5. **Vercel detectará automáticamente** que es una aplicación Node.js
6. **¡Listo!** Tu aplicación estará disponible en una URL como `https://tu-app.vercel.app`

### Opción 2: Despliegue Manual

1. **Instala Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Navega al directorio:**
   ```bash
   cd web-app
   ```

3. **Inicia sesión en Vercel:**
   ```bash
   vercel login
   ```

4. **Despliega:**
   ```bash
   vercel
   ```

5. **Sigue las instrucciones** en pantalla

## 🎯 Funcionalidades

### ✅ **Carga de Archivos Excel**
- Sube archivos `.xls` y `.xlsx`
- Drag & Drop para fácil carga
- Validación de tipos y tamaños de archivo

### ✅ **Procesamiento de Datos**
- Lee columnas: UUID, Proveedor, Folio, Monto, Fecha, Concepto, Método de Pago
- Procesa PUE, PPD y PAGO correctamente
- Genera estadísticas automáticamente

### ✅ **Gestión de Pagos**
- Cambia estatus de facturas (Pendiente ↔ Pagado)
- Registra fechas de pago
- Persistencia en memoria durante la sesión

### ✅ **Visualización de Datos**
- Estadísticas en tiempo real
- Tabla detallada de facturas
- Resumen por proveedor
- Badges de colores para estatus y métodos de pago

### ✅ **Exportación**
- Exporta todos los datos a JSON
- Incluye facturas y cambios de estatus

## 🛠️ Desarrollo Local

### Instalación
```bash
cd web-app
npm install
```

### Ejecutar en desarrollo
```bash
npm run dev
```

### Ejecutar en producción
```bash
npm start
```

## 📁 Estructura del Proyecto

```
web-app/
├── server.js              # Servidor Express
├── package.json           # Dependencias
├── vercel.json           # Configuración de Vercel
├── public/
│   ├── index.html        # Interfaz principal
│   ├── style.css         # Estilos
│   └── script.js         # Lógica frontend
└── uploads/              # Archivos temporales (se crea automáticamente)
```

## 🔧 API Endpoints

- `POST /api/upload` - Subir archivo Excel
- `GET /api/facturas` - Obtener todas las facturas
- `POST /api/pagos/actualizar-status` - Cambiar estatus de pago
- `GET /api/pagos/resumen` - Obtener resumen estadístico
- `GET /api/export` - Exportar datos a JSON

## 🎨 Características de la UI

- **Responsive Design** - Funciona en móviles y desktop
- **Drag & Drop** - Arrastra archivos para subirlos
- **Animaciones** - Transiciones suaves
- **Notificaciones** - Feedback visual para acciones
- **Loading States** - Indicadores de carga
- **Error Handling** - Manejo elegante de errores

## 🔒 Seguridad

- Validación de tipos de archivo
- Límite de tamaño de archivo (10MB)
- Sanitización de datos
- Manejo seguro de errores

## 📱 Compatibilidad

- ✅ Chrome, Firefox, Safari, Edge
- ✅ iOS Safari, Android Chrome
- ✅ Tablets y móviles
- ✅ Escritorio y laptop

## 🚀 ¡Listo para usar!

Una vez desplegado en Vercel, tu aplicación estará disponible 24/7 y podrás:

1. **Compartir la URL** con tu equipo
2. **Subir archivos Excel** desde cualquier dispositivo
3. **Gestionar pagos** en tiempo real
4. **Exportar datos** cuando necesites

¡Perfecto para gestionar pagos de facturas de forma colaborativa! 🎉
