---
name: shared-workspace
description: "Acceder a archivos compartidos de la organización (Excel, CSV, documentos). Usar esta skill cuando el usuario pregunte por archivos, planillas, reportes, datos de la empresa, o cualquier documento que esté en el workspace compartido. Siempre buscar primero en workspace/shared/ antes de decir que no hay archivos."
---

# Shared Workspace

Todos los archivos compartidos de la organización están en `workspace/shared/`, accesible desde el home del agente.

## Dónde están los archivos

```
/home/soma-{id}/
└── workspace/
    └── shared/          ← symlink a /home/orgs/{orgId}/shared/
        ├── *.xlsx       ← archivos Excel
        ├── *.csv        ← archivos CSV
        └── ...
```

## Operaciones comunes

```bash
# Listar todos los archivos compartidos
ls workspace/shared/

# Buscar archivos Excel
find workspace/shared -name "*.xlsx" -o -name "*.csv"

# Buscar recursivamente
find workspace/shared -type f
```

## Leer archivos

Usar la herramienta `read` para leer archivos directamente:

```
read workspace/shared/reporte.xlsx
```

## Reglas

- **Siempre** buscar en `workspace/shared/` antes de responder "no hay archivos"
- Si el usuario menciona "archivos", "planillas", "reportes", "datos", o "Excel", revisar `workspace/shared/` primero
- Los archivos en `workspace/shared/` son de toda la organización, no personales
