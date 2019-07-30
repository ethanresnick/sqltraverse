import {
  parseQuery,
  parseQuerySync,
  parsePlPgSQL,
  parsePlPgSQLSync
} from "@sqlutils/parse";
import * as NodeTypes from "./nodes";

export async function parseSql(
  statements: string
): Promise<NodeTypes.StatementList> {
  return NodeTypes.StatementList.fromJSON(
    { statements: await parseQuery(statements), text: statements },
    undefined,
    NodeTypes
  );
}

export function parseSqlSync(statements: string): NodeTypes.StatementList {
  return NodeTypes.StatementList.fromJSON(
    { statements: parseQuerySync(statements), text: statements },
    undefined,
    NodeTypes
  );
}

export async function parsePlPgSql(
  funcStmt: string
): Promise<NodeTypes.PLpgSQL_function> {
  const [parsedFunc] = await parsePlPgSQL(funcStmt);
  return NodeTypes.PLpgSQL_function.fromJSON(
    parsedFunc.PLpgSQL_function,
    undefined,
    NodeTypes
  );
}

export function parsePlPgSqlSync(funcStmt: string): NodeTypes.PLpgSQL_function {
  const [parsedFunc] = parsePlPgSQLSync(funcStmt);
  return NodeTypes.PLpgSQL_function.fromJSON(
    parsedFunc.PLpgSQL_function,
    undefined,
    NodeTypes
  );
}
