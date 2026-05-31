# Crypto API — Endpoint Catalog

The Crypto API is a small internal-only HTTP service in VLAN 4. Reachable only from VLAN 3. Authentication via shared API key (`X-Crypto-Api-Key`).

See [crypto-design.md §6](../crypto-design.md#6-crypto-api-endpoint-contract) for the full request/response schemas; this file is a quick-reference table.

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/ca/root` | Generate keypair, self-sign a Root CA cert, persist |
| POST | `/v1/ca/intermediate` | Generate keypair, parent signs Intermediate CA cert, persist |
| GET | `/v1/ca/{ca_kind}/{business_db_ca_id}/certificate` | Return CA public certificate (PEM + DER base64) |
| POST | `/v1/cert/issue` | Validate CSR, issue end-entity certificate, persist all output formats |
| GET | `/v1/cert/{business_db_certificate_id}/download` | Return stored bytes for a given format |
| POST | `/v1/admin/kek-rotate` | Re-encrypt all `ca_private_keys` rows from old KEK to new |
| GET | `/health` | Liveness + DB ping |
| GET | `/health/ready` | Readiness |
| GET | `/metrics` | Prometheus exposition (cluster-internal only) |

## Authentication

- All `/v1/*` endpoints require `X-Crypto-Api-Key: <CRYPTO_API_KEY>`.
- `/v1/admin/*` endpoints additionally require `X-Crypto-Admin-Token: <CRYPTO_ADMIN_TOKEN>`.
- `/health` and `/metrics` do not require authentication but are reachable only from VLAN 3 (or, for metrics, the Prometheus scraper host) by firewall rule.

## Network isolation

- Inbound: VLAN 3 only.
- Outbound: only to Crypto DB within VLAN 4.

## Error response shape

Same shape as the Business Logic API. Common codes:

| Code | Meaning |
|---|---|
| `AUTH-0040` | Missing / invalid `X-Crypto-Api-Key` |
| `AUTH-0041` | Missing / invalid `X-Crypto-Admin-Token` |
| `CRYPTO-0001` | CSR fails PKCS#10 parse |
| `CRYPTO-0002` | CSR signature does not verify |
| `CRYPTO-0003` | Public-key algorithm or size not permitted |
| `CRYPTO-0004` | EC curve not permitted |
| `CRYPTO-0005` | Validity exceeds parent CA `valid_to` |
| `CRYPTO-0006` | KEK decryption failure on signing CA |
| `CRYPTO-0007` | Idempotency-Key replay with different body |

See [error-catalog.md](../error-catalog.md) for the full catalog.
