Estoy deployando a producción en zea.cl y al hacer login OAuth2, el formulario de consentimiento (Authorize) no se envía. El error en consola es:

```
Sending form data to 'https://auth.zea.cl/oauth/authorize' violates the following 
Content Security Policy directive: "form-action 'self' http://localhost:*". 
The request has been blocked.
```

El CSP `form-action` solo permite `'self'` y `http://localhost:*`. Necesito que incluya `https://*.zea.cl:*`.

**Archivos a revisar:**

1. `thalamus/config/config.exs` (~línea 153) — el CSP está hardcodeado y SOBRESCRIBE cualquier cambio en el módulo `security_headers.ex`:
```elixir
csp_policy: "... form-action 'self' http://localhost:*"
```
→ Cambiar a: `"... form-action 'self' http://localhost:* https://*.zea.cl:* https://*.zea.localhost:*"`

2. `thalamus/config/runtime.exs` — verificar que `url: [scheme: ...]` use `FORCE_SSL` env var:
```elixir
scheme = if System.get_env("FORCE_SSL") == "true", do: "https", else: "http"
public_port = if System.get_env("FORCE_SSL") == "true", do: 443, else: 80
config :thalamus, ThalamusWeb.Endpoint,
  url: [host: host, port: public_port, scheme: scheme],
```

3. `docker-compose.yml` — verificar `FORCE_SSL: "true"` y `CORS_ORIGINS` incluye dominios de prod

**Contexto adicional:**
- La skill `thalamus-auth` en `/Users/dev/.agents/skills/thalamus-auth/SKILL.md` tiene la documentación completa de este fix y otras lecciones aprendidas.
- El mismo problema pasó en local con `http://auth.zea.localhost` y se arregló agregando `http://*.zea.localhost:*` al CSP.
- Para prod es igual pero con `https://*.zea.cl:*`.

¿Podés revisar y aplicar el fix?
