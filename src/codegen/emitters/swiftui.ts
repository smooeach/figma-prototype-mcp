import type { InteractionSpec, Action } from "../../server/interaction-spec.js";
import type { GeneratedFile } from "../types.js";
import { pascalCase } from "../types.js";
import { buildScreenIdentities, collectVariables, type ScreenIdentity } from "./react-shared.js";

const SWIFT_KEYWORDS = new Set([
  "associatedtype","class","deinit","enum","extension","fileprivate","func","import","init",
  "inout","internal","let","open","operator","private","protocol","public","rethrows","static",
  "struct","subscript","typealias","var","break","case","continue","default","defer","do","else",
  "fallthrough","for","guard","if","in","repeat","return","switch","where","while","as","catch",
  "false","is","nil","super","self","throw","throws","true","try",
]);
function guardSwift(s: string): string { return SWIFT_KEYWORDS.has(s) ? `${s}_` : s; }

/** Screen enum case name: lowercase-first of the unique component (e.g. Screen02 → screen02). */
export function screenCase(component: string): string {
  const s = component.charAt(0).toLowerCase() + component.slice(1);
  return guardSwift(s);
}

/**
 * A valid Swift identifier for a func/method name. Swift identifiers may not start with a
 * digit, so a digit/empty start (e.g. node id "1:2" → "1_2", or name "2nd Button") is prefixed
 * with "n" to keep the generated Swift compiling.
 */
export function swiftIdent(raw: string): string {
  const cleaned = (raw ?? "").replace(/[^A-Za-z0-9]/g, "_");
  const safe = /^[A-Za-z]/.test(cleaned) ? cleaned : `n${cleaned}`;
  return guardSwift(safe);
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
    `enum OverlayStyle { case sheet, dialog }`,
    `struct OverlayPresentation: Identifiable {`,
    `    let id = UUID()`,
    `    let screen: Screen`,
    `    let style: OverlayStyle`,
    `    let dismissable: Bool`,
    `}`,
    ``,
    `final class Router: ObservableObject {`,
    `    @Published var path = NavigationPath()`,
    `    @Published var overlay: OverlayPresentation?`,
    `    func navigate(_ screen: Screen) { path.append(screen) }`,
    `    func goBack() { if !path.isEmpty { path.removeLast() } }`,
    `    func reset() { path = NavigationPath() }`,
    `    func presentOverlay(_ style: OverlayStyle, screen: Screen, dismissable: Bool) {`,
    `        overlay = OverlayPresentation(screen: screen, style: style, dismissable: dismissable)`,
    `    }`,
    `    func dismissOverlay() { overlay = nil }`,
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
  const overlayCall = (a: any): string => {
    const style = a.overlay?.style === "dialog" ? ".dialog" : ".sheet";
    const dismissable = a.overlay?.dismissable === false ? "false" : "true";
    return `${style}, screen: .${caseFor(a.to)}, dismissable: ${dismissable}`;
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
          `${indent}// TODO: overlay target "${a.to?.name ?? a.to?.id ?? ""}" is not in the Screen enum — add a case, then uncomment:`,
          `${indent}// router.presentOverlay(${overlayCall(a)})`,
        ];
      }
      return [`${indent}router.presentOverlay(${overlayCall(a)})`];
    }
    case "closeOverlay":
      return [`${indent}router.dismissOverlay()`];
    case "back":
      return [`${indent}router.goBack()`];
    case "openUrl":
      return [`${indent}if let url = URL(string: ${JSON.stringify(String((a as any).url ?? ""))}) { UIApplication.shared.open(url) }`];
    case "setVariable":
      return [`${indent}store.set(${JSON.stringify(String((a as any).variable))}, ${swiftLiteral((a as any).value)})`];
    case "toggleVariable":
      return [`${indent}store.toggle(${JSON.stringify(String((a as any).variable))})`];
    case "scrollTo": {
      const label = (a as any).to?.name ?? (a as any).to?.id ?? "";
      const id = String((a as any).to?.id ?? "");
      return [`${indent}// TODO: scroll to "${label}" — wrap the list in ScrollViewReader { proxy in … } and call proxy.scrollTo("${id}")`];
    }
    case "changeVariant": {
      const label = (a as any).to?.name ?? (a as any).to?.id ?? "";
      return [`${indent}// TODO: change to variant "${label}" — set your component's variant state in the View`];
    }
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
          ? swiftIdent(screenCase(pascalCase(it.source.name)))
          : swiftIdent(it.source?.id ?? "node");
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
    `## Overlays`,
    `- Bind \`router.overlay\` to present it. Sheet vs dialog by \`overlay.style\`:`,
    `  \`\`\`swift`,
    `  .sheet(item: $router.overlay) { o in /* view for o.screen */ }`,
    `  // for o.style == .dialog, use .fullScreenCover + a centered card instead`,
    `  \`\`\``,
    ``,
    `## Best-effort / manual`,
    `- Scroll-to and component variants are commented stubs. Navigation transitions use the default push.`,
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
