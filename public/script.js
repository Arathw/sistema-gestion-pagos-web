// Variables globales
let facturasData = [];
let resumenData = {};

// Elementos del DOM
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const uploadStatus = document.getElementById('uploadStatus');
const resultsSection = document.getElementById('resultsSection');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const errorMessage = document.getElementById('errorMessage');

// Event listeners
fileInput.addEventListener('change', handleFileSelect);
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('dragleave', handleDragLeave);
uploadArea.addEventListener('drop', handleDrop);
uploadArea.addEventListener('click', () => fileInput.click());

// Funciones de utilidad
function mostrarLoading() {
    loading.style.display = 'flex';
}

function ocultarLoading() {
    loading.style.display = 'none';
}

function mostrarError(mensaje) {
    error.style.display = 'block';
    errorMessage.textContent = mensaje;
    setTimeout(() => {
        error.style.display = 'none';
    }, 5000);
}

function mostrarUploadStatus(mensaje, tipo = 'success') {
    uploadStatus.textContent = mensaje;
    uploadStatus.className = `upload-status ${tipo}`;
    uploadStatus.style.display = 'block';
}

function ocultarUploadStatus() {
    uploadStatus.style.display = 'none';
}

// Manejo de archivos
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

function handleFile(file) {
    // Validar tipo de archivo
    const allowedTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(xls|xlsx)$/)) {
        mostrarUploadStatus('Por favor selecciona un archivo Excel (.xls o .xlsx)', 'error');
        return;
    }
    
    // Validar tamaño (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
        mostrarUploadStatus('El archivo es demasiado grande. Máximo 10MB', 'error');
        return;
    }
    
    subirArchivo(file);
}

async function subirArchivo(file) {
    mostrarLoading();
    ocultarUploadStatus();
    
    try {
        const formData = new FormData();
        formData.append('excel', file);
        
        console.log('Enviando archivo:', file.name, 'Tamaño:', file.size);
        
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        console.log('Respuesta del servidor:', response.status, response.statusText);
        
        // Verificar si la respuesta es JSON válido
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const textResponse = await response.text();
            console.error('Respuesta no es JSON:', textResponse);
            throw new Error(`El servidor respondió con formato incorrecto: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Resultado del servidor:', result);
        
        if (result.success) {
            mostrarUploadStatus(`✅ Archivo procesado: ${result.totalFacturas} facturas encontradas`, 'success');
            
            // Cargar datos completos
            await cargarDatosCompletos();
            
            // Mostrar resultados
            mostrarResultados();
            
        } else {
            throw new Error(result.error || 'Error procesando archivo');
        }
        
    } catch (error) {
        console.error('Error subiendo archivo:', error);
        
        // Mostrar error más detallado
        let errorMessage = error.message;
        if (error.message.includes('Unexpected end of JSON input')) {
            errorMessage = 'Error del servidor: Respuesta incompleta. Verifica que el archivo Excel sea válido.';
        } else if (error.message.includes('Failed to execute')) {
            errorMessage = 'Error de conexión con el servidor. Intenta nuevamente.';
        }
        
        mostrarError(`Error procesando archivo: ${errorMessage}`);
        mostrarUploadStatus('❌ Error procesando archivo', 'error');
    } finally {
        ocultarLoading();
    }
}

async function cargarDatosCompletos() {
    try {
        const response = await fetch('/api/facturas');
        const result = await response.json();
        
        if (result.success) {
            facturasData = result.facturas;
        } else {
            throw new Error('Error cargando datos');
        }
        
        // Cargar resumen
        await actualizarResumen();
        
    } catch (error) {
        console.error('Error cargando datos:', error);
        throw error;
    }
}

async function actualizarResumen() {
    try {
        const response = await fetch('/api/pagos/resumen');
        const result = await response.json();
        
        if (result.success) {
            resumenData = result;
            actualizarEstadisticas();
            actualizarTablaFacturas();
            actualizarTablaProveedores();
        } else {
            throw new Error('Error cargando resumen');
        }
        
    } catch (error) {
        console.error('Error actualizando resumen:', error);
        mostrarError(`Error actualizando resumen: ${error.message}`);
    }
}

function actualizarEstadisticas() {
    const resumen = resumenData.resumen;
    
    document.getElementById('totalFacturas').textContent = resumen.totalFacturas;
    document.getElementById('totalMonto').textContent = `$${resumen.totalMonto.toLocaleString()}`;
    document.getElementById('pendientes').textContent = resumen.pendientes;
    document.getElementById('pagados').textContent = resumen.pagados;
    document.getElementById('pue').textContent = resumen.pue;
    document.getElementById('ppd').textContent = resumen.ppd;
}

function actualizarTablaFacturas() {
    const tbody = document.getElementById('facturasTableBody');
    tbody.innerHTML = '';
    
    if (!facturasData || facturasData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px;">No hay facturas disponibles</td></tr>';
        return;
    }
    
    facturasData.forEach(factura => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="uuid-cell">${factura.UUID ? factura.UUID.substring(0, 8) + '...' : 'N/A'}</td>
            <td>${factura.Proveedor || 'Sin Proveedor'}</td>
            <td>${factura.Folio || 'N/A'}</td>
            <td>$${(factura.Monto || 0).toLocaleString()}</td>
            <td>${factura.Fecha || 'N/A'}</td>
            <td>${factura.Concepto || 'N/A'}</td>
            <td>
                <span class="metodo-pago-badge ${factura.METODO_PAGO ? factura.METODO_PAGO.toLowerCase() : 'pago'}">
                    ${factura.METODO_PAGO || 'PAGO'}
                </span>
            </td>
            <td>
                <span class="estatus-badge estatus-${factura.ESTATUS_PAGO ? factura.ESTATUS_PAGO.toLowerCase() : 'pendiente'}">
                    ${factura.ESTATUS_PAGO || 'Pendiente'}
                </span>
            </td>
            <td>
                <button class="btn-cambiar-estatus" onclick="cambiarEstatus('${factura.UUID}', '${factura.ESTATUS_PAGO || 'Pendiente'}')">
                    ${(factura.ESTATUS_PAGO || 'Pendiente') === 'Pendiente' ? 'Marcar Pagado' : 'Marcar Pendiente'}
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function actualizarTablaProveedores() {
    const tbody = document.getElementById('proveedoresTableBody');
    tbody.innerHTML = '';
    
    if (!resumenData.proveedores || resumenData.proveedores.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No hay datos de proveedores</td></tr>';
        return;
    }
    
    resumenData.proveedores.forEach(proveedor => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${proveedor.nombre}</td>
            <td>${proveedor.facturas}</td>
            <td>$${proveedor.monto.toLocaleString()}</td>
            <td><span class="badge-pendiente">${proveedor.pendientes}</span></td>
            <td><span class="badge-pagado">${proveedor.pagados}</span></td>
            <td><span class="badge-pue">${proveedor.pue || 0}</span></td>
            <td><span class="badge-ppd">${proveedor.ppd || 0}</span></td>
        `;
        tbody.appendChild(row);
    });
}

async function cambiarEstatus(uuid, estatusActual) {
    try {
        const nuevoEstatus = estatusActual === 'Pendiente' ? 'Pagado' : 'Pendiente';
        let fechaPago = null;
        
        if (nuevoEstatus === 'Pagado') {
            fechaPago = prompt('Ingresa la fecha de pago (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
            if (!fechaPago) {
                return; // Usuario canceló
            }
        }
        
        mostrarLoading();
        
        const response = await fetch('/api/pagos/actualizar-status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uuid: uuid,
                nuevoEstatus: nuevoEstatus,
                fechaPago: fechaPago
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Actualizar datos locales
            const facturaIndex = facturasData.findIndex(f => f.UUID === uuid);
            if (facturaIndex !== -1) {
                facturasData[facturaIndex].ESTATUS_PAGO = nuevoEstatus;
                if (fechaPago) {
                    facturasData[facturaIndex].FECHA_PAGO_REAL = fechaPago;
                }
            }
            
            // Actualizar resumen
            await actualizarResumen();
            
            // Mostrar notificación
            mostrarNotificacion('✅ Estatus actualizado correctamente', 'success');
            
        } else {
            throw new Error(result.error || 'Error actualizando estatus');
        }
        
    } catch (error) {
        console.error('Error cambiando estatus:', error);
        mostrarError(`Error actualizando estatus: ${error.message}`);
    } finally {
        ocultarLoading();
    }
}

async function exportarDatos() {
    try {
        mostrarLoading();
        
        const response = await fetch('/api/export');
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `datos_pagos_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            mostrarNotificacion('✅ Datos exportados correctamente', 'success');
        } else {
            throw new Error('Error exportando datos');
        }
        
    } catch (error) {
        console.error('Error exportando datos:', error);
        mostrarError(`Error exportando datos: ${error.message}`);
    } finally {
        ocultarLoading();
    }
}

function mostrarNotificacion(mensaje, tipo = 'info') {
    const notification = document.createElement('div');
    notification.textContent = mensaje;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    // Colores según el tipo
    switch(tipo) {
        case 'success':
            notification.style.background = '#27ae60';
            break;
        case 'error':
            notification.style.background = '#e74c3c';
            break;
        case 'warning':
            notification.style.background = '#f39c12';
            break;
        default:
            notification.style.background = '#3498db';
    }
    
    document.body.appendChild(notification);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function mostrarResultados() {
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Animaciones CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    console.log('Sistema de Gestión de Pagos iniciado');
    
    // Verificar si hay datos cargados
    if (facturasData.length > 0) {
        mostrarResultados();
    }
});
