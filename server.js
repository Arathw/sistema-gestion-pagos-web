const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rutas específicas para archivos estáticos
app.get('/style.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'style.css'));
});

app.get('/script.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'script.js'));
});

// Configurar multer para subir archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Variable para almacenar datos en memoria
let datosFacturas = {};
let statusPagos = {};

// Función para leer archivo Excel
function leerExcel(archivo) {
  try {
    console.log('Leyendo archivo Excel:', archivo);
    
    // Verificar que el archivo existe
    if (!fs.existsSync(archivo)) {
      console.error('Archivo no encontrado:', archivo);
      return [];
    }
    
    const workbook = XLSX.readFile(archivo);
    console.log('Workbook leído, hojas disponibles:', workbook.SheetNames);
    
    const sheetName = workbook.SheetNames[0];
    console.log('Usando hoja:', sheetName);
    
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log('Datos extraídos:', data.length, 'filas');
    if (data.length > 0) {
      console.log('Primera fila:', Object.keys(data[0]));
    }
    
    return data;
  } catch (error) {
    console.error("Error leyendo Excel:", error);
    console.error("Stack trace:", error.stack);
    return [];
  }
}

// Función para procesar facturas
function procesarFacturas(facturas) {
  console.log('Procesando facturas, total:', facturas.length);
  
  if (!facturas || facturas.length === 0) {
    console.log('No hay facturas para procesar');
    return [];
  }
  
  // Mostrar la estructura de la primera factura para debugging
  if (facturas.length > 0) {
    console.log('Estructura de la primera factura:', Object.keys(facturas[0]));
    console.log('Primera factura completa:', facturas[0]);
  }
  
  return facturas.map((factura, index) => {
    try {
      // Mapear campos según la estructura real del archivo
      const uuid = factura.UUID || factura.uuid || `UUID-${index}`;
      const proveedor = factura.Proveedor || factura.proveedor || factura.PROVEEDOR || 'Sin Proveedor';
      const folio = factura.Folio || factura.folio || factura.FOLIO || `FOL-${index}`;
      const monto = parseFloat(factura.Monto || factura.monto || factura.MONTO || factura.Total || 0);
      const concepto = factura.Concepto || factura.concepto || factura.CONCEPTO || 'Sin concepto';
      const fecha = factura.Fecha || factura.fecha || factura.FECHA || new Date().toISOString().split('T')[0];
      
      const metodoPago = factura['Método de Pago'] || factura.metodoPago || factura.METODO_PAGO || '';
      const esPUE = metodoPago.toString().toUpperCase().includes('PUE');
      const esPPD = metodoPago.toString().toUpperCase().includes('PPD');
      
      // Determinar estatus inicial
      let estatusPago = 'Pendiente';
      if (factura.ESTATUS_PAGO || factura.estatusPago) {
        estatusPago = factura.ESTATUS_PAGO || factura.estatusPago;
      }
      
      const facturaProcesada = {
        UUID: uuid,
        Proveedor: proveedor,
        Folio: folio,
        Monto: monto,
        Concepto: concepto,
        Fecha: fecha,
        'Método de Pago': metodoPago,
        METODO_PAGO: esPUE ? 'PUE' : esPPD ? 'PPD' : 'PAGO',
        ES_PUE: esPUE,
        ES_PPD: esPPD,
        ESTATUS_PAGO: estatusPago,
        TIENE_COMPLEMENTO: !!factura.COMPLEMENTO_PAGO
      };
      
      return facturaProcesada;
    } catch (error) {
      console.error(`Error procesando factura ${index}:`, error);
      // Retornar una factura básica en caso de error
      return {
        UUID: `ERROR-${index}`,
        Proveedor: 'Error en procesamiento',
        Folio: `ERR-${index}`,
        Monto: 0,
        Concepto: 'Error',
        Fecha: new Date().toISOString().split('T')[0],
        'Método de Pago': 'PAGO',
        METODO_PAGO: 'PAGO',
        ES_PUE: false,
        ES_PPD: false,
        ESTATUS_PAGO: 'Pendiente',
        TIENE_COMPLEMENTO: false
      };
    }
  });
}

// Ruta de salud para Vercel
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Subir archivo Excel
app.post('/api/upload', upload.single('excel'), (req, res) => {
  let filePath = null;
  
  try {
    console.log('=== INICIANDO PROCESAMIENTO DE ARCHIVO ===');
    console.log('Archivo recibido:', req.file);
    
    if (!req.file) {
      console.log('Error: No se subió ningún archivo');
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    filePath = req.file.path;
    console.log('Ruta del archivo:', filePath);
    console.log('Tamaño del archivo:', req.file.size);
    console.log('Tipo del archivo:', req.file.mimetype);

    const facturas = leerExcel(filePath);
    console.log('Facturas leídas:', facturas.length);
    
    if (facturas.length === 0) {
      console.log('Error: No se pudieron leer datos del archivo Excel');
      return res.status(400).json({ error: 'No se pudieron leer datos del archivo Excel' });
    }

    console.log('Procesando facturas...');
    const facturasProcesadas = procesarFacturas(facturas);
    console.log('Facturas procesadas:', facturasProcesadas.length);
    
    datosFacturas = facturasProcesadas;

    // Limpiar archivo temporal
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Archivo temporal eliminado');
    }

    const response = {
      success: true,
      message: 'Archivo procesado correctamente',
      totalFacturas: facturasProcesadas.length,
      facturas: facturasProcesadas.slice(0, 10) // Primeras 10 para preview
    };
    
    console.log('Respuesta preparada:', response);
    res.json(response);

  } catch (error) {
    console.error('Error procesando archivo:', error);
    
    // Limpiar archivo temporal en caso de error
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log('Archivo temporal eliminado después del error');
      } catch (cleanupError) {
        console.error('Error limpiando archivo temporal:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      error: error.message,
      details: error.stack 
    });
  }
});

// Obtener todas las facturas
app.get('/api/facturas', (req, res) => {
  res.json({
    success: true,
    facturas: datosFacturas,
    total: Object.keys(datosFacturas).length
  });
});

// Actualizar estatus de pago
app.post('/api/pagos/actualizar-status', (req, res) => {
  try {
    const { uuid, nuevoEstatus, fechaPago } = req.body;

    if (!uuid || !nuevoEstatus) {
      return res.status(400).json({ 
        error: 'Faltan parámetros requeridos (uuid, nuevoEstatus)' 
      });
    }

    // Actualizar en memoria
    statusPagos[uuid] = {
      estatus: nuevoEstatus,
      fechaPago: fechaPago || null,
      fechaActualizacion: new Date().toISOString()
    };

    // Actualizar en datosFacturas
    if (datosFacturas && datosFacturas.length > 0) {
      const facturaIndex = datosFacturas.findIndex(f => f.UUID === uuid);
      if (facturaIndex !== -1) {
        datosFacturas[facturaIndex].ESTATUS_PAGO = nuevoEstatus;
        if (fechaPago) {
          datosFacturas[facturaIndex].FECHA_PAGO_REAL = fechaPago;
        }
      }
    }

    res.json({
      success: true,
      message: 'Status actualizado correctamente',
      uuid: uuid,
      nuevoEstatus: nuevoEstatus,
      fechaPago: fechaPago
    });

  } catch (error) {
    console.error('Error actualizando status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener resumen de pagos
app.get('/api/pagos/resumen', (req, res) => {
  try {
    if (!datosFacturas || datosFacturas.length === 0) {
      return res.json({
        success: true,
        resumen: {
          totalFacturas: 0,
          totalMonto: 0,
          pendientes: 0,
          pagados: 0,
          pue: 0,
          ppd: 0
        },
        proveedores: []
      });
    }

    const totalFacturas = datosFacturas.length;
    const totalMonto = datosFacturas.reduce((sum, f) => sum + (f.Monto || 0), 0);
    const pendientes = datosFacturas.filter(f => f.ESTATUS_PAGO === 'Pendiente').length;
    const pagados = datosFacturas.filter(f => f.ESTATUS_PAGO === 'Pagado').length;
    const pue = datosFacturas.filter(f => f.ES_PUE).length;
    const ppd = datosFacturas.filter(f => f.ES_PPD).length;

    // Agrupar por proveedor
    const proveedores = {};
    datosFacturas.forEach(factura => {
      const proveedor = factura.Proveedor || 'Sin Proveedor';
      if (!proveedores[proveedor]) {
        proveedores[proveedor] = {
          nombre: proveedor,
          facturas: 0,
          monto: 0,
          pendientes: 0,
          pagados: 0,
          pue: 0,
          ppd: 0
        };
      }

      proveedores[proveedor].facturas++;
      proveedores[proveedor].monto += factura.Monto || 0;

      if (factura.ESTATUS_PAGO === 'Pendiente') {
        proveedores[proveedor].pendientes++;
      } else if (factura.ESTATUS_PAGO === 'Pagado') {
        proveedores[proveedor].pagados++;
      }

      if (factura.ES_PUE) {
        proveedores[proveedor].pue++;
      } else if (factura.ES_PPD) {
        proveedores[proveedor].ppd++;
      }
    });

    res.json({
      success: true,
      resumen: {
        totalFacturas,
        totalMonto,
        pendientes,
        pagados,
        pue,
        ppd
      },
      proveedores: Object.values(proveedores)
    });

  } catch (error) {
    console.error('Error generando resumen:', error);
    res.status(500).json({ error: error.message });
  }
});

// Exportar datos a JSON
app.get('/api/export', (req, res) => {
  try {
    const datosParaExportar = {
      facturas: datosFacturas,
      statusPagos: statusPagos,
      fechaExportacion: new Date().toISOString(),
      totalFacturas: datosFacturas.length
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="datos_pagos.json"');
    res.json(datosParaExportar);

  } catch (error) {
    console.error('Error exportando datos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor solo si no estamos en Vercel
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📱 Aplicación disponible en: http://localhost:${PORT}`);
  });
}

// Exportar la app para Vercel
module.exports = app;
