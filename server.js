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
    const workbook = XLSX.readFile(archivo);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    return data;
  } catch (error) {
    console.error("Error leyendo Excel:", error);
    return [];
  }
}

// Función para procesar facturas
function procesarFacturas(facturas) {
  return facturas.map(factura => {
    const metodoPago = factura['Método de Pago'] || '';
    const esPUE = metodoPago.includes('PUE');
    const esPPD = metodoPago.includes('PPD');
    
    // Determinar estatus inicial
    let estatusPago = 'Pendiente';
    if (factura.ESTATUS_PAGO) {
      estatusPago = factura.ESTATUS_PAGO;
    }
    
    return {
      ...factura,
      METODO_PAGO: esPUE ? 'PUE' : esPPD ? 'PPD' : 'PAGO',
      ES_PUE: esPUE,
      ES_PPD: esPPD,
      ESTATUS_PAGO: estatusPago,
      TIENE_COMPLEMENTO: !!factura.COMPLEMENTO_PAGO
    };
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
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    const filePath = req.file.path;
    const facturas = leerExcel(filePath);
    
    if (facturas.length === 0) {
      return res.status(400).json({ error: 'No se pudieron leer datos del archivo Excel' });
    }

    const facturasProcesadas = procesarFacturas(facturas);
    datosFacturas = facturasProcesadas;

    // Limpiar archivo temporal
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: 'Archivo procesado correctamente',
      totalFacturas: facturasProcesadas.length,
      facturas: facturasProcesadas.slice(0, 10) // Primeras 10 para preview
    });

  } catch (error) {
    console.error('Error procesando archivo:', error);
    res.status(500).json({ error: error.message });
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
