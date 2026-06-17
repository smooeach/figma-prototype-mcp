import type { InteractionSpec, Action } from "../../server/interaction-spec.js";
import type { GeneratedFile } from "../types.js";
import { pascalCase } from "../types.js";
import { buildScreenIdentities, collectVariables, type ScreenIdentity } from "./react-shared.js";

const DART_KEYWORDS = new Set([
  "abstract","else","import","show","as","enum","in","static","assert","export","interface","super",
  "async","extends","is","switch","await","extension","late","sync","break","external","library",
  "this","case","factory","mixin","throw","catch","false","new","true","class","final","null","try",
  "const","finally","on","typedef","continue","for","operator","var","covariant","part","void",
  "default","get","required","while","deferred","hide","rethrow","with","do","if","return","yield",
  "dynamic","implements","set","late","function",
  // implicit enum members — collide with a generated enum value
  "values","index",
]);
function guardDart(s: string): string { return DART_KEYWORDS.has(s) ? `${s}_` : s; }

/** lowercase-first of a PascalCase component (e.g. Home → home). Used for enum values + fn names. */
export function dartCase(component: string): string {
  const s = component.charAt(0).toLowerCase() + component.slice(1);
  return guardDart(s);
}

/** PascalCase/camelCase → snake_case for Dart file names (HomeScreen → home_screen). */
export function snakeCase(component: string): string {
  return component
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "screen";
}

/**
 * A valid Dart identifier for a function name. Dart identifiers may not start with a digit,
 * so a digit/empty start (node id "1:2" → "1_2", or name "2nd Button") is prefixed with "n".
 */
export function dartIdent(raw: string): string {
  const cleaned = (raw ?? "").replace(/[^A-Za-z0-9]/g, "_");
  const safe = /^[A-Za-z]/.test(cleaned) ? cleaned : `n${cleaned}`;
  return guardDart(safe);
}

/** A Dart literal for a JS boolean/number/string value. */
function dartLiteral(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return JSON.stringify(String(value));
}

/** Screen enum + ScreenPath extension + Router wrapping a GoRouter. */
export function emitRouterDart(spec: InteractionSpec): string {
  const ids = buildScreenIdentities(spec);
  const values = spec.screens.map((s) => dartCase(ids.get(s.id)!.component)).join(", ");
  const pathCases = spec.screens.map((s) => {
    const c = dartCase(ids.get(s.id)!.component);
    return `      case Screen.${c}:\n        return ${JSON.stringify("/" + c)};`;
  }).join("\n");
  return [
    `import 'package:flutter/material.dart';`,
    `import 'package:go_router/go_router.dart';`,
    ``,
    `// Routes generated from the Figma prototype screen graph.`,
    `enum Screen { ${values} }`,
    ``,
    `extension ScreenPath on Screen {`,
    `  String get path {`,
    `    switch (this) {`,
    pathCases,
    `    }`,
    `  }`,
    `}`,
    ``,
    `enum OverlayStyle { sheet, dialog }`,
    ``,
    `// Named ProtoRouter to avoid colliding with Flutter's own Router widget.`,
    `class ProtoRouter {`,
    `  final GoRouter go;`,
    `  ProtoRouter(this.go);`,
    `  void navigate(Screen screen) => go.push(screen.path);`,
    `  void goBack() => go.pop();`,
    `  void presentOverlay(Screen screen, OverlayStyle style, bool dismissable) {`,
    `    final ctx = go.routerDelegate.navigatorKey.currentContext;`,
    `    if (ctx == null) return;`,
    `    final child = const SizedBox.shrink(); // TODO: build the widget for \`screen\``,
    `    if (style == OverlayStyle.sheet) {`,
    `      showModalBottomSheet(context: ctx, isDismissible: dismissable, builder: (_) => child);`,
    `    } else {`,
    `      showDialog(context: ctx, barrierDismissible: dismissable, builder: (_) => child);`,
    `    }`,
    `  }`,
    `  void dismissOverlay() {`,
    `    final ctx = go.routerDelegate.navigatorKey.currentContext;`,
    `    if (ctx != null) Navigator.of(ctx).pop();`,
    `  }`,
    `}`,
    ``,
  ].join("\n");
}

/** ChangeNotifier variable store. */
export function emitStoreDart(spec: InteractionSpec): string {
  const vars = collectVariables(spec);
  const inits = vars.map((v) => `    ${JSON.stringify(v)}: false,`).join("\n");
  return [
    `import 'package:flutter/foundation.dart';`,
    ``,
    `// Prototype variables, generated from set/toggle/conditional actions.`,
    `// Defaults are best-effort (false); adjust types to match your design.`,
    `class PrototypeStore extends ChangeNotifier {`,
    `  final Map<String, dynamic> vars = {`,
    inits,
    `  };`,
    `  void set(String name, dynamic value) {`,
    `    vars[name] = value;`,
    `    notifyListeners();`,
    `  }`,
    `  void toggle(String name) {`,
    `    vars[name] = !((vars[name] as bool?) ?? false);`,
    `    notifyListeners();`,
    `  }`,
    `}`,
    ``,
  ].join("\n");
}

/** Condition node → Dart boolean expression (map cast inferred from the literal). */
export function renderConditionDart(node: any): string {
  if (!node || typeof node !== "object") return "false";
  if (Array.isArray(node.all)) return node.all.map(renderConditionDart).join(" && ") || "true";
  if (Array.isArray(node.any)) return node.any.map(renderConditionDart).join(" || ") || "false";
  if (typeof node.variable === "string") {
    const OP: Record<string, string> = { "==": "==", "!=": "!=", "<": "<", "<=": "<=", ">": ">", ">=": ">=" };
    const op = OP[node.operator as string] ?? "==";
    const key = JSON.stringify(node.variable);
    const v = node.value;
    // `is`-guarded read (not a hard `as` cast): vars default to `false`, so `false as num?`
    // would THROW at runtime — Dart `as` is not a safe cast like Swift/Kotlin `as?`.
    if (typeof v === "boolean") return `(store.vars[${key}] is bool ? store.vars[${key}] as bool : false) ${op} ${dartLiteral(v)}`;
    if (typeof v === "number") return `(store.vars[${key}] is num ? store.vars[${key}] as num : 0) ${op} ${dartLiteral(v)}`;
    return `(store.vars[${key}] is String ? store.vars[${key}] as String : "") ${op} ${dartLiteral(v)}`;
  }
  return "false";
}

function renderActionDart(a: Action, indent: string, ids: Map<string, ScreenIdentity>): string[] {
  const caseFor = (to: any): string => {
    const dest = to?.id ? ids.get(to.id) : undefined;
    return dest ? dartCase(dest.component) : to?.name ? dartCase(pascalCase(to.name)) : "screen";
  };
  const overlayCall = (a: any): string => {
    const style = a.overlay?.style === "dialog" ? "OverlayStyle.dialog" : "OverlayStyle.sheet";
    const dismissable = a.overlay?.dismissable === false ? "false" : "true";
    return `Screen.${caseFor(a.to)}, ${style}, ${dismissable}`;
  };
  switch (a.type) {
    case "navigate": {
      const known = a.to?.id ? ids.get(a.to.id) : undefined;
      if (!known) {
        return [
          `${indent}// TODO: target "${a.to?.name ?? a.to?.id ?? ""}" is not in the Screen enum — add a value, then uncomment:`,
          `${indent}// router.navigate(Screen.${caseFor(a.to)});`,
        ];
      }
      return [`${indent}router.navigate(Screen.${caseFor(a.to)});`];
    }
    case "openOverlay":
    case "swapOverlay": {
      const known = a.to?.id ? ids.get(a.to.id) : undefined;
      if (!known) {
        return [
          `${indent}// TODO: overlay target "${a.to?.name ?? a.to?.id ?? ""}" is not in the Screen enum — add a value, then uncomment:`,
          `${indent}// router.presentOverlay(${overlayCall(a)});`,
        ];
      }
      return [`${indent}router.presentOverlay(${overlayCall(a)});`];
    }
    case "closeOverlay":
      return [`${indent}router.dismissOverlay();`];
    case "back":
      return [`${indent}router.goBack();`];
    case "openUrl":
      return [`${indent}launchUrl(Uri.parse(${JSON.stringify(String((a as any).url ?? ""))}));`];
    case "setVariable":
      return [`${indent}store.set(${JSON.stringify(String((a as any).variable))}, ${dartLiteral((a as any).value)});`];
    case "toggleVariable":
      return [`${indent}store.toggle(${JSON.stringify(String((a as any).variable))});`];
    case "scrollTo": {
      const label = (a as any).to?.name ?? (a as any).to?.id ?? "";
      const id = String((a as any).to?.id ?? "");
      return [`${indent}// TODO: scroll to "${label}" — attach a ScrollController and call Scrollable.ensureVisible / animateTo for "${id}"`];
    }
    case "changeVariant": {
      const label = (a as any).to?.name ?? (a as any).to?.id ?? "";
      return [`${indent}// TODO: change to variant "${label}" — set your Widget's variant state`];
    }
    case "conditional": {
      const cond = renderConditionDart((a as any).if);
      const then = (a as any).then.flatMap((x: Action) => renderActionDart(x, indent + "  ", ids));
      const out = [`${indent}if (${cond}) {`, ...then];
      if ((a as any).else && (a as any).else.length) {
        const els = (a as any).else.flatMap((x: Action) => renderActionDart(x, indent + "  ", ids));
        out.push(`${indent}} else {`, ...els, `${indent}}`);
      } else {
        out.push(`${indent}}`);
      }
      return out;
    }
    default:
      return [`${indent}// TODO: unsupported action ${JSON.stringify((a as any).type)}`];
  }
}

/** One <screen>_actions.dart per screen WITH interactions (empty screens are skipped). */
export function emitScreenActionsDart(spec: InteractionSpec): GeneratedFile[] {
  const ids = buildScreenIdentities(spec);
  return spec.screens
    .filter((s) => s.interactions.length > 0)
    .map((s) => {
      const comp = ids.get(s.id)!.component;
      const funcs = s.interactions.map((it) => {
        const fn = it.source?.name
          ? dartIdent(dartCase(pascalCase(it.source.name)))
          : dartIdent(it.source?.id ?? "node");
        const body = it.actions.flatMap((act) => renderActionDart(act, "  ", ids)).join("\n");
        return [`void ${fn}(ProtoRouter router, PrototypeStore store) {`, body, `}`].join("\n");
      }).join("\n\n");
      const usesUrl = funcs.includes("launchUrl(");
      const content = [
        `import 'router.dart';`,
        `import 'prototype_store.dart';`,
        ...(usesUrl ? [`import 'package:url_launcher/url_launcher.dart';`] : []),
        ``,
        `// Interaction handlers for the "${s.name ?? s.id}" screen, keyed by source node.`,
        funcs,
        ``,
      ].join("\n");
      return { path: `${snakeCase(comp)}_actions.dart`, content };
    });
}

export function emitReadmeDart(spec: InteractionSpec): string {
  const unsupported = spec.unsupported.length
    ? spec.unsupported.map((u) => `- \`${u.source?.name ?? u.source?.id ?? "?"}\`: ${u.reason}`).join("\n")
    : "- (none)";
  return [
    `# Generated prototype interactions (Flutter)`,
    ``,
    `Dart + GoRouter. Covers navigation, variables, and conditionals — NOT screen UI.`,
    ``,
    `## Wiring`,
    `- Add dependencies: \`go_router\`, \`provider\`, \`url_launcher\`.`,
    `- Build a GoRouter, wrap it in ProtoRouter, and bind MaterialApp.router:`,
    `  \`\`\`dart`,
    `  final go = GoRouter(routes: [`,
    `    GoRoute(path: Screen.home.path, builder: (c, s) => const HomeScreen()),`,
    `  ]);`,
    `  final router = ProtoRouter(go);`,
    `  // MaterialApp.router(routerConfig: go) with a ChangeNotifierProvider<PrototypeStore>`,
    `  \`\`\``,
    `- Files: \`router.dart\` (Screen enum + ProtoRouter), \`prototype_store.dart\` (vars ChangeNotifier),`,
    `  \`<screen>_actions.dart\` (call e.g. \`goDetail(router, store)\` from your widgets).`,
    ``,
    `## Overlays`,
    `- \`presentOverlay\` uses the GoRouter navigatorKey to show a \`showModalBottomSheet\` (sheet)`,
    `  or \`showDialog\` (dialog). Replace the \`SizedBox.shrink()\` placeholder in router.dart with`,
    `  the widget for each \`Screen\`. \`dismissable\` maps to isDismissible/barrierDismissible.`,
    ``,
    `## Best-effort / manual`,
    `- scroll-to (names the target node) and component variants are commented stubs. Navigation transitions use the default.`,
    ``,
    `## Unsupported interactions`,
    unsupported,
    ``,
    spec.truncated ? `> Note: the source flow was truncated; some interactions may be missing.\n` : ``,
  ].join("\n");
}

/** The Flutter emitter: InteractionSpec -> Dart file set. */
export function emitFlutter(spec: InteractionSpec): GeneratedFile[] {
  return [
    { path: "router.dart", content: emitRouterDart(spec) },
    { path: "prototype_store.dart", content: emitStoreDart(spec) },
    ...emitScreenActionsDart(spec),
    { path: "README.md", content: emitReadmeDart(spec) },
  ];
}
