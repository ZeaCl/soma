---
name: fm-cli
description: |
  Usa esta skill cuando necesites crear, modificar o gestionar fondos de inversión,
  capital calls, inversionistas, compromisos o cualquier operación de fund management
  en la plataforma ZEA. También cuando el usuario mencione "crear un fondo", "activar
  fondo", "first close", "capital call", "liquidar fondo", "fund lifecycle", o
  cualquier tarea de fund management.

  Esta skill reemplaza la antigua skill `fund-management`. En vez de llamar
  directamente a múltiples microservicios (fm_funds, fm_investors, fm_commitments,
  fm_capital_calls), ahora todo se hace a través de la API unificada de fm-cli.
---

# FM-CLI — Fund Management API Unificada

## 🎯 Qué es

`fm-cli` es el **API REST unificado** para todas las operaciones de fund management
en ZEA. Orquesta el ciclo de vida completo de fondos a través de Cerebelum (workflow
engine) y los microservicios fm_*.

## 📡 Endpoints

**URL base**: `http://fm_cli:4099` (interno Docker)
**URL local**: `http://fm-cli.zea.localhost:8080`
**URL prod**: `https://fm-cli.zea.cl`

### Health
```
GET /api/health
→ {"status":"ok"}
```

### Fondos
```
POST   /api/funds                    ← Crear fondo (vía Cerebelum)
GET    /api/funds/{id}/get           ← Obtener fondo
POST   /api/funds/{id}/activate      ← Activar (DRAFT → FUNDRAISING)
POST   /api/funds/{id}/first-close   ← First close
POST   /api/funds/{id}/transition    ← Transición (INVESTING, HARVESTING, LIQUIDATED)
POST   /api/funds/{id}/close         ← Cerrar fondo (→ CLOSED)
POST   /api/funds/{id}/liquidate     ← Liquidar fondo (→ LIQUIDATED)
```

## 🔐 Auth

Todas las requests requieren JWT de Thalamus. El token se pasa así:

```bash
Authorization: Bearer $ZEA_TOKEN
```

El token se obtiene del entorno del agente Soma (disponible como `ZEA_TOKEN`).

## 📋 Ciclo de vida de un fondo

```
DRAFT → FUNDRAISING → ACTIVE → INVESTING → HARVESTING → CLOSED → LIQUIDATED
```

### 1. Crear fondo

```bash
curl -X POST http://fm_cli:4099/api/funds \
  -H "Authorization: Bearer $ZEA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Fondo Alpha",
    "fund_type": "PE",
    "size": "5000000",
    "fee": "200",
    "carried": "2000",
    "hurdle": "800",
    "term": "10",
    "inv_period": "5",
    "fundraising": "12",
    "invest": "60",
    "harvest": "48",
    "thesis": "Fondo de prueba",
    "currency": "USD"
  }'
```

**Response**: `{"success":true,"data":{"fund_id":"...","execution_id":"...","status":"DRAFT"}}`

### Campos de creación

| Campo | Tipo | Default | Descripción |
|---|---|---|---|
| `name` | string | requerido | Nombre (≥3 chars) |
| `fund_type` | string | `"PE"` | PE, VC, RE, INFRA, GROWTH, BUYOUT, FoF |
| `size` | string | `"5000000"` | Tamaño target |
| `fee` | string (bps) | `"200"` | Management fee (200 = 2.00%) |
| `carried` | string (bps) | `"2000"` | Carried interest (2000 = 20.00%) |
| `hurdle` | string (bps) | `"800"` | Hurdle rate (800 = 8.00%) |
| `term` | string | `"10"` | Años del fondo |
| `inv_period` | string | `"5"` | Período de inversión |
| `fundraising` | string | `"12"` | Meses de fundraising |
| `invest` | string | `"60"` | Meses de inversión |
| `harvest` | string | `"48"` | Meses de harvesting |
| `thesis` | string | auto | Tesis de inversión |
| `currency` | string | `"USD"` | Moneda |
| `vintage_year` | string | `""` | Año vintage |
| `hard_cap` | string | `""` | Hard cap |

### 2. Activar fondo

```bash
curl -X POST http://fm_cli:4099/api/funds/{fund_id}/activate \
  -H "Authorization: Bearer $ZEA_TOKEN"
```

→ `{"success":true,"data":{"status":"FUNDRAISING"}}`

### 3. First Close

```bash
curl -X POST http://fm_cli:4099/api/funds/{fund_id}/first-close \
  -H "Authorization: Bearer $ZEA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-06-01","amount":"3000000","lps":"5"}'
```

**⚠️ Requiere LPs con compromisos firmados.** Crear inversionistas y compromisos primero.

### 4. Transiciones

```bash
# Iniciar inversión (→ INVESTING)
curl -X POST http://fm_cli:4099/api/funds/{fund_id}/transition \
  -H "Authorization: Bearer $ZEA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"INVESTING","date":"2026-07-01"}'

# Iniciar cosecha (→ HARVESTING)
curl -X POST http://fm_cli:4099/api/funds/{fund_id}/transition \
  -H "Authorization: Bearer $ZEA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"HARVESTING","date":"2027-01-01"}'
```

### 5. Cerrar fondo (→ CLOSED)

```bash
curl -X POST http://fm_cli:4099/api/funds/{fund_id}/close \
  -H "Authorization: Bearer $ZEA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"auditoria":"audit-001"}'
```

### 6. Liquidar fondo (→ LIQUIDATED)

```bash
curl -X POST http://fm_cli:4099/api/funds/{fund_id}/liquidate \
  -H "Authorization: Bearer $ZEA_TOKEN"
```

## ⚠️ Basis Points

**Todos los fees son enteros** (basis points). Solo el frontend divide por 100.

| Valor | Significa |
|---|---|
| `200` | 2.00% |
| `2000` | 20.00% |
| `800` | 8.00% |

## 🔄 Recovery automático

Si una operación falla (workflow corrupto, proceso muerto), fm-cli automáticamente:
1. Detecta el estado corrupto
2. Crea una nueva ejecución en Cerebelum
3. Fast-forwardea los steps ya completados
4. Actualiza `execution_id` en el fondo
5. Continúa con la operación solicitada

No necesitás hacer nada especial — la recovery es transparente.

## 🧪 Verificación

```bash
# Verificar que fm-cli responde
curl http://fm_cli:4099/api/health

# Ver un fondo
curl http://fm_cli:4099/api/funds/{fund_id}/get \
  -H "Authorization: Bearer $ZEA_TOKEN"
```

## 🔗 Relación con otros servicios

```
fm-cli (API unificada)
  ├── Cerebelum  (workflow engine, :4001)
  ├── fm_funds   (CRUD fondos, :4082)
  ├── fm_investors (:4086)
  └── fm_commitments (:4087)
```

El agente **NO** llama directamente a estos servicios — siempre usa fm-cli.
