# n8n-nodes-oracle-database-parameterization

[Oracle](https://docs.oracle.com/en/database/oracle/oracle-database/) database node for n8n

This is a fork of the original [n8n-nodes-oracle-database](https://www.npmjs.com/package/n8n-nodes-oracle-database) and has been enhanced with parameterization and error handling functionalities.

## Features

### Parameterization

This node allows you to use bind parameters in your SQL queries for better security and performance.

**Normal Query Example:**
![1708469710894](image/README/1708469710894.png)

**Example query with parameters:**
![1708469967715](image/README/1708469967715.png)

**Example Query Using IN operator:**
![1708470132486](image/README/1708470132486.png)

### On Error Output

This node includes a "Continue On Error" option. If you enable this option, any error that occurs during the node's execution will be sent to the error output, allowing you to handle it in subsequent nodes without stopping the entire workflow.

## License

[MIT](https://github.com/afardana/n8n-nodes-oracle-database-parameterization/blob/main/LICENSE.md)
