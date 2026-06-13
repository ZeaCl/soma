defmodule SomaWeb.Plugs.JWTAuth do
  @moduledoc "Validates JWT Bearer tokens from Thalamus via JWKS."

  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] ->
        case validate_jwt(token) do
          {:ok, claims} ->
            org_id = get_org_id(conn, claims)
            conn
            |> assign(:user_id, claims["sub"])
            |> assign(:org_id, org_id)
            |> assign(:jwt_claims, claims)
            |> assign(:authenticated, true)
          {:error, _} -> conn
        end
      _ -> conn
    end
  end

  defp validate_jwt(token) do
    with {:ok, jwks} <- fetch_jwks(),
         {:ok, signer} <- build_signer(jwks, token),
         {:ok, claims} <- Joken.verify_and_validate(%{}, token, signer) do
      {:ok, claims}
    else
      {:error, reason} -> {:error, reason}
    end
  rescue
    _ -> {:error, "Not a valid JWT"}
  end

  defp fetch_jwks do
    jwks_url = Application.get_env(:soma, :thalamus)[:jwks_url]
    case Req.get(jwks_url, receive_timeout: 5000) do
      {:ok, %{status: 200, body: body}} -> {:ok, body}
      _ -> {:error, "JWKS unavailable"}
    end
  end

  defp build_signer(jwks, token) do
    [header_b64 | _] = String.split(token, ".")
    {:ok, header_json} = Base.url_decode64(header_b64, padding: false)
    header = Jason.decode!(header_json)
    keys = jwks["keys"] || []
    key = if header["kid"], do: Enum.find(keys, fn k -> k["kid"] == header["kid"] end), else: List.first(keys)
    if key do
      pem = jwk_to_pem(key)
      {:ok, Joken.Signer.create("RS256", %{"pem" => pem})}
    else
      {:error, "No matching JWK"}
    end
  end

  defp jwk_to_pem(%{"n" => n, "e" => e}) do
    n_int = :binary.decode_unsigned(Base.url_decode64!(n, padding: false))
    e_int = :binary.decode_unsigned(Base.url_decode64!(e, padding: false))
    pem_entry = :public_key.pem_entry_encode(:RSAPublicKey, {:RSAPublicKey, n_int, e_int})
    :public_key.pem_encode([pem_entry])
  end

  defp get_org_id(conn, claims) do
    case get_req_header(conn, "x-zea-org-id") do
      [org_id | _] when org_id != "" -> org_id
      _ -> (claims["domain_roles"] || []) |> List.first() |> (fn r -> r && r["org_id"] end).()
    end
  end
end
