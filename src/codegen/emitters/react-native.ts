import type { InteractionSpec, Action } from "../../server/interaction-spec.js";
import type { GeneratedFile } from "../types.js";
import { pascalCase } from "../types.js";
import { buildScreenIdentities, renderCondition, emitStore, type ScreenIdentity } from "./react-shared.js";

/** Map a Figma transition to a React Navigation native-stack animation. Best-effort. */
export function mapTransitionRN(transition: any): string {
  const t = transition?.type;
  const dir = transition?.direction;
  if (t === "DISSOLVE" || t === "SMART_ANIMATE") return "fade";
  if (t === "MOVE_IN" || t === "MOVE_OUT" || t === "PUSH" || t === "SLIDE_IN" || t === "SLIDE_OUT") {
    return dir === "BOTTOM" || dir === "TOP" ? "slide_from_bottom" : "slide_from_right";
  }
  if (t === "INSTANT") return "none";
  return "default";
}

/** React Navigation native-stack navigator from the screen graph. */
export function emitNavigation(spec: InteractionSpec): string {
  const ids = buildScreenIdentities(spec);
  const comps = spec.screens.map((s) => ids.get(s.id)!.component);
  const imports = comps.map((c) => `import ${c} from "./screens/${c}";`).join("\n");
  const screens = comps.map((c) => `        <Stack.Screen name=${JSON.stringify(c)} component={${c}} />`).join("\n");
  const initial = comps[0] ?? "";
  return [
    `import { NavigationContainer } from "@react-navigation/native";`,
    `import { createNativeStackNavigator } from "@react-navigation/native-stack";`,
    imports,
    ``,
    `const Stack = createNativeStackNavigator();`,
    ``,
    `// Navigation generated from the Figma prototype screen graph.`,
    `export function AppNavigator() {`,
    `  return (`,
    `    <NavigationContainer>`,
    `      <Stack.Navigator initialRouteName=${JSON.stringify(initial)}>`,
    screens,
    `      </Stack.Navigator>`,
    `    </NavigationContainer>`,
    `  );`,
    `}`,
    ``,
  ].join("\n");
}

function renderActionRN(a: Action, indent: string, ids: Map<string, ScreenIdentity>): string[] {
  const destName = (to: any): string => {
    const dest = to?.id ? ids.get(to.id) : undefined;
    return dest ? dest.component : to?.name ? pascalCase(to.name) : "Home";
  };
  switch (a.type) {
    case "navigate": {
      const known = a.to?.id ? ids.get(a.to.id) : undefined;
      const out = [`${indent}navigation.navigate(${JSON.stringify(destName(a.to))});`];
      if (!known) out.push(`${indent}// TODO: target "${a.to?.name ?? a.to?.id ?? ""}" is not in the generated navigator`);
      return out;
    }
    case "openOverlay":
    case "swapOverlay": {
      const known = a.to?.id ? ids.get(a.to.id) : undefined;
      const screen = destName(a.to);
      const style = (a as any).overlay?.style === "dialog" ? "dialog" : "sheet";
      const dismissable = (a as any).overlay?.dismissable === false ? "false" : "true";
      const line = `${indent}presentOverlay({ screen: ${JSON.stringify(screen)}, style: ${JSON.stringify(style)}, dismissable: ${dismissable} });`;
      return known ? [line] : [line, `${indent}// TODO: overlay target "${a.to?.name ?? a.to?.id ?? ""}" is not in the generated navigator`];
    }
    case "closeOverlay":
      return [`${indent}dismissOverlay();`];
    case "back":
      return [`${indent}navigation.goBack();`];
    case "openUrl":
      return [`${indent}Linking.openURL(${JSON.stringify(String((a as any).url ?? ""))});`];
    case "setVariable":
      return [`${indent}set(${JSON.stringify(String((a as any).variable))}, ${JSON.stringify((a as any).value)});`];
    case "toggleVariable":
      return [`${indent}toggle(${JSON.stringify(String((a as any).variable))});`];
    case "scrollTo": {
      const label = (a as any).to?.name ?? (a as any).to?.id ?? "";
      const id = String((a as any).to?.id ?? "");
      return [`${indent}// TODO: scroll to "${label}" — attach a ScrollView ref and call ref.scrollTo(...) for "${id}"`];
    }
    case "changeVariant": {
      const label = (a as any).to?.name ?? (a as any).to?.id ?? "";
      return [`${indent}// TODO: change to variant "${label}" — set your component's variant prop/state`];
    }
    case "conditional": {
      const cond = renderCondition((a as any).if);
      const then = (a as any).then.flatMap((x: Action) => renderActionRN(x, indent + "  ", ids));
      const out = [`${indent}if (${cond}) {`, ...then, `${indent}}`];
      if ((a as any).else && (a as any).else.length) {
        const els = (a as any).else.flatMap((x: Action) => renderActionRN(x, indent + "  ", ids));
        out.push(`${indent}else {`, ...els, `${indent}}`);
      }
      return out;
    }
    case "media": {
      const label = (a as any).target?.name ?? (a as any).target?.id ?? "current media";
      return [`${indent}// TODO: media '${(a as any).mediaAction}' on '${label}' — wire to expo-av / react-native-video ref`];
    }
    default:
      return [`${indent}// TODO: unsupported action ${JSON.stringify((a as any).type)}`];
  }
}

/** One interaction-hook file per screen (onPress handlers keyed by source node). Screens with no interactions are skipped. */
export function emitScreenInteractionsRN(spec: InteractionSpec): GeneratedFile[] {
  const ids = buildScreenIdentities(spec);
  return spec.screens.filter((s) => s.interactions.length > 0).map((s) => {
    const comp = ids.get(s.id)!.component;
    const handlers = s.interactions.map((it) => {
      const key = it.source?.name ? pascalCase(it.source.name) : it.source?.id ?? "node";
      const body = it.actions.flatMap((a) => renderActionRN(a, "        ", ids)).join("\n");
      return [`    ${JSON.stringify(key)}: {`, `      onPress: () => {`, body, `      },`, `    },`].join("\n");
    }).join("\n");
    const content = [
      `import { useNavigation } from "@react-navigation/native";`,
      `import { Linking } from "react-native";`,
      `import { useProtoStore } from "../prototype-store";`,
      ``,
      `// Interaction handlers for the "${s.name ?? s.id}" screen, keyed by source node.`,
      `export function use${comp}Interactions() {`,
      `  const navigation = useNavigation<any>();`,
      `  const { vars, set, toggle, presentOverlay, dismissOverlay } = useProtoStore();`,
      `  return {`,
      handlers,
      `  };`,
      `}`,
      ``,
    ].join("\n");
    return { path: `interactions/${comp}.ts`, content };
  });
}

export function emitReadmeRN(spec: InteractionSpec): string {
  const unsupported = spec.unsupported.length
    ? spec.unsupported.map((u) => `- \`${u.source?.name ?? u.source?.id ?? "?"}\`: ${u.reason}`).join("\n")
    : "- (none)";
  return [
    `# Generated prototype interactions (React Native)`,
    ``,
    `Covers navigation, variables, and conditionals — NOT screen UI. Wire these into your components.`,
    ``,
    `## Dependencies`,
    `- \`@react-navigation/native\`, \`@react-navigation/native-stack\``,
    `- \`react-native-screens\`, \`react-native-safe-area-context\``,
    ``,
    `## Files`,
    `- \`navigation.tsx\` — \`<AppNavigator />\` (native stack; one screen per frame).`,
    `- \`prototype-store.tsx\` — wrap your app in \`<PrototypeStoreProvider>\`; read with \`useProtoVar(name)\`.`,
    `- \`interactions/<Screen>.ts\` — \`use<Screen>Interactions()\` returns onPress handlers keyed by source node.`,
    ``,
    `## Best-effort / manual interactions`,
    `- Overlays: read \`useProtoStore().overlay\` and render a <Modal> (sheet/dialog by \`overlay.style\`);`,
    `  call \`dismissOverlay()\` to close. Scroll-to and component variants are commented stubs.`,
    ``,
    `## Unsupported interactions`,
    unsupported,
    ``,
    spec.truncated ? `> Note: the source flow was truncated; some interactions may be missing.\n` : ``,
  ].join("\n");
}

/** The React Native emitter: InteractionSpec -> structured file set. */
export function emitReactNative(spec: InteractionSpec): GeneratedFile[] {
  return [
    { path: "navigation.tsx", content: emitNavigation(spec) },
    { path: "prototype-store.tsx", content: emitStore(spec) },
    ...emitScreenInteractionsRN(spec),
    { path: "README.md", content: emitReadmeRN(spec) },
  ];
}
