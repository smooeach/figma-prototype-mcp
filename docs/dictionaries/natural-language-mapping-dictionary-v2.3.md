# Natural Language Mapping Dictionary v2.3 (Figma API-aligned)
# 자연어 매핑 사전 v2.3 (Figma API 정합)

> **Bilingual natural language → Figma Prototype Reaction mapping dictionary**
> **자연어 → Figma Prototype Reaction 변환을 위한 표준 매핑 사전**
>
> - Version / 버전: v2.3 (Figma API alignment correction)
> - Date / 작성일: 2026-05-20
> - Foundation / 기반: Carbon, Material 3, Apple HIG, Fluent 2, Adobe Spectrum, Atlassian, Audi, Primer, Uber Base, Pinterest Gestalt
> - Scope / 사용 범위: Natural language input → Figma `setReactionsAsync` call conversion

## v2.3 Changes / v2.3 변경사항

**Critical corrections from v2.2** — earlier versions had abstract tokens that didn't directly map to Figma's actual API. This version is fully aligned with Figma's `Transition` and `Easing` type definitions.

v2.2까지의 추상 토큰 중 Figma 실제 API와 직접 매핑되지 않는 항목들을 모두 수정. Figma의 실제 `Transition`과 `Easing` 타입에 100% 정합되도록 정비.

### Key Changes / 주요 변경

| Topic / 항목 | v2.2 | v2.3 |
|---|---|---|
| `morph` token | Separate transition type | **Removed**. Mapped to `SMART_ANIMATE` or `matchLayers: true` |
| Easing tokens | Abstract (standard/emphasized/etc.) | **Aligned with Figma natives**: `EASE_IN`, `EASE_OUT`, `EASE_IN_AND_OUT`, `LINEAR`, `EASE_IN_BACK`, `EASE_OUT_BACK`, `EASE_IN_AND_OUT_BACK`, `CUSTOM_CUBIC_BEZIER`, `GENTLE`, `QUICK`, `BOUNCY`, `SLOW`, `CUSTOM_SPRING` |
| Spring presets | One generic `bouncy` | **4 Figma presets**: GENTLE / QUICK / BOUNCY / SLOW + CUSTOM_SPRING |
| Back easing | Missing | **Added**: anticipation/overshoot patterns ("튕기다 돌아오듯", "오버슛") |
| Direction mapping | Missing | **Added**: LEFT/RIGHT/TOP/BOTTOM mapping for DirectionalTransition |
| MOVE vs PUSH vs SLIDE | Mixed | **Clarified**: distinct behavior semantics for each |
| `matchLayers` option | Not mentioned | **Added**: enables smart-animate behavior on directional transitions |

---

## Table of Contents / 목차

1. [Figma Prototype API Reference / Figma API 정의](#1-figma-prototype-api-reference--figma-api-정의)
2. [Expression Levels / 표현 레벨](#2-expression-levels--표현-레벨)
3. [Duration Dictionary / Duration 사전](#3-duration-dictionary--duration-사전)
4. [Easing Dictionary / Easing 사전](#4-easing-dictionary--easing-사전)
5. [Transition Type Dictionary / Transition 타입 사전](#5-transition-type-dictionary--transition-타입-사전)
6. [Direction Dictionary / 방향 사전](#6-direction-dictionary--방향-사전)
7. [Combined Patterns / 복합 패턴](#7-combined-patterns--복합-패턴)
8. [Emotional & Generational Expressions / 감정·세대별 표현](#8-emotional--generational-expressions--감정세대별-표현)
9. [Ambiguous Expressions / 두루뭉술한 표현](#9-ambiguous-expressions--두루뭉술한-표현)
10. [Domain Adjustments / 도메인 보정](#10-domain-adjustments--도메인-보정)
11. [LLM System Prompt / LLM 시스템 프롬프트](#11-llm-system-prompt--llm-시스템-프롬프트)
12. [Validation Checklist / 검증 체크리스트](#12-validation-checklist--검증-체크리스트)
13. [Appendix / 부록](#13-appendix--부록)

---

## 1. Figma Prototype API Reference / Figma API 정의

This dictionary outputs JSON conforming to Figma's actual Plugin API. Reference: https://developers.figma.com/docs/plugins/api/Transition/

본 사전은 Figma Plugin API에 정확히 정합되는 JSON 출력을 목표로 합니다.

### 1.1 Transition Type (Figma 공식 정의)

```typescript
type Transition = SimpleTransition | DirectionalTransition

interface SimpleTransition {
  type: "DISSOLVE" | "SMART_ANIMATE" | "SCROLL_ANIMATE"
  easing: Easing
  duration: number  // seconds
}

interface DirectionalTransition {
  type: "MOVE_IN" | "MOVE_OUT" | "PUSH" | "SLIDE_IN" | "SLIDE_OUT"
  direction: "LEFT" | "RIGHT" | "TOP" | "BOTTOM"
  matchLayers: boolean
  easing: Easing
  duration: number  // seconds
}
```

### 1.2 Easing Type (Figma 공식 정의)

```typescript
interface Easing {
  type: 
    | "LINEAR"
    | "EASE_IN" | "EASE_OUT" | "EASE_IN_AND_OUT"
    | "EASE_IN_BACK" | "EASE_OUT_BACK" | "EASE_IN_AND_OUT_BACK"
    | "CUSTOM_CUBIC_BEZIER"
    | "GENTLE" | "QUICK" | "BOUNCY" | "SLOW"  // Spring presets
    | "CUSTOM_SPRING"
  
  easingFunctionCubicBezier?: { x1, y1, x2, y2 }  // for CUSTOM_CUBIC_BEZIER
  easingFunctionSpring?: { mass, stiffness, damping, initialVelocity }  // for CUSTOM_SPRING
}
```

### 1.3 Important Behavioral Differences

**MOVE vs PUSH vs SLIDE** are commonly confused. Clarification:

| Transition | Behavior | Best for |
|---|---|---|
| `MOVE_IN/OUT` | Destination frame moves over/away from origin (origin stays put) | Overlays, modals from side |
| `PUSH` | Destination frame pushes origin away (origin moves too) | Swipe-style next/prev navigation |
| `SLIDE_IN/OUT` | Destination slides while origin dissolves | Mixed feel (slide + fade) |
| `DISSOLVE` | Pure cross-fade, no movement | Tab switches, unrelated content |
| `SMART_ANIMATE` | Auto-matches shared layers between frames | Same UI element transforming |

**`matchLayers: true`** on a DirectionalTransition enables smart-animate behavior alongside the directional motion. This is how you get "morph + slide" effects.

---

## 2. Expression Levels / 표현 레벨

Same 4-level classification across both languages.

| Level | Characteristic | EN Example | KO Example |
|---|---|---|---|
| **L1: Precise** | Specific Figma values | `"EASE_OUT, 250ms"` | `"EASE_OUT으로 250ms"` |
| **L2: Standard** | Design terms | `"smooth"`, `"snappy"` | `"부드럽게"`, `"빠르게"` |
| **L3: Sensory** | Onomatopoeia/sensory | `"whoosh"`, `"boing"` | `"스르륵"`, `"통통"` |
| **L4: Metaphor** | Analogies | `"like a feather"` | `"깃털처럼"` |

---

## 3. Duration Dictionary / Duration 사전

Duration in Figma is `number` in **seconds** (not ms). Convert ms → s by dividing by 1000.

Figma에서 duration은 **초 단위 number** (밀리초 아님). 사용 시 ms ÷ 1000으로 변환.

### 3.1 Token Table

| Token | Seconds | ms | Use Case |
|---|---|---|---|
| `instant` | 0 | 0 | No animation |
| `xs` | 0.07 | 70 | Micro-interactions |
| `sm` | 0.10 | 100 | Small fades, color changes |
| `md` | 0.15 | 150 | Dropdowns, small entry |
| `lg` | 0.25 | 250 | Modals, standard transitions |
| `xl` | 0.40 | 400 | Large entries, system notifications |
| `xxl` | 0.60+ | 600+ | Onboarding, celebration |

> Note: For `instant` cases, set `transition: null` or use `INSTANT` semantic (no transition object). Setting duration: 0 with a transition type may cause UI glitches.

### 3.2 Natural Language → Duration (요약)

Same as v2.2 (Korean + English vocabulary). Reference Appendix C for full vocabulary list.

v2.2의 Duration 어휘 사전이 그대로 유효합니다 (Figma API와 무관한 영역). 전체 어휘는 부록 C 참조.

---

## 4. Easing Dictionary / Easing 사전

This is where v2.3 differs most from v2.2. All easing tokens now map directly to Figma native types.

### 4.1 Figma Native Easing Tokens (모두 직접 지원)

| Token | Figma Type | Behavior |
|---|---|---|
| `linear` | `LINEAR` | Constant speed, no acceleration |
| `ease-in` | `EASE_IN` | Slow start, fast end |
| `ease-out` | `EASE_OUT` | Fast start, slow end (most common for entry) |
| `ease-in-out` | `EASE_IN_AND_OUT` | Slow on both ends |
| `ease-in-back` | `EASE_IN_BACK` | Goes backward first (anticipation), then accelerates |
| `ease-out-back` | `EASE_OUT_BACK` | Overshoots end, settles back (bounce-back feel) |
| `ease-in-out-back` | `EASE_IN_AND_OUT_BACK` | Both ends overshoot |

### 4.2 Figma Spring Presets (4종 기본 제공)

| Token | Figma Type | Use Case | Approximate Feel |
|---|---|---|---|
| `gentle` | `GENTLE` | Subtle scale animations | Soft, neutral spring |
| `quick` | `QUICK` | Toasts, notifications | Snappy with slight bounce |
| `bouncy` | `BOUNCY` | Heart bounces, playful UI | Pronounced bounce |
| `slow` | `SLOW` | Fullscreen content scaling | Slow, settled spring |

### 4.3 Custom Easing (when natives don't fit)

When no native preset fits the natural language description, use:

```typescript
// CUSTOM_CUBIC_BEZIER for non-spring fine-tuning
{
  type: "CUSTOM_CUBIC_BEZIER",
  easingFunctionCubicBezier: { x1: 0.2, y1: 0, x2: 0, y2: 1 }
}

// CUSTOM_SPRING for non-preset spring physics
{
  type: "CUSTOM_SPRING",
  easingFunctionSpring: { 
    mass: 1, 
    stiffness: 180, 
    damping: 20, 
    initialVelocity: 0 
  }
}
```

**Use CUSTOM when:**
- User specifies exact values ("damping 15", "stiffness 300")
- "Emphasized" Material-style curve needed: `CUSTOM_CUBIC_BEZIER(0.2, 0, 0, 1)`
- Brand-specific motion characteristics needed

### 4.4 Natural Language Mapping

#### LINEAR
```
EN:
- linear / constant / uniform / even / steady
- mechanical / robotic / rigid / stiff / monotonous
- "no easing" / "ease none" / "step-function"

KO:
- 일정하게 / 균일하게 / 등속으로 / 곧이곧대로
- 칼각으로 / 기계적으로 / 딱딱하게 / 무미건조하게
- "이징 없이" / "그냥 일정하게"

→ { type: "LINEAR" }
```

#### EASE_OUT (most common for entries)
```
EN:
- ease out / ease-out / settling / landing / arriving
- gentle landing / soft touchdown / floaty
- "comes to rest" / "decelerating" / "easing in (motion design)"

KO:
- 들어오면서 점점 멈추듯 / 도착하듯 / 안착하듯
- 사뿐히 / 살포시 / 살그머니 / 살랑살랑
- 비행기 착륙하듯 / 깃털 떨어지듯

Common contexts:
- Modals appearing → EASE_OUT + lg
- Tooltips showing → EASE_OUT + md
- Cards entering → EASE_OUT + lg

→ { type: "EASE_OUT" }
```

#### EASE_IN (for exits)
```
EN:
- ease in / ease-in / accelerating / departing
- whoosh away / dash off / shooting out
- "leaving fast" / "exit easing"

KO:
- 떠나면서 빨라지듯 / 출발하듯 / 떠나듯
- 휘릭 빠져나가듯 / 던지듯 / 튕겨나가듯
- 화살처럼 / 총알처럼 / 휙

Common contexts:
- Modal dismissing → EASE_IN + sm
- Toast disappearing → EASE_IN + md

→ { type: "EASE_IN" }
```

#### EASE_IN_AND_OUT (bidirectional)
```
EN:
- ease in and out / smooth / balanced
- "starts and ends gently" / "symmetric easing"
- silky / buttery / natural / fluid

KO:
- 자연스럽게 / 매끄럽게 / 부드럽게
- 보통 / 평범하게 / 균형있게
- 스무스하게 / 내추럴하게

Common contexts:
- Position changes within same screen
- Toggle states
- Tab switches

→ { type: "EASE_IN_AND_OUT" }
```

#### EASE_OUT_BACK (overshoot then settle) ★ Added in v2.3
```
EN:
- "overshoot and settle" / "bounce-back" / "snap into place"
- "back-easing" / "rubber-band feel"
- "slingshot in" / "yo-yo end"

KO:
- "넘어갔다 돌아오듯" / "튕기다 자리잡듯"
- "오버슛하면서 안착" / "용수철처럼 정착"
- "쑥 들어왔다 살짝 후퇴"

Common contexts:
- Playful entries
- Modal "pop" appearance
- Notification arrival with personality

→ { type: "EASE_OUT_BACK" }
```

#### EASE_IN_BACK (anticipation before exit) ★ Added in v2.3
```
EN:
- "wind-up then go" / "anticipation"
- "step back to leap" / "pull back then launch"
- "loaded spring exit"

KO:
- "뒤로 빠졌다 나가듯" / "준비동작 후 떠남"
- "장전됐다 나가듯" / "뒤로 갔다가 휙"

Common contexts:
- Dramatic exits
- Game UI element disappearing
- Animation that builds anticipation

→ { type: "EASE_IN_BACK" }
```

#### EASE_IN_AND_OUT_BACK (both ends) ★ Added in v2.3
```
EN:
- "anticipate and overshoot" / "back-and-forth bounce"
- "wind-up and settle" / "dramatic in and out"

KO:
- "뒤로 갔다가 오버슛하면서 안착"
- "준비동작 후 튕기듯 정착"

→ { type: "EASE_IN_AND_OUT_BACK" }
```

#### GENTLE Spring ★ Figma Native
```
EN:
- "subtle spring" / "soft bounce" / "gentle spring"
- "neutral spring" / "barely-there bounce"
- "scaling content"

KO:
- "은은하게 튕기듯" / "부드럽게 살짝 튕기듯"
- "잔잔한 스프링" / "조심스러운 바운스"

Use case: Subtle scale animations, careful UI elements

→ { type: "GENTLE" }
```

#### QUICK Spring ★ Figma Native
```
EN:
- "snappy spring" / "quick bounce"
- "toast-style bounce" / "notification spring"
- "responsive spring"

KO:
- "탁탁 튕기듯" / "토스트같이 통통"
- "알림처럼 살짝 튀어나오듯"
- "퀵 스프링"

Use case: Toasts, notifications, quick feedback

→ { type: "QUICK" }
```

#### BOUNCY Spring ★ Figma Native (default "bouncy")
```
EN:
- "bouncy" / "springy" / "elastic" / "lively"
- "heart bounce" / "playful spring"
- "instagram-like bounce" / "social media bounce"

KO:
- "탄력있게" / "통통" / "튕기듯" / "스프링같이"
- "인스타 좋아요처럼" / "재미있게 튕기듯"
- "활발하게 튕기듯"

Use case: Likes, playful UI, delightful moments

→ { type: "BOUNCY" }
```

#### SLOW Spring ★ Figma Native
```
EN:
- "slow spring" / "settled spring" / "deliberate spring"
- "fullscreen scaling" / "steady spring"
- "slow natural settle"

KO:
- "천천히 안착하듯" / "느긋한 스프링"
- "차분하게 스프링" / "전체화면 확장하듯"

Use case: Fullscreen content scaling, dramatic settles

→ { type: "SLOW" }
```

#### CUSTOM_CUBIC_BEZIER (when natives don't fit) ★ Use sparingly
```
Material 3 "emphasized" mapping:
EN: "Material emphasized" / "Material 3 style"
KO: "Material 강조" / "머티리얼 3 스타일"
→ {
    type: "CUSTOM_CUBIC_BEZIER",
    easingFunctionCubicBezier: { x1: 0.2, y1: 0, x2: 0, y2: 1 }
  }

Apple-style smooth:
EN: "iOS-feel" / "Cupertino smooth"
KO: "iOS 느낌" / "애플식 매끄러움"
→ {
    type: "CUSTOM_CUBIC_BEZIER",
    easingFunctionCubicBezier: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }
  }

User specifies exact:
"bezier(0.4, 0, 0.6, 1)" → use exact values
```

#### CUSTOM_SPRING (when preset doesn't fit) ★ Use sparingly
```
"Very bouncy" / "exaggerated bounce" / "엄청 튀게":
→ {
    type: "CUSTOM_SPRING",
    easingFunctionSpring: { mass: 1, stiffness: 600, damping: 10, initialVelocity: 0 }
  }

"Soft jelly" / "marshmallow" / "마쉬멜로처럼":
→ {
    type: "CUSTOM_SPRING",
    easingFunctionSpring: { mass: 1.5, stiffness: 100, damping: 30, initialVelocity: 0 }
  }

User specifies: "damping 15, stiffness 300" → use exact values
```

### 4.5 Easing Decision Tree

```
User input includes spring/bounce vocabulary?
├─ YES → Spring preset
│   ├─ "subtle/gentle" → GENTLE
│   ├─ "quick/snappy" → QUICK
│   ├─ "bouncy/lively" → BOUNCY
│   ├─ "slow/settled" → SLOW
│   └─ "exact values" → CUSTOM_SPRING
│
└─ NO → Cubic-style easing
    ├─ "linear/mechanical" → LINEAR
    ├─ Direction: entry/landing → EASE_OUT
    ├─ Direction: exit/departing → EASE_IN
    ├─ Direction: bidirectional → EASE_IN_AND_OUT
    ├─ Has overshoot/anticipation
    │   ├─ "overshoot then settle" → EASE_OUT_BACK
    │   ├─ "wind-up then leave" → EASE_IN_BACK
    │   └─ "both ends back" → EASE_IN_AND_OUT_BACK
    └─ Brand-specific or "emphasized" → CUSTOM_CUBIC_BEZIER
```

---

## 5. Transition Type Dictionary / Transition 타입 사전

Figma has exactly **8 transition types**: 3 simple + 5 directional. Plus an implicit "no transition" (instant).

Figma는 정확히 **8개의 transition type**을 가집니다: 3개 simple + 5개 directional. 그 외에 암묵적 "no transition" (즉시).

### 5.1 Simple Transitions (방향 없음)

#### DISSOLVE — Pure cross-fade
```
Behavior: Opacity transition between frames, no movement.
동작: 두 프레임 간 투명도만 전환, 위치 변경 없음.

EN natural language:
- fade / fade in / fade out / cross-fade / dissolve
- blend / bleed / wash / mist / haze / vanish
- "opacity transition" / "alpha blend"

KO:
- 서서히 / 점점 / 흐려지면서 / 사라지면서
- 페이드 / 페이드인 / 페이드아웃 / 디졸브
- 옅어지면서 / 안개처럼 / 김 서리듯

Use when:
- Switching between unrelated content (tabs)
- Modal background overlay
- Loading state transitions

→ { type: "DISSOLVE", easing: ..., duration: ... }
```

#### SMART_ANIMATE — Auto-match shared layers ★ Replaces v2.2's "morph"
```
Behavior: Figma automatically matches layers with same name between frames 
and interpolates their properties (position, size, color, opacity, rotation, corner radius).
동작: 두 프레임 사이의 동일 이름 레이어를 자동 매칭해 속성 보간.

EN natural language:
- "morph" / "transform" / "shape-shift"
- "shared element" / "magic move" / "hero animation"
- "continuous element" / "connected motion"
- "Material container transform"
- "iOS hero" / "page-to-detail transform"

KO:
- 변형되면서 / 모양 바뀌면서 / 이어지듯
- 같은 요소가 / 연결되면서 / 끊김없이
- 모핑 / 트랜스폼 / 변신하듯 / 진화하듯
- 히어로 애니메이션 / 공유 요소 / 매직 무브

Use when:
- Card → detail view (same card transforms)
- Button → loading spinner morph
- Avatar → fullscreen photo
- Any element that "transforms" rather than "replaces"

Requirements:
- Layers must have matching names between source and destination frames
- Some properties (drop-shadow, inner-shadow) are not supported
- Falls back to DISSOLVE if no matching layers found

→ { type: "SMART_ANIMATE", easing: ..., duration: ... }
```

#### SCROLL_ANIMATE
```
Behavior: Smooth scroll-based animation.
동작: 스크롤 기반 부드러운 애니메이션.

EN natural language:
- "scroll animation" / "scroll-linked" / "scroll-driven"
- "parallax-like" / "scroll-triggered smooth"

KO:
- 스크롤 따라 / 스크롤에 맞춰 / 스크롤 애니메이션

Use when:
- Scroll-to-section transitions
- Animated scroll within frame

→ { type: "SCROLL_ANIMATE", easing: ..., duration: ... }
```

### 5.2 Directional Transitions (방향 필수)

All directional transitions require:
- `direction`: `"LEFT" | "RIGHT" | "TOP" | "BOTTOM"`
- `matchLayers`: `boolean` (true enables smart-animate behavior alongside the motion)

#### MOVE_IN / MOVE_OUT — Destination moves over origin
```
Behavior: 
- MOVE_IN: Destination frame moves into view, sitting ABOVE the original. Origin stays put.
- MOVE_OUT: Destination moves away, exposing original underneath.
동작: 새 프레임이 기존 프레임 위에 들어옴/나감. 기존은 그대로.

EN natural language:
- "move in from [direction]" / "slide on top from [direction]"
- "drawer from side" / "panel from side"
- "off-canvas menu" / "sheet from bottom"
- "overlay slide in" / "modal from edge"

KO:
- "[방향]에서 위로 들어와" / "[방향]에서 덮으면서"
- "사이드 메뉴 열리듯" / "드로어 열리듯"
- "패널이 옆에서 들어와" / "시트가 아래에서 올라와"

Use when:
- Hamburger menu opens
- Bottom sheet slides up
- Side panel/drawer
- Notification banner from top

→ {
    type: "MOVE_IN",  // or "MOVE_OUT"
    direction: "LEFT", // see direction dictionary
    matchLayers: false,
    easing: ...,
    duration: ...
  }
```

#### PUSH — Destination pushes origin away
```
Behavior: Destination enters from one side, pushing origin out the opposite side.
Both frames move together.
동작: 새 프레임이 한쪽에서 들어오면서 기존 프레임을 반대쪽으로 밀어냄.

EN natural language:
- "push" / "swipe to next" / "page next"
- "carousel-style" / "swipe navigation"
- "iOS push navigation" / "drill-in"

KO:
- "다음으로 밀어내듯" / "스와이프하듯"
- "캐러셀처럼 넘어가" / "옆으로 페이지 넘기듯"
- "iOS 푸시 네비게이션처럼"

Use when:
- Onboarding step transitions
- Image carousel
- Wizard next/prev
- Swipeable card stack
- Navigation drill-down (iOS-style)

→ {
    type: "PUSH",
    direction: "LEFT", // "next" usually = LEFT
    matchLayers: false,
    easing: ...,
    duration: ...
  }
```

#### SLIDE_IN / SLIDE_OUT — Hybrid: slide + dissolve
```
Behavior:
- SLIDE_IN: Destination slides into view while origin dissolves in place.
- SLIDE_OUT: Destination slides out while origin appears via dissolve.
동작: 새 프레임은 슬라이드하면서 들어오고, 기존 프레임은 디졸브.

EN natural language:
- "slide in with fade" / "slide and fade"
- "soft slide" / "gentle slide-in"
- "slide while fading"

KO:
- "슬라이드하면서 사라져" / "옆으로 가면서 디졸브"
- "부드럽게 슬라이드" / "흐려지면서 슬라이드"

Use when:
- Want a softer slide effect than PUSH or MOVE
- Tab transitions with motion + fade
- Content that "appears" rather than "replaces"

→ {
    type: "SLIDE_IN",  // or "SLIDE_OUT"
    direction: "LEFT",
    matchLayers: false,
    easing: ...,
    duration: ...
  }
```

### 5.3 Implicit "Instant" (no transition object)

```
Behavior: No transition applied. Frame changes immediately.
동작: transition 객체 없이 즉시 프레임 변경.

EN: "instant" / "no animation" / "hard cut" / "boom" / "snap"
KO: "즉시" / "바로" / "그냥 변경" / "딱" / "짠"

Implementation: Either set transition to null, or omit transition field entirely.
구현: transition을 null로 설정하거나 필드 자체 생략.

In Action object:
→ {
    type: "NODE",
    destinationId: "...",
    navigation: "NAVIGATE",
    // no transition field, or transition: null
  }
```

### 5.4 Choosing Between MOVE / PUSH / SLIDE

This is the most commonly confused area. Decision logic:

```
User wants origin to STAY visible (overlay-like)?
└─ YES → MOVE_IN (destination on top of origin)

User wants origin to MOVE OUT (swipe-like)?
└─ YES → PUSH (both frames slide together)

User wants origin to FADE while new comes in?
└─ YES → SLIDE_IN (slide + dissolve hybrid)

User just wants opacity change?
└─ YES → DISSOLVE (no motion)

User wants same UI element to transform shape?
└─ YES → SMART_ANIMATE

User wants combination of slide + element morph?
└─ YES → PUSH/SLIDE/MOVE with matchLayers: true
```

---

## 6. Direction Dictionary / 방향 사전

DirectionalTransitions require `direction: "LEFT" | "RIGHT" | "TOP" | "BOTTOM"`.

Natural language mapping for directions:

### 6.1 LEFT (entering from right side, moves leftward)
```
EN:
- "from the right" / "rightward" / "right-to-left"
- "next" / "forward" / "advance" / "drill in"
- "iOS push next" / "swipe to next"

KO:
- "오른쪽에서" / "다음으로" / "진행해서"
- "넘겨" / "다음 화면으로" / "앞으로"
- "iOS 다음 화면처럼"

→ direction: "LEFT"
```

### 6.2 RIGHT (entering from left side, moves rightward)
```
EN:
- "from the left" / "leftward" / "left-to-right"
- "back" / "previous" / "return" / "go back"
- "iOS pop back" / "swipe to prev"

KO:
- "왼쪽에서" / "이전으로" / "돌아가"
- "뒤로" / "이전 화면으로" / "뒤로 가기"

→ direction: "RIGHT"
```

### 6.3 TOP (entering from bottom, moves upward)
```
EN:
- "from the bottom" / "rising" / "bottom-to-top"
- "from below" / "upward" / "swiping up"
- "bottom sheet up" / "rising banner"

KO:
- "아래에서" / "위로 올라와" / "아래에서 위로"
- "올라와" / "솟아오르듯"
- "바텀시트가 올라와"

→ direction: "TOP"
```

### 6.4 BOTTOM (entering from top, moves downward)
```
EN:
- "from the top" / "falling" / "top-to-bottom"
- "from above" / "downward" / "dropping down"
- "notification drop" / "header reveal"

KO:
- "위에서" / "아래로 내려와" / "위에서 아래로"
- "떨어지듯" / "내려오듯"
- "알림이 위에서 내려와"

→ direction: "BOTTOM"
```

### 6.5 Direction Defaults by Context

When user doesn't specify direction:

```
Action: "next" / "forward" / "다음" → LEFT (destination comes from right)
Action: "back" / "previous" / "이전" → RIGHT
Action: "open menu" / "open drawer" / "메뉴 열기" → typically LEFT or RIGHT (depends on UI)
Action: "open bottom sheet" / "바텀시트" → TOP
Action: "show notification" / "알림 표시" → BOTTOM
Action: undefined → LEFT (most common default)
```

---

## 7. Combined Patterns / 복합 패턴

Common transition + easing combinations for typical UI moments.

### 7.1 Standard UI Patterns

```typescript
// Modal entrance — soft, settled
{
  type: "DISSOLVE",
  easing: { type: "EASE_OUT" },
  duration: 0.25  // lg
}

// Modal entrance — playful pop
{
  type: "DISSOLVE",
  easing: { type: "EASE_OUT_BACK" },
  duration: 0.4  // xl
}

// Modal exit — quick fade
{
  type: "DISSOLVE",
  easing: { type: "EASE_IN" },
  duration: 0.15  // md
}

// iOS-style next page
{
  type: "PUSH",
  direction: "LEFT",
  matchLayers: false,
  easing: { type: "EASE_OUT" },
  duration: 0.3
}

// iOS-style back
{
  type: "PUSH",
  direction: "RIGHT",
  matchLayers: false,
  easing: { type: "EASE_IN_AND_OUT" },
  duration: 0.3
}

// Hamburger menu opens (drawer from left)
{
  type: "MOVE_IN",
  direction: "RIGHT",  // destination moves rightward = comes from left
  matchLayers: false,
  easing: { type: "EASE_OUT" },
  duration: 0.25
}

// Bottom sheet rises
{
  type: "MOVE_IN",
  direction: "TOP",  // moves upward = comes from bottom
  matchLayers: false,
  easing: { type: "EASE_OUT" },
  duration: 0.3
}

// Toast notification appearing
{
  type: "MOVE_IN",
  direction: "BOTTOM",
  matchLayers: false,
  easing: { type: "QUICK" },  // Spring preset for snappy feel
  duration: 0.4
}

// Card → detail view (same card transforms)
{
  type: "SMART_ANIMATE",
  easing: { type: "EASE_IN_AND_OUT" },
  duration: 0.4
}

// Card → detail (Material 3 container transform feel)
{
  type: "SMART_ANIMATE",
  easing: {
    type: "CUSTOM_CUBIC_BEZIER",
    easingFunctionCubicBezier: { x1: 0.2, y1: 0, x2: 0, y2: 1 }
  },
  duration: 0.5
}

// Heart "like" button bounce
{
  type: "SMART_ANIMATE",
  easing: { type: "BOUNCY" },  // Spring preset
  duration: 0.4
}

// Tab switch (unrelated content)
{
  type: "DISSOLVE",
  easing: { type: "EASE_IN_AND_OUT" },
  duration: 0.15
}

// Swipeable carousel
{
  type: "PUSH",
  direction: "LEFT",
  matchLayers: false,
  easing: { type: "EASE_OUT" },
  duration: 0.3
}

// Page slide with element morph (best of both)
{
  type: "PUSH",
  direction: "LEFT",
  matchLayers: true,  // ★ This enables smart-animate behavior
  easing: { type: "EASE_OUT" },
  duration: 0.4
}
```

### 7.2 Brand-style Patterns

```typescript
// iOS-feel default
{
  type: "PUSH",
  direction: "LEFT",
  matchLayers: false,
  easing: { type: "EASE_IN_AND_OUT" },
  duration: 0.35
}

// Material 3 emphasized
{
  type: "SMART_ANIMATE",
  easing: {
    type: "CUSTOM_CUBIC_BEZIER",
    easingFunctionCubicBezier: { x1: 0.2, y1: 0, x2: 0, y2: 1 }
  },
  duration: 0.5
}

// Instagram-like heart bounce
{
  type: "SMART_ANIMATE",
  easing: { type: "BOUNCY" },
  duration: 0.4
}

// Toss-style payment slide
{
  type: "PUSH",
  direction: "LEFT",
  matchLayers: false,
  easing: { type: "EASE_OUT" },
  duration: 0.3
}

// Game UI explosive entry
{
  type: "SMART_ANIMATE",
  easing: {
    type: "CUSTOM_SPRING",
    easingFunctionSpring: { mass: 1, stiffness: 400, damping: 12, initialVelocity: 0 }
  },
  duration: 0.6
}
```

---

## 8. Emotional & Generational Expressions / 감정·세대별 표현

(This section is mostly unchanged from v2.2 - emotion vocabulary maps to Figma-native easing/transitions correctly.)

### Quick Reference — Emotion → Figma Pattern

| Emotion | Easing | Transition | Duration |
|---|---|---|---|
| "playful" / "fun" / "재미있게" | BOUNCY | SMART_ANIMATE / DISSOLVE | lg |
| "elegant" / "luxurious" / "우아하게" | EASE_OUT or SLOW | DISSOLVE | xl |
| "snappy" / "responsive" / "시원하게" | EASE_OUT or QUICK | DISSOLVE | sm |
| "dramatic" / "cinematic" / "드라마틱하게" | EASE_IN_AND_OUT or SLOW | DISSOLVE | xxl |
| "serious" / "professional" / "진중하게" | EASE_IN_AND_OUT | DISSOLVE | lg |
| "magical" / "dreamy" / "신비롭게" | EASE_OUT or SLOW | DISSOLVE | xxl |

---

## 9. Ambiguous Expressions / 두루뭉술한 표현

### 9.1 Single-word Vague Inputs → Figma Mapping

```
EN "smooth" / KO "부드럽게" → 
  { transition: DISSOLVE, easing: EASE_IN_AND_OUT, duration: 0.25 }

EN "snappy" / KO "빠릿하게" → 
  { transition: DISSOLVE, easing: EASE_OUT, duration: 0.1 }

EN "bouncy" / KO "탄력있게" → 
  { transition: SMART_ANIMATE, easing: BOUNCY, duration: 0.4 }

EN "dramatic" / KO "드라마틱하게" → 
  { transition: DISSOLVE, easing: EASE_IN_AND_OUT, duration: 0.6 }

EN "pretty" / KO "예쁘게" → 
  { transition: SMART_ANIMATE, easing: GENTLE, duration: 0.25 }

EN "professional" / KO "전문적으로" → 
  { transition: DISSOLVE, easing: EASE_IN_AND_OUT, duration: 0.2 }

EN "nice" / KO "좋게" → safe default
  { transition: DISSOLVE, easing: EASE_IN_AND_OUT, duration: 0.15 }
```

### 9.2 Intensity Modifier Effects (Figma-aware)

```
Intensifier boosts duration AND may switch to more pronounced easing:

"smooth" → DISSOLVE + EASE_IN_AND_OUT + lg
"very smooth" → DISSOLVE + EASE_OUT + lg (one step longer easing)
"super smooth" → DISSOLVE + EASE_OUT + xl
"extremely smooth" → DISSOLVE + EASE_OUT_BACK + xl  // adds personality

"bouncy" → SMART_ANIMATE + BOUNCY + lg
"very bouncy" → SMART_ANIMATE + BOUNCY + xl
"super bouncy" → SMART_ANIMATE + CUSTOM_SPRING(stiffness: 400, damping: 12) + xl
"insanely bouncy" → SMART_ANIMATE + CUSTOM_SPRING(stiffness: 600, damping: 8) + xxl
```

### 9.3 Negation Effects (Figma-aware)

```
"not bouncy" → exclude BOUNCY/QUICK/GENTLE/SLOW/CUSTOM_SPRING → use EASE_IN_AND_OUT
"not linear" → exclude LINEAR → use EASE_IN_AND_OUT or EASE_OUT
"not too fast" → duration md or lg minimum
"not too slow" → duration md or sm maximum
"without back/overshoot" → exclude EASE_*_BACK variants
"no motion" → INSTANT (no transition)
```

---

## 10. Domain Adjustments / 도메인 보정

(Same logic as v2.2, but adjusted output is now Figma-native.)

### 10.1 Finance / Enterprise
```
Default tendencies:
- Prefer EASE_IN_AND_OUT (balanced, professional)
- Avoid CUSTOM_SPRING with high stiffness (jarring)
- Duration cap: md (0.15s) for most cases
- Avoid SMART_ANIMATE on critical flows (potential confusion)

"smooth" (finance) → DISSOLVE + EASE_IN_AND_OUT + md (0.15s)
```

### 10.2 Social / Entertainment
```
Default tendencies:
- Embrace BOUNCY/QUICK spring presets
- SMART_ANIMATE for delight
- Duration: lg (0.25s) or xl (0.4s) frequently

"smooth" (social) → SMART_ANIMATE + EASE_OUT + lg (0.25s)
```

### 10.3 B2B / Productivity
```
Default tendencies:
- Functional, fast
- Prefer EASE_OUT for entries (quick comprehension)
- Duration: sm-md range
- LINEAR for color/opacity-only changes

"smooth" (B2B) → DISSOLVE + EASE_OUT + md (0.15s)
```

### 10.4 Gaming / Playful
```
Default tendencies:
- BOUNCY / CUSTOM_SPRING liberal use
- EASE_*_BACK for personality
- Duration: xl+ frequent

"smooth" (gaming) → SMART_ANIMATE + EASE_OUT_BACK + xl (0.4s)
```

### 10.5 Accessibility-first / Medical
```
Default tendencies:
- DISSOLVE preferred (avoid motion sickness)
- LINEAR or EASE_IN_AND_OUT (predictable)
- Avoid BOUNCY/CUSTOM_SPRING (jarring for vestibular issues)
- Avoid SMART_ANIMATE if elements move significantly
- Honor prefers-reduced-motion → DISSOLVE only

"smooth" (a11y) → DISSOLVE + EASE_IN_AND_OUT + lg (0.25s)
```

---

## 11. LLM System Prompt / LLM 시스템 프롬프트

```
You are converting natural language input to Figma Prototype Reaction objects.
The output must strictly conform to Figma's Plugin API Transition and Easing types.

# Figma API Constraints (CRITICAL)
- Transition.type: ONLY these values are valid:
  Simple: "DISSOLVE" | "SMART_ANIMATE" | "SCROLL_ANIMATE"
  Directional: "MOVE_IN" | "MOVE_OUT" | "PUSH" | "SLIDE_IN" | "SLIDE_OUT"
- Directional transitions REQUIRE direction: "LEFT" | "RIGHT" | "TOP" | "BOTTOM"
- Directional transitions REQUIRE matchLayers: boolean
- Easing.type: ONLY these values:
  Cubic: "LINEAR" | "EASE_IN" | "EASE_OUT" | "EASE_IN_AND_OUT"
  Back: "EASE_IN_BACK" | "EASE_OUT_BACK" | "EASE_IN_AND_OUT_BACK"
  Spring presets: "GENTLE" | "QUICK" | "BOUNCY" | "SLOW"
  Custom: "CUSTOM_CUBIC_BEZIER" (with easingFunctionCubicBezier)
          "CUSTOM_SPRING" (with easingFunctionSpring)
- Duration is in SECONDS (number), not milliseconds. Convert ms → s by /1000.
- For "instant" / "no animation", set transition to null or omit it entirely.

# DO NOT output:
- Abstract names like "morph" → use "SMART_ANIMATE" instead
- Abstract names like "fade" → use "DISSOLVE"
- Abstract names like "slide" → use "PUSH" or "MOVE_IN" or "SLIDE_IN"
- Abstract names like "standard"/"emphasized" → use Figma native easing
- Duration in ms → convert to seconds

# Mapping Procedure
1. Detect language (Korean/English/Bilingual)
2. Detect expression level (L1/L2/L3/L4)
3. Detect intent (Enter/Exit/Move/Transform/Emphasize)
4. Map to Figma native types:
   - Duration → seconds value
   - Easing → one of 13 native easing types
   - Transition → one of 8 native transition types
5. If Directional transition: determine direction (LEFT/RIGHT/TOP/BOTTOM)
6. Determine matchLayers based on whether user wants element morphing
7. Apply intensity modifiers / negations
8. Apply domain context adjustments
9. Validate against Figma API constraints
10. Output Reaction object

# Validation rules before output
- duration must be number (seconds), in range 0.01 - 10
- For "instant" cases, set transition to null
- DirectionalTransition MUST have direction and matchLayers
- CUSTOM_CUBIC_BEZIER MUST have easingFunctionCubicBezier
- CUSTOM_SPRING MUST have easingFunctionSpring
- SMART_ANIMATE works only if matching layer names exist; warn user otherwise

# Output Format
{
  detected_language: "ko" | "en" | "bilingual",
  detected_level: "L1" | "L2" | "L3" | "L4",
  detected_intent: "Enter" | "Exit" | ...,
  reasoning: "...",
  figma_reaction: {
    trigger: { type: "ON_CLICK" },
    actions: [{
      type: "NODE",
      destinationId: "...",
      navigation: "NAVIGATE",
      transition: {
        type: "DISSOLVE" | ...,  // Figma native value
        // if directional: direction, matchLayers
        easing: { type: "EASE_OUT" | ... },  // Figma native value
        duration: 0.25  // seconds
      }
    }]
  },
  confirmation_message: "Created: smooth fade-in (DISSOLVE, EASE_OUT, 250ms)"
}
```

---

## 12. Validation Checklist / 검증 체크리스트

Before outputting any Reaction, verify:

### 12.1 Schema Validation

```
[ ] transition.type is one of:
    DISSOLVE | SMART_ANIMATE | SCROLL_ANIMATE | 
    MOVE_IN | MOVE_OUT | PUSH | SLIDE_IN | SLIDE_OUT
    (Not: morph, fade, slide, push without direction, etc.)

[ ] If transition.type is directional (MOVE/PUSH/SLIDE):
    [ ] direction field exists: LEFT | RIGHT | TOP | BOTTOM
    [ ] matchLayers field exists: boolean

[ ] easing.type is one of 13 valid values:
    LINEAR | EASE_IN | EASE_OUT | EASE_IN_AND_OUT |
    EASE_IN_BACK | EASE_OUT_BACK | EASE_IN_AND_OUT_BACK |
    GENTLE | QUICK | BOUNCY | SLOW |
    CUSTOM_CUBIC_BEZIER | CUSTOM_SPRING

[ ] If CUSTOM_CUBIC_BEZIER: easingFunctionCubicBezier has x1, y1, x2, y2 (0-1 range)

[ ] If CUSTOM_SPRING: easingFunctionSpring has mass, stiffness, damping, initialVelocity

[ ] duration is number in seconds, range 0.01 - 10
```

### 12.2 Semantic Validation

```
[ ] SMART_ANIMATE only used when matching layer names exist between frames
    (otherwise warn user that it will fall back to DISSOLVE)

[ ] Direction makes sense for user intent:
    - "next" → LEFT (destination comes from right)
    - "back" → RIGHT
    - "up from bottom" → TOP
    - "down from top" → BOTTOM

[ ] Duration appropriate for context:
    - Hover/press → xs/sm
    - Modal entry → lg
    - Hero/celebration → xl/xxl
    - Warning if > 1 second for everyday interactions

[ ] Easing makes sense for transition direction:
    - Entry → EASE_OUT or settling easings preferred
    - Exit → EASE_IN preferred
    - Same screen movement → EASE_IN_AND_OUT preferred

[ ] Accessibility check:
    - User mentioned accessibility/medical/senior → prefer DISSOLVE + LINEAR/EASE_IN_AND_OUT
    - Avoid CUSTOM_SPRING with high stiffness for these contexts
```

### 12.3 User Confirmation Format

After generating, present to user in their language:

```
EN: "Created reaction:
     - Transition: SMART_ANIMATE
     - Easing: EASE_OUT_BACK (overshoot then settle)
     - Duration: 0.4s (400ms)
     - This will morph matching layers with a playful overshoot."

KO: "리액션이 생성되었어요:
     - 전환 방식: SMART_ANIMATE (자동 모핑)
     - 이징: EASE_OUT_BACK (오버슛 후 안착)
     - 지속 시간: 0.4초 (400ms)
     - 같은 이름의 레이어가 자연스럽게 변형되면서 살짝 튕기듯 안착해요."
```

---

## 13. Appendix / 부록

### Appendix A: Figma Native Quick Reference (EN)

#### All Transition Types
| Figma Type | Behavior | Direction? | matchLayers? |
|---|---|---|---|
| `DISSOLVE` | Pure opacity transition | No | No |
| `SMART_ANIMATE` | Auto-match shared layers | No | Built-in |
| `SCROLL_ANIMATE` | Scroll-based animation | No | No |
| `MOVE_IN` | Destination over origin | Yes | Yes |
| `MOVE_OUT` | Destination moves away | Yes | Yes |
| `PUSH` | Both frames move together | Yes | Yes |
| `SLIDE_IN` | Slide + dissolve hybrid | Yes | Yes |
| `SLIDE_OUT` | Slide out + dissolve | Yes | Yes |
| (null transition) | Instant change | — | — |

#### All Easing Types
| Figma Type | Feel | Use For |
|---|---|---|
| `LINEAR` | Constant speed | Color, opacity only |
| `EASE_IN` | Slow start, fast end | Exits |
| `EASE_OUT` | Fast start, slow end | Entries (most common) |
| `EASE_IN_AND_OUT` | Slow on both ends | Bidirectional, balanced |
| `EASE_IN_BACK` | Pulls back then exits | Anticipation before exit |
| `EASE_OUT_BACK` | Overshoots then settles | Playful entries |
| `EASE_IN_AND_OUT_BACK` | Both ends overshoot | Dramatic motion |
| `GENTLE` | Soft spring | Subtle scaling |
| `QUICK` | Snappy spring | Toasts, notifications |
| `BOUNCY` | Pronounced bounce | Likes, playful UI |
| `SLOW` | Settled slow spring | Fullscreen scaling |
| `CUSTOM_CUBIC_BEZIER` | Defined curve | Brand-specific feel |
| `CUSTOM_SPRING` | Defined physics | Specific spring behavior |

### Appendix B: Figma Native Quick Reference (한국어)

#### Transition 타입 전체
| Figma 타입 | 동작 | 방향? | matchLayers? |
|---|---|---|---|
| `DISSOLVE` | 순수 페이드/디졸브 | X | X |
| `SMART_ANIMATE` | 동일 레이어 자동 매칭 | X | 내장 |
| `SCROLL_ANIMATE` | 스크롤 기반 | X | X |
| `MOVE_IN` | 새 프레임이 위에 들어옴 | O | O |
| `MOVE_OUT` | 새 프레임이 위에서 나감 | O | O |
| `PUSH` | 두 프레임 함께 이동 | O | O |
| `SLIDE_IN` | 슬라이드 + 디졸브 | O | O |
| `SLIDE_OUT` | 슬라이드 아웃 + 디졸브 | O | O |
| (null) | 즉시 변경 | — | — |

### Appendix C: Common UI Pattern → Figma Output

| Pattern | Transition | Direction | Easing | Duration |
|---|---|---|---|---|
| Modal show | DISSOLVE | — | EASE_OUT | 0.25s |
| Modal hide | DISSOLVE | — | EASE_IN | 0.15s |
| iOS push next | PUSH | LEFT | EASE_IN_AND_OUT | 0.35s |
| iOS pop back | PUSH | RIGHT | EASE_IN_AND_OUT | 0.35s |
| Drawer left | MOVE_IN | RIGHT | EASE_OUT | 0.25s |
| Bottom sheet | MOVE_IN | TOP | EASE_OUT | 0.3s |
| Toast top | MOVE_IN | BOTTOM | QUICK | 0.3s |
| Tab switch | DISSOLVE | — | EASE_IN_AND_OUT | 0.15s |
| Card → detail | SMART_ANIMATE | — | EASE_IN_AND_OUT | 0.4s |
| Heart like | SMART_ANIMATE | — | BOUNCY | 0.4s |
| Page slide w/morph | PUSH (matchLayers: true) | LEFT | EASE_OUT | 0.4s |
| Hard cut | null | — | — | — |

### Appendix D: Brand Pattern → Figma Output

| Brand Style | Transition | Easing | Duration |
|---|---|---|---|
| iOS default | PUSH (LEFT) | EASE_IN_AND_OUT | 0.35s |
| Material 3 emphasized | SMART_ANIMATE | CUSTOM_CUBIC_BEZIER(0.2,0,0,1) | 0.5s |
| Instagram heart | SMART_ANIMATE | BOUNCY | 0.4s |
| Toss payment | PUSH (LEFT) | EASE_OUT | 0.3s |
| Slack message | DISSOLVE | EASE_OUT | 0.15s |
| Netflix intro | DISSOLVE | EASE_IN_AND_OUT | 0.8s |
| Game UI explosive | SMART_ANIMATE | CUSTOM_SPRING(stiff:400, damp:12) | 0.6s |

---

## Change Log / 변경 이력

- **v2.3** (2026-05-20): **Critical Figma API alignment**. Removed abstract `morph` token. Easing tokens now map 1:1 to Figma natives (13 types). Added EASE_*_BACK variants. Added Spring presets (GENTLE/QUICK/BOUNCY/SLOW). Added direction mapping (LEFT/RIGHT/TOP/BOTTOM). Clarified MOVE/PUSH/SLIDE differences. Added matchLayers option handling. Added validation checklist.
- **v2.2** (2026-05-20): English vocabulary expanded to match Korean. Added bilingual handling, language detection.
- **v2.1** (2026-05-20): Korean vocabulary expanded ~4x. Added onomatopoeia, loanwords, generational expressions.
- **v2.0** (2026-05-20): Introduced 4-level expression classification, ambiguous expression handling.
- **v1.0** (2026-05-19): Initial version with token definitions based on 10 design systems.

---

## License / Sources

This dictionary synthesizes publicly available guidelines from:

- **Figma Plugin API** (primary technical reference)
  - https://developers.figma.com/docs/plugins/api/Transition/
- IBM Carbon Design System
- Google Material Design 3
- Apple Human Interface Guidelines
- Microsoft Fluent 2
- Adobe Spectrum
- Atlassian Design System
- Audi UI
- GitHub Primer
- Uber Base
- Pinterest Gestalt
