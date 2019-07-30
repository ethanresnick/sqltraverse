import * as NodeTypes from "./nodes";
import { pick } from "lodash";
import { inspect } from "util";

export type NodeVisitor<State, NodeType extends typeof Node> = {
  (this: Visitor<State>, node: InstanceType<NodeType>, state: State): void;
};

export type Visitor<State> = {
  [K in keyof typeof NodeTypes]?: (typeof NodeTypes)[K] extends typeof Node
    ? NodeVisitor<State, (typeof NodeTypes)[K]>
    : never;
};

// Say we have a structure like: NodeA { field1: [NodeB, NodeC], field2: NodeD }.
// Inside of NodeC, we want to know not only that it's contained in NodeA,
// but that it's contained in the `field1` property of NodeA, at position 1.
// So, rather than making the `parent` prop in NodeC be the NodeA instance,
// we make it a "Reference", which holds both NodeA and the path ["field1", 1].
// This path can either have two entries (for child nodes in parent array fields)
// or one, as in the case of NodeD, which is directly under field2.
type Reference = {
  readonly node: Node;
  readonly path: Readonly<[string] | [string, number]>;
};

export default class Node {
  static toVisit?: string[];
  owner?: Reference;
  loc: { start: number; length: number };

  constructor(partialData: any, owner?: Reference) {
    this.owner = owner;
    Object.assign(this, partialData);
  }

  protected childNodePaths() {
    return keysHolding(isNode, this);
  }

  [inspect.custom](depth: number, options: any) {
    if (this.owner) {
      const owner = this.owner;
      delete this.owner;
      const res = inspect(this, options);
      this.owner = owner;
      return res;
    } else {
      return this;
    }
  }

  addChild<T extends keyof this & string>(childName: T, node: this[T] & Node) {
    this[childName] = node;
    node.owner = { node: this, path: [childName] };
  }

  findParent(predicate: (it: Node) => boolean) {
    const matchingOwner = this.findOwner(it => predicate(it.node));
    return matchingOwner && matchingOwner.node;
  }

  findOwner(predicate: (it: Reference) => boolean) {
    let owner = this.owner;
    while (owner && !predicate(owner)) {
      owner = owner.node.owner;
    }

    // No owner means we've reached root
    return owner || undefined;
  }

  traverse(visitor: Visitor<undefined>): undefined;
  traverse<T>(visitor: Visitor<T>, state: T): T;
  traverse<T>(visitor: Visitor<T | undefined>, state?: T): T | undefined {
    const nodeType = this.constructor.name as keyof typeof NodeTypes;
    const visitorFnForNodeType = visitor[nodeType] as NodeVisitor<
      T | undefined,
      typeof Node
    >;

    if (visitorFnForNodeType) {
      visitorFnForNodeType.call(visitor, this as Node, state);
      return state;
    }

    return this.traverseChildren(visitor, state);
  }

  traverseChildren(visitor: Visitor<undefined>): undefined;
  traverseChildren<T>(visitor: Visitor<T>, state: T): T;
  traverseChildren<T>(
    visitor: Visitor<T | undefined>,
    state?: T
  ): T | undefined {
    const toVisit = (this.constructor as typeof Node).toVisit;
    const pathsToVisit = toVisit || this.childNodePaths();
    (pathsToVisit as (keyof this)[]).forEach(path => {
      forEachValOrArray(this[path], it => {
        if (it instanceof Node) {
          it.traverse(visitor, state);
        }
      });
    });

    return state;
  }

  /**
   * Takes a blob of JSON representing a Node's contents, and recursively
   * transforms it, and the JSON for any of its child nodes, into instances
   * of the Node class (which is useful so we can recursively `visit()`).
   *
   * @param {any} data JSON for a node
   * @param {any} classMap An object whose keys are node names
   *   (as found in the JSON) and whose values are constructors for the
   *   classes that should be instantiated to represent a node of each name.
   */
  static fromJSON(data: any, owner: Reference | undefined, classMap: any): any {
    const fieldsToVisit = new Set(
      this.toVisit || keysHolding(isNodeJSON, data)
    ) as Set<keyof Node & string>;

    // There's a cycle here: when we construct a node, we set its parent,
    // but the parent node isn't done being constructed until we've created
    // and added all its children. This cycle becomes problematic when the
    // child constructor actually needs to read some of the data on the
    // not-yet-finalized parent in order to set props on itself. That happens
    // in the CreateFunctionStmt, which needs the text from the parent
    // StatementList to parse and save a child node for the function.
    // So, to work around this, we add the non-node-holding keys first,
    // and then add the child nodes.
    const simpleFields = Object.keys(data).filter(
      it => !fieldsToVisit.has(<any>it)
    );
    const baseData = pick(data, simpleFields);
    const inst = new this(baseData, owner);

    fieldsToVisit.forEach(fieldToVisit => {
      // Make sure the constructor didn't already set up the field.
      if (fieldToVisit in inst) {
        return;
      }

      inst[fieldToVisit] = mapValOrArray(
        data[fieldToVisit],
        (nodeJSON: any, i?: number) => {
          // fieldToVisit, which generally holds a node,
          // could be null/undefined if node's optional
          if (!nodeJSON) {
            return nodeJSON;
          }

          const nodeName = Object.keys(nodeJSON)[0];

          // If we haven't defined a class for this node, turn it into an
          // UnrecognizedNode node so we can at least traverse any children.
          // This makes our rules much more robust in the face of new SQL nodes
          // and those I haven't thought/bothered explicitly to add.
          const NodeClass: typeof Node =
            classMap[nodeName] || NodeTypes.Unrecognized;

          // i will be set if data[fieldToVisit] was an array.
          const owner = {
            node: inst,
            path:
              typeof i === "undefined"
                ? <const>[fieldToVisit]
                : <const>[fieldToVisit, i]
          };

          return NodeClass.fromJSON(nodeJSON[nodeName], owner, classMap);
        }
      );
    });

    return inst;
  }
}

function isNode(it: any): it is Node {
  return it instanceof Node;
}

/** Is this the json that represents a Node? */
function isNodeJSON(it: any) {
  if (typeof it !== "object" || it === null) return false;

  const keys = Object.keys(it);
  return keys.length === 1 && keys[0][0].toUpperCase() === keys[0][0];
}

function keysHolding(pred: (it: any) => boolean, data: any) {
  return Object.keys(data).filter(k => {
    const val = data[k as keyof typeof data];
    return Array.isArray(val) ? val.every(pred) : pred(val);
  });
}

function forEachValOrArray<T>(data: T[] | T, cb: (it: T) => void) {
  const dataArr = Array.isArray(data) ? data : [data];
  dataArr.forEach(cb);
}

function mapValOrArray<T, U>(data: T[] | T, cb: (it: T) => U): U | U[] {
  return Array.isArray(data) ? data.map(cb) : cb(data);
}
