# n8n-nodes-oracle-database-parameterization

[Oracle](https://docs.oracle.com/en/database/oracle/oracle-database/) database node for n8n

Forked from https://www.npmjs.com/package/n8n-nodes-oracle-database with the intent of adding parameterization functionality and aligning with n8n's Postgres "Execute a SQL query" behaviour.

## Features

- Parameterized SQL with optional automatic expansion for `IN (...)` clauses
- Sanitizes trailing semicolons and prevents multi-statement execution per item
- Returns Oracle driver metadata alongside `rows`
- Errors bubble up as `NodeOperationError` objects; if `Continue On Fail` is enabled the node emits an error payload for that item on the single output stream

## Normal Query Example![1708469710894](image/README/1708469710894.png)

### New Functionality (parameters)

Example query:

![1708469967715](image/README/1708469967715.png)

Example Query Using IN operator:

![1708470132486](image/README/1708470132486.png)

## License

[MIT](https://github.com/matheuspeluchi/n8n-nodes-oracle-database/blob/main/LICENSE.md)
