---
name: fund-management
description: |
  Gestionar fondos de inversión, inversionistas (LPs), compromisos y capital calls
  en la plataforma ZEA. Usar esta skill cuando un usuario pida: listar fondos,
  crear capital calls, gestionar inversionistas, consultar commitments, o cualquier
  operación sobre el dominio de Fund Management.

  ⚠️ Esta skill incluye reglas de seguridad estrictas. NUNCA hagas operaciones
  destructivas sin confirmación explícita.
license: MIT
compatibility: ZEA Platform, fm_funds, fm_investors, fm_commitments, fm_capital_calls
metadata:
  project: ZEA Soma
  services:
    - fm_funds:4082
    - fm_investors:4086
    - fm_commitments:4087
    - fm_capital_calls:4083
---

# Fund Management Skill

Gestioná fondos de inversión, inversionistas, compromisos y capital calls.

---

## 🔐 Autenticación

Todas las APIs requieren JWT Bearer token. El token está en la variable
de entorno `ZEA_TOKEN`.

```bash
# El token ya está disponible — NO necesitás obtenerlo
echo $ZEA_TOKEN
```

Para cada request HTTP, usá este header:

```bash
Authorization: Bearer $ZEA_TOKEN
```

**⚠️ NUNCA muestres el token en tus respuestas.** Si necesitás mostrar
un curl de ejemplo, usá `$ZEA_TOKEN` como placeholder.

---

## 📡 Cómo hacer requests

Usá `curl` desde el sandbox. Todos los servicios están en la red Docker
interna con nombres de servicio (NO uses `zea.localhost`):

| Servicio | URL interna | Rol |
|---|---|---|
| fm_funds | `http://fm_funds:4082` | Fondos de inversión |
| fm_investors | `http://fm_investors:4086` | Inversionistas / LPs |
| fm_commitments | `http://fm_commitments:4087` | Compromisos de inversión |
| fm_capital_calls | `http://fm_capital_calls:4083` | Llamadas de capital |

### Patrón de request

```bash
curl -s "http://SERVICIO:PUERTO/RUTA" \
  -H "Authorization: Bearer $ZEA_TOKEN" \
  -H "Content-Type: application/json"
```

### Parsear respuestas

Las respuestas son JSON. Usá `python3` o `jq` para extraer datos:

```bash
# Listar fondos y extraer nombres
curl -s "http://fm_funds:4082/funds" \
  -H "Authorization: Bearer $ZEA_TOKEN" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
for fund in data.get('items', []):
    print(f'{fund[\"name\"]} — \${int(fund[\"total_size\"]):,}')
"
```

---

## 🟢 Operaciones SEGURAS — Consulta libre

Estas operaciones solo leen datos. **Podés ejecutarlas sin preguntar.**

### 📊 Fondos

```bash
# Listar todos los fondos
curl -s "http://fm_funds:4082/funds" \
  -H "Authorization: Bearer $ZEA_TOKEN"

# Ver detalle de un fondo específico
curl -s "http://fm_funds:4082/funds/FUND_ID" \
  -H "Authorization: Bearer $ZEA_TOKEN"
```

**Modelo de datos — Fund:**

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único |
| `name` | string | Nombre del fondo |
| `status` | enum | `DRAFT`, `FUNDRAISING`, `ACTIVE`, `CLOSED` |
| `type` | enum | `PE`, `VC`, `RE`, `HF`, `INFRA`, `DEBT`, `OTHER` |
| `currency` | string | `USD`, `CLP`, `EUR` |
| `total_size` | string | Tamaño objetivo (ej: "50000000") |
| `vintage_year` | int | Año de vintage |
| `close_date` | date | Fecha de cierre |
| `lp_count` | int | Número de LPs |
| `total_committed` | string | Total comprometido |
| `total_called` | string | Total llamado |
| `total_paid` | string | Total pagado |

### 👥 Inversionistas (LPs)

```bash
# Listar todos los inversionistas
curl -s "http://fm_investors:4086/investors" \
  -H "Authorization: Bearer $ZEA_TOKEN"

# Ver detalle de un inversionista
curl -s "http://fm_investors:4086/investors/INVESTOR_ID" \
  -H "Authorization: Bearer $ZEA_TOKEN"

# Listar con paginación
curl -s "http://fm_investors:4086/investors?page=1&page_size=50" \
  -H "Authorization: Bearer $ZEA_TOKEN"
```

**Modelo de datos — Investor:**

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único |
| `name` | string | Nombre del inversionista |
| `email` | string | Correo electrónico |
| `type` | enum | `INDIVIDUAL`, `INSTITUTIONAL`, `FAMILY_OFFICE`, `SOVEREIGN`, `PENSION_FUND` |
| `status` | enum | `ACTIVE`, `INACTIVE`, `PENDING`, `DELETED` |
| `kyc_status` | enum | `VERIFIED`, `PENDING`, `REJECTED` |
| `organization_id` | UUID | Organización propietaria |

### 💰 Capital Calls

```bash
# Listar todas las capital calls
curl -s "http://fm_capital_calls:4083/capital-calls" \
  -H "Authorization: Bearer $ZEA_TOKEN"

# Ver detalle de una capital call
curl -s "http://fm_capital_calls:4083/capital-calls/CALL_ID" \
  -H "Authorization: Bearer $ZEA_TOKEN"

# Enviar una capital call (DRAFT → SENT)
curl -s -X POST "http://fm_capital_calls:4083/capital-calls/CALL_ID/send" \
  -H "Authorization: Bearer $ZEA_TOKEN"

# Cancelar una capital call
curl -s -X DELETE "http://fm_capital_calls:4083/capital-calls/CALL_ID" \
  -H "Authorization: Bearer $ZEA_TOKEN"
```

**Modelo de datos — Capital Call:**

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único |
| `fund_id` | UUID | Fondo asociado |
| `fund_name` | string | Nombre del fondo |
| `amount` | string | Monto total |
| `currency` | string | Moneda |
| `status` | enum | `DRAFT`, `SENT`, `PAID`, `OVERDUE`, `CANCELLED` |
| `due_date` | date | Fecha límite de pago |
| `called_percentage` | float | Porcentaje llamado del compromiso |

### 📋 Commitments

```bash
# Listar commitments de un investor
curl -s "http://fm_commitments:4087/investors/INVESTOR_ID/commitments" \
  -H "Authorization: Bearer $ZEA_TOKEN"
```

**Modelo de datos — Commitment:**

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único |
| `fund_id` | UUID | Fondo asociado |
| `fund_name` | string | Nombre del fondo |
| `amount` | string | Monto comprometido |
| `currency` | string | Moneda |
| `status` | enum | `ACTIVE`, `CANCELLED`, `FULFILLED` |
| `commitment_date` | date | Fecha del compromiso |

---

## 🟡 Operaciones CON CONFIRMACIÓN

Para estas operaciones, **SIEMPRE** seguí este protocolo:

1. **Prepará** los datos que vas a enviar
2. **Mostrá** al usuario EXACTAMENTE qué vas a hacer (formato tabla)
3. **Preguntá** "¿Procedo?"
4. **Esperá** confirmación explícita ("sí", "dale", "procede", "ok", "yes")
5. **Ejecutá** solo tras confirmación
6. **Reportá** el resultado (ID creado, campos modificados)

### ✏️ Crear fondo (draft)

```bash
curl -s -X POST "http://fm_funds:4082/funds/draft" \
  -H "Authorization: Bearer $ZEA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "NOMBRE_DEL_FONDO",
    "type": "PE",
    "currency": "USD",
    "target_size": 50000000,
    "vintage_year": 2026,
    "thesis": "Tesis de inversión...",
    "management_fee": 0.02,
    "carried_interest": 0.20,
    "hurdle_rate": 0.08,
    "fund_term_years": 10,
    "investment_period_years": 5
  }'
```

### ✏️ Crear inversionista

```bash
curl -s -X POST "http://fm_investors:4086/investors" \
  -H "Authorization: Bearer $ZEA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "NOMBRE_DEL_LP",
    "email": "lp@example.com",
    "type": "INSTITUTIONAL",
    "kyc_status": "VERIFIED"
  }'
```

**Campos requeridos**: `name`, `email`, `type`

**Validaciones que DEBÉS hacer antes de enviar**:
- `email` debe contener `@` y un dominio
- `name` debe tener al menos 2 caracteres
- `type` debe ser uno de los valores válidos
- Si el email ya existe en otro LP, la API lo rechazará

### ✏️ Actualizar inversionista

```bash
curl -s -X PUT "http://fm_investors:4086/investors/INVESTOR_ID" \
  -H "Authorization: Bearer $ZEA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "NUEVO_NOMBRE"
  }'
```

Solo enviá los campos que cambiaron (partial update).

**⚠️ Al editar, mostrá explícitamente qué cambió**:

```
Antes: name = "Family Office Alpha"
Después: name = "Family Office Alpha LLC"

¿Procedo?
```

### ✏️ Crear capital call

```bash
curl -s -X POST "http://fm_capital_calls:4083/capital-calls" \
  -H "Authorization: Bearer $ZEA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fund_id": "FUND_UUID",
    "amount": 5000000,
    "currency": "USD",
    "due_date": "2026-08-15"
  }'
```

**⚠️ Antes de crear una capital call, verificá**:
- El fondo existe y está ACTIVO o FUNDRAISING
- El monto es razonable (no negativo, no mayor al total_size)

### ✏️ Enviar capital call

```bash
curl -s -X POST "http://fm_capital_calls:4083/capital-calls/CALL_ID/send" \
  -H "Authorization: Bearer $ZEA_TOKEN"
```

**⚠️ Solo se puede enviar si está en estado DRAFT.**

### ✏️ Crear commitment

```bash
curl -s -X POST "http://fm_commitments:4087/investors/INVESTOR_ID/commitments" \
  -H "Authorization: Bearer $ZEA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fund_id": "FUND_UUID",
    "amount": 1000000,
    "currency": "USD"
  }'
```

---

## 🔴 Operaciones BLOQUEADAS

**NUNCA ejecutes estas operaciones** a menos que el usuario escriba
explícitamente la palabra `EJECUTAR` en su mensaje.

Si el usuario pide una de estas operaciones sin decir `EJECUTAR`,
respondé con un mensaje de advertencia mostrando qué se perdería
y pedile que confirme con la palabra clave.

### 🗑️ Borrar inversionista

```bash
curl -s -X DELETE "http://fm_investors:4086/investors/INVESTOR_ID" \
  -H "Authorization: Bearer $ZEA_TOKEN"
```

**Protocolo de borrado**:

```
🚫 Operación destructiva detectada: BORRAR LP

LP a borrar: Family Office Alpha (id: abc123...)
Email: alpha@family.com
Tipo: FAMILY_OFFICE

⚠️ Esta operación NO se puede deshacer.
El LP se marcará como DELETED y no aparecerá en listados.

Para continuar, escribí: EJECUTAR borrado de Family Office Alpha
```

### 🗑️ Cancelar capital call

```bash
curl -s -X DELETE "http://fm_capital_calls:4083/capital-calls/CALL_ID" \
  -H "Authorization: Bearer $ZEA_TOKEN"
```

**Mismo protocolo que borrado — requiere `EJECUTAR`.**

### 📦 Operaciones batch (más de 5 registros)

Si el usuario pide modificar más de 5 registros a la vez, tratá la
operación como BLOQUEADA aunque sea un POST/PUT.

---

## 🧠 Ejemplos de interacción

### Ejemplo 1: Consulta simple (🟢 automático)

```
👤 Usuario: "¿Qué fondos tenemos?"

🤖 Agente: 
   [Ejecuta GET /funds automáticamente]
   
   Tenemos 3 fondos, todos en estado DRAFT:
   
   1. 📝 Andes Growth Fund IV — PE — $50,000,000 USD
   2. 📝 Pacific Ventures II — VC — $25,000,000 USD
   3. 📝 Test Fund — PE — $10,000,000 USD
```

### Ejemplo 2: Creación con confirmación (🟡 pregunta)

```
👤 Usuario: "Creame un LP que se llame Acme Capital"

🤖 Agente:
   Voy a crear un nuevo inversionista con estos datos:
   
   ┌──────────────────────────────┐
   │ Nombre:  Acme Capital        │
   │ Email:   (no especificado)   │
   │ Tipo:    (no especificado)   │
   └──────────────────────────────┘
   
   ⚠️ Faltan campos requeridos: email y type.
   
   ¿Me pasás el email y el tipo de LP?
   Tipos válidos: INDIVIDUAL, INSTITUTIONAL, FAMILY_OFFICE, 
   SOVEREIGN, PENSION_FUND
```

```
👤 Usuario: "acme@capital.com, INSTITUTIONAL"

🤖 Agente:
   Perfecto. Voy a crear:
   
   ┌────────────────────────────────┐
   │ Nombre:  Acme Capital          │
   │ Email:   acme@capital.com      │
   │ Tipo:    INSTITUTIONAL         │
   └────────────────────────────────┘
   
   ¿Procedo?
```

```
👤 Usuario: "sí"

🤖 Agente:
   ✅ LP creado exitosamente.
   ID: 7f8a3b2c-...
   Nombre: Acme Capital
```

### Ejemplo 3: Borrado bloqueado (🔴 requiere EJECUTAR)

```
👤 Usuario: "Borra todos los LPs que tengan 'test' en el nombre"

🤖 Agente:
   🚫 Operación destructiva detectada: BORRADO MÚLTIPLE
   
   Encontré 12 LPs con 'test' en el nombre:
   - Test LP
   - Test LP 1783902086296
   - Redis Test
   ... y 9 más
   
   ⚠️ Esta operación NO se puede deshacer.
   Los LPs se marcarán como DELETED permanentemente.
   
   Para continuar, escribí exactamente:
   EJECUTAR borrado de 12 LPs con 'test' en el nombre
```

```
👤 Usuario: "EJECUTAR borrado de 12 LPs con 'test' en el nombre"

🤖 Agente:
   ⚠️ Confirmación recibida. Procediendo...
   
   Borrando 1/12: Test LP ✅
   Borrando 2/12: Test LP 1783902086296 ✅
   ...
   
   ✅ Operación completada. 12 LPs borrados.
```

---

## ⚡ Reglas de seguridad (OBLIGATORIAS)

1. **Nivel 🟢**: GET, listar → ejecutá directo, respondé en el mismo mensaje
2. **Nivel 🟡**: POST, PUT (crear/editar) → mostrá datos primero, esperá confirmación
3. **Nivel 🔴**: DELETE, cancelaciones, batches → bloqueá hasta recibir `EJECUTAR`
4. **Validá datos**: emails con @, tipos de enum correctos, montos no negativos
5. **Usá IDs reales**: nunca inventes UUIDs, solo usá IDs obtenidos de GET previos
6. **Límite de batch**: máximo 5 operaciones por mensaje sin `EJECUTAR`
7. **Token seguro**: nunca muestres `$ZEA_TOKEN` en respuestas, usá el placeholder
8. **Reportá siempre**: después de cada acción, mostrá ID creado y campos afectados
9. **Errores**: si la API devuelve error, mostralo al usuario y NO reintentes sin preguntar
10. **No asumas**: si el usuario no especifica un campo requerido, preguntá

---

## 🏥 Health checks

```bash
# Verificar que los servicios están disponibles
for svc in fm_funds:4082 fm_investors:4086 fm_commitments:4087 fm_capital_calls:4083; do
  echo -n "$svc: "
  curl -s -o /dev/null -w "%{http_code}" "http://${svc}/health"
  echo ""
done
```

---

## 📐 Esquema de urgencia

Si algo sale mal y necesitás saber el estado real:

```bash
# 1. Verificar salud de servicios
curl -s http://fm_funds:4082/health
curl -s http://fm_investors:4086/health
curl -s http://fm_commitments:4087/health
curl -s http://fm_capital_calls:4083/health

# 2. Verificar auth
curl -s -o /dev/null -w "%{http_code}" \
  "http://fm_funds:4082/funds" \
  -H "Authorization: Bearer $ZEA_TOKEN"
# 200 = OK, 401 = token inválido/expirado, 500 = error interno

# 3. Si el token expiró, pedile al usuario que renueve sesión
```
