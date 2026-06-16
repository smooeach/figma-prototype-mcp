import type { InteractionSpec, Action } from "../../server/interaction-spec.js";
import type { GeneratedFile } from "../types.js";
import { pascalCase } from "../types.js";
import { buildScreenIdentities, collectVariables, type ScreenIdentity } from "./react-shared.js";

/** Screen enum case name: lowercase-first of the unique component (e.g. Screen02 → screen02). */
export function screenCase(component: string): string {
  return component.charAt(0).toLowerCase() + component.slice(1);
}

/** A Swift literal for a JS boolean/number/string value. */
function swiftLiteral(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return JSON.stringify(String(value));
}

/** Screen enum + Router ObservableObject. */
export function emitRouter(spec: InteractionSpec): string {
  const ids = buildScreenIdentities(spec);
  const cases = spec.screens.map((s) => `    case ${screenCase(ids.get(s.id)!.component)}`).join("\n");
  return [
    `import SwiftUI`,
    ``,
    `// Routes generated from the Figma prototype screen graph.`,
    `enum Screen: Hashable {`,
    cases,
    `}`,
    ``,
    `final class Router: ObservableObject {`,
    `    @Published var path = NavigationPath()`,
    `    func navigate(_ screen: Screen) { path.append(screen) }`,
    `    func goBack() { if !path.isEmpty { path.removeLast() } }`,
    `    func reset() { path = NavigationPath() }`,
    `}`,
    ``,
  ].join("\n");
}

/** ObservableObject variable store. */
export function emitStoreSwift(spec: InteractionSpec): string {
  const vars = collectVariables(spec);
  const inits = vars.map((v) => `        ${JSON.stringify(v)}: false,`).join("\n");
  return [
    `import SwiftUI`,
    ``,
    `// Prototype variables, generated from set/toggle/conditional actions.`,
    `// Defaults are best-effort (false); adjust types to match your design.`,
    `final class PrototypeStore: ObservableObject {`,
    `    @Published var vars: [String: Any] = [`,
    inits,
    `    ]`,
    `    func set(_ name: String, _ value: Any) { vars[name] = value }`,
    `    func toggle(_ name: String) { vars[name] = !((vars[name] as? Bool) ?? false) }`,
    `}`,
    ``,
  ].join("\n");
}

/** Condition node → Swift boolean expression (dictionary cast inferred from the literal). */
export function renderConditionSwift(node: any): string {
  if (!node || typeof node !== "object") return "false";
  if (Array.isArray(node.all)) return node.all.map(renderConditionSwift).join(" && ") || "true";
  if (Array.isArray(node.any)) return node.any.map(renderConditionSwift).join(" || ") || "false";
  if (typeof node.variable === "string") {
    const OP: Record<string, string> = { "==": "==", "!=": "!=", "<": "<", "<=": "<=", ">": ">", ">=": ">=" };
    const op = OP[node.operator as string] ?? "==";
    const key = JSON.stringify(node.variable);
    const v = node.value;
    if (typeof v === "boolean") return `((store.vars[${key}] as? Bool) ?? false) ${op} ${swiftLiteral(v)}`;
    if (typeof v === "number") return `((store.vars[${key}] as? Double) ?? 0) ${op} ${swiftLiteral(v)}`;
    return `((store.vars[${key}] as? String) ?? "") ${op} ${swiftLiteral(v)}`;
  }
  return "false";
}

function renderActionSwift(a: Action, indent: string, ids: Map<string, ScreenIdentity>): string[] {
  const caseFor = (to: any): string => {
    const dest = to?.id ? ids.get(to.id) : undefined;
    return dest ? screenCase(dest.component) : to?.name ? screenCase(pascalCase(to.name)) : "screen";
  };
  switch (a.type) {
    case "navigate": {
      const known = a.to?.id ? ids.get(a.to.id) : undefined;
      // Unknown target → comment the call out (an undefined Screen case is a SWIFT COMPILE error,
      // unlike a runtime no-op in JS), so the generated file still builds.
      if (!known) {
        return [
          `${indent}// TODO: target "${a.to?.name ?? a.to?.id ?? ""}" is not in the Screen enum — add a case, then uncomment:`,
          `${indent}// router.navigate(.${caseFor(a.to)})`,
        ];
      }
      return [`${indent}router.navigate(.${caseFor(a.to)})`];
    }
    case "openOverlay":
    case "swapOverlay": {
      const known = a.to?.id ? ids.get(a.to.id) : undefined;
      if (!known) {
        return [
          `${indent}// TODO: overlay target "${a.to?.name ?? a.to?.id ?? ""}" is not in the Screen enum — add a case, then uncomment (present as a .sheet / .fullScreenCover):`,
          `${indent}// router.navigate(.${caseFor(a.to)})`,
        ];
      }
      return [`${indent}router.navigate(.${caseFor(a.to)}) // TODO: present as a .sheet / .fullScreenCover`];
    }
    case "closeOverlay":
      return [`${indent}router.goBack() // close overlay`];
    case "back":
      return [`${indent}router.goBack()`];
    case "openUrl":
      return [`${indent}if let url = URL(string: ${JSON.stringify(String((a as any).url ?? ""))}) { UIApplication.shared.open(url) }`];
    case "setVariable":
      return [`${indent}store.set(${JSON.stringify(String((a as any).variable))}, ${swiftLiteral((a as any).value)})`];
    case "toggleVariable":
      return [`${indent}store.toggle(${JSON.stringify(String((a as any).variable))})`];
    case "scrollTo":
      return [`${indent}// TODO: ScrollViewReader.scrollTo — no navigation equivalent`];
    case "changeVariant":
      return [`${indent}// TODO: component variant — handle in the View`];
    case "conditional": {
      const cond = renderConditionSwift((a as any).if);
      const then = (a as any).then.flatMap((x: Action) => renderActionSwift(x, indent + "    ", ids));
      const out = [`${indent}if ${cond} {`, ...then, `${indent}}`];
      if ((a as any).else && (a as any).else.length) {
        const els = (a as any).else.flatMap((x: Action) => renderActionSwift(x, indent + "    ", ids));
        out.push(`${indent}else {`, ...els, `${indent}}`);
      }
      return out;
    }
    default:
      return [`${indent}// TODO: unsupported action ${JSON.stringify((a as any).type)}`];
  }
}

/** One <Screen>Actions.swift per screen WITH interactions (empty screens are skipped). */
export function emitScreenActions(spec: InteractionSpec): GeneratedFile[] {
  const ids = buildScreenIdentities(spec);
  return spec.screens
    .filter((s) => s.interactions.length > 0)
    .map((s) => {
      const comp = ids.get(s.id)!.component;
      const funcs = s.interactions.map((it) => {
        const fn = it.source?.name
          ? screenCase(pascalCase(it.source.name))
          : (it.source?.id ?? "node").replace(/[^A-Za-z0-9]/g, "_");
        const body = it.actions.flatMap((act) => renderActionSwift(act, "        ", ids)).join("\n");
        return [`    static func ${fn}(router: Router, store: PrototypeStore) {`, body, `    }`].join("\n");
      }).join("\n\n");
      const content = [
        `import SwiftUI`,
        ``,
        `// Interaction handlers for the "${s.name ?? s.id}" screen, keyed by source node.`,
        `enum ${comp}Actions {`,
        funcs,
        `}`,
        ``,
      ].join("\n");
      return { path: `${comp}Actions.swift`, content };
    });
}

export function emitReadmeSwift(spec: InteractionSpec): string {
  const unsupported = spec.unsupported.length
    ? spec.unsupported.map((u) => `- \`${u.source?.name ?? u.source?.id ?? "?"}\`: ${u.reason}`).join("\n")
    : "- (none)";
  return [
    `# Generated prototype interactions (SwiftUI)`,
    ``,
    `iOS 16+. Covers navigation, variables, and conditionals — NOT screen UI.`,
    ``,
    `## Wiring`,
    `- Wrap your root in a NavigationStack bound to the Router:`,
    `  \`\`\`swift`,
    `  NavigationStack(path: $router.path) {`,
    `    HomeView()`,
    `      .navigationDestination(for: Screen.self) { screen in /* switch screen { ... } */ }`,
    `  }`,
    `  .environmentObject(router)`,
    `  .environmentObject(store)`,
    `  \`\`\``,
    `- Files: \`Router.swift\` (Screen enum + Router), \`PrototypeStore.swift\` (vars),`,
    `  \`<Screen>Actions.swift\` (call e.g. \`HomeActions.goDetail(router:store:)\` from your Buttons).`,
    ``,
    `## Best-effort / manual`,
    `- Overlays → plain navigate (use \`.sheet\`/\`.fullScreenCover\`). Scroll-to and component`,
    `  variants are commented stubs. Navigation transitions use the default push.`,
    ``,
    `## Unsupported interactions`,
    unsupported,
    ``,
    spec.truncated ? `> Note: the source flow was truncated; some interactions may be missing.\n` : ``,
  ].join("\n");
}

/** The SwiftUI emitter: InteractionSpec -> Swift file set. */
export function emitSwiftUI(spec: InteractionSpec): GeneratedFile[] {
  return [
    { path: "Router.swift", content: emitRouter(spec) },
    { path: "PrototypeStore.swift", content: emitStoreSwift(spec) },
    ...emitScreenActions(spec),
    { path: "README.md", content: emitReadmeSwift(spec) },
  ];
}
