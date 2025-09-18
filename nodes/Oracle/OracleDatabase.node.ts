import { IExecuteFunctions } from "n8n-core";

import type {
  IDataObject,
  INodeExecutionData,
  INodeType,
  INodeTypeBaseDescription,
  INodeTypeDescription,
  INodeVersionedType,
} from "n8n-workflow";
import { NodeOperationError } from "n8n-workflow";
import { randomUUID } from "crypto";
import oracledb from "oracledb";
import { OracleConnection } from "./core/connection";

const baseDescription: INodeTypeBaseDescription = {
  displayName: "Oracle Database with Parameterization ",
  name: "Oracle Database with Parameterization",
  icon: "file:oracle.svg",
  group: ["input"],
  description: "Upsert, get, add and update data in Oracle database",
  defaultVersion: 1.1,
};

class OracleDatabaseV1 implements INodeType {
  description: INodeTypeDescription;

  constructor(baseDescription: INodeTypeBaseDescription) {
    this.description = {
      ...baseDescription,
      version: [1, 1.1],
      defaults: {
        name: "Oracle Database",
      },
      inputs: ["main"],
      outputs: ["main"],
      credentials: [
        {
          name: "oracleCredentials",
          required: true,
        },
      ],
      properties: [
        {
          displayName: "SQL Statement",
          name: "query",
          type: "string",
          typeOptions: {
            alwaysOpenEditWindow: true,
          },
          default: "",
          placeholder: "SELECT id, name FROM product WHERE id < :param_name",
          required: true,
          description: "The SQL query to execute",
        },
        {
          displayName: "Parameters",
          name: "params",
          placeholder: "Add Parameter",
          type: "fixedCollection",
          typeOptions: {
            multipleValueButtonText: "Add another Parameter",
            multipleValues: true,
          },
          default: {},
          options: [
            {
              displayName: "Values",
              name: "values",
              values: [
                {
                  displayName: "Name",
                  name: "name",
                  type: "string",
                  default: "",
                  placeholder: "e.g. param_name",
                  hint: 'Do not start with ":"',
                  required: true,
                },
                {
                  displayName: "Value",
                  name: "value",
                  type: "string",
                  default: "",
                  placeholder: "Example: 12345",
                  required: true,
                },
                {
                  displayName: "Data Type",
                  name: "datatype",
                  type: "options",
                  required: true,
                  default: "string",
                  options: [
                    { name: "String", value: "string" },
                    { name: "Number", value: "number" },
                  ],
                },
                {
                  displayName: "Parse for IN statement",
                  name: "parseInStatement",
                  type: "options",
                  required: true,
                  default: false,
                  hint: 'If "Yes" the "Value" field should be a string of comma-separated values. i.e: 1,2,3 or str1,str2,str3',
                  options: [
                    { name: "No", value: false },
                    { name: "Yes", value: true },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
  }

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const credentials = await this.getCredentials("oracleCredentials");
    const oracleCredentials = {
      user: String(credentials.user),
      password: String(credentials.password),
      connectionString: String(credentials.connectionString),
    };

    const db = new OracleConnection(
      oracleCredentials,
      Boolean(credentials.thinMode)
    );

    const items = this.getInputData();
    const returnItems: INodeExecutionData[] = [];

    const sanitizeQuery = (sql: unknown, itemIndex: number) => {
      const raw = typeof sql === "string" ? sql : String(sql ?? "");
      const trimmed = raw.trim();

      if (!trimmed) {
        throw new NodeOperationError(this.getNode(), "SQL query must be a non-empty string", { itemIndex });
      }

      return trimmed.replace(/;\s*$/g, "");
    };

    let connection: oracledb.Connection | undefined;

    try {
      connection = await db.getConnection();

      for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
        const rawQuery = this.getNodeParameter("query", itemIndex);
        let query = sanitizeQuery(rawQuery, itemIndex);

        const parameterDefinitions = ((this.getNodeParameter("params", itemIndex, {}) as IDataObject).values as {
          name: string;
          value: string | number;
          datatype: string;
          parseInStatement: boolean;
        }[]) || [];

        const bindParameters: oracledb.BindParameters = {};

        for (const param of parameterDefinitions) {
          const datatype = param.datatype === "number" ? oracledb.NUMBER : oracledb.STRING;

          if (!param.parseInStatement) {
            bindParameters[param.name] = {
              type: datatype,
              val: param.datatype === "number" ? Number(param.value) : String(param.value),
            };
            continue;
          }

          const values = param.value.toString().split(",").map((val) => val.trim());
          let generatedSqlString = "(";

          for (const value of values) {
            const newParamName = `${param.name}${randomUUID().replace(/-/g, "_")}`;
            bindParameters[newParamName] = {
              type: datatype,
              val: param.datatype === "number" ? Number(value) : String(value),
            };
            generatedSqlString += `:${newParamName},`;
          }

          generatedSqlString = `${generatedSqlString.slice(0, -1)})`;
          query = query.split(`:${param.name}`).join(generatedSqlString);
        }

        try {
          const result = await connection.execute(query, bindParameters, {
            outFormat: oracledb.OUT_FORMAT_OBJECT,
            autoCommit: true,
          });

          const rows = (result.rows ?? []) as IDataObject[];
          const formatted: IDataObject = { rows };

          if (result.metaData !== undefined) {
            formatted.metaData = result.metaData as unknown as IDataObject[];
          }
          if (result.rowsAffected !== undefined) {
            formatted.rowsAffected = result.rowsAffected;
          }
          if (result.outBinds !== undefined) {
            formatted.outBinds = result.outBinds as IDataObject;
          }
          if ((result as IDataObject).lastRowid !== undefined) {
            formatted.lastRowid = (result as IDataObject).lastRowid;
          }

          returnItems.push({
            json: formatted,
            pairedItem: { item: itemIndex },
          });
        } catch (error) {
          const errorInstance = error instanceof Error ? error : new Error("Oracle query failed");

          if (!this.continueOnFail()) {
            throw new NodeOperationError(this.getNode(), errorInstance, {
              itemIndex,
              description: `Query: ${query}`,
            });
          }

          returnItems.push({
            json: {
              message: errorInstance.message,
              item: { ...items[itemIndex].json },
              error: { ...errorInstance },
            },
            pairedItem: { item: itemIndex },
          } as INodeExecutionData);
        }
      }
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (error) {
          console.error(`OracleDB: Failed to close the database connection: ${error}`);
        }
      }
    }

    return [returnItems];
  }
}

export class OracleDatabase implements INodeVersionedType {
  description: INodeTypeBaseDescription = baseDescription;
  nodeVersions: { [key: number]: INodeType };
  currentVersion = 1.1;

  constructor() {
    this.nodeVersions = {
      1: new OracleDatabaseV1(baseDescription),
      1.1: new OracleDatabaseV1(baseDescription),
    };
  }

  getNodeType(version?: number): INodeType {
    if (version === undefined) {
      return this.nodeVersions[this.currentVersion];
    }
    return this.nodeVersions[version] ?? this.nodeVersions[this.currentVersion];
  }
}
