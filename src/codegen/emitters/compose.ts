import type { InteractionSpec, Action } from "../../server/interaction-spec.js";
import type { GeneratedFile } from "../types.js";
import { pascalCase } from "../types.js";
import { buildScreenIdentities, collectVariables, type ScreenIdentity } from "./react-shared.js";

/** lowercase-first of a PascalCase component (e.g. Home → home). Used for routes + fun names. */
export function camelCase(component: string): string {
  return component.charAt(0).toLowerCase() + component.slice(1);
}

/**
 * A valid Kotlin identifier for a fun name. Kotlin identifiers may not start with a digit,
 * so a digit/empty start (node id "1:2" → "1_2", or name "2nd Button") is prefixed with "n".
 */
export function kotlinIdent(raw: string): string {
  const cleaned = (raw ?? "").replace(/[^A-Za-z0-9]/g, "_");
  return /^[A-Za-z]/.test(cleaned) ? cleaned : `n${cleaned}`;
}

/** A Kotlin literal for a JS boolean/number/string value. */
function kotlinLiteral(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return JSON.stringify(String(value));
}

/** sealed Screen class + Router wrapping a NavHostController. */
export function emitRouterKotlin(spec: InteractionSpec): string {
  const ids = buildScreenIdentities(spec);
  const objs = spec.screens.map((s) => {
    const comp = ids.get(s.id)!.component;
    return `    object ${comp} : Screen(${JSON.stringify(camelCase(comp))})`;
  }).join("\n");
  return [
    `import androidx.compose.runtime.getValue`,
    `import androidx.compose.runtime.mutableStateOf`,
    `import androidx.compose.runtime.setValue`,
    `import androidx.navigation.NavHostController`,
    ``,
    `// Routes generated from the Figma prototype screen graph.`,
    `sealed class Screen(val route: String) {`,
    objs,
    `}`,
    ``,
    `enum class OverlayStyle { Sheet, Dialog }`,
    `data class OverlayPresentation(val screen: Screen, val style: OverlayStyle, val dismissable: Boolean)`,
    ``,
    `class Router(private val nav: NavHostController) {`,
    `    var overlay by mutableStateOf<OverlayPresentation?>(null)`,
    `    fun navigate(screen: Screen) { nav.navigate(screen.route) }`,
    `    fun goBack() { nav.popBackStack() }`,
    `    fun reset() { nav.popBackStack(nav.graph.startDestinationId, inclusive = false) }`,
    `    fun presentOverlay(style: OverlayStyle, screen: Screen, dismissable: Boolean) {`,
    `        overlay = OverlayPresentation(screen, style, dismissable)`,
    `    }`,
    `    fun dismissOverlay() { overlay = null }`,
    `}`,
    ``,
  ].join("\n");
}

/** ViewModel variable store. */
export function emitStoreKotlin(spec: InteractionSpec): string {
  const vars = collectVariables(spec);
  const inits = vars.map((v) => `        ${JSON.stringify(v)} to false,`).join("\n");
  return [
    `import androidx.compose.runtime.mutableStateMapOf`,
    `import androidx.lifecycle.ViewModel`,
    ``,
    `// Prototype variables, generated from set/toggle/conditional actions.`,
    `// Defaults are best-effort (false); adjust types to match your design.`,
    `class PrototypeStore : ViewModel() {`,
    `    val vars = mutableStateMapOf<String, Any?>(`,
    inits,
    `    )`,
    `    fun set(name: String, value: Any?) { vars[name] = value }`,
    `    fun toggle(name: String) { vars[name] = !((vars[name] as? Boolean) ?: false) }`,
    `}`,
    ``,
  ].join("\n");
}

/** Condition node → Kotlin boolean expression (map cast inferred from the literal). */
export function renderConditionKotlin(node: any): string {
  if (!node || typeof node !== "object") return "false";
  if (Array.isArray(node.all)) return node.all.map(renderConditionKotlin).join(" && ") || "true";
  if (Array.isArray(node.any)) return node.any.map(renderConditionKotlin).join(" || ") || "false";
  if (typeof node.variable === "string") {
    const OP: Record<string, string> = { "==": "==", "!=": "!=", "<": "<", "<=": "<=", ">": ">", ">=": ">=" };
    const op = OP[node.operator as string] ?? "==";
    const key = JSON.stringify(node.variable);
    const v = node.value;
    if (typeof v === "boolean") return `((store.vars[${key}] as? Boolean) ?: false) ${op} ${kotlinLiteral(v)}`;
    // Cast side is Double, so the literal must be Double too — `Double == 5` (Int) does not compile in Kotlin.
    if (typeof v === "number") {
      const numLit = Number.isInteger(v) ? `${v}.0` : String(v);
      return `((store.vars[${key}] as? Double) ?: 0.0) ${op} ${numLit}`;
    }
    return `((store.vars[${key}] as? String) ?: "") ${op} ${kotlinLiteral(v)}`;
  }
  return "false";
}

function renderActionKotlin(a: Action, indent: string, ids: Map<string, ScreenIdentity>): string[] {
  const objFor = (to: any): string => {
    const dest = to?.id ? ids.get(to.id) : undefined;
    return dest ? dest.component : to?.name ? pascalCase(to.name) : "Screen";
  };
  const overlayCall = (a: any): string => {
    const style = a.overlay?.style === "dialog" ? "OverlayStyle.Dialog" : "OverlayStyle.Sheet";
    const dismissable = a.overlay?.dismissable === false ? "false" : "true";
    return `${style}, Screen.${objFor(a.to)}, ${dismissable}`;
  };
  switch (a.type) {
    case "navigate": {
      const known = a.to?.id ? ids.get(a.to.id) : undefined;
      if (!known) {
        return [
          `${indent}// TODO: target "${a.to?.name ?? a.to?.id ?? ""}" is not in the Screen graph — add an object, then uncomment:`,
          `${indent}// router.navigate(Screen.${objFor(a.to)})`,
        ];
      }
      return [`${indent}router.navigate(Screen.${objFor(a.to)})`];
    }
    case "openOverlay":
    case "swapOverlay": {
      const known = a.to?.id ? ids.get(a.to.id) : undefined;
      if (!known) {
        return [
          `${indent}// TODO: overlay target "${a.to?.name ?? a.to?.id ?? ""}" is not in the Screen graph — add an object, then uncomment:`,
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
      return [`${indent}// TODO: open URL ${JSON.stringify(String((a as any).url ?? ""))} — call LocalUriHandler.current.openUri(...) from a @Composable`];
    case "setVariable":
      return [`${indent}store.set(${JSON.stringify(String((a as any).variable))}, ${kotlinLiteral((a as any).value)})`];
    case "toggleVariable":
      return [`${indent}store.toggle(${JSON.stringify(String((a as any).variable))})`];
    case "scrollTo": {
      const label = (a as any).to?.name ?? (a as any).to?.id ?? "";
      const id = String((a as any).to?.id ?? "");
      return [`${indent}// TODO: scroll to "${label}" — use rememberLazyListState() + animateScrollToItem(/* index of "${id}" */)`];
    }
    case "changeVariant":
      return [`${indent}// TODO: component variant — handle in the Composable`];
    case "conditional": {
      const cond = renderConditionKotlin((a as any).if);
      const then = (a as any).then.flatMap((x: Action) => renderActionKotlin(x, indent + "    ", ids));
      // `} else {` on one line — a newline before `else` is fragile in Kotlin.
      const out = [`${indent}if (${cond}) {`, ...then];
      if ((a as any).else && (a as any).else.length) {
        const els = (a as any).else.flatMap((x: Action) => renderActionKotlin(x, indent + "    ", ids));
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

/** One <Screen>Actions.kt per screen WITH interactions (empty screens are skipped). */
export function emitScreenActionsKotlin(spec: InteractionSpec): GeneratedFile[] {
  const ids = buildScreenIdentities(spec);
  return spec.screens
    .filter((s) => s.interactions.length > 0)
    .map((s) => {
      const comp = ids.get(s.id)!.component;
      const funcs = s.interactions.map((it) => {
        const fn = it.source?.name
          ? kotlinIdent(camelCase(pascalCase(it.source.name)))
          : kotlinIdent(it.source?.id ?? "node");
        const body = it.actions.flatMap((act) => renderActionKotlin(act, "        ", ids)).join("\n");
        return [`    fun ${fn}(router: Router, store: PrototypeStore) {`, body, `    }`].join("\n");
      }).join("\n\n");
      const content = [
        `// Interaction handlers for the "${s.name ?? s.id}" screen, keyed by source node.`,
        `// Assumes Router/PrototypeStore/Screen live in the same package.`,
        `object ${comp}Actions {`,
        funcs,
        `}`,
        ``,
      ].join("\n");
      return { path: `${comp}Actions.kt`, content };
    });
}

export function emitReadmeKotlin(spec: InteractionSpec): string {
  const unsupported = spec.unsupported.length
    ? spec.unsupported.map((u) => `- \`${u.source?.name ?? u.source?.id ?? "?"}\`: ${u.reason}`).join("\n")
    : "- (none)";
  return [
    `# Generated prototype interactions (Jetpack Compose)`,
    ``,
    `Kotlin + Navigation Compose. Covers navigation, variables, and conditionals — NOT screen UI.`,
    ``,
    `## Wiring`,
    `- Add the dependency: \`androidx.navigation:navigation-compose\`.`,
    `- Build a NavHost and wrap the NavController in Router:`,
    `  \`\`\`kotlin`,
    `  val navController = rememberNavController()`,
    `  val router = remember(navController) { Router(navController) }`,
    `  val store: PrototypeStore = viewModel()`,
    `  NavHost(navController, startDestination = Screen.Home.route) {`,
    `    composable(Screen.Home.route) { /* HomeScreen(router, store) */ }`,
    `  }`,
    `  \`\`\``,
    `- Files: \`Router.kt\` (sealed Screen + Router), \`PrototypeStore.kt\` (vars ViewModel),`,
    `  \`<Screen>Actions.kt\` (call e.g. \`HomeActions.goDetail(router, store)\` from your Buttons).`,
    ``,
    `## Overlays`,
    `- Observe \`router.overlay\` and present it. Sheet vs dialog by \`overlay.style\`:`,
    `  \`\`\`kotlin`,
    `  router.overlay?.let { o ->`,
    `    if (o.style == OverlayStyle.Sheet) ModalBottomSheet(onDismissRequest = { if (o.dismissable) router.dismissOverlay() }) { /* o.screen */ }`,
    `    else Dialog(onDismissRequest = { if (o.dismissable) router.dismissOverlay() }) { /* o.screen */ }`,
    `  }`,
    `  \`\`\``,
    ``,
    `## Best-effort / manual`,
    `- openUrl, scroll-to, and component variants are commented stubs. Navigation transitions use the default.`,
    ``,
    `## Unsupported interactions`,
    unsupported,
    ``,
    spec.truncated ? `> Note: the source flow was truncated; some interactions may be missing.\n` : ``,
  ].join("\n");
}

/** The Compose emitter: InteractionSpec -> Kotlin file set. */
export function emitCompose(spec: InteractionSpec): GeneratedFile[] {
  return [
    { path: "Router.kt", content: emitRouterKotlin(spec) },
    { path: "PrototypeStore.kt", content: emitStoreKotlin(spec) },
    ...emitScreenActionsKotlin(spec),
    { path: "README.md", content: emitReadmeKotlin(spec) },
  ];
}
