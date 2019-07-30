import Node from "./Node";
import { parseSqlSync, parsePlPgSqlSync } from "./parse";

// Synthetic root node describing top-level result.
export class StatementList extends Node {
  public statements: RawStmt[];
  public text: string;
  static toVisit = ["statements"];
}

export class CreateFunctionStmt extends Node {
  static toVisit = ["func", "funcname", "returnType", "options"];
  public func: PLpgSQL_function;
  // starts as String nodes, but gets turned to primitive strings when visited
  public funcname: string[];

  constructor(data: any, parent: any) {
    super(data, parent);
    this.addChild("func", parsePlPgSqlSync(this.text));
  }

  get text() {
    const stmt = getParentOfType(RawStmt, true, this);
    return stmt.text;
  }
}

export class CreateTrigStmt extends Node {
  static toVisit = ["relation", "funcname", "whenClause", "transitionRels"];
  public trigname: string;
  public relation: RangeVar;
  // starts as String nodes, but gets turned to primitive strings when visited
  public funcname: string[];
  public row: boolean;
  public timing: number;
  public events: number;
  public transitionRels?: TriggerTransition[];
  public whenClause?: Node;
}

export class RawStmt extends Node {
  static toVisit = ["stmt"];
  public stmt_location?: number;
  public stmt_len: number;
  public stmt: Node;

  get text() {
    const statementList = getParentOfType(StatementList, true, this);
    return statementList.text.substr(this.stmt_location || 0, this.stmt_len);
  }
}

export class SelectStmt extends Node {
  static toVisit = [
    "distinctClause",
    "targetList",
    "fromClause",
    "whereClause",
    "groupClause",
    "havingClause",
    "sortClause"
  ];

  public targetList?: ResTarget[];
  public fromClause?: (RangeVar | RangeSubselect | JoinExpr)[];
  public sortClause?: any[];
}

export class SortBy extends Node {
  static toVisit = ["node"];
}

export class UpdateStmt extends Node {
  static toVisit = ["targetList", "relation", "fromClause", "whereClause"];
  public relation: RangeVar;
  public targetList: ResTarget[];
  public whereClause?: Node;
  public fromClause?: any[];
}

export class DeleteStmt extends Node {
  static toVisit = ["targetList", "relation"];
}

export class InsertStmt extends Node {
  static toVisit = ["relation", "cols", "selectStmt"];
  public relation: RangeVar;
  public cols?: ResTarget[];
}

export class String {
  static toVisit = [];
  static fromJSON(data: any) {
    return data.str;
  }
}

export class PLpgSQL_function extends Node {
  public datums: (
    | PLpgSQL_var
    | PLpgSQL_row
    | PLpgSQL_rec
    | PLpgSQL_recfield
    | PLpgSQL_arrayelem)[];
  static toVisit = ["datums", "action"];
}

export class PLpgSQL_rec extends Node {
  public dno: number;
  public refname: string;
}

export class PLpgSQL_row extends Node {
  public dno: number;
  public refname: string;
  public fields: { name: string; varno: number }[];
}

export class PLpgSQL_recfield extends Node {
  public recparentno: number;
  public fieldname: string;

  get func() {
    return getParentOfType(PLpgSQL_function, true, this);
  }

  get record() {
    return this.func.datums.find((it: any) => {
      return it instanceof PLpgSQL_rec && it.dno === this.recparentno;
    }) as PLpgSQL_rec;
  }
}

export class PLpgSQL_var extends Node {}
export class PLpgSQL_arrayelem extends Node {}

export class PLpgSQL_stmt_assign extends Node {
  static toVisit = ["expr"];

  get func() {
    return getParentOfType(PLpgSQL_function, true, this);
  }

  get target(): PLpgSQL_function["datums"][number] {
    const func = this.func as any;
    return func && func.datums[(<any>this).varno];
  }
}

export class PLpgSQL_stmt_block extends Node {
  static toVisit = ["body"];
}

export class PLpgSQL_expr extends Node {
  static toVisit = ["expr"];
  public query: string;
  public expr: Node;

  constructor(data: any, parent: any) {
    super(data, parent);
    this.addChild("expr", parseSqlSync(this.query).statements[0]);
  }
}

export class ColumnRef extends Node {
  static toVisit = ["fields"];
  public fields: [string] | [A_Star] | [string, string] | [string, A_Star];
  toString() {
    return (<any>this).fields.map((it: string) => `"${it}"`).join(".");
  }
}

// account_type, guidebook_classification, source, source_l2
export class BoolExpr extends Node {
  static toVisit = ["args"];
}
export class A_Star extends Node {}
export class A_Const extends Node {}
export class A_Expr extends Node {
  static toVisit = ["name", "lexpr", "rexpr"];
}

export class FuncCall extends Node {
  static toVisit = ["funcname", "args"];
}

export class NullTest extends Node {
  static toVisit = ["arg"];
}

export class CoalesceExpr extends Node {
  static toVisit = ["args"];
}

export class ResTarget extends Node {
  static toVisit = ["val"];
  public name?: string;
  public val?: Node;
  public indirection?: any;
}

export class PLpgSQL_stmt_execsql extends Node {
  static toVisit = ["row", "sqlstmt"];

  get func() {
    return getParentOfType(PLpgSQL_function, true, this);
  }

  get intoVars() {
    const datums = this.func.datums;
    return this.into && this.row && this.row.fields.map(it => datums[it.varno]);
  }

  // Whether this is an PlPgSQL SELECT INTO, and the into's target.
  // Note: INTO doesn't necessarily mean select; UPDATE INTO is valid.
  public into: boolean;
  public rec?: PLpgSQL_rec;
  public row?: PLpgSQL_row;
}

export class PLpgSQL_stmt_if extends Node {
  static toVisit = ["cond", "then_body", "elsif_list", "else_body"];
}

export class PLpgSQL_if_elsif extends Node {
  static toVisit = ["cond", "stmts"];
}

export class PLpgSQL_stmt_perform extends Node {
  static toVisit = ["expr"];
}

export class TypeCast extends Node {
  static toVisit = ["arg", "typeName"];
}

export class TypeName extends Node {
  static toVisit = ["names"];
}

export class JoinExpr extends Node {
  static toVisit = ["larg", "rarg", "quals"];
  public larg: RangeVar | RangeSubselect;
  public rarg: RangeVar | RangeSubselect;
}

export class RangeVar extends Node {
  static toVisit = ["alias"];
  public schemaname?: string;
  public relname: string;
  public alias?: Alias;
}

export class SubLink extends Node {
  static toVisit = ["testexpr", "subselect"];
}

export class RangeSubselect extends Node {
  static toVisit = ["subquery", "alias"];
  public alias: Alias;
}

export class Alias extends Node {
  public aliasname: string;
}

export class TriggerTransition extends Node {
  public name: string;
  public isNew: boolean;
  public isTable: boolean;
}

export class Unrecognized extends Node {}

function getParentOfType<T extends typeof Node>(
  type: T,
  required: true,
  node: Node
): InstanceType<T>;
function getParentOfType<T extends typeof Node>(
  type: T,
  required: false,
  node: Node
): InstanceType<T> | undefined;
function getParentOfType<T extends typeof Node>(
  type: T,
  required: boolean,
  node: Node
): InstanceType<T> | undefined {
  const parent = node.findParent(it => it instanceof type);

  if (required && !parent) {
    throw new Error(`Missing required parent node of type ${type}.`);
  }

  return parent as InstanceType<T> | undefined;
}
