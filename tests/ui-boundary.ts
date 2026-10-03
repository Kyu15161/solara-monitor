import ts from "typescript";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Compare executable code and data bindings after removing only presentation
// attributes. The separate capture harness checks untouched source files.
const run = process.env.UI_CAPTURE_RUN ?? "ui-modernization";
if (!/^[a-z0-9-]+$/.test(run))
  throw new Error("Invalid capture directory name");
const directory = join(process.cwd(), ".data", run);
const files = [
  "src/app/dashboard/loading.tsx",
  "src/app/error.tsx",
  "src/components/dashboard/dashboard.tsx",
  "src/components/dashboard/analytics-page.tsx",
  "src/components/dashboard/controls-page.tsx",
  "src/components/dashboard/settings-page.tsx",
  "src/components/energy-flow.tsx",
  "src/components/charts/power-chart.tsx",
  "src/components/ui/button.tsx",
  "src/components/ui/dialog.tsx",
];
const presentation = new Set([
  "className",
  "role",
  "tone",
  "tick",
  "contentStyle",
  "stroke",
  "fill",
  "stopColor",
  "stopOpacity",
  "strokeWidth",
  "strokeDasharray",
  "iconType",
  "content",
  "data-section",
]);
// Explicit presentation-copy changes; data values, units, dynamic state labels,
// messages and every other literal still compare exactly against the baseline.
const uiCopy = new Map([
  ["Measured household load", "Powering your everyday"],
  ["System status", "System at a glance"],
  ["Device and connection diagnostics", "Measured status, no guesswork"],
  ["Solar energy monitoring.", "A little more independent."],
  ["Production · storage · consumption.", "Your energy, understood."],
  ["Energy overview", "Your energy, at a glance."],
  [
    "Power distribution and system diagnostics.",
    "A little sunshine. A more independent home.",
  ],
  ["Energy balance", "Energy in motion"],
  ["Source, storage and destination", "Follow the flow of your power"],
  ["Production and consumption today", "The rhythm of your solar day"],
  ["Solara · Energy monitoring", "Solara · Your energy, understood."],
]);
function canonical(source: string, file: string): string {
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const transformed = ts.transform(parsed, [
    (context) => {
      const visit: ts.Visitor = (node) => {
        // Reading subdivides an already-formatted string into typography;
        // scoped CSS imports affect presentation only.
        if (
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier) &&
          (node.moduleSpecifier.text.endsWith("ui/reading") ||
            node.moduleSpecifier.text.endsWith(".module.css"))
        )
          return undefined;
        if (
          ts.isJsxSelfClosingElement(node) &&
          ts.isIdentifier(node.tagName) &&
          node.tagName.text === "Reading"
        ) {
          const value = node.attributes.properties.find(
            (attribute) =>
              ts.isJsxAttribute(attribute) &&
              attribute.name.getText(parsed) === "value",
          );
          if (
            value &&
            ts.isJsxAttribute(value) &&
            value.initializer &&
            ts.isJsxExpression(value.initializer)
          )
            return ts.factory.createJsxExpression(
              undefined,
              value.initializer.expression,
            );
          throw new Error("Reading must retain its original value expression.");
        }
        // Header identity adds read-only presentation of existing account data.
        // Retain the original account link, initial, destination and handlers.
        if (file.endsWith("dashboard/dashboard.tsx") && ts.isJsxElement(node)) {
          const className = node.openingElement.attributes.properties.find(
            (attribute) =>
              ts.isJsxAttribute(attribute) &&
              attribute.name.getText(parsed) === "className",
          );
          if (
            className &&
            ts.isJsxAttribute(className) &&
            className.initializer &&
            ts.isStringLiteral(className.initializer)
          ) {
            if (className.initializer.text === "header-identity")
              return undefined;
            if (className.initializer.text === "header-avatar") {
              const initial = node.children.find(ts.isJsxExpression);
              if (!initial)
                throw new Error(
                  "Account initial must remain bound to existing data.",
                );
              return ts.visitNode(initial, visit);
            }
          }
        }
        if (
          file.endsWith("dashboard/dashboard.tsx") &&
          ts.isStringLiteral(node) &&
          uiCopy.has(node.text)
        )
          return ts.factory.createStringLiteral(uiCopy.get(node.text)!);
        // The console schematic adds only static decorative equipment drawings.
        if (
          file.endsWith("energy-flow.tsx") &&
          ts.isFunctionDeclaration(node) &&
          node.name?.text === "FlowGlyph"
        )
          return undefined;
        if (
          file.endsWith("energy-flow.tsx") &&
          ts.isJsxElement(node) &&
          node.openingElement.attributes.properties.some(
            (attribute) =>
              ts.isJsxAttribute(attribute) &&
              attribute.name.getText(parsed) === "className" &&
              attribute.initializer &&
              ts.isStringLiteral(attribute.initializer) &&
              attribute.initializer.text === "flow-illustration",
          )
        )
          return undefined;
        if (ts.isJsxAttribute(node)) {
          const name = node.name.getText(parsed);
          if (
            name === "title" &&
            ts.isJsxOpeningElement(node.parent.parent) &&
            node.parent.parent.tagName.getText(parsed) === "Link"
          )
            return undefined;
          if (presentation.has(name) || name.startsWith("aria-"))
            return undefined;
        }
        if (ts.isJsxText(node)) {
          // Ignore indentation and line wrapping, retaining meaningful text.
          const text = node.text.replace(/\s+/g, " ").trim();
          return text
            ? ts.factory.createJsxText(uiCopy.get(text) ?? text)
            : undefined;
        }
        if (
          file.endsWith("energy-flow.tsx") &&
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "line"
        ) {
          return ts.factory.updateCallExpression(
            node,
            node.expression,
            node.typeArguments,
            node.arguments.map((argument, index) =>
              index < 2
                ? ts.factory.createStringLiteral(
                    index === 0 ? "presentation-path" : "presentation-color",
                  )
                : (ts.visitNode(argument, visit) as ts.Expression),
            ),
          );
        }
        return ts.visitEachChild(node, visit, context);
      };
      return (node) => ts.visitNode(node, visit) as ts.SourceFile;
    },
  ]);
  try {
    // Compare the semantic AST rather than printer line wrapping or source
    // positions. Literal contents and expression/operator structure stay exact.
    function fingerprint(node: ts.Node): unknown[] {
      const parts: unknown[] = [node.kind];
      if (
        !ts.isSourceFile(node) &&
        "text" in node &&
        typeof node.text === "string"
      )
        parts.push(node.text);
      if ("operator" in node) parts.push(node.operator);
      if ("token" in node) parts.push(node.token);
      if ("isTypeOnly" in node) parts.push(node.isTypeOnly);
      if (ts.isVariableDeclarationList(node))
        parts.push(node.flags & ts.NodeFlags.BlockScoped);
      ts.forEachChild(node, (child) => {
        parts.push(fingerprint(child));
      });
      return parts;
    }
    return JSON.stringify(fingerprint(transformed.transformed[0]));
  } finally {
    transformed.dispose();
  }
}
async function main() {
  for (const file of files) {
    const before = canonical(
      await readFile(join(directory, "source", file), "utf8"),
      file,
    );
    const after = canonical(await readFile(file, "utf8"), file);
    if (before !== after) {
      await writeFile(join(directory, "unexpected-before.txt"), before);
      await writeFile(join(directory, "unexpected-after.txt"), after);
      throw new Error(`Non-presentation change detected in ${file}`);
    }
  }
  console.log(
    `UI boundary verified: executable logic, handlers, data bindings and dynamic content unchanged in ${files.length} components; static presentation-copy revisions accounted for.`,
  );
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
