# Ficha del modelo — synthetic-rf-v1

## Objetivo

Demostrar clasificación supervisada de **riesgo sintético de anomalía/fallo** basada en señales de maquinaria rotativa. No es un clasificador de fallas reales ni sustituye al personal de mantenimiento.

## Procedencia

Los 9.000 ejemplos son generados mediante `training_set(seed=2026)`. Las etiquetas están calculadas con reglas heurísticas sobre temperatura, vibración, corriente, presión, RPM y horas de uso, además de ruido pseudoaleatorio. No se han usado datos obtenidos de una planta ni datos personales.

## Algoritmo

`RandomForestClassifier(n_estimators=90,max_depth=13,min_samples_leaf=4,class_weight='balanced',random_state=42)`.

Validación con `train_test_split(test_size=0.25,stratify=y,random_state=42)`; 6.750 para entrenamiento y 2.250 para prueba. Las métricas exactas se mantienen en `model/model_card.json` y aparecen en el dashboard.

## Advertencias técnicas

- El conjunto de prueba procede del **mismo generador** del entrenamiento; puede sobreestimar la generalización.
- No hay partición temporal ni validación por familias de equipos reales.
- La puntuación `predict_proba` no es una estimación calibrada de tasa real de fallo.
- La importancia de variables de un bosque aleatorio no implica causalidad.
- Cambiar el generador o conectar sensores reales requiere reevaluar todos los umbrales.
- Los resultados no son aptos para activar paradas, reparaciones o procedimientos de seguridad.

## Siguiente investigación

Datos públicos de fallo con su procedencia y licencia, validación temporal, métricas con falsas alarmas operativas, evaluación fuera de distribución y calibración probabilística.
