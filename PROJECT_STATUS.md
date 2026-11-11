# Entrega — ForgePulse v1.0.0

- **Estado:** prototipo educativo funcional, ejecutable de forma local.
- **Backend:** FastAPI, modelo Random Forest, simulación de señales, SQLite, API REST.
- **Frontend:** seis módulos visuales, diseño responsive, filtros, diálogo de simulación, alertas revisables y descarga CSV.
- **Evidencias:** nueve capturas en `docs/screenshots/`, obtenidas del frontend HTML/CSS/JS renderizado en Chromium y alimentado con datos reales de la API local mediante un puente de pruebas.
- **Verificación:** 4 tests de pytest aprobados; `node --check web/app.js` sin errores; interacción de simulador y acuse de alertas validada con navegador; sin errores de JavaScript en las vistas capturadas.
- **Límites:** datos enteramente sintéticos, sin IoT físico ni despliegue en nube, métricas del clasificador solo válidas para el conjunto generado. La demostración no actualiza sensores en segundo plano; los eventos nuevos se crean manualmente.
- **Embalaje:** ZIP independiente preparado para importar como repositorio GitHub.
