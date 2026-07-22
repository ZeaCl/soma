defmodule SomaWeb.Plugs.JWTAuth do
  @moduledoc "Validates JWT Bearer tokens from Thalamus via JWKS."

  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] ->
        case validate_jwt(token) do
          {:ok, claims} ->
            org_id = get_org_id(conn, claims, token)

            conn
            |> assign(:user_id, claims["sub"])
            |> assign(:org_id, org_id)
            |> assign(:jwt_claims, claims)
            |> assign(:authenticated, true)

          {:error, _} ->
            conn
        end

      _ ->
        conn
    end
  end

  def verify_token(token) do
    case validate_jwt(token) do
      {:ok, claims} ->
        # We need a dummy conn to extract header if present, but since WS doesn't have it, we pass empty conn
        org_id = get_org_id(%Plug.Conn{}, claims, token)
        {:ok, claims, org_id}

      {:error, reason} ->
        {:error, reason}
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

    key =
      if header["kid"],
        do: Enum.find(keys, fn k -> k["kid"] == header["kid"] end),
        else: List.first(keys)

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

  defp get_org_id(conn, claims, token) do
    # 1. Header explícito
    case get_req_header(conn, "x-zea-org-id") do
      [org_id | _] when org_id != "" ->
        org_id

      _ ->
        # 2. JWT claim directo
        case claims["organization_id"] do
          org_id when is_binary(org_id) and org_id != "" ->
            org_id

          _ ->
            # 3. Domain roles claim
            case List.first(claims["domain_roles"] || []) do
              %{"org_id" => org_id} ->
                org_id

              _ ->
                # 4. Fetch from Thalamus /oauth/userinfo
                fetch_org_from_thalamus(token)
            end
        end
    end
  end

  defp fetch_org_from_thalamus(token) do
    thalamus_url = Application.get_env(:soma, :thalamus)[:url]
    require Logger
    Logger.info("JWTAuth: fetching org from Thalamus userinfo")

    case Req.get("#{thalamus_url}/oauth/userinfo",
           headers: [authorization: "Bearer #{token}"],
           receive_timeout: 3000
         ) do
      {:ok, %{status: 200, body: body}} ->
        org_id = body["organization"]["id"]
        Logger.info("JWTAuth: org_id=#{org_id}")
        org_id

      other ->
        Logger.warning("JWTAuth: userinfo failed: #{inspect(other)}")
        nil
    end
  end
end
