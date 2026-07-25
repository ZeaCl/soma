[
  # agent_metrics.ex — :telemetry_metrics Erlang module not resolved by Dialyzer (comes from prom_ex)
  {"lib/soma/agent_metrics.ex", :unknown_function},

  # agent_socket.ex — WebSock behaviour callback chain not traced by Dialyzer
  {"lib/soma_web/agent_socket.ex", :pattern_match},
  {"lib/soma_web/agent_socket.ex", :unused_fun},

  # jwt_auth.ex — validate_jwt has a rescue block, Dialyzer can't resolve return type
  {"lib/soma_web/plugs/jwt_auth.ex", :call},

  # router.ex — PromEx.export/0 not available in dev/test
  {"lib/soma_web/router.ex", :call_to_missing},

  # file_controller.ex — intentional _ -> catch-all for future-proofing
  {"lib/soma_web/controllers/file_controller.ex", :pattern_match_cov}
]
