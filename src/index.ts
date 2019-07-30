import * as NodeTypes from "./nodes";
import Node, { Visitor } from "./Node";
import { parseSql } from "./parse";

export { NodeTypes, Node };

type Options<T> = {
  text: string;
  parseResult?: any[];
  visitor: Visitor<T>;
  initialState?: T;
};

export default async function traverse<T extends undefined>(
  opts: Options<T>
): Promise<undefined>;
export default async function traverse<T>(opts: Options<T>): Promise<T>;
export default async function traverse<T>(opts: Options<T>) {
  const {
    parseResult = await parseSql(opts.text),
    text,
    visitor,
    initialState
  } = opts;

  type StatementList = InstanceType<(typeof NodeTypes)["StatementList"]>;
  const statementList = NodeTypes.StatementList.fromJSON(
    { statements: parseResult, text },
    undefined,
    NodeTypes
  );

  return (statementList as StatementList).traverse(
    visitor as Visitor<T | undefined>,
    initialState
  );
}

/*
type Grouper = (keyof T | ((it: T) => string));
function nestedGroups<T>(data: T[], groupers: [Grouper, Grouper, Grouper]): Dictionary<Dictionary<Dictionary<T[]>>>;
function nestedGroups<T>(data: T[], groupers: [Grouper, Grouper]): Dictionary<Dictionary<T[]>>;
function nestedGroups<T>(data: T[], groupers: [Grouper]): Dictionary<T[]>;
function nestedGroups<T>(data: T[], groupers: []): T[];
function nestedGroups<T>(data: T[], groupers: Grouper[]): any {
  if (!groupers.length)
      return data;

  const [grouper, ...tailGroupers] = groupers;
  return mapValues(
    groupBy(data, grouper),
    (subGroupData) => nestedGroups(subGroupData, tailGroupers as any)
  );
};
*/
