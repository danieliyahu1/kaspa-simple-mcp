# Address Tools Priority

| # | Tool | Endpoint | Priority |
|---|------|----------|----------|
| 5 | `get_address_balance_history` | `GET /addresses/{address}/balance/{day_or_month}` | Medium |
| 6 | `get_utxos_batch` | `POST /addresses/utxos` | Medium |
| 7 | `get_address_transactions_page` | `GET /addresses/{address}/full-transactions-page` | Medium |
| 8 | `get_addresses_active` | `POST /addresses/active` | Medium |
| 9 | `get_address_name` | `GET /addresses/{address}/name` | Low |
| 10 | `get_top_addresses` | `GET /addresses/top` | Low |
| 11 | `get_address_distribution` | `GET /addresses/distribution` | Low |
| 12 | `get_active_addresses_count` | `GET /addresses/active/count/` | Low |
| 13 | `get_active_addresses_count_history` | `GET /addresses/active/count/{day_or_month}` | Low |
| 14 | `get_address_names` | `GET /addresses/names` | Low |

## Notes

- Endpoints 5-8 add analytics and batch operations — useful but less essential.
- Endpoints 9-14 are niche/experimental features to add when the core set is complete.
