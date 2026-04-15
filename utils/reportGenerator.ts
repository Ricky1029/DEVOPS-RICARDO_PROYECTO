import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";

interface Prestamo {
  id: string;
  equipoNombre: string;
  usuarioNombre: string;
  estado: string;
  fechaSolicitud: any;
  fechaAprobacion?: any;
  fechaDevolucionEsperada?: any;
  proposito?: string;
}

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  telefono?: string;
  carrera?: string;
  matricula?: string;
  activo: boolean;
  fechaRegistro: any;
}

interface Equipo {
  id: string;
  nombre: string;
  categoria?: string;
  tipo?: string;
  estado?: boolean;
}

interface ReportData {
  prestamosActivos: Prestamo[];
  equipos: Equipo[];
  usuarios: Usuario[];
  prestamosHoy: Prestamo[];
}

// Función para formatear fechas
const formatDate = (date: any): string => {
  if (!date) return "N/A";

  try {
    let dateObj: Date;

    if (date.toDate && typeof date.toDate === "function") {
      // Firestore Timestamp
      dateObj = date.toDate();
    } else if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === "string") {
      dateObj = new Date(date);
    } else {
      return "N/A";
    }

    return dateObj.toLocaleDateString("es-MX", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "N/A";
  }
};

// Generar CSV
const generateCSV = (data: ReportData): string => {
  const now = new Date().toLocaleDateString("es-MX");
  let csv = `Reporte de Dashboard - ${now}\n\n`;

  // Resumen
  csv += `RESUMEN\n`;
  csv += `Préstamos Activos,${data.prestamosActivos.length}\n`;
  csv += `Equipos Disponibles,${data.equipos.filter((e) => e.estado).length}\n`;
  csv += `Total Equipos,${data.equipos.length}\n`;
  csv += `Total Usuarios,${data.usuarios.length}\n`;
  csv += `Préstamos Hoy,${data.prestamosHoy.length}\n\n`;

  // Préstamos Activos
  csv += `PRÉSTAMOS ACTIVOS\n`;
  csv += `ID,Equipo,Usuario,Estado,Fecha Solicitud,Propósito\n`;
  data.prestamosActivos.forEach((p) => {
    csv += `"${p.id}","${p.equipoNombre}","${p.usuarioNombre}","${p.estado}","${formatDate(p.fechaSolicitud)}","${p.proposito || "N/A"}"\n`;
  });
  csv += `\n`;

  // Equipos
  csv += `EQUIPOS\n`;
  csv += `ID,Nombre,Categoría,Tipo,Estado\n`;
  data.equipos.forEach((e) => {
    csv += `"${e.id}","${e.nombre}","${e.categoria || "N/A"}","${e.tipo || "N/A"}","${e.estado ? "Disponible" : "No disponible"}"\n`;
  });
  csv += `\n`;

  // Usuarios
  csv += `USUARIOS\n`;
  csv += `ID,Nombre,Email,Teléfono,Carrera,Matrícula,Estado,Fecha Registro\n`;
  data.usuarios.forEach((u) => {
    csv += `"${u.id}","${u.nombre}","${u.email}","${u.telefono || "N/A"}","${u.carrera || "N/A"}","${u.matricula || "N/A"}","${u.activo ? "Activo" : "Inactivo"}","${formatDate(u.fechaRegistro)}"\n`;
  });

  return csv;
};

// Generar HTML para PDF (que el navegador puede imprimir como PDF)
const generateHTML = (data: ReportData): string => {
  const now = new Date().toLocaleDateString("es-MX");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Reporte Dashboard</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      color: #0A66FF;
      border-bottom: 3px solid #0A66FF;
      padding-bottom: 10px;
    }
    h2 {
      color: #333;
      margin-top: 30px;
      border-bottom: 2px solid #ddd;
      padding-bottom: 5px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .summary-card {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
    }
    .summary-card .value {
      font-size: 32px;
      font-weight: bold;
      color: #0A66FF;
      margin: 10px 0;
    }
    .summary-card .label {
      font-size: 14px;
      color: #666;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    th {
      background: #0A66FF;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: bold;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #ddd;
    }
    tr:nth-child(even) {
      background: #f8f9fa;
    }
    tr:hover {
      background: #e9ecef;
    }
    .badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }
    .badge-success {
      background: #d4edda;
      color: #155724;
    }
    .badge-warning {
      background: #fff3cd;
      color: #856404;
    }
    .badge-danger {
      background: #f8d7da;
      color: #721c24;
    }
    .badge-info {
      background: #d1ecf1;
      color: #0c5460;
    }
    @media print {
      body {
        padding: 10px;
      }
      .no-print {
        display: none;
      }
    }
    .print-info {
      text-align: right;
      color: #666;
      font-size: 12px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <h1>📊 Reporte de Dashboard - Administrador</h1>
  <div class="print-info">Generado: ${now}</div>
  
  <div class="summary">
    <div class="summary-card">
      <div class="label">Préstamos Activos</div>
      <div class="value">${data.prestamosActivos.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">Equipos Disponibles</div>
      <div class="value">${data.equipos.filter((e) => e.estado).length}</div>
    </div>
    <div class="summary-card">
      <div class="label">Total Usuarios</div>
      <div class="value">${data.usuarios.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">Préstamos Hoy</div>
      <div class="value">${data.prestamosHoy.length}</div>
    </div>
  </div>
  
  <h2>📋 Préstamos Activos</h2>
  <table>
    <thead>
      <tr>
        <th>Equipo</th>
        <th>Usuario</th>
        <th>Estado</th>
        <th>Fecha Solicitud</th>
        <th>Propósito</th>
      </tr>
    </thead>
    <tbody>
      ${data.prestamosActivos
        .map(
          (p) => `
        <tr>
          <td>${p.equipoNombre}</td>
          <td>${p.usuarioNombre}</td>
          <td><span class="badge badge-info">${p.estado}</span></td>
          <td>${formatDate(p.fechaSolicitud)}</td>
          <td>${p.proposito || "N/A"}</td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
  </table>
  
  <h2>💻 Equipos</h2>
  <table>
    <thead>
      <tr>
        <th>Nombre</th>
        <th>Categoría</th>
        <th>Estado</th>
      </tr>
    </thead>
    <tbody>
      ${data.equipos
        .map(
          (e) => `
        <tr>
          <td>${e.nombre}</td>
          <td>${e.categoria || "N/A"}</td>
          <td><span class="badge ${e.estado ? "badge-success" : "badge-danger"}">${e.estado ? "Disponible" : "No disponible"}</span></td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
  </table>
  
  <h2>👥 Usuarios</h2>
  <table>
    <thead>
      <tr>
        <th>Nombre</th>
        <th>Email</th>
        <th>Teléfono</th>
        <th>Carrera</th>
        <th>Matrícula</th>
        <th>Estado</th>
      </tr>
    </thead>
    <tbody>
      ${data.usuarios
        .map(
          (u) => `
        <tr>
          <td>${u.nombre}</td>
          <td>${u.email}</td>
          <td>${u.telefono || "N/A"}</td>
          <td>${u.carrera || "N/A"}</td>
          <td>${u.matricula || "N/A"}</td>
          <td><span class="badge ${u.activo ? "badge-success" : "badge-warning"}">${u.activo ? "Activo" : "Inactivo"}</span></td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
  </table>
  
  <div class="no-print" style="margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center;">
    <p style="margin: 0; color: #666;">Para guardar como PDF: Use Ctrl+P (Cmd+P en Mac) y seleccione "Guardar como PDF"</p>
  </div>
</body>
</html>
  `;
};

// Descargar en Web
const downloadForWeb = (
  content: string,
  filename: string,
  mimeType: string,
) => {
  try {
    // Verificar que estamos en un entorno web real
    if (typeof window === "undefined" || typeof document === "undefined") {
      console.error("APIs de navegador no disponibles");
      return false;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);

    return true;
  } catch (error) {
    console.error("Error descargando archivo en web:", error);
    Alert.alert(
      "Error",
      "No se pudo descargar el archivo. Intente nuevamente.",
    );
    return false;
  }
};

// Descargar en Mobile
const downloadForMobile = async (content: string, filename: string) => {
  try {
    const file = new File(Paths.document, filename);

    // Create the file
    file.create({ overwrite: true });

    // Write content to the file
    file.write(content);

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: filename.endsWith(".csv") ? "text/csv" : "text/html",
        dialogTitle: "Guardar reporte",
      });
      return true;
    } else {
      Alert.alert("Éxito", `Archivo guardado en: ${file.uri}`);
      return true;
    }
  } catch (err) {
    console.error("Error descargando archivo en mobile:", err);
    return false;
  }
};

// Función principal para descargar reportes
export const downloadReport = async (
  format: "csv" | "pdf",
  data: ReportData,
): Promise<boolean> => {
  try {
    const timestamp = new Date().toISOString().split("T")[0];

    if (format === "csv") {
      const csvContent = generateCSV(data);
      const filename = `reporte-dashboard-${timestamp}.csv`;

      if (Platform.OS === "web") {
        return downloadForWeb(csvContent, filename, "text/csv;charset=utf-8;");
      } else {
        return await downloadForMobile(csvContent, filename);
      }
    } else {
      // PDF (HTML)
      const htmlContent = generateHTML(data);
      const filename = `reporte-dashboard-${timestamp}.html`;

      if (Platform.OS === "web") {
        // Verificar que estamos en un entorno web real
        if (typeof window === "undefined" || typeof document === "undefined") {
          console.error("APIs de navegador no disponibles");
          Alert.alert(
            "Error",
            "No se pudo generar el reporte en este entorno.",
          );
          return false;
        }

        // En web, abrimos el HTML en una nueva ventana para que el usuario pueda imprimirlo como PDF
        try {
          const blob = new Blob([htmlContent], { type: "text/html" });
          const url = URL.createObjectURL(blob);
          const newWindow = window.open(url, "_blank");

          if (newWindow) {
            // Esperar a que cargue y luego mostrar diálogo de impresión
            newWindow.onload = () => {
              setTimeout(() => {
                try {
                  newWindow.print();
                } catch (e) {
                  console.error("Error al abrir diálogo de impresión:", e);
                }
              }, 500);
            };

            // Cleanup después de un tiempo
            setTimeout(() => {
              URL.revokeObjectURL(url);
            }, 10000);

            return true;
          } else {
            Alert.alert(
              "Error",
              "No se pudo abrir la ventana de impresión. Verifique que las ventanas emergentes estén permitidas.",
            );
            return false;
          }
        } catch (error) {
          console.error("Error generando PDF en web:", error);
          Alert.alert(
            "Error",
            "No se pudo generar el PDF. Intente descargar en formato CSV.",
          );
          return false;
        }
      } else {
        // En mobile, guardamos el HTML y lo compartimos
        return await downloadForMobile(htmlContent, filename);
      }
    }
  } catch (error) {
    console.error("Error generando reporte:", error);
    Alert.alert("Error", "No se pudo generar el reporte. Intente nuevamente.");
    return false;
  }
};
