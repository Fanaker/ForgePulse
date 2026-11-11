# ForgePulse — Arquitectura y decisiones

## Capas

1. **Simulación:** `simulator.py` crea 10 equipos de 4 zonas y 96 muestras cada uno con semilla fija. Cuatro escenarios pueden generar muestras adicionales por API.
2. **Modelo:** `modeling.py` genera 9.000 registros artificiales con seis variables; usa `train_test_split(stratify=y)`, Random Forest de 90 árboles y `predict_proba` para puntuar lecturas.
3. **Almacén:** SQLite contiene `assets`, `readings`, `alerts`; `readings` tiene índice `(asset_id,timestamp DESC)` y `alerts` por `(acknowledged,created_at DESC)`.
4. **API:** FastAPI expone rutas de solo lectura y mutaciones (`simulate`, `acknowledge`, `reset`). La API sirve también el frontend sin depender de Node ni de un backend externo.
5. **UI:** SPA JavaScript vanilla, con estados de navegación, carga por fetch, paneles SVG, filtros y modalidades de interacción.

## Estado de activos

El modelo devuelve una puntuación entre 0 y 1. ForgePulse divide este **indicador sintético** en `healthy` (< 0.08), `warning` (0.08–0.7199), `critical` (>= 0.72). Los umbrales son definidos para esta demo, no normas industriales.

## Flujo de telemetría

1. `Store.initialize()` crea el esquema y el seed si la base está vacía.
2. Se infieren probabilidades **por lote**, evitando 960 llamadas independientes al modelo.
3. `POST /api/simulate` crea la muestra, la puntúa, la guarda y genera una alerta cuando corresponde.
4. `GET /api/overview` recalcula indicadores agregados y devuelve estado por activo y área.
5. `GET /api/export.csv` permite analizar los datos fuera de la aplicación.

## Consideraciones

- Tiempo de inicio: primera ejecución requiere entrenamiento solo si falta `model/plant_risk_model.joblib`; el modelo pre-entrenado está incluido.
- Seguridad: demo local sin login. No exponer a Internet ni conectar a dispositivos reales.
- Datos: toda la telemetría y los incidentes son ficticios. La base SQLite se excluye de Git.
- Escalabilidad: una instalación real necesitaría streaming, cola, particiones por tiempo, retención, autenticación, observabilidad y modelos calibrados.
- Calidad: tests básicos en `tests/test_api.py`; no se declara cobertura exhaustiva.
