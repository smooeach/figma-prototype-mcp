# Trigger Dictionary v2.7.1 / Trigger 사전 v2.7.1

> **Part 1 of 2: Trigger (when it happens)**
> **자연어 → Figma Prototype Trigger 매핑 사전**
>
> Sister document: **Animation Dictionary v2.7.1** (Part 2 of 2)
> 자매 문서: **Animation Dictionary v2.7.1** (Part 2)
>
> - Version: v2.7.1 (Cross-document disambiguation + Combined Patterns added)
> - Date: 2026-05-20
>
> ## What's new in v2.7.1
> - Added cross-document disambiguation rules (Section 18)
> - Added Combined Patterns with sister document (Section 19, brief)
> - Added Brand Pattern Matrix (Appendix E, brief)
> - All vocabulary from v2.7 preserved

## What's covered here / 이 문서가 다루는 범위

This document focuses on the "**when it happens**" side of a Figma Reaction — the trigger that initiates an interaction. For the "**what happens**" side (animation properties: Duration/Easing/Transition/Direction), see the sister document.

이 문서는 Figma Reaction의 "**언제 일어나는가**" — 즉 인터랙션을 발동시키는 Trigger를 다룹니다. "**무엇이 일어나는가**" (Duration/Easing/Transition/Direction)는 자매 문서 참조.

### Covered triggers

| Trigger Type | Required Params | Vocabulary per trigger |
|---|---|---|
| **ON_CLICK** | — | 60+ EN, 60+ KO |
| **ON_HOVER** (round-trip) | — | 50+ EN, 50+ KO |
| **ON_PRESS** (round-trip) | — | 50+ EN, 50+ KO |
| **ON_DRAG** | — | 60+ EN, 60+ KO |
| **AFTER_TIMEOUT** | timeout (s) | 50+ EN, 50+ KO + time mapping |
| **MOUSE_DOWN / MOUSE_UP** | delay (s) | 40+ EN, 40+ KO each |
| **MOUSE_ENTER / MOUSE_LEAVE** | delay, deprecatedVersion | 40+ EN, 40+ KO each |
| **ON_KEY_DOWN** | device, keyCodes[] | Full keycode mapping |
| **ON_MEDIA_END / ON_MEDIA_HIT** | mediaHitTime (s) | 30+ EN, 30+ KO each |

---

## Table of Contents / 목차

1. [Figma Trigger API / Figma Trigger API](#1-figma-trigger-api--figma-trigger-api)
2. [Expression Levels / 표현 레벨](#2-expression-levels--표현-레벨)
3. [Trigger Disambiguation / Trigger 추론 전략](#3-trigger-disambiguation--trigger-추론-전략)
4. [ON_CLICK — 클릭/탭](#4-on_click--클릭탭)
5. [ON_HOVER — 호버 (왕복)](#5-on_hover--호버-왕복)
6. [ON_PRESS — 누름 (왕복)](#6-on_press--누름-왕복)
7. [ON_DRAG — 드래그](#7-on_drag--드래그)
8. [AFTER_TIMEOUT — 시간 후](#8-after_timeout--시간-후)
9. [MOUSE_DOWN / MOUSE_UP](#9-mouse_down--mouse_up--마우스-누름뗌)
10. [MOUSE_ENTER / MOUSE_LEAVE — 영구 호버](#10-mouse_enter--mouse_leave--영구-호버)
11. [ON_KEY_DOWN — 키보드/게임패드](#11-on_key_down--키보드게임패드)
12. [ON_MEDIA_END / ON_MEDIA_HIT — 미디어](#12-on_media_end--on_media_hit--미디어)
13. [Time Expression Mapping / 시간 표현](#13-time-expression-mapping--시간-표현)
14. [Context-based Inference / 컨텍스트 추론](#14-context-based-inference--컨텍스트-추론)
15. [Validation Checklist / 검증 체크리스트](#15-validation-checklist--검증-체크리스트)
16. [LLM System Prompt / LLM 프롬프트](#16-llm-system-prompt--llm-프롬프트)
17. [Cross-document Disambiguation / 자매 문서 간 충돌 해소](#17-cross-document-disambiguation--자매-문서-간-충돌-해소) ★ v2.7.1 NEW
18. [Combined Patterns (with Animation) / 복합 패턴](#18-combined-patterns-with-animation--복합-패턴) ★ v2.7.1 NEW
19. [Appendix / 부록](#19-appendix--부록)

---

## 1. Figma Trigger API / Figma Trigger API

### 1.1 Type Definition (Official)

```typescript
type Trigger = 
  // Simple triggers (no params)
  | { type: "ON_CLICK" | "ON_HOVER" | "ON_PRESS" | "ON_DRAG" | "ON_MEDIA_END" }
  // Time-based
  | { type: "AFTER_TIMEOUT", timeout: number }  // seconds
  // Mouse with delay
  | { type: "MOUSE_UP" | "MOUSE_DOWN", delay: number }  // seconds
  // Mouse with delay + deprecation flag
  | { type: "MOUSE_ENTER" | "MOUSE_LEAVE", delay: number, deprecatedVersion: boolean }
  // Keyboard/Gamepad
  | {
      type: "ON_KEY_DOWN",
      device: "KEYBOARD" | "XBOX_ONE" | "PS4" | "SWITCH_PRO" | "UNKNOWN_CONTROLLER",
      keyCodes: number[]
    }
  // Media timing
  | { type: "ON_MEDIA_HIT", mediaHitTime: number }  // seconds
```

### 1.2 Behavior Classification

**Round-trip (왕복) — Auto-reverts when trigger ends:**
- `ON_HOVER` — Reverts when cursor leaves
- `ON_PRESS` — Reverts when mouse/finger lifts

**One-way (단방향) — Permanent navigation:**
- All others (ON_CLICK, ON_DRAG, MOUSE_*, AFTER_TIMEOUT, ON_KEY_DOWN, ON_MEDIA_*)

This distinction is critical for natural language interpretation:
- "while hovering" → ON_HOVER (round-trip)
- "permanently open on hover" → MOUSE_ENTER (one-way)

### 1.3 Critical Constraints

- AFTER_TIMEOUT: `timeout` in **seconds** (number)
- MOUSE_UP/DOWN: `delay` in seconds
- MOUSE_ENTER/LEAVE: `delay` (seconds) + `deprecatedVersion` (boolean)
- ON_KEY_DOWN: `device` + non-empty `keyCodes` array
- ON_MEDIA_HIT: `mediaHitTime` in seconds

---

## 2. Expression Levels / 표현 레벨

Same 4-level classification across all triggers.

| Level | Characteristic | EN Example | KO Example |
|---|---|---|---|
| **L1: Precise** | API values | `"ON_CLICK"`, `"AFTER_TIMEOUT 3s"` | `"ON_CLICK"`, `"3초 후 타임아웃"` |
| **L2: Standard** | Standard terms | `"when clicked"` | `"클릭하면"` |
| **L3: Sensory** | Onomatopoeia | `"tap it"`, `"wait a sec"` | `"톡 누르면"`, `"잠깐 있다가"` |
| **L4: Metaphor** | Analogies | `"like a tooltip"` | `"툴팁처럼"` |

---

## 3. Trigger Disambiguation / Trigger 추론 전략

### 3.1 The 5-Signal Detection Model

People use wildly different vocabulary for the same trigger. Use 5 signals to detect intent:

```
Signal 1: Action verb (동사)        — "click", "hover", "drag", "누르면", "끌면"
Signal 2: Duration modifier (지속)  — "while", "during", "동안", "있는 동안"  
Signal 3: Temporality (시점)        — "when", "after", "할 때", "후"
Signal 4: Device hint (기기)        — "mouse", "finger", "keyboard", "터치", "스와이프"
Signal 5: Persistence (영속성)      — "stays", "until", "유지", "영구적"
```

### 3.2 Top-level Decision Tree

```
1. Device/input hint?
   ├─ Keyboard mention → ON_KEY_DOWN
   ├─ Video/audio + ends → ON_MEDIA_END
   ├─ Video/audio + timestamp → ON_MEDIA_HIT
   ├─ Time mention only → AFTER_TIMEOUT
   └─ Touch/mouse hint → continue

2. Continuous or one-shot?
   ├─ Continuous (drag/swipe/끌면) → ON_DRAG
   ├─ Held (press/hold/꾹/길게) → ON_PRESS or MOUSE_DOWN
   └─ One-shot → continue

3. Persistence signal?
   ├─ "stays"/"유지"/"영구" → MOUSE_ENTER (not ON_HOVER)
   ├─ "while"/"동안"/"하는 중" → ON_HOVER (auto-revert)
   └─ No info → default

4. Hover vs Click vs specific Mouse?
   ├─ hover/호버/갖다대 → ON_HOVER
   ├─ click/tap/누르면 → ON_CLICK
   ├─ press start/누르는 순간 → MOUSE_DOWN
   ├─ release/떼면 → MOUSE_UP
   └─ Ambiguous → ON_CLICK (safe default)
```

### 3.3 Signal Conflict Priority

```
1. Explicit type mention ("ON_HOVER로", "use ON_CLICK") — HIGHEST
2. Device specification
3. Action verb with clear semantics
4. Duration/temporality modifiers
5. Domain context (mobile vs desktop)
6. Default fallback (ON_CLICK)
```

---

## 4. ON_CLICK — 클릭/탭

**Output:** `{ type: "ON_CLICK" }`  
**Behavior:** Single-fire on click/tap. One-way. The default trigger.

### 4.1 English Vocabulary (60+)

#### L1: Precise / Technical
```
ON_CLICK / "ON_CLICK trigger" / "on click event"
"set trigger to ON_CLICK" / "click trigger" / "tap trigger"
"clickHandler" / "onClick" / "click event"
"single-click" / "left-click" / "primary click"
```

#### L2: Standard
```
Core verbs:
click / clicks / clicking / clicked / on click / when clicked
tap / taps / tapping / tapped / on tap / when tapped
press (in tap sense, mobile) / pressed / pressing
hit / hits / hitting / "hit the button"
select / selects / selecting / "user selects"
choose / chooses / "when chosen" / "on selection"
activate / activates / "on activation"

Phrase patterns:
"when [user] clicks" / "when [user] taps"
"upon clicking" / "once clicked" / "if clicked"
"after clicking" / "the moment they click"
"as soon as clicked" / "on first click"
"on user click" / "on user tap" / "on mouse click"
"left mouse click" / "on button press" (in click sense)
"action on click" / "click handler" / "tap event"
```

#### L3: Sensory / Colloquial
```
Onomatopoeia:
"click" / "clack" / "clik" / "tic" / "tick"
"give it a click" / "give it a tap"
"a quick click" / "a single click" / "one click"
"just click" / "go click" / "go tap"

Casual:
"hit it" / "smack it" / "boop it" / "punch it"
"touch it" / "poke it" / "ping it"
"jab it" / "stab it" / "smash it"
"thwack" / "knock"

Gen Z:
"yeet click" / "smash that like" / "slap that button"
"go off on click" / "smash button"
```

#### L4: Metaphorical
```
Button metaphors:
"like clicking a remote control" / "like pressing an elevator button"
"like hitting a calculator key" / "button-press"
"keyboard-key style click" / "doorbell press"
"vending machine button"

Brand:
"like Facebook Like button" / "like Twitter heart click"
"like iOS button tap" / "Spotify play button click"
"YouTube like click"

Action metaphors:
"engage" / "fire off" / "trigger it"
"pull the trigger" (figurative) / "flip the switch" / "send it"
```

### 4.2 Korean Vocabulary (60+)

#### L1: 정밀
```
"ON_CLICK으로" / "ON_CLICK 트리거" / "클릭 이벤트로"
"클릭 핸들러" / "온 클릭" / "온 탭"
"단일 클릭" / "왼쪽 클릭" / "주 클릭"
"클릭 트리거" / "탭 트리거" / "onClick으로" / "click 이벤트"
```

#### L2: 일반
```
핵심 동사:
클릭 / 클릭하면 / 클릭할 때 / 클릭 시
탭 / 탭하면 / 탭할 때 / 탭 시
누르면 / 누를 때 / 누르기만 하면
터치 / 터치하면 / 터치할 때
선택 / 선택하면 / 선택할 때 / 선택 시
고르면 / 골랐을 때 / 누름 / 클릭 후
액티베이트 / 활성화하면

문장 패턴:
"클릭하면 ~로" / "사용자가 클릭하면" / "사용자가 누르면"
"누르는 순간" / "클릭 시" / "한번 클릭하면" / "한번 누르면"
"클릭 한 번에" / "버튼 누르면" / "이거 누르면" / "여기 누르면"
"이걸 클릭하면" / "이거 탭하면" / "마우스 클릭하면"
"마우스 왼쪽 버튼으로"
```

#### L3: 감각적 / 구어체
```
의성어:
딸깍 / 딸깍하면 / 딸깍하니
딱 / 딱 누르면 / 딱 한 번
탁 / 탁 치면 / 탁 누르면
톡 / 톡 치면 / 톡 한번
띡 / 띡 누르면 / 띡 하고
또각 / 또각하니

캐주얼:
"한 번 톡" / "한번 톡" / "슉 누르면" / "슉 클릭"
"콕 찌르면" / "콕 누르면" / "콕" / "콕콕"
"폭 누르면" / "팟 누르면"

MZ:
"개눌러" / "걍 눌러" / "한방에 클릭" / "클릭 한 방"
"눌러봐" / "눌러봐 이거" / "이거 갈겨" / "이거 박아"
"이거 때려" / "눌러삐기"
```

#### L4: 비유적
```
버튼 비유:
"리모컨 누르듯" / "엘리베이터 버튼 누르듯"
"계산기 키 누르듯" / "키보드 키 누르듯"
"초인종 누르듯" / "자판기 버튼 누르듯"

브랜드:
"페북 좋아요 누르듯" / "인스타 하트 누르듯"
"카카오 보내기 누르듯" / "토스 송금 누르듯"

행동:
"방아쇠 당기듯" / "스위치 켜듯" / "버저 누르듯"
"전원 켜듯" / "트리거 발동"
```

---

## 5. ON_HOVER — 호버 (왕복)

**Output:** `{ type: "ON_HOVER" }`  
**Behavior:** Auto-reverts when cursor leaves. Desktop only.

### 5.1 English (50+)

#### L1: Precise
```
"ON_HOVER" / "on hover" / "hover trigger"
"set to ON_HOVER" / "hover with auto-revert"
"hover state" / "hover interaction" / ":hover state"
"hover pseudo-state" / "transient hover" / "reverting hover"
```

#### L2: Standard
```
Core verbs:
hover / hovers / hovering / hovered
"on hover" / "when hovering" / "while hovering" / "during hover"
"mouseover" (with revert) / "mouse over" / "mouse-hover"

Phrase patterns:
"show on hover" / "appear on hover" / "display on hover"
"only show while hovering" / "only on hover"
"reveal on hover" / "hover-show" / "hover to see"
"hover for preview" / "hover-preview" / "hover tooltip"

Round-trip signals (CRITICAL):
"while hovering" → ON_HOVER
"as long as cursor is over" → ON_HOVER
"only while hovering" → ON_HOVER
"goes away when you leave" → ON_HOVER
"disappears when not hovered" → ON_HOVER
```

#### L3: Sensory
```
"hover over it" / "hover on" / "hover above"
"mouse over it" / "mouse above"
"float cursor over" / "linger on it" / "linger over"
"loiter on" / "loiter over" / "dwell on" / "dwell over"
"glide cursor over" / "slide cursor over"
"drift cursor onto" / "hover-glide"

Casual:
"give it a hover" / "have a hover" / "do the hover thing"
```

#### L4: Metaphorical
```
"like a tooltip" / "tooltip-style"
"preview on hover" / "preview behavior"
"like a magnifying glass over"
"ghost reveal" / "auto-fade preview"
"peek behavior" / "peek on hover"
"glance interaction"

Brand:
"like GitHub commit hover" / "like Notion mention preview"
"like Figma comment hover" / "like Apple page link preview"
```

### 5.2 Korean (50+)

#### L1: 정밀
```
"ON_HOVER로" / "ON_HOVER 트리거"
"온 호버" / "호버 (왕복)" / "호버 트리거"
"호버 상태" / "자동 복귀 호버" / ":hover 의사상태"
```

#### L2: 일반
```
핵심 동사:
호버 / 호버하면 / 호버하는 동안 / 호버 시
마우스 올리면 / 마우스 올릴 때 / 마우스 올리는 동안
커서 올리면 / 커서 올릴 때 / 커서 갖다대면
마우스 갖다대면 / 마우스 가져가면 / 마우스 오버

문장 패턴:
"호버 시" / "호버하는 동안" / "마우스 올라가 있을 때"
"커서 위에 있을 때" / "호버 중일 때" / "마우스 위치할 때"

왕복 시그널 (중요):
"호버하는 동안만" → ON_HOVER
"마우스 떼면 사라지게" → ON_HOVER
"마우스 위에 있을 때만" → ON_HOVER
"마우스 빠지면 원래대로" → ON_HOVER
"호버 시에만" → ON_HOVER
"호버 끝나면 돌아오게" → ON_HOVER
```

#### L3: 감각적
```
감각어:
"마우스 슬쩍 올리면" / "커서 살짝 올리면"
"마우스 살짝 갖다대면" / "마우스 잠깐 올리면"
"커서로 살짝 짚으면" / "마우스로 더듬으면"
"커서 갖다 두면"

캐주얼:
"호버해봐" / "호버해보면" / "마우스 올려봐"
"마우스 올려놓으면" / "커서 올려놔"
"올려놓고 있으면" / "마우스 갖다대"

MZ:
"호버좀" / "마올" (마우스 올림)
"마갖" (마우스 갖다댐) / "호버 한번 해봐"
```

#### L4: 비유적
```
"툴팁처럼" / "미리보기처럼" / "프리뷰처럼"
"잠깐 미리보기" / "호버 효과로" / "마우스 따라"
"돋보기처럼" / "슬쩍 보기" / "엿보기 느낌"
"잠깐 띄우기"

브랜드:
"노션 멘션 호버처럼" / "깃허브 커밋 호버처럼"
"피그마 코멘트 호버처럼" / "맥OS 도크 호버처럼"
```

---

## 6. ON_PRESS — 누름 (왕복)

**Output:** `{ type: "ON_PRESS" }`  
**Behavior:** Auto-reverts on release. Used for hold-to-preview, 3D Touch.

### 6.1 English (50+)

#### L1
```
"ON_PRESS" / "on press" / "press trigger"
"press and hold trigger" / "hold trigger with revert"
"transient press" / "reverting press"
```

#### L2
```
Core verbs:
press / hold / "press and hold" / "hold down" / "long press"
"3D touch" / "force touch" / "haptic touch"

Phrase patterns:
"while pressing" / "while held" / "while held down"
"during press" / "during hold" / "as long as pressed"
"hold to preview" / "press to preview" / "hold to view"
"press-and-hold for" / "long-press to" / "hold for menu"

Round-trip signals:
"while pressing" → ON_PRESS
"release to dismiss" → ON_PRESS
"hold to preview" → ON_PRESS
"goes away when released" → ON_PRESS
"only while held" → ON_PRESS
```

#### L3
```
Physical:
"hold it down" / "press it down" / "keep pressing"
"keep it pressed" / "squeeze it" / "keep finger on"
"keep mouse down" / "finger down" / "finger held"
"hold pressure" / "sustained press"

Casual:
"press n' hold" / "squeeze for menu" / "hold yer finger"
"keep that pressed" / "don't let go" / "stay on it"

Gen Z:
"long-press that" / "hold it bro" / "keep smashing"
"keep that finger down"
```

#### L4
```
"like iOS 3D Touch" / "like Apple force touch"
"like haptic touch on iPhone" / "like Android long-press menu"
"3D Touch preview" / "hard press" / "deep press" / "force-press"
"hold-to-zoom" / "magnifier-style press" / "hold-to-peek"
"piano key hold" / "trigger hold" / "car horn press"
```

### 6.2 Korean (50+)

#### L1
```
"ON_PRESS로" / "ON_PRESS 트리거"
"프레스 트리거" / "온 프레스" / "누름 (왕복)"
"왕복 누름" / "롱프레스 트리거" / "자동 복귀 누름"
```

#### L2
```
핵심 동사:
프레스 / 누르고 있으면 / 누르는 동안
누른 채로 / 누르고 있을 때
꾹 누르면 / 꾹 누른 채로 / 꾹 누르고 있으면
길게 누르면 / 길게 누른 채로
한참 누르면 / 한참 누르고 있으면
오래 누르면 / 오래 누른 채로
계속 누르면 / 계속 누르고 있으면

문장 패턴:
"누르고 있는 동안" / "꾹 누르고 있는 동안"
"길게 누르는 동안" / "눌러진 상태에서" / "누른 상태로"
"손가락 떼지 않고" / "꾹 누르면서" / "눌러보고 있으면"
"꾸욱 누르고 있으면"

왕복 시그널:
"떼면 사라지게" / "떼면 원래대로"
"누르고 있는 동안만" / "손가락 떼면 닫혀"
"누르는 동안만 보이게" / "꾹 누르고 있을 때만"
"릴리즈하면 닫히게"
```

#### L3
```
감각어:
"꾸욱 누르면" / "지긋이 누르면" / "꾹 잡고 있으면"
"눌러 잡고 있으면" / "한참 누르면" / "오래 잡고 있으면"
"꾸욱 잡으면" / "꾹 박고 있으면"

캐주얼:
"꾹 눌러봐" / "꾹 눌러보면" / "꾹 잡아봐"
"길게 한 번 눌러봐" / "오래 누르면"

MZ:
"꾸욱존버" / "꾹누르기" / "길게 누르기"
"롱프레스해" / "꾹누 한번" / "꾹꾹"
```

#### L4
```
"iOS 3D 터치처럼" / "포스 터치처럼" / "햅틱 터치처럼"
"아이폰 미리보기처럼" / "안드로이드 롱프레스 메뉴처럼"
"롱프레스 메뉴" / "꾹 눌러 미리보기"
"피아노 건반 누르듯" / "경적 누르듯"
"트리거 잡고 있듯" / "버튼 꾹 누르고 있듯"
"카메라 셔터 눌러놓고 있듯"
```

---

## 7. ON_DRAG — 드래그

**Output:** `{ type: "ON_DRAG" }`  
**Behavior:** Continuous drag motion response.

### 7.1 English (60+)

#### L1
```
"ON_DRAG" / "on drag" / "drag trigger"
"continuous drag" / "drag gesture" / "drag-based interaction"
"scrubbing trigger" / "pan trigger"
```

#### L2
```
Core verbs:
drag / swipe / scrub / pan / pull / push / slide / flick

Phrase patterns:
"when dragged" / "when swiped" / "when pulled"
"on drag" / "on swipe" / "on pull"
"during drag" / "during swipe"
"drag to" / "swipe to" / "pull to"
"drag-to-delete" / "swipe-to-dismiss"
"drag-to-reorder" / "drag-to-sort"
"pinch and drag" / "swipe action" / "drag action"

Mobile:
"finger swipe" / "touch drag" / "swipe gesture"
"two-finger swipe" / "pinch-drag"
```

#### L3
```
Physical:
"drag it" / "yank it" / "tug it"
"pull it across" / "drag it across" / "pull it to the side"
"slide it" / "shove it" / "toss it" / "fling it"
"flick it" / "whip it" / "swing it"

Direction:
"swipe left" / "swipe right" / "swipe up" / "swipe down"
"drag down" / "pull down" / "pull up" / "drag up"
"sideways drag"

Casual:
"give it a swipe" / "slide that thing" / "drag it bro"
"swipe like Tinder" / "flick away" / "yeet it across"
```

#### L4
```
"Tinder-like swipe" / "Instagram story swipe"
"iOS pull-to-refresh" / "Gmail swipe-to-archive"
"swipe-to-delete email" / "carousel swipe"
"slider drag" / "scrubbing video timeline"
"drag handle for reordering" / "deck of cards swipe"
"Trello card drag" / "image gallery swipe"
"banner carousel" / "Snapchat swipe"
"finger painting drag" / "pinch-zoom drag"
"map panning" / "scroll wheel drag"
```

### 7.2 Korean (60+)

#### L1
```
"ON_DRAG로" / "ON_DRAG 트리거"
"드래그 트리거" / "온 드래그" / "연속 드래그"
"드래그 제스처" / "스크럽 트리거" / "팬 트리거"
"드래그 기반 인터랙션"
```

#### L2
```
핵심 동사:
드래그 / 드래그하면 / 드래그할 때 / 드래깅
스와이프 / 스와이프하면 / 스와이프할 때 / 스와이핑
끌면 / 끌어서 / 끌어당기면 / 끌고 가면
밀면 / 밀어서 / 밀어내면 / 밀쳐
잡아당기면 / 잡아끌면 / 당기면 / 당겨서
훑으면 / 훑어서 / 스크럽 / 플릭 / 플릭하면

문장 패턴:
"드래그하면 ~로" / "스와이프하면" / "옆으로 밀면"
"끌어내리면" / "끌어올리면" / "위로 올리면"
"아래로 내리면" / "좌에서 우로 끌면"
"잡아끌면" / "손가락으로 끌면" / "마우스로 끌면"

모바일:
"손가락 드래그" / "터치 드래그" / "두 손가락 스와이프"
"핀치 드래그" / "두 손가락 끌기"
```

#### L3
```
의태어:
"쓱 끌면" / "확 밀면" / "휙 밀면"
"슥슥 끌면" / "슈슉 밀면" / "쭉 끌면"
"쭈욱 끌면" / "훨훨 밀면"

방향:
"좌로 스와이프" / "우로 스와이프"
"왼쪽으로 밀면" / "오른쪽으로 밀면"
"위로 스와이프" / "아래로 스와이프" / "옆으로 휙"

캐주얼:
"확 밀어버려" / "끌어 던져" / "휙 밀어"
"쓱 끌어와" / "확 빼" / "쭉 빼" / "위로 휙"

MZ:
"스와이프해" / "스왚" / "드래그해" / "드래그ㄱ"
"옆으로 휙해" / "위로 휙해" / "훅 밀어"
"휘리릭 밀어" / "플릭해"
```

#### L4
```
"틴더처럼 스와이프" / "인스타 스토리처럼 옆으로"
"당겨서 새로고침처럼" / "메시지 삭제 스와이프처럼"
"카카오톡 메시지 답장 스와이프처럼" / "이메일 삭제 스와이프"
"스크럽바 끌듯" / "슬라이더 끌듯" / "비디오 타임라인 끌듯"
"트렐로 카드 끌듯" / "피그마 캔버스 끌듯" / "지도 끌듯"
"사진 갤러리 스와이프" / "손가락으로 그리듯"
```

---

## 8. AFTER_TIMEOUT — 시간 후

**Output:** `{ type: "AFTER_TIMEOUT", timeout: number }` (timeout in seconds)

### 8.1 English (50+)

#### L1
```
"AFTER_TIMEOUT with 3 seconds" / "AFTER_TIMEOUT timeout: 3000ms"
"set timeout 3 seconds" / "after delay 3.0s" / "timeout trigger 3000"
"setTimeout-like" / "auto-fire after N seconds" / "timed trigger"
```

#### L2
```
Time markers:
after / "after [N] seconds" / "after [N]ms" / "after [N] minutes"
"after a delay" / "after a wait" / "after waiting" / "after pausing"
"on timeout" / "after timeout" / "automatically after"
"auto-fire after" / "wait then" / "wait and then"
"after [time] passes" / "[time] later"

Phrase patterns:
"X seconds later" / "after [N] seconds"
"following a [N]s delay" / "on a [N]-second delay"
"after [N] secs" / "in [N] seconds"
"give it [N] seconds, then" / "wait [N], then"

Modifiers:
"a moment later" / "a beat later" / "shortly after"
"soon after" / "momentarily" / "immediately after a pause"
```

#### L3
```
Casual:
"wait a sec then" / "give it a sec" / "hold on a tick"
"after a heartbeat" / "in a jiffy" / "in two shakes"
"in a bit" / "in a moment" / "in a minute"
"give it a hot second" / "a beat after" / "a tick after"

Onomatopoeic:
"tick-tock then" / "pause-then-go" / "wait-wait-go"
"hold-then-do" / "pause-fire"

Modern:
"after a sec" / "in two ticks" / "momentarily"
"after a bit" / "give it a moment"
```

#### L4
```
"like a splash screen" / "auto-advance like onboarding"
"timed reveal" / "auto-dismiss after [N] seconds"
"self-closing toast" / "auto-redirect after success"
"loading state auto-transition" / "auto-progress"
"countdown trigger" / "timer-based action"

Specific:
"splash → home auto transition" / "toast auto-disappear"
"snackbar auto-dismiss" / "confirmation auto-close"
"intro animation auto-next" / "video pre-roll skip"
"slideshow auto-advance"
```

### 8.2 Korean (50+)

#### L1
```
"AFTER_TIMEOUT 3초로" / "AFTER_TIMEOUT timeout: 3000ms"
"3000밀리초 후 타임아웃" / "타임아웃 3초로 설정"
"자동 발화 3초" / "delay 3.0초" / "timed trigger 3.0"
"3초 타이머"
```

#### L2
```
시간 표현:
N초 후에 / N초 뒤에 / N초 지나면 / N초 지나서
N분 후에 / N분 뒤에 / 잠시 후 / 잠시 후에 / 잠깐 후
자동으로 / 자동 진행 / 일정 시간 후 / 지연 후
"시간이 지나면" / "기다린 후에" / "기다리고 있으면"

문장 패턴:
"3초 후 ~로" / "잠시 기다리면" / "잠깐 있으면"
"좀 있으면" / "조금 있으면" / "기다리다 보면"
"한참 있으면" / "잠시 기다린 후" / "몇 초 지나면"
"수초 후에"

부사형:
"잠시 후 자동으로" / "몇 초 있다가" / "잠깐만 있으면"
"잠깐 후" / "조금 후" / "바로 후"
```

#### L3
```
캐주얼:
"조금 있다가" / "조금 있으면" / "잠깐 있다가" / "잠깐 있으면"
"좀 있다가" / "좀 있으면" / "한참 있으면" / "한참 후"
"기다려 봐" / "기다리고 있어" / "잠깐만 기다려"
"잠시만 기다려" / "좀만 기다려"

의성어:
"똑딱똑딱 후" / "똑딱 후" / "째깍 후"
"잠깐 똑딱" / "띵 후" / "띵동 후"

MZ:
"좀 있다 알아서" / "잠깐만, 그리고" / "좀 후에 자동으로"
"몇 초 있다 알아서" / "멍 때리고 있으면" / "기다리고 있으면 알아서"
```

#### L4
```
"스플래시 화면처럼" / "자동으로 다음으로"
"토스트 자동 닫기처럼" / "스낵바 자동 사라지듯"
"온보딩 자동 진행" / "자동 리다이렉트"
"인트로 자동 다음" / "카운트다운 후" / "타이머 끝나고"

구체:
"스플래시 → 홈 자동 전환" / "토스트 자동 소멸"
"성공 후 자동 이동" / "로딩 완료 후 자동"
"광고 자동 스킵" / "슬라이드쇼 자동 진행"
```

---

## 9. MOUSE_DOWN / MOUSE_UP — 마우스 누름/뗌

**Outputs:**
- `{ type: "MOUSE_DOWN", delay: number }`
- `{ type: "MOUSE_UP", delay: number }`

One-way fires on press start / release. Often used together.

### 9.1 MOUSE_DOWN English (40+)
```
L1: "MOUSE_DOWN" / "mouse down trigger" / "on press down"
    "mousedown event" / "press-start trigger" / "delay: 0 mouse down"

L2: press start / press initiation / press begin
    "on press start" / "when pressed (start)" / "the moment you click"
    "click down" / "finger down" / "button down"
    "when mouse goes down" / "as soon as pressed" / "on initial press"
    "on mousedown" / "press in" / "down stroke" / "primary down"

L3: "press it down" / "the moment you click" / "the instant you press"
    "finger touches down" / "click contact" / "first press"
    "initial touch" / "down stroke"
    Casual: "smack it down" / "hit it down" / "press start" / "the down click"

L4: "open dropdown on mouse down" / "feedback as press starts"
    "engaging press" / "piano key down" / "trigger pull"
    "shutter button half-press"
```

### 9.2 MOUSE_DOWN Korean (40+)
```
L1: "MOUSE_DOWN으로" / "마우스 다운 트리거"
    "누름 시작 트리거" / "delay 0 마우스 다운"

L2: 누르는 순간 / 누르기 시작할 때 / 누름 시작 / 누름이 시작될 때
    프레스 시작 / 클릭 다운 / 마우스 다운
    손가락 닿는 순간 / 손가락 내려놓는 순간
    마우스 누를 때 / 마우스 누름
    처음 누를 때 / 누르자마자 / 누르자말자 / 누르면 바로
    다운 시 / 누름 시 / "마우스 키 다운 순간" / "누름 즉시" / "누름 발생 시"

L3: "딱 누르는 순간" / "딱 닿는 순간" / "손가락 닿자마자"
    "손가락 닿는 즉시" / "눌리는 순간" / "눌리자마자"
    "마우스 키 닿는 순간" / "버튼 누르자마자" / "처음 닿는 순간"
    캐주얼: "누르는 순간 바로" / "누르자마자" / "닿자마자"
            "콱 누른 순간" / "탁 누른 순간"

L4: "드롭다운 열기처럼" / "눌림과 동시에 피드백"
    "피아노 키 누름" / "셔터 반셔터" / "방아쇠 당김 시작"
```

### 9.3 MOUSE_UP English (40+)
```
L1: "MOUSE_UP" / "mouse up trigger" / "on release"
    "mouseup event" / "release trigger" / "delay: 0 mouse up"

L2: release / "on release" / "when released"
    "finger lifts" / "finger up" / "finger off"
    "mouse lifts" / "mouse up" / "let go" / "letting go"
    "after release" / "release moment" / "on release of mouse"
    "upon release" / "button up" / "key up"
    "lift off" / "primary up" / "release click" / "end of press"

L3: "let go of it" / "lift off" / "release the click"
    "finger up" / "the up stroke" / "the moment you release"
    "once released" / "after letting go"
    Casual: "unhit" / "unclick" / "release-grip" / "finger lift-off"

L4: "drop point" / "release confirmation" / "drag-and-drop release"
    "piano key release" / "shutter button release" / "trigger release"
    "menu select moment (after MOUSE_DOWN open)"
```

### 9.4 MOUSE_UP Korean (40+)
```
L1: "MOUSE_UP으로" / "마우스 업 트리거"
    "릴리즈 트리거" / "delay 0 마우스 업"

L2: 떼면 / 떼었을 때 / 떼는 순간
    손가락 떼면 / 손가락 떼었을 때 / 마우스 떼면 / 마우스를 떼면
    릴리즈 / 릴리즈 시 / 풀면 / 놓으면 / 놓을 때
    마우스 키 떼면 / 릴리즈 순간 / 떼었을 때
    "눌렀다 떼면" / "손가락 들어올리면" / "마우스 들면"
    업 시 / 떼는 시점

L3: "손가락 떼는 순간" / "딱 떼면" / "마우스 풀면" / "탁 놓으면"
    "손가락 들어올리는 순간" / "마우스 들어올리면" / "엄지 떼면"
    캐주얼: "손가락 뗌" / "마우스 떼" / "놓으면" / "풀면"
            "확 떼" / "탁 떼"

L4: "드래그앤드롭 완료처럼" / "메뉴 선택처럼"
    "피아노 키 뗌" / "셔터 풀 누름 후 뗌" / "방아쇠 풀림"
```

---

## 10. MOUSE_ENTER / MOUSE_LEAVE — 영구 호버

**Outputs:**
- `{ type: "MOUSE_ENTER", delay: number, deprecatedVersion: boolean }`
- `{ type: "MOUSE_LEAVE", delay: number, deprecatedVersion: boolean }`

One-way (permanent), no auto-revert. **Distinct from ON_HOVER.**

### 10.1 MOUSE_ENTER English (40+)
```
L1: "MOUSE_ENTER" / "mouse enter trigger" / "permanent hover-enter"
    "one-way hover" / "non-reverting hover" / "sticky hover"
    "persistent hover" / "deprecatedVersion: false MOUSE_ENTER"

L2: Core: "mouse enter" / "on mouse enter" / "when cursor enters"
    "when mouse enters" / "on cursor entry" / "when mouse comes in"
    "cursor enters area" / "mouse enters region" / "on enter"
    
    Persistence markers: "permanent on hover" / "stay on hover"
    "stays open after hover" / "open on enter (stays)"
    "hover-to-open" / "hover and stays" / "sticky open"
    
    Key signals:
    "permanently show" → MOUSE_ENTER
    "stays open after hovering" → MOUSE_ENTER
    "open menu on hover, close on click" → MOUSE_ENTER
    "hover opens it, must click to close" → MOUSE_ENTER

L3: "as mouse comes in" / "cursor walks in" / "cursor enters territory"
    "once cursor crosses in" / "once mouse arrives" / "upon entry"
    Casual: "when mouse pulls up" / "when cursor rolls in" / "mouse strolling in"

L4: "hover-to-open menu (stays open)" / "permanent reveal"
    "sticky tooltip" / "latching hover" / "hover-and-stay"
    "like macOS dock magnification (sticky)" / "like dropdown that hovers open"
```

### 10.2 MOUSE_ENTER Korean (40+)
```
L1: "MOUSE_ENTER로" / "마우스 엔터 트리거"
    "영구 호버" / "단방향 호버" / "고정 호버" / "스티키 호버"
    "deprecatedVersion: false 마우스 엔터" / "비복귀 호버"

L2: 마우스 들어오면 / 마우스 들어올 때
    커서 들어오면 / 커서 들어올 때
    마우스 진입 / 마우스 진입 시 / 커서 진입 / 커서 진입 시
    "커서가 들어왔을 때" / "마우스가 들어왔을 때"
    
    영속성 마커:
    "영구적 호버" / "영구 호버" / "한 번 들어오면 유지"
    "호버 후 유지" / "호버해서 열고 클릭으로 닫기"
    "호버로 열고 유지" / "마우스 떼도 그대로"
    "마우스 빠져도 유지" / "호버 후 닫지 않음"
    
    핵심 시그널:
    "한번 호버하면 계속 열려있게" → MOUSE_ENTER
    "마우스 떼도 그대로" → MOUSE_ENTER
    "호버로 열고 클릭으로 닫게" → MOUSE_ENTER
    "마우스 빠져도 안 닫히게" → MOUSE_ENTER

L3: "커서 들어오는 순간" / "마우스 진입하는 순간"
    "마우스 도착하면" / "마우스 닿으면 계속 보여"
    "커서 들어오면 그대로"

L4: "호버 메뉴 영구 표시" / "호버로 열고 클릭으로 닫기"
    "고정 툴팁" / "걸어두는 호버"
    "맥 도크 확대처럼 (고정)" / "호버 드롭다운 유지"
```

### 10.3 MOUSE_LEAVE English (30+)
```
L1: "MOUSE_LEAVE" / "mouse leave trigger" / "on cursor exit" / "exit trigger"

L2: "mouse leaves" / "when mouse leaves" / "when cursor leaves"
    "on cursor exit" / "on mouse exit" / "cursor leaves area"
    "close on leave" / "hide on exit" / "auto-close on mouse exit"
    "dismiss on cursor leave"

L3: "as mouse goes away" / "cursor walks out" / "as cursor exits"
    "once cursor leaves" / "upon exit"

L4: "auto-close on exit" / "dismiss on leave"
    "hide when cursor leaves" / "close when cursor moves away"
```

### 10.4 MOUSE_LEAVE Korean (30+)
```
L1: "MOUSE_LEAVE로" / "마우스 리브 트리거" / "커서 나감 트리거" / "이탈 트리거"

L2: "마우스 나가면" / "마우스 빠지면" / "마우스 떠나면"
    "커서 나가면" / "커서 빠지면" / "마우스 이탈" / "마우스 이탈 시"
    "커서 벗어나면" / "마우스 벗어나면" / "마우스 떠날 때"
    "커서 떠날 때" / "마우스 나갈 때"

L3: "커서 벗어나는 순간" / "마우스 빠지는 순간"
    "커서 사라지는 순간" / "마우스 멀어지면"

L4: "메뉴 자동 닫기처럼" / "프리뷰 자동 숨김"
    "마우스 떠나면 닫기" / "호버 떠나면 사라지기"
```

---

## 11. ON_KEY_DOWN — 키보드/게임패드

**Output:**
```typescript
{ 
  type: "ON_KEY_DOWN", 
  device: "KEYBOARD" | "XBOX_ONE" | "PS4" | "SWITCH_PRO" | "UNKNOWN_CONTROLLER",
  keyCodes: number[]
}
```

### 11.1 Trigger Detection Signals

#### English
```
Key mentions:
"key" / "keys" / "keyboard" / "kb" / "keypress" / "keystroke"
"shortcut" / "keyboard shortcut" / "hotkey" / "key combo"
"keyboard combo" / "key combination" / "keybind" / "key binding"

Specific keys:
"Enter" / "Return" / "↵" / "Space" / "Spacebar"
"ESC" / "Escape" / "Tab" / "Backspace" / "Delete"
"Arrow keys" / "arrows" / "up arrow" / "down arrow"
"Cmd" / "Ctrl" / "Alt" / "Shift" / "Win" / "Meta"
"F1" through "F12"

Combos:
"Cmd+K" / "⌘K" / "Ctrl+S" / "Shift+Enter"
"Alt+Tab" / "Cmd+Shift+P" / "slash key" / "/"

Gamepad:
"controller" / "gamepad" / "joystick"
"Xbox" / "PlayStation" / "PS" / "Nintendo" / "Switch"
"A button" / "B button" / "X button" / "Y button"
"Square" / "Circle" / "Triangle" / "Cross"
"L1" / "R1" / "L2" / "R2" / "LB" / "RB"
"D-pad" / "left stick" / "right stick"
"Start" / "Select" / "Menu" / "View"
```

#### Korean
```
키 관련:
"키" / "키를" / "키보드" / "단축키"
"키 누르면" / "키 입력" / "키 조합" / "키 콤보"
"핫키" / "키바인딩"

특정 키:
"엔터" / "엔터키" / "리턴키" / "스페이스" / "스페이스바" / "공백키"
"이스케이프" / "에스크" / "ESC" / "취소키" / "탭" / "탭키"
"백스페이스" / "딜리트" / "삭제키"
"방향키" / "화살표키" / "위로키" / "아래로키"
"커맨드" / "컨트롤" / "알트" / "시프트" / "윈도우키"
"F1" ~ "F12"

조합:
"커맨드+K" / "Cmd+K" / "⌘K" / "컨트롤+S" / "Ctrl+S"
"시프트+엔터" / "알트+탭" / "커맨드+시프트+P"
"슬래시키" / "/"

게임패드:
"컨트롤러" / "게임패드" / "조이스틱"
"엑박" / "엑스박스" / "Xbox"
"플스" / "플레이스테이션" / "PS" / "닌텐도" / "스위치"
"A 버튼" / "B 버튼" / "X 버튼" / "Y 버튼"
"세모" / "네모" / "동그라미" / "엑스"
"트리거 버튼" / "십자키" / "D-pad"
"좌측 스틱" / "우측 스틱" / "스타트 버튼" / "셀렉트 버튼" / "메뉴 버튼"
```

### 11.2 Single-key Mapping Table

| Natural Language (EN) | 자연어 (KO) | keyCode |
|---|---|---|
| Enter / Return | 엔터 / 리턴 | `13` |
| Space / Spacebar | 스페이스 / 스페이스바 | `32` |
| Escape / ESC | 이스케이프 / 에스크 / 취소 | `27` |
| Tab | 탭 | `9` |
| Backspace | 백스페이스 / 지우기 | `8` |
| Delete | 딜리트 / 삭제 | `46` |
| Shift | 시프트 | `16` |
| Ctrl | 컨트롤 | `17` |
| Alt / Option | 알트 / 옵션 | `18` |
| Cmd / Meta | 커맨드 / 메타 / 윈도우 | `91` |
| ← Left | 왼쪽 / 좌측 / 왼쪽 화살표 | `37` |
| ↑ Up | 위 / 위쪽 / 위로 화살표 | `38` |
| → Right | 오른쪽 / 우측 / 우측 화살표 | `39` |
| ↓ Down | 아래 / 아래쪽 / 아래로 화살표 | `40` |
| `/` Slash | 슬래시 / 빗금 | `191` |

```
Letters A-Z: 65-90 (A=65, K=75, S=83, Z=90)
Numbers 0-9: 48-57 (0=48, 9=57)
Numpad 0-9: 96-105
Function: F1=112, F2=113, ..., F12=123
```

### 11.3 Common Shortcuts → keyCodes Array

| Shortcut | English | 한국어 | keyCodes |
|---|---|---|---|
| Cmd+K | "Cmd+K" / "⌘K" | "커맨드+K" | `[91, 75]` |
| Cmd+Enter | "Cmd+Enter" | "커맨드+엔터" | `[91, 13]` |
| Ctrl+S | "Ctrl+S" / "save" | "컨트롤+S" / "저장" | `[17, 83]` |
| Shift+Enter | "Shift+Enter" | "시프트+엔터" | `[16, 13]` |
| Cmd+Shift+P | "command palette" | "명령 팔레트" | `[91, 16, 80]` |
| Cmd+/ | "Cmd+/" / "help" | "도움말" | `[91, 191]` |
| Cmd+Z | "undo" | "실행취소" | `[91, 90]` |
| Cmd+Shift+Z | "redo" | "다시실행" | `[91, 16, 90]` |
| Cmd+C / V / X | "copy" / "paste" / "cut" | "복사" / "붙여넣기" / "잘라내기" | `[91, 67]` / `[91, 86]` / `[91, 88]` |
| Cmd+A | "select all" | "전체선택" | `[91, 65]` |
| Cmd+F | "find" | "찾기" | `[91, 70]` |

### 11.4 Device Selection Logic

```
"controller" / "gamepad" / "joystick" + specific:
- "Xbox" / "엑박" → XBOX_ONE
- "PS" / "PlayStation" / "플스" → PS4
- "Nintendo" / "Switch" / "닌텐도" / "스위치" → SWITCH_PRO
- generic "controller" → XBOX_ONE (default)
- unknown → UNKNOWN_CONTROLLER

key/shortcut without controller → KEYBOARD
```

---

## 12. ON_MEDIA_END / ON_MEDIA_HIT — 미디어

### 12.1 ON_MEDIA_END

**Output:** `{ type: "ON_MEDIA_END" }`  
**Behavior:** Fires when video/audio finishes playing.

#### English (30+)
```
L1: "ON_MEDIA_END" / "on media end" / "media end trigger"
    "video end event" / "audio end event"

L2: "when video ends" / "when video finishes" / "after video plays"
    "when audio ends" / "when audio finishes"
    "playback complete" / "playback finished"
    "media completion" / "video done" / "audio done"
    "clip ends" / "film ends" / "movie ends"
    "track ends" / "song ends"
    "after the clip finishes" / "once video plays through"

L3: "when video's done" / "after the clip plays"
    "once it's done playing" / "video runs out"
    "when it ends" / "film wraps up"

L4: "auto-next after intro video" / "skip after ad ends"
    "continue after splash video" / "go on after tutorial video"
```

#### Korean (30+)
```
L1: "ON_MEDIA_END로" / "온 미디어 엔드"
    "비디오 종료 트리거" / "미디어 종료 이벤트"

L2: "비디오 끝나면" / "영상 끝나면" / "동영상 끝나면"
    "오디오 끝나면" / "소리 끝나면" / "재생 끝나면" / "재생 완료되면"
    "재생이 끝났을 때" / "동영상이 끝났을 때" / "미디어 종료 시"
    "영상 다 보면" / "비디오 다 보면" / "음악 끝나면" / "노래 끝나면"
    "클립 끝나면" / "플레이백 끝나면" / "재생 종료" / "끝났을 때"

L3: "다 보고 나면" / "다 듣고 나면" / "끝나면 자동으로"
    "영상 마치면" / "비디오 끝까지 봤을 때" / "재생 다 됐을 때"

L4: "인트로 영상 후 자동 진행" / "광고 후 다음"
    "스플래시 비디오 후 홈" / "튜토리얼 영상 후 다음 단계"
```

### 12.2 ON_MEDIA_HIT

**Output:** `{ type: "ON_MEDIA_HIT", mediaHitTime: number }` (seconds)  
**Behavior:** Fires when video reaches specified timestamp.

#### English (30+)
```
L1: "ON_MEDIA_HIT at 5 seconds" / "mediaHitTime: 5.0"
    "video timestamp trigger"

L2: "when video hits 5s" / "at 5 seconds into video"
    "at 30 seconds in video" / "video at timestamp [N]"
    "at video time [N]" / "when video reaches [N]s"
    "when audio hits [N] seconds" / "timestamp trigger at"
    "at [N] second mark" / "at [N]:00 in video"

L3: "5 seconds in" / "halfway through video"
    "after 30 seconds of video" / "around the 1 minute mark"

L4: "video ad break overlay" / "subtitle moment"
    "interactive video moment" / "video CTA insertion"
    "timed video overlay" / "chapter point"
```

#### Korean (30+)
```
L1: "ON_MEDIA_HIT 5초로" / "mediaHitTime: 5.0"
    "비디오 시점 트리거" / "타임스탬프 트리거"

L2: "비디오 5초 시점" / "영상 5초 됐을 때"
    "비디오 5초에서" / "영상 5초에서" / "동영상 5초 지점"
    "비디오 [N]초 시점" / "영상 [N]초 지나면"
    "재생 [N]초 지점" / "비디오 [N]초 도달 시"

L3: "5초 됐을 때" / "중간 즈음에" / "30초 지나서"
    "1분 즈음에" / "비디오 중간쯤" / "영상 절반 즈음"

L4: "광고 삽입 시점처럼" / "자막 표시 시점"
    "인터랙티브 비디오 모먼트" / "비디오 CTA 시점"
    "챕터 포인트" / "학습 비디오 체크포인트"
```

---

## 13. Time Expression Mapping / 시간 표현

For AFTER_TIMEOUT and ON_MEDIA_HIT.

### 13.1 Precise Time → seconds

```
EN:
"1 second" → 1.0
"0.5 seconds" / "half second" / "500ms" → 0.5
"3 seconds" → 3.0
"5 seconds" → 5.0
"10 seconds" → 10.0
"1 minute" / "60 seconds" → 60.0
"1.5 seconds" → 1.5
"2 and a half" → 2.5
"100ms" / "0.1s" → 0.1
"a quarter second" → 0.25

KO:
"1초" → 1.0
"0.5초" / "반초" → 0.5
"3초" → 3.0 / "5초" → 5.0 / "10초" → 10.0
"1분" → 60.0
"1.5초" / "1초 반" → 1.5
"2.5초" / "2초 반" → 2.5
"100ms" / "0.1초" → 0.1
"4분의 1초" → 0.25
```

### 13.2 Vague Time → Suggested seconds

```
EN:
"a moment" / "a sec" / "a beat" → 1.0
"a brief moment" / "quick pause" → 0.5
"shortly" / "soon" → 1.0
"after a bit" / "in a bit" → 2.0
"a few seconds" → 3.0
"after a while" → 5.0 (warn user)
"momentarily" → 1.0
"in a jiffy" / "in two shakes" → 0.5

KO:
"잠깐" → 0.5
"잠시" → 1.0
"잠시만" → 1.5
"조금 있다가" → 2.0
"좀 있다가" → 2.5
"몇 초 후" → 3.0
"한참 후" → 5.0 (사용자 확인)
"오래 후" → 사용자 명확화 필요
"조금만" → 0.5 ~ 1.0
"잠깐만" → 0.5
"한숨 돌리고" → 2.0
"좀 있으면" → 3.0
```

### 13.3 Validation

```
[ ] timeout > 0 (otherwise use instant)
[ ] timeout < 10 seconds (warn if longer)
[ ] timeout < 0.5s on entry → warn (may feel premature)
[ ] If user says "한참" / "after a while" without number → ask for clarification
[ ] If user says "곧" / "soon" → default 1.0s with note
```

---

## 14. Context-based Inference / 컨텍스트 추론

### 14.1 Mobile vs Desktop Detection

```
Mobile signals:
EN: "tap", "swipe", "finger", "touchscreen", "iOS", "Android", "phone", "mobile"
KO: "탭", "스와이프", "손가락", "터치스크린", "아이폰", "안드로이드", "모바일"

If mobile:
- "press" likely means tap → ON_CLICK
- "hover" doesn't exist on mobile, warn user
- MOUSE_* triggers don't work, warn user
- ON_PRESS preferred for long-press

Desktop signals:
EN: "click", "hover", "mouse", "cursor", "keyboard", "shortcut"
KO: "클릭", "호버", "마우스", "커서", "키보드", "단축키"
```

### 14.2 Persistence Inference

```
Persistence signals (→ MOUSE_ENTER):
EN: "stays", "stay", "permanent", "permanently", "remains", "sticky"
KO: "유지", "계속", "영구", "영구적", "그대로", "남아있", "고정"

Non-persistence signals (→ ON_HOVER):
EN: "while", "during", "as long as", "temporarily", "auto-revert"
KO: "동안", "중", "잠깐", "잠시", "잠시만", "자동 복귀", "원복"
```

### 14.3 Hover Ambiguity Resolution

The most common ambiguity. Decision logic:

```
"hover" / "호버" alone:
- Tooltip-like → ON_HOVER (default)
- Menu → ask: does it stay or revert?
- Preview → ON_HOVER (typical)
- Default fallback → ON_HOVER

"hover but stays" / "호버 후 유지" → MOUSE_ENTER
"hover and reverts" / "호버 떼면 원복" → ON_HOVER
"mouse over" / "마우스 오버" → slight lean MOUSE_ENTER but ambiguous
```

### 14.4 Click vs Press Disambiguation

```
"press" / "누르면" without duration signal → ON_CLICK
"press" + "hold/while/long/꾹/길게" → ON_PRESS (round-trip)
"press the moment it touches" / "누르는 순간" → MOUSE_DOWN
"press then release" / "눌렀다 떼면" → ON_CLICK (default) or MOUSE_UP if release is emphasized
```

### 14.5 Drag Continuity Inference

```
Continuous drag (full ON_DRAG):
EN: "drag", "continuously", "scrubbing", "panning"
KO: "드래그", "쭉", "계속", "끌면서"

Discrete swipe (ON_DRAG with snap):
EN: "swipe to", "swipe-to-dismiss", "flick"
KO: "스와이프해서", "휙 밀어서", "옆으로 휙"

Both map to ON_DRAG but the destination behavior differs.
```

### 14.6 Time vs Click Inference

```
If both time and click mentioned:
"after 3 seconds, click to skip" 
  → Primary: AFTER_TIMEOUT (auto)
  → Secondary: ON_CLICK (manual override)
  → Create TWO separate reactions

"click and after 5 seconds"
  → Same: two reactions for same destination
```

---

## 15. Validation Checklist / 검증 체크리스트

### 15.1 Trigger Schema Validation

```
[ ] trigger.type ∈ 12 valid values:
    ON_CLICK | ON_HOVER | ON_PRESS | ON_DRAG | ON_MEDIA_END |
    AFTER_TIMEOUT | MOUSE_UP | MOUSE_DOWN | MOUSE_ENTER | MOUSE_LEAVE |
    ON_KEY_DOWN | ON_MEDIA_HIT

[ ] AFTER_TIMEOUT: timeout > 0 (seconds)
[ ] MOUSE_UP/DOWN: delay >= 0
[ ] MOUSE_ENTER/LEAVE: delay, deprecatedVersion present
[ ] ON_KEY_DOWN: device valid, keyCodes non-empty
[ ] ON_MEDIA_HIT: mediaHitTime >= 0
```

### 15.2 Trigger Semantic Validation

```
[ ] Round-trip vs one-way matches user intent:
    - "while hovering" → ON_HOVER (round-trip)
    - "stays open" → MOUSE_ENTER (one-way)

[ ] AFTER_TIMEOUT value reasonable:
    - < 0.5s → warn (may feel like instant)
    - > 10s → warn (may feel broken)

[ ] ON_KEY_DOWN keyCodes valid:
    - Don't conflict with system shortcuts (Cmd+Q, Cmd+W)
    - Combos should be modifier+key (not multiple letters)

[ ] ON_MEDIA_HIT only when frame contains video/audio
[ ] ON_MEDIA_END only when frame contains video/audio
[ ] ON_HOVER, MOUSE_* not used on mobile-only prototypes
[ ] ON_DRAG behavior matches intent (continuous vs discrete)
```

### 15.3 Trigger + Action Compatibility

```
[ ] If trigger is ON_HOVER or ON_PRESS (round-trip):
    [ ] Action should be NAVIGATE or OPEN_OVERLAY (revertible)
    [ ] Avoid SET_VARIABLE (won't revert as expected)

[ ] If trigger is MOUSE_ENTER (one-way):
    [ ] Pair with separate MOUSE_LEAVE or click handler

[ ] If trigger is AFTER_TIMEOUT:
    [ ] Frame should be a "waiting" state (splash, loading, toast)
    [ ] Avoid combining with ON_CLICK on same frame

[ ] If trigger is ON_KEY_DOWN:
    [ ] User confirmation needed if keys could conflict
```

---

## 16. LLM System Prompt / LLM 프롬프트

```
You are detecting the Trigger from natural language input for Figma Prototype Reactions.
Output must conform to Figma's Plugin API Trigger type.

# CRITICAL CONSTRAINTS
Valid trigger.type values (12):
- Simple (no params): ON_CLICK | ON_HOVER | ON_PRESS | ON_DRAG | ON_MEDIA_END
- With timeout: AFTER_TIMEOUT (timeout: seconds)
- With delay: MOUSE_UP | MOUSE_DOWN (delay: seconds)
- With delay + deprecatedVersion: MOUSE_ENTER | MOUSE_LEAVE
- Keyboard/Gamepad: ON_KEY_DOWN (device, keyCodes[])
- Media timestamp: ON_MEDIA_HIT (mediaHitTime: seconds)

# Behavior Rules
ROUND-TRIP (auto-revert): ON_HOVER, ON_PRESS
ONE-WAY (permanent): All others

# Detection: Use 5-Signal Model
Signal 1: Action verb — click/hover/drag/press/누르면/끌면
Signal 2: Duration modifier — while/during/동안
Signal 3: Temporality — after/when/할 때/후
Signal 4: Device hint — keyboard/video/finger/마우스/키보드
Signal 5: Persistence — stays/permanent/유지

# Key Disambiguations
1. "press" / "누르면" → ON_CLICK unless "hold/while/long/꾹/길게" → ON_PRESS
2. "hover" / "호버" → ON_HOVER unless persistence signal → MOUSE_ENTER
3. "tap"/"click"/"누르면" without time signal → ON_CLICK
4. "drag"/"swipe"/"끌면" → ON_DRAG (not PUSH transition)
5. Number + "seconds/초" with no click verb → AFTER_TIMEOUT
6. "key"/"shortcut"/"키"/"단축키" → ON_KEY_DOWN
7. "video"/"영상" + "ends/끝" → ON_MEDIA_END
8. "video"/"영상" + specific time → ON_MEDIA_HIT

# Output Format
{
  detected_language: "ko" | "en" | "bilingual",
  detected_level: "L1" | "L2" | "L3" | "L4",
  detected_signals: { ... },
  trigger: {
    type: "...",  // Figma valid
    // include required params per type
  },
  reasoning: "...",
  confirmation_message: "..."  // in user's language
}

# Hand-off to Animation Dictionary
After detecting the trigger, hand off to the Animation Dictionary 
(sister document v2.7.1) for transition/easing/duration/direction mapping.
```

---

## 17. Cross-document Disambiguation / 자매 문서 간 충돌 해소

★ NEW in v2.7.1: Resolves ambiguities between Trigger and Animation dictionaries.

자매 문서(Animation Dictionary)와 같은 자연어 어휘가 다른 의미로 매핑될 수 있어요. 이 섹션은 그 충돌을 해소합니다.

### 17.1 Time Expression Conflict / 시간 표현 충돌

The most critical disambiguation. Same word means different things in different dimensions.

같은 단어가 두 차원에서 다른 의미를 가집니다.

| Expression | In Trigger (AFTER_TIMEOUT) | In Animation (Duration) |
|---|---|---|
| "잠깐" / "a moment" | 0.5초 (when to fire) | rarely used here |
| "한참" / "a while" | 5.0초 (when to fire) | XXL (0.6s+, how long animation) |
| "오래" / "long" | 5.0초+ (when to fire) | XL or XXL (how long animation) |
| "잠시" / "briefly" | 1.0초 (when to fire) | rarely used here |
| "곧" / "soon" | 1.0초 (when to fire) | not used here |

### 17.2 Disambiguation Decision Rules

```
Rule 1: Sentence position
- "X 후에 [동작]" / "after X, [verb]" → Time = Trigger (AFTER_TIMEOUT)
  Example: "한참 후에 사라져" → AFTER_TIMEOUT 5s + fade
  
- "[동작] X (속도/스타일)" / "[verb] X (speed)" → Time = Animation
  Example: "한참 천천히 사라져" → DISSOLVE + XL/XXL Duration

Rule 2: Verb proximity
- Time expression closer to "후에/지나면/뒤에" → Trigger
  Example: "잠깐 있다가 사라져" → "잠깐 있다가" = AFTER_TIMEOUT 0.5s
  
- Time expression closer to verb of motion → Animation
  Example: "잠깐 부드럽게 사라져" → "부드럽게" 강조, "잠깐"은 약화 부사
              → DISSOLVE + LG duration

Rule 3: Compound expression
- "X 후에 Y 천천히" → Both (Trigger: X seconds, Animation: Y速度)
  Example: "3초 후에 천천히 사라져" 
  → AFTER_TIMEOUT timeout: 3.0
  → DISSOLVE + EASE_OUT + XL (0.4s)
```

### 17.3 Common Disambiguation Examples

```
"3초 후에 사라져"
  Trigger: AFTER_TIMEOUT timeout: 3.0
  Animation: DISSOLVE + EASE_IN + md (default for fade-out)

"천천히 사라져"
  Trigger: (depends on parent context, often ON_CLICK)
  Animation: DISSOLVE + EASE_IN + XL (0.4s)

"한참 후에 천천히 등장"
  Trigger: AFTER_TIMEOUT timeout: 5.0
  Animation: DISSOLVE + EASE_OUT + XL (0.4s)

"잠깐 떴다가 사라져"
  Trigger: AFTER_TIMEOUT timeout: 0.5 (after appearing)
  Animation: DISSOLVE + EASE_IN + sm/md (quick fade out)
```

### 17.4 Onomatopoeia Cross-domain (의태어/의성어 교차 등장)

Same onomatopoeia can appear in both dictionaries with different semantic roles.

| Expression | In Trigger | In Animation |
|---|---|---|
| "휙" / "whoosh" | ON_DRAG (drag gesture) | XS Duration + EASE_IN |
| "확" / "yank" | ON_DRAG (forceful drag) | sm Duration (intensifier) |
| "쓱" / "swipe" | ON_DRAG (swipe gesture) | sm-md Duration |
| "탁" / "tap" | ON_CLICK (tap) | xs Duration (intensifier) |
| "톡" / "poke" | ON_CLICK (light tap) | sm Duration (intensifier) |

### 17.5 Onomatopoeia Disambiguation Rules

```
Rule 1: Is it the main verb or a modifier?
- "휙 사라져" → "사라져"가 동사, "휙"은 modifier
  → Trigger: (parent context, e.g. ON_CLICK)
  → Animation: DISSOLVE + EASE_IN + XS (휙 modifies speed)

- "휙 밀어" → "밀어"가 drag 동사, "휙"은 manner
  → Trigger: ON_DRAG
  → Animation: SMART_ANIMATE + EASE_OUT + sm

Rule 2: Object of action
- If object is direction (옆으로 휙, 위로 휙) → likely ON_DRAG trigger
- If object is state (휙 사라져, 휙 등장) → modifier for Animation

Rule 3: Action verb context
- Drag/swipe verbs (밀어, 끌어, 던져) + onomatopoeia → ON_DRAG
- State change verbs (사라져, 나타나, 변해) + onomatopoeia → Animation modifier
```

### 17.6 Persistence Cross-document Note

"호버" (hover) appears in both contexts but the trigger choice affects the animation defaults:

- **ON_HOVER** (round-trip) → typically short Duration (sm/md) + EASE_OUT
- **MOUSE_ENTER** (one-way) → can have longer Duration (md/lg) + EASE_OUT
- **ON_PRESS** (round-trip) → typically md Duration + EASE_OUT

This isn't a conflict, but a useful pairing rule for the LLM.

---

## 18. Combined Patterns (with Animation) / 복합 패턴

★ NEW in v2.7.1: Brief reference of Trigger + Animation combinations.

For full Animation details (Easing/Transition/Direction), refer to Animation Dictionary v2.7.1.

Trigger + Animation 조합 예시. 전체 Animation 세부는 자매 문서 참조.

### 18.1 Common Patterns (Trigger + Animation Brief)

```typescript
// 1. Button click → next page (iOS-style)
{
  trigger: { type: "ON_CLICK" },
  // Animation: PUSH (LEFT) + EASE_IN_AND_OUT + 0.35s
}

// 2. Hover preview (auto-revert)
{
  trigger: { type: "ON_HOVER" },
  // Animation: DISSOLVE + EASE_OUT + 0.15s
}

// 3. Long-press preview (round-trip)
{
  trigger: { type: "ON_PRESS" },
  // Animation: DISSOLVE + EASE_OUT + 0.2s
}

// 4. Swipe to delete
{
  trigger: { type: "ON_DRAG" },
  // Animation: SMART_ANIMATE + EASE_OUT + 0.2s
}

// 5. Splash auto-advance
{
  trigger: { type: "AFTER_TIMEOUT", timeout: 2.0 },
  // Animation: DISSOLVE + EASE_IN_AND_OUT + 0.4s
}

// 6. Toast auto-dismiss
{
  trigger: { type: "AFTER_TIMEOUT", timeout: 4.0 },
  // Animation: MOVE_OUT (BOTTOM) + EASE_IN + 0.25s
}

// 7. Permanent hover-open menu
{
  trigger: { type: "MOUSE_ENTER", delay: 0, deprecatedVersion: false },
  // Animation: DISSOLVE + EASE_OUT + 0.15s
}

// 8. Heart like (bouncy)
{
  trigger: { type: "ON_CLICK" },
  // Animation: SMART_ANIMATE + BOUNCY + 0.4s
}

// 9. Cmd+K command palette
{
  trigger: { type: "ON_KEY_DOWN", device: "KEYBOARD", keyCodes: [91, 75] },
  // Animation: DISSOLVE + EASE_OUT + 0.15s
}

// 10. Video end → next screen
{
  trigger: { type: "ON_MEDIA_END" },
  // Animation: DISSOLVE + EASE_IN_AND_OUT + 0.5s
}

// 11. Mouse down opens dropdown
{
  trigger: { type: "MOUSE_DOWN", delay: 0 },
  // Animation: MOVE_IN (TOP) + EASE_OUT + 0.2s
}

// 12. Bottom sheet rises (drag gesture)
{
  trigger: { type: "ON_DRAG" },
  // Animation: MOVE_IN (TOP) + EASE_OUT + 0.3s
}
```

### 18.2 Trigger-Animation Pairing Defaults

Quick reference for sensible defaults when Animation isn't specified.

| Trigger | Default Animation | Why |
|---|---|---|
| ON_CLICK | PUSH (LEFT) + EASE_IN_AND_OUT + md | iOS default navigation |
| ON_HOVER | DISSOLVE + EASE_OUT + sm | Quick subtle preview |
| ON_PRESS | DISSOLVE + EASE_OUT + sm | Quick reveal during hold |
| ON_DRAG | SMART_ANIMATE + EASE_OUT + md | Continuous element response |
| AFTER_TIMEOUT | DISSOLVE + EASE_IN_AND_OUT + md | Subtle auto-advance |
| MOUSE_ENTER | DISSOLVE + EASE_OUT + sm | Permanent reveal |
| MOUSE_LEAVE | DISSOLVE + EASE_IN + sm | Auto-hide |
| ON_KEY_DOWN | DISSOLVE + EASE_OUT + xs | Snappy keyboard response |
| ON_MEDIA_END | DISSOLVE + EASE_IN_AND_OUT + lg | Smooth video transition |
| ON_MEDIA_HIT | DISSOLVE + EASE_OUT + sm | Quick overlay |

---

## 19. Appendix / 부록

### Appendix A: All Triggers Quick Reference (EN)

| Trigger Type | Required Params | Round-trip? | Common NL Phrases |
|---|---|---|---|
| `ON_CLICK` | — | No | click, tap, press, hit |
| `ON_HOVER` | — | **Yes** | hover, while hovering, mouseover |
| `ON_PRESS` | — | **Yes** | long-press, hold, press-and-hold |
| `ON_DRAG` | — | No (continuous) | drag, swipe, scrub, pull |
| `ON_MEDIA_END` | — | No | when video ends, after playback |
| `AFTER_TIMEOUT` | timeout (s) | No (auto) | after X seconds, after delay |
| `MOUSE_UP` | delay (s) | No | when released, on lift |
| `MOUSE_DOWN` | delay (s) | No | when pressed, on press start |
| `MOUSE_ENTER` | delay, deprecatedVersion | No | when cursor enters, permanent hover |
| `MOUSE_LEAVE` | delay, deprecatedVersion | No | when cursor leaves |
| `ON_KEY_DOWN` | device, keyCodes[] | No | when [key] pressed, shortcut |
| `ON_MEDIA_HIT` | mediaHitTime (s) | No | at [time] in video |

### Appendix B: 모든 Trigger 빠른 참조 (한국어)

| Trigger 타입 | 필수 파라미터 | 왕복? | 자주 쓰는 표현 |
|---|---|---|---|
| `ON_CLICK` | — | X | 클릭, 탭, 누르면, 터치 |
| `ON_HOVER` | — | **O** | 호버, 호버하는 동안, 마우스 올리면 |
| `ON_PRESS` | — | **O** | 길게 누르면, 꾹 누르면, 누르고 있으면 |
| `ON_DRAG` | — | X (연속) | 드래그, 스와이프, 끌면, 밀면 |
| `ON_MEDIA_END` | — | X | 비디오 끝나면, 영상 종료 |
| `AFTER_TIMEOUT` | timeout (초) | X (자동) | N초 후에, 잠시 후, 자동으로 |
| `MOUSE_UP` | delay (초) | X | 떼면, 손가락 떼면, 마우스 떼면 |
| `MOUSE_DOWN` | delay (초) | X | 누르는 순간, 마우스 다운 |
| `MOUSE_ENTER` | delay, deprecatedVersion | X | 마우스 들어오면, 영구 호버 |
| `MOUSE_LEAVE` | delay, deprecatedVersion | X | 마우스 나가면, 커서 빠지면 |
| `ON_KEY_DOWN` | device, keyCodes[] | X | 엔터 누르면, 단축키, Cmd+K |
| `ON_MEDIA_HIT` | mediaHitTime (초) | X | 비디오 N초 시점 |

### Appendix C: Hover Disambiguation Cheatsheet

The most commonly confused area. Decision rules:

```
User says "hover" / "호버":
├─ + "while" / "하는 동안" → ON_HOVER (round-trip)
├─ + "stays open" / "유지" → MOUSE_ENTER (one-way)
├─ + "show" alone → ON_HOVER (default, common case)
├─ + "permanently" / "영구적으로" → MOUSE_ENTER
└─ + nothing → ON_HOVER (safer default)

User says "mouse enter/leave":
└─ Explicit → MOUSE_ENTER / MOUSE_LEAVE (one-way)

User says "long press" / "press and hold":
└─ ON_PRESS (round-trip, reverts on release)

User says "press" alone (ambiguous):
├─ Mobile context → likely ON_CLICK (tap)
├─ Desktop context with "hold" → ON_PRESS
└─ Default → ON_CLICK
```

### Appendix D: Reaction Examples (Trigger only — for Animation, see sister document)

```typescript
// 1. Simple click
{ trigger: { type: "ON_CLICK" }, actions: [...] }

// 2. Hover preview (round-trip)
{ trigger: { type: "ON_HOVER" }, actions: [...] }

// 3. Long-press preview (round-trip)
{ trigger: { type: "ON_PRESS" }, actions: [...] }

// 4. Drag/swipe gesture
{ trigger: { type: "ON_DRAG" }, actions: [...] }

// 5. Splash auto-advance after 2s
{ trigger: { type: "AFTER_TIMEOUT", timeout: 2.0 }, actions: [...] }

// 6. Press start on mouse-down
{ trigger: { type: "MOUSE_DOWN", delay: 0 }, actions: [...] }

// 7. Release on mouse-up
{ trigger: { type: "MOUSE_UP", delay: 0 }, actions: [...] }

// 8. Permanent hover-open
{ trigger: { type: "MOUSE_ENTER", delay: 0, deprecatedVersion: false }, actions: [...] }

// 9. Close on cursor exit
{ trigger: { type: "MOUSE_LEAVE", delay: 0, deprecatedVersion: false }, actions: [...] }

// 10. Cmd+K command palette
{ 
  trigger: { 
    type: "ON_KEY_DOWN", 
    device: "KEYBOARD", 
    keyCodes: [91, 75]
  }, 
  actions: [...] 
}

// 11. Video end → next screen
{ trigger: { type: "ON_MEDIA_END" }, actions: [...] }

// 12. Video at 30s overlay
{ trigger: { type: "ON_MEDIA_HIT", mediaHitTime: 30.0 }, actions: [...] }
```

For complete Reaction examples (including transitions), see **Animation Dictionary v2.7.1** (Part 2 of 2).

전체 Reaction 예시 (트랜지션 포함)는 **Animation Dictionary v2.7.1** (Part 2) 참조.

### Appendix E: Brand Pattern Matrix (Trigger view)

★ NEW in v2.7.1: Quick reference for how popular brands map trigger + animation.

| Brand | Common Trigger | Sister Animation (brief) |
|---|---|---|
| iOS default navigation | ON_CLICK | PUSH (LEFT) + EASE_IN_AND_OUT |
| Material 3 emphasized | ON_CLICK | SMART_ANIMATE + CUSTOM bezier |
| Instagram heart | ON_CLICK | SMART_ANIMATE + BOUNCY |
| Toss payment | ON_CLICK | PUSH (LEFT) + EASE_OUT |
| Slack message arrival | (auto/notification) | DISSOLVE + EASE_OUT |
| Notion page open | ON_CLICK | SMART_ANIMATE + EASE_IN_AND_OUT |
| Netflix intro | AFTER_TIMEOUT or ON_MEDIA_END | DISSOLVE + EASE_IN_AND_OUT |
| Game UI explosive | ON_CLICK | SMART_ANIMATE + CUSTOM_SPRING |
| Apple Pay | ON_CLICK | DISSOLVE + EASE_OUT |
| Splash screen | AFTER_TIMEOUT | DISSOLVE + EASE_IN_AND_OUT |
| Hover tooltip | ON_HOVER | DISSOLVE + EASE_OUT |
| Hold-to-preview (iOS) | ON_PRESS | DISSOLVE + EASE_OUT |
| Pull-to-refresh | ON_DRAG | SMART_ANIMATE + EASE_OUT |
| Swipe-to-delete | ON_DRAG | SMART_ANIMATE + EASE_OUT |
| Cmd+K palette | ON_KEY_DOWN | DISSOLVE + EASE_OUT |
| Hover dropdown (persistent) | MOUSE_ENTER | DISSOLVE + EASE_OUT |
| Bottom sheet | ON_CLICK or ON_DRAG | MOVE_IN (TOP) + EASE_OUT |
| Toast notification | (multiple) | MOVE_IN (BOTTOM) + QUICK spring |

For full Animation pattern details, see Animation Dictionary v2.7.1 Appendix F.

---

## Change Log / 변경 이력

- **v2.7.1** (2026-05-20): **Cross-document disambiguation added.** Section 17 resolves time-expression and onomatopoeia conflicts with Animation Dictionary. Section 18 adds Combined Patterns (brief). Appendix E adds Brand Pattern Matrix. All v2.7 vocabulary preserved.
- **v2.7** (2026-05-20): Trigger vocabulary maintained at 50-100+ per trigger. Document split into Trigger (Part 1) and Animation (Part 2).
- **v2.6** (2026-05-20): Complete consolidation of all sections in one document.
- **v2.5** (2026-05-20): Trigger vocabulary heavily expanded.
- **v2.4** (2026-05-20): Full Trigger type coverage.
- **v2.3** (2026-05-20): Figma API alignment.
- **v2.2** (2026-05-20): English vocabulary expanded.
- **v2.1** (2026-05-20): Korean vocabulary expanded.
- **v2.0** (2026-05-20): 4-level expression classification.
- **v1.0** (2026-05-19): Initial version.

---

## License / Sources

- **Figma Plugin API**: https://developers.figma.com/docs/plugins/api/Trigger/
- IBM Carbon, Google Material 3, Apple HIG, Microsoft Fluent 2, Adobe Spectrum, Atlassian, Audi UI, GitHub Primer, Uber Base, Pinterest Gestalt
