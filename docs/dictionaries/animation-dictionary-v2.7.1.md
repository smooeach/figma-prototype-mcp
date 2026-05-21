# Animation Dictionary v2.7.1 / Animation 사전 v2.7.1

> **Part 2 of 2: Animation (Duration / Easing / Transition / Direction)**
> **자연어 → Figma Prototype 애니메이션 매핑 사전**
>
> Sister document: **Trigger Dictionary v2.7.1** (Part 1 of 2)
> 자매 문서: **Trigger Dictionary v2.7.1** (Part 1)
>
> - Version: v2.7.1 (Cross-document disambiguation added)
> - Date: 2026-05-20
>
> ## What's new in v2.7.1
> - Added cross-document disambiguation rules (Section 12)
> - All vocabulary from v2.7 preserved

## What's covered here / 이 문서가 다루는 범위

This document focuses on the "**what happens**" side of a Figma Reaction — the animation properties inside `Action.transition`. For the "**when it happens**" side (Trigger), see the sister document.

이 문서는 Figma Reaction의 "**무엇이 일어나는가**" — 즉 `Action.transition` 안의 애니메이션 속성을 다룹니다. "**언제 일어나는가**" (Trigger)는 자매 문서 참조.

### Covered tokens

| Dimension | Tokens | Vocabulary per token |
|---|---|---|
| **Duration** | 7 tokens (instant/xs/sm/md/lg/xl/xxl) | 60-100/token in EN + KO |
| **Easing** | 13 Figma natives + 2 custom | 50-80/token in EN + KO |
| **Transition** | 8 Figma natives | 50-80/type in EN + KO |
| **Direction** | 4 values (LEFT/RIGHT/TOP/BOTTOM) | 30-50/direction in EN + KO |

---

## Table of Contents / 목차

1. [Figma Animation API / Figma 애니메이션 API](#1-figma-animation-api--figma-애니메이션-api)
2. [Expression Levels / 표현 레벨](#2-expression-levels--표현-레벨)
3. [Duration Dictionary / Duration 사전](#3-duration-dictionary--duration-사전)
4. [Easing Dictionary / Easing 사전](#4-easing-dictionary--easing-사전)
5. [Transition Dictionary / Transition 사전](#5-transition-dictionary--transition-사전)
6. [Direction Dictionary / 방향 사전](#6-direction-dictionary--방향-사전)
7. [Combined Patterns / 복합 패턴](#7-combined-patterns--복합-패턴)
8. [Domain Adjustments / 도메인 보정](#8-domain-adjustments--도메인-보정)
9. [Validation Checklist / 검증 체크리스트](#9-validation-checklist--검증-체크리스트)
10. [LLM System Prompt Guide / LLM 프롬프트](#10-llm-system-prompt-guide--llm-프롬프트)
11. [Appendix / 부록](#11-appendix--부록)
12. [Cross-document Disambiguation / 자매 문서 간 충돌 해소](#12-cross-document-disambiguation--자매-문서-간-충돌-해소) ★ v2.7.1 NEW

---

## 1. Figma Animation API / Figma 애니메이션 API

### 1.1 Transition Type Definition

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

### 1.2 Easing Type Definition

```typescript
interface Easing {
  type: 
    | "LINEAR"
    | "EASE_IN" | "EASE_OUT" | "EASE_IN_AND_OUT"
    | "EASE_IN_BACK" | "EASE_OUT_BACK" | "EASE_IN_AND_OUT_BACK"
    | "GENTLE" | "QUICK" | "BOUNCY" | "SLOW"  // Spring presets
    | "CUSTOM_CUBIC_BEZIER" | "CUSTOM_SPRING"
  
  easingFunctionCubicBezier?: { x1, y1, x2, y2 }
  easingFunctionSpring?: { mass, stiffness, damping, initialVelocity }
}
```

### 1.3 Critical Constraints

- **Duration is in SECONDS, not milliseconds** (convert ms ÷ 1000)
- **DirectionalTransition MUST have direction + matchLayers**
- **CUSTOM_CUBIC_BEZIER MUST have easingFunctionCubicBezier**
- **CUSTOM_SPRING MUST have easingFunctionSpring**
- For "instant" (no animation), set transition to null or omit entirely

---

## 2. Expression Levels / 표현 레벨

Same 4-level classification across all dimensions.

| Level | Characteristic | EN Example | KO Example |
|---|---|---|---|
| **L1: Precise** | API values | `"EASE_OUT 250ms"` | `"EASE_OUT 250ms"` |
| **L2: Standard** | Design terms | `"smooth"`, `"snappy"` | `"부드럽게"`, `"빠르게"` |
| **L3: Sensory** | Onomatopoeia/感覚 | `"whoosh"`, `"boing"` | `"스르륵"`, `"통통"` |
| **L4: Metaphor** | Analogies | `"like a feather"` | `"깃털처럼"` |

---

## 3. Duration Dictionary / Duration 사전

7 tokens, each with 60-100+ vocabulary entries across EN and KO.

### 3.1 Token Table

| Token | Seconds | ms | Use Case |
|---|---|---|---|
| `instant` | 0 | 0 | No animation |
| `xs` | 0.07 | 70 | Micro-interactions |
| `sm` | 0.10 | 100 | Small fades, color changes |
| `md` | 0.15 | 150 | Dropdowns, small entries |
| `lg` | 0.25 | 250 | Modals, standard transitions |
| `xl` | 0.40 | 400 | Large entries, system notifications |
| `xxl` | 0.60+ | 600+ | Celebration, onboarding |

### 3.2 INSTANT (0ms) — 즉시

#### English (60+)
```
L1 (Precise):
"0ms" / "0s" / "zero duration" / "no duration"
"instant" / "INSTANT" / "no animation"
"duration: 0" / "skip animation" / "no transition"
"hard cut" / "no easing applied"

L2 (Standard):
immediate / immediately / instantly / "at once"
"right away" / "right now" / "straight away"
"with zero delay" / "without delay" / "no delay"
"on the spot" / "this very moment"
"without hesitation"
"this instant" / "that instant"
"a moment" (in the literal sense)
abrupt / abruptly / sudden / suddenly

L3 (Sensory/Onomatopoeic):
"boom" / "bam" / "pow" / "wham"
"poof" / "snap" / "zap" / "pop"
"in a snap" / "in a flash" / "in a heartbeat"
"in a blink" / "in no time"
"in nothing flat" / "in two shakes"
"lightning fast" / "lightning quick"
"just like that"
"there and then"

L4 (Metaphorical):
"like flicking a switch"
"like blinking" / "blink-of-an-eye"
"like a camera flash"
"snap of the fingers"
"like teleporting"
"like a magic trick"
"as fast as thought"
"quicker than a thought"
"abracadabra fast"
"poof — gone"
"in a heartbeat"

Modern slang:
"on god instant" / "fr fr quick"
"deadass right now"
"no cap immediate"
"period." (as in done)
```

#### Korean (60+)
```
L1 (정밀):
"0ms" / "0초" / "0s" / "duration 0"
"즉시" / "instant" / "INSTANT"
"트랜지션 없이" / "애니메이션 없이"
"트랜지션 X" / "딜레이 0"

L2 (일반):
즉시 / 즉각 / 즉각적으로 / 즉시즉시
바로 / 곧바로 / 단번에 / 한순간에
단숨에 / 한 방에 / 한 번에
"일순간" / "찰나에" / "순식간에"
칼같이 / 칼처럼 / 칼로
바로바로 / 즉각즉각
"끝" / "끝났음" / "끝장"
"진짜 바로" / "그냥 바로" / "그대로 바로"
"망설임 없이" / "지체 없이" / "딜레이 없이"
"기다림 없이" / "쉴 틈도 없이"
"손 쓸 새도 없이"
바로 그 순간 / 그 즉시

L3 (감각적/의성어):
딱 / 딱하니 / 딱 하고
탁 / 탁하니 / 탁 하고
척 / 척하니 / 척 하고
휙 / 휙하니 / 휙 하고
짠 / 짠하니 / 짠 하고
쨘 / 쨘하니
쾅 / 쿵 / 쿠웅
빵 / 펑 / 팡
뿅 / 뽕 / 픽
"한방에" / "한 방에"
"눈 깜빡할 새"
"순식간에 휙"

L4 (비유적):
"손가락 튕기듯"
"눈 깜빡할 사이"
"스위치 켜듯"
"카메라 플래시처럼"
"마술처럼"
"순간이동처럼"
"생각의 속도로"
"사라졌다 나타나듯"
"뿅 하고 사라지듯"
"빛의 속도로"
"찰나의 순간"

MZ/구어:
"걍 바로" / "그냥 즉빵"
"바로 직진" / "지체 ㄴㄴ"
"바로 ㄱㄱ" / "당장에"
"이생망 즉시" (참고로만)
"실시간"
```

### 3.3 XS (70ms) — 마이크로 인터랙션

#### English (80+)
```
L1 (Precise):
"70ms" / "0.07s" / "0.07 seconds"
"50-70ms range" / "micro-duration"
"sub-100ms" / "imperceptibly fast"
"frame-level" / "1-2 frame motion"
"4 frames at 60fps"

L2 (Standard):
Core adjectives:
quick / quickly / swift / swiftly / fast / rapidly
rapid / brisk / briskly / nimble / agile
"super quick" / "very fast" / "really quick"
"lightning fast" / "lightning quick" / "lightning-quick"
"impossibly fast" / "blazingly fast"

UX terms:
"snappy" / "snappy quick" / "snappy fast"
"responsive" / "instant-feel" / "near-instant"
"crisp" / "tight" / "sharp"
"micro-fast" / "micro-quick"
"hairline duration" / "sliver of time"

Hover/press context:
"hover-quick" / "hover-fast"
"tap-fast" / "click-fast"

L3 (Sensory):
Onomatopoeia:
"snap" / "snap-quick" / "snappy"
"zip" / "zippy" / "zippity"
"zap" / "zap-quick"
"flash" / "flashy quick"
"flick" / "flicky"
"dart" / "darting"
"whip" / "whippy"
"blink" / "blink-fast"
"wink" / "wink-quick"
"dash" / "dashy"
"tic" / "tick" / "tic-quick"
"blip"
"poof"

Hyperbolic casual:
"super super quick"
"hella fast" / "mad quick"
"crazy fast" / "insanely fast"
"ridiculously quick"
"stupid fast"

British:
"nippy" / "quick as a flash"
"sharpish" / "sharp-quick"
"in two ticks"

L4 (Metaphorical):
"like a hummingbird's wing"
"like an eye-blink"
"like a finger snap"
"like a heartbeat"
"like a camera shutter"
"like static electricity"
"micro-second feel"
"frame-perfect"
"60fps perfect"

Brand metaphors:
"iOS keyboard tap feel"
"Linear app response time"
"Superhuman email feel"
"Stripe input response"

Modern slang:
"snappy af" / "quick af"
"hits different (quick)"
"absolutely snaps"
"sends instantly"
```

#### Korean (80+)
```
L1 (정밀):
"70ms" / "0.07초" / "70밀리초"
"50-70밀리초" / "마이크로 듀레이션"
"100ms 미만" / "프레임 단위"
"4프레임 (60fps)"

L2 (일반):
핵심 형용사:
빠르게 / 신속하게 / 잽싸게 / 후딱
빠릿빠릿 / 빠릿하게 / 빠릿
신속히 / 잽싸 / 잽싸게
재빠르게 / 재빠르
민첩하게 / 민첩
"엄청 빠르게" / "정말 빨리"
"진짜 빠르게" / "되게 빨리"

UX 용어:
"스냅 / 스냅 같이"
"즉답적인" / "즉응성있는"
"반응이 빠른" / "응답이 즉각적인"
"날렵하게" / "날렵한"
"칼같이 빠른"
"미세하게 빠른"

L3 (감각적):
의성어/의태어:
휘릭 / 휘릭하면 / 휘릭하니
휙 / 휙하니 / 휙휙
슉 / 슈슉 / 슉슉
쉭 / 쉬익 / 쉬리릭
쓱 / 쓱쓱
탁 / 탁탁
척 / 척척
딱 / 딱딱
띡 / 띠릭
빛처럼 / 광속으로
"순식간" / "찰나"
"잠깐" / "한순간"
"폼나게 빠르게"
"빛의 속도로"

캐주얼:
"잠깐만에" / "잠깐 사이에"
"한순간에" / "찰나에"
"눈 깜빡할 새에"
"빠릿빠릿"
"잽싸게 한방"
"휙 하면"

MZ/구어:
"개빠르게" / "개잽싸게"
"겁나 빠르게" / "엄청 빨리"
"미친듯이 빠르게"
"진짜 진짜 빠르게"
"순살 빠르게"
"광속" / "광속으로"
"FTL" (재미)

L4 (비유적):
"손가락 튕기듯이"
"눈 깜빡할 사이에"
"심장 박동처럼"
"빛의 속도로"
"카메라 셔터처럼"
"손가락 스냅처럼"
"정전기처럼"
"순간이동급"

브랜드:
"iOS 키보드 탭처럼"
"토스 토글처럼"
"슬랙 메시지 도착처럼"
"노션 입력 반응처럼"
```

### 3.4 SM (100ms) — 작은 동작

#### English (70+)
```
L1:
"100ms" / "0.1s" / "0.1 seconds"
"hundred milliseconds" / "tenth of a second"
"a tenth" / "1/10 second"

L2:
Core:
short / brief / light / quick / fleeting
momentary / "split-second" / "split second"
"brief touch" / "light tap" / "gentle nudge"
"soft pulse" / "quick blip" / "brief blip"

Modifiers:
"a tad" / "a bit" / "a touch"
"barely a moment" / "tiny moment"
"micro-pause" / "hint of" / "dash of"
"touch of" / "sliver of" / "wisp of"
"a whisper of time"
"a smidgen" / "a smidge"

UX:
"microsecond-feel" / "quick-touch"
"soft-tap" / "gentle interaction"
"light feedback" / "subtle quick"
"minimal motion" / "small motion"

L3:
Onomatopoeia:
tap / taps / tapping
tick / ticks / ticking
tic / tics
nudge / nudges
pat / pats
dab / dabs
poke / pokes
prod / prods
chirp / chirps
blip / blips
tink / tinks
ping / pings
bop / bops
boop / boops

Sensory:
"a quick tap" / "a brief tap"
"a slight movement" / "a slight shift"
"a quick pat" / "a brief pat"
"a wisp of motion"
"a hint of motion"

Casual:
"just a sec touch"
"a quick wee" (British)
"a wee tap" / "a wee touch"
"a tiny dab"
"a smidge of motion"

L4:
"like a quick tap on the shoulder"
"like dipping a toe"
"like a brief glance"
"like a blink-and-miss"
"a moth's wingbeat"
"sparkler-quick"

Brand:
"like Twitter heart pulse (quick)"
"like notification flicker"
"like input focus shift"
```

#### Korean (70+)
```
L1:
"100ms" / "0.1초" / "100밀리초"
"10분의 1초" / "잠깐 듀레이션"
"100ms 정도"

L2:
핵심:
짧게 / 짧은 / 짤막하게 / 짤막
가볍게 / 가벼운 / 가뿐하게
살짝 / 살짝쿵 / 살그머니
슬쩍 / 슬쩍슬쩍 / 살랑
잠깐 / 잠시 / 잠깐만
쪼끔 / 조금 / 조금만
한순간 / 한 박자

UX:
"짧은 피드백"
"가벼운 반응"
"잠깐의 움직임"
"약간의 움직임"
"미세한 움직임"
"부담없이 짧게"

L3:
의성어:
톡 / 톡톡 / 토독 / 토독토독
딸깍 / 딸깍하니
띡 / 띠리릭
콕 / 콕콕
폭 / 폭폭
팟 / 팟팟
픽 / 픽픽
또각 / 또각또각

감각어:
"살짝쿵" / "살짜쿵"
"살그머니"
"슬며시"
"슬쩍"
"잠깐 사이에"
"한순간"
"순간적으로"
"잠시잠시"

캐주얼:
"한 번 톡"
"살짝 한 번"
"슬쩍 한 번"
"한번 톡 치듯"
"잠깐 슉"
"가볍게 한 번"

MZ/구어:
"살짝쿵" / "슬쩍쿵"
"가볍게 톡"
"잠깐 휙"
"잽싸게 톡"

L4:
"눈인사하듯"
"손가락 끝으로 톡"
"어깨 톡 치듯"
"가벼운 인사처럼"
"잠깐 곁눈질하듯"
"반딧불이 깜빡임"
"별 깜빡임"
"손등 톡 두드림"

브랜드:
"인스타 좋아요 깜빡임"
"트위터 하트 펄스"
"카톡 알림 깜빡임"
```

### 3.5 MD (150ms) — 기본값

#### English (70+)
```
L1:
"150ms" / "0.15s" / "0.15 seconds"
"a hundred and fifty ms" / "150 millis"
"medium duration" / "default duration"

L2:
Core:
normal / standard / regular / typical
usual / common / average / ordinary
moderate / mid-range / balanced / neutral
"by default" / "default" / "baseline"
"middle-ground" / "midway"
"reasonable" / "appropriate"

Design jargon:
"default timing" / "baseline timing"
"mid-tempo" / "moderate pace"
"comfortable" / "natural pace"
"well-paced" / "balanced pace"
"workhorse timing" / "safe choice"
"production-default"

Casual:
"just right" / "spot-on"
"in-between" / "in between"
"neither fast nor slow"
"middle-of-the-road"
"run-of-the-mill"
"nothing fancy"
"basic" / "vanilla"

UX:
"standard motion" / "standard timing"
"interaction-standard"
"default-feel" / "natural-feel"
"midi" / "medium" / "mid"

L3:
"a beat" / "a comfortable beat"
"a brief sec"
"about a sec"
"a quick second"
"a measured beat"
"comfortable pacing"

L4:
"like a normal blink"
"like a typical UI moment"
"baseline native feel"
"like an iOS dropdown"

Brand:
"iOS default timing"
"Android Material timing"
"Stripe default response"
"default web interaction"
```

#### Korean (70+)
```
L1:
"150ms" / "0.15초" / "150밀리초"
"기본 듀레이션" / "디폴트 시간"

L2:
핵심:
보통 / 보통은 / 평소처럼 / 평범하게
일반적으로 / 일반적인
무난하게 / 무난한
적당히 / 적당한
적절히 / 적절한
알맞게 / 알맞은
무리없이 / 무리없는
부담없이 / 부담없는

디자인 jargon:
"기본으로" / "기본값으로" / "디폴트로"
"표준으로" / "표준" / "표준 시간"
"평범한 속도" / "보통 속도"
"무난한 페이스"
"기본 페이스" / "기본 페이싱"
"안전한 선택"
"바닐라" / "디폴트"

캐주얼:
"그냥" / "그저"
"평이하게" / "그냥저냥"
"별 거 없이"
"수수하게"
"심플하게"
"중간 정도로"
"평범하게"

UX:
"표준 모션" / "표준 시간"
"기본 인터랙션"
"디폴트 느낌"
"내추럴 페이스"
"노멀 페이스"

L3:
"한 박자에"
"적당한 박자"
"무리없는 박자"
"무난한 흐름"
"자연스러운 흐름"
"평탄하게"

L4:
"일반적인 깜빡임처럼"
"전형적인 UI 모먼트"
"기본 네이티브 느낌"
"iOS 드롭다운처럼"
"안드로이드 기본처럼"

브랜드:
"iOS 기본 타이밍"
"안드로이드 머티리얼 타이밍"
"노션 페이지 전환 기본"
"슬랙 기본 응답"
```

### 3.6 LG (250ms) — 부드럽게

#### English (90+)
```
L1:
"250ms" / "0.25s" / "0.25 seconds"
"quarter second" / "a quarter of a second"
"long-medium" / "ample duration"

L2:
Core:
smooth / smoothly / "very smooth"
gentle / gently / "real gentle"
soft / softly / "nice and soft"
mellow / fluid / "fluid motion"
silky / "silky smooth"
buttery / "buttery smooth"
flowing / "flowing motion"
graceful / "graceful pacing"
easy / "easy and smooth"
relaxed / "nice and relaxed"
"well-paced"

Sensory:
"like silk" / "silk-smooth"
"like butter" / "buttery"
"like honey" / "honey-smooth"
"creamy" / "cream-smooth"
"velvet" / "velvety"
"glassy" / "glass-smooth"

Casual/Modern:
"chill" / "chill pace"
"laid-back" / "laidback"
"breezy" / "breezy pace"
"easy-going"
"super smooth" / "very smooth"
"silky-smooth" / "mad smooth"
"smooth af" / "buttery af"
"chefs kiss smooth"
"no notes smooth"

Cinematic:
"cinematic smooth"
"film-smooth" / "film-like"
"movie-smooth"
"editorial smooth"
"polished" / "refined"

UX/Tech:
"well-eased" / "nicely paced"
"comfortable pacing"
"easy-going timing"
"soft-easing duration"
"iOS-like smooth" / "Apple-smooth"
"native-smooth"

L3:
"flowing" / "drifting" / "floating"
"sailing through"
"coasting through"
"gliding"
"sliding"
"sweeping"
"streaming"

Onomatopoeic:
"swoosh" (smooth swoosh)
"whoosh" (smooth)
"glide"

L4:
"like water flowing"
"like silk falling"
"like clouds drifting"
"like a gentle breeze"
"like a dancer's move"
"like syrup pouring"
"like a feather drifting"
"like a slow exhale"
"like waves rolling"
"like cream pouring"

Brand:
"like iOS native motion"
"like Apple Keynote transition"
"like Toss payment flow"
"like Notion page open"
"like Linear's app feel"
"like Stripe checkout smoothness"
"Pixar smooth"
"Disney smooth"
```

#### Korean (90+)
```
L1:
"250ms" / "0.25초" / "250밀리초"
"4분의 1초" / "쿼터 세컨드"
"미디엄-롱"

L2:
핵심:
부드럽게 / 부드러운 / 부드러이
매끄럽게 / 매끄러운 / 매끄러이
매끈하게 / 매끈한
미끈하게 / 미끈한
미끄럽게 / 미끄러운
자연스럽게 / 자연스러운
스무스하게 / 스무스 / 스무스한
젠틀하게 / 젠틀한
소프트하게 / 소프트한
여유롭게 / 여유로운
여유있게 / 여유있는
무리없게 / 무리없는
편안하게 / 편안한

의태어:
살랑살랑 / 살랑이듯
사뿐사뿐 / 사뿐히
살그머니 / 살며시
스르륵 / 스르륵하니
스으윽 / 스으윽하니
슈르륵 / 슈르륵
사르륵 / 사르르
술술 / 술술이
사사삭

감각어 (촉감 기반):
"실크처럼" / "실크 같이"
"비단처럼" / "비단 같이"
"버터처럼" / "버터 같이"
"크림처럼" / "크림 같이"
"우유처럼"
"꿀처럼" / "꿀 흐르듯"
"물처럼" / "물 흐르듯"
"바람처럼"
"솜처럼" / "솜털처럼"
"벨벳처럼"

캐주얼:
"부드러이"
"매끈하니"
"보들보들"
"산들산들"
"슬렁슬렁"

MZ/구어:
"개부드럽게" / "개매끄럽게"
"진짜 부드럽게"
"엄청 부드럽게"
"정말 매끄럽게"
"진짜 스무스"
"진짜 매끈"

L3:
"흐르듯이"
"흐름타듯"
"바람타듯"
"흐물흐물"
"부드럽게 흘러가듯"
"슬며시 미끄러지듯"
"물결타듯"
"파도타듯"

L4:
자연 비유:
"물이 흐르듯"
"실크가 흘러내리듯"
"구름이 떠다니듯"
"산들바람처럼"
"댄서의 움직임처럼"
"꿀이 떨어지듯"
"깃털이 떠다니듯"
"천천히 숨쉬듯"
"파도가 밀려오듯"
"크림이 흘러내리듯"
"안개가 흐르듯"
"비단이 휘날리듯"

브랜드:
"iOS 네이티브 모션처럼"
"애플 키노트 전환처럼"
"토스 결제 흐름처럼"
"노션 페이지 열림처럼"
"리니어 앱 느낌"
"스트라이프 결제 매끄러움"
"픽사 부드러움"
"디즈니 부드러움"
```

### 3.7 XL (400ms) — 느긋하게/강조

#### English (80+)
```
L1:
"400ms" / "0.4s" / "0.4 seconds"
"four hundred ms" / "two-fifths of a second"

L2:
Core (slow):
slow / slowly / "fairly slow"
"a bit slow" / "kinda slow"
leisurely / "at a leisurely pace"
unhurried / "in no hurry"
deliberate / deliberately
measured / "measured pace"
paced / "well-paced"
steady / "steady pace"
gradual / "gradual motion"
extended / "extended duration"
lingering / "lingering motion"

Core (weighty):
weighty / "weighty motion"
heavy / "heavy motion"
hefty / "hefty"
substantial / "substantial pause"
pronounced / "pronounced motion"
emphasized / "emphasized timing"
accentuated / "accentuated"
"statement timing" / "hero timing"

Cinematic:
dramatic / "dramatic timing"
theatrical / "theatrical"
cinematic / "cinematic pacing"
stately / "stately motion"
grand / "grand motion"
elegant / "elegant timing"
graceful / "graceful pace"
luxurious / "luxurious pace"
swooping / "swooping motion"
sweeping / "sweeping motion"

Casual:
"take its time"
"nice and slow"
"no rush"
"chill-paced"
"laid-back pace"
"unhurried pace"

UX/Tech:
"long-easing" / "drawn-out"
"extended easing"
"emphasized motion"
"hero animation timing"
"signature timing"
"impactful timing"
"showcase pacing"

L3:
"a deliberate beat"
"a measured beat"
"a full beat"
"two beats"
"a couple of beats"
"a thoughtful pause"

L4:
"like a thoughtful nod"
"like a deep breath"
"like a slow exhale"
"like a sweeping gesture"
"like a luxury car door close"
"like a curtain rising"
"like a stage entrance"

Brand:
"like Material 3 emphasized"
"like luxury brand motion"
"like Audi UI motion"
"like Tesla animation"
"like Netflix intro"
"like documentary pacing"
```

#### Korean (80+)
```
L1:
"400ms" / "0.4초" / "400밀리초"
"5분의 2초"

L2:
핵심 (느긋함):
천천히 / 천천히도 / 살살
느긋하게 / 느긋한 / 느긋
여유롭게 / 여유롭다
여유있게 / 여유있는
차분하게 / 차분한 / 차분히
진중하게 / 진중한 / 진중히
진득하게 / 진득한 / 진득
차근차근 / 차근차근히
느릿하게 / 느릿한 / 느릿느릿이

핵심 (묵직함):
묵직하게 / 묵직한
무게있게 / 무게있는
굵직하게 / 굵직한
단단하게 / 단단한
임팩트있게 / 임팩트있는
강조해서 / 강조해
또렷하게 / 또렷한
도드라지게 / 도드라진
분명하게 / 분명한
화끈하게 / 화끈한
시원하게 / 시원한
호쾌하게 / 호쾌한
박력있게 / 박력있는

시네마틱:
드라마틱하게 / 드라마틱한
영화같이 / 영화처럼
의젓하게 / 의젓한
점잖게 / 점잖은
정중하게 / 정중한
그윽하게 / 그윽한
우아하게 / 우아한
고고하게 / 고고한

캐주얼:
"넉넉하게"
"천천히 천천히"
"여유롭게 여유롭게"
"진중히"
"묵묵히"
"으스대듯"
"거창하게"

MZ/구어:
"갓 부드럽게" (강조)
"진짜 묵직하게"
"엄청 천천히"
"개 천천히" (강조)
"진짜 부드러이"
"임팩트 살게"

L3:
"한참 동안"
"여유롭게 한 박자"
"두 박자에 걸쳐"
"진중한 한 박자"
"점잖은 흐름"

L4:
"고개 끄덕이듯"
"숨을 깊이 들이쉬듯"
"천천히 숨을 내쉬듯"
"우아한 손짓처럼"
"럭셔리 차 문 닫히듯"
"커튼이 올라가듯"
"무대 입장처럼"
"점잖은 인사처럼"

브랜드:
"머티리얼 3 강조처럼"
"럭셔리 브랜드 모션처럼"
"아우디 UI처럼"
"테슬라 애니메이션처럼"
"넷플릭스 인트로처럼"
"다큐멘터리 페이스"
```

### 3.8 XXL (600ms+) — 매우 천천히

#### English (70+)
```
L1:
"600ms" / "0.6s" / "0.6 seconds"
"800ms" / "0.8s" / "almost a second"
"a second" / "1 second" (warning: long)

L2:
Core:
"very slow" / "extremely slow"
sluggish / "sluggish pace"
crawling / "crawling pace"
dragging / "dragging motion"
lingering / "lingering"
loitering / "loitering"
ponderous / "ponderous"
labored / "labored"
glacial / "glacial pace"

Cinematic:
"cinematic-slow"
"movie-paced"
"theatrical-slow"
epic / "epic motion"
grand / "grand reveal"
majestic / "majestic"
ceremonial / "ceremonial"
ritualistic / "ritualistic"

Casual/Modern:
"mad slow"
"hella slow"
"ages" / "takes ages"
"forever" / "takes forever"
"like watching paint dry"
"slow as molasses"
"snail-paced"

UX/Design:
"onboarding-paced"
"celebration-timing"
"showcase-slow"
"hero-moment timing"
"reveal-timing"

Negative connotations (warn user):
sluggish / tedious / draggy / weary

L3:
"a long beat"
"several beats"
"a sustained pause"
"an extended pause"
"a deliberate slow"
"a contemplative pace"

L4:
"like a sunrise"
"like dawn breaking"
"like a slow exhale"
"like a meditation breath"
"like a curtain ceremony"
"like an opera overture"
"like a slow-motion replay"
"like time-lapse in reverse"
"like a wedding entrance"
"like a documentary opening"

Brand:
"Netflix intro slowness"
"Disney intro pacing"
"Apple Keynote reveal"
"luxury brand reveal"
"epic game intro"
```

#### Korean (70+)
```
L1:
"600ms" / "0.6초"
"800ms" / "0.8초"
"1초" / "1s" (경고: 김)

L2:
핵심:
"아주 천천히" / "엄청 천천히"
"매우 천천히" / "정말 천천히"
굼뜨게 / 굼뜬
느릿느릿 / 느릿느릿이
"답답할 정도로" / "답답하게"
어슬렁어슬렁 / 어슬렁
슬렁슬렁 / 슬렁
"지나치게 천천히"
"심하게 느리게"

시네마틱:
장엄하게 / 장엄한
위풍당당하게 / 위풍당당
거대하게 / 거대한
웅장하게 / 웅장한
거창하게 / 거창한
의식적으로 / 의식적인
화려하게 / 화려한

캐주얼:
"한참" / "한참을"
"한참 동안"
"오래오래"
"길게 길게"
"늘어지게"
"여유 부리며"

MZ/구어:
"갓 천천히"
"진짜 진짜 천천히"
"개 느리게"
"엄청 늦게"
"미친듯이 천천히"

부정적 (경고):
"답답하게" → 사용자 확인
"굼뜨게" → 의도 확인
"지겹게" → 의도 확인

L3:
"한참 동안"
"길게 길게"
"오래도록"
"느릿느릿"
"슬렁슬렁"
"여유롭게도 여유롭게"
"점점점"
"슬금슬금"

L4:
"일출처럼"
"새벽이 밝아오듯"
"천천히 숨을 내쉬듯"
"명상 호흡처럼"
"커튼콜 의식처럼"
"오페라 서곡처럼"
"슬로우 모션 리플레이"
"리버스 타임랩스처럼"
"결혼식 입장처럼"
"다큐 오프닝처럼"

브랜드:
"넷플릭스 인트로 천천히"
"디즈니 인트로 페이스"
"애플 키노트 공개"
"럭셔리 브랜드 공개"
"에픽 게임 인트로"
```

---

## 4. Easing Dictionary / Easing 사전

13 Figma native easing types + 2 custom. Each with 50-80 vocabulary entries.

### 4.1 LINEAR — 등속

**Figma type:** `"LINEAR"` (cubic-bezier: 0,0,1,1)  
**Use:** Color/opacity only, no position change. Looks unnatural for motion.

#### English (50+)
```
L1:
"LINEAR" / "linear easing" / "no easing"
"linear curve" / "constant speed"
"cubic-bezier(0,0,1,1)" / "step-function"
"ease: none" / "ease: linear"

L2:
Core:
linear / constant / uniform / even / steady
unchanging / unwavering / consistent / unvarying
"no acceleration" / "no deceleration"
"same speed throughout"

Mechanical:
mechanical / robotic / rigid / stiff
"machine-like" / "automated-feel"
monotonous / unvarying / dull / lifeless
sterile / cold / artificial

Tech:
"linear motion" / "linear interpolation"
"raw motion" / "unprocessed motion"
"unfiltered easing"
"step easing" / "discrete easing"
"direct timing"

L3:
"like a ruler" / "ruler-straight"
"clockwork" / "clockwork-precise"
"metronome" / "metronome-steady"
"like a conveyor belt"
"on rails"

Negative:
"boring linear" / "robotic linear"
"feels unnatural"
"feels mechanical"
"feels off"
"unnatural"

L4:
"like a robot arm"
"like a metronome"
"like a piston"
"like a clock hand (smooth)"
"like an escalator"
"like a treadmill"
"like a conveyor belt"
"computer-precise"
"like a CNC machine"
"factory-precision"
```

#### Korean (50+)
```
L1:
"LINEAR로" / "리니어"
"리니어 이징" / "리니어 곡선"
"cubic-bezier(0,0,1,1)"
"이징 없이" / "이징 X"
"ease: linear"

L2:
핵심:
일정하게 / 일정한 / 일정히
균일하게 / 균일한 / 균일히
등속으로 / 등속의 / 등속
"속도 일정"
"속도 변화 없이"
"가속도 없이"
"감속 없이"

기계적:
기계적으로 / 기계적인
로봇같이 / 로봇처럼
딱딱하게 / 딱딱한
경직되게 / 경직된
무미건조하게 / 무미건조한
무미한 / 메마르게
"기계 같이"
"양심없이" (구어)

테크:
"리니어 모션"
"리니어 보간"
"가공되지 않은 모션"
"필터 없는 이징"
"이산 이징"
"직선 타이밍"

L3:
"자처럼" / "자같이"
"칼처럼" / "칼같이"
"칼각으로"
"곧이곧대로"
"일직선으로"
"한결같이"
"변함없이"

부정적:
"양심없이" (구어, MZ)
"부자연스러운"
"기계 같은"
"이상한"
"어색한"

L4:
"로봇 팔처럼"
"메트로놈처럼"
"피스톤처럼"
"시계 초침처럼" (부드러운)
"에스컬레이터처럼"
"러닝머신처럼"
"컨베이어 벨트처럼"
"컴퓨터처럼 정밀"
"CNC 기계처럼"
"공장 정밀도"
```

### 4.2 EASE_IN — 가속 (출발)

**Figma type:** `"EASE_IN"`  
**Use:** Exits, departing motion.

#### English (60+)
```
L1:
"EASE_IN" / "ease-in" / "ease in"
"in-easing" / "exit easing"
"acceleration curve"
"cubic-bezier(0.5, 0, 1, 1)" (approximate)

L2:
Core:
"ease in" / "easing in" / "eased in"
accelerating / "accelerating motion"
"speeding up" / "gathering pace"
"building speed" / "building momentum"
"picking up speed"
"starting slow, ending fast"
"slow start, fast finish"

Sensory:
launching / "launching off"
"taking off" / "lift-off"
departing / "departing motion"
"shooting off" / "shooting out"
"darting away"
"zipping away"

Casual:
"whoosh away" / "whooshing"
"dash off" / "dashing"
"zip away" / "zipping"
"yeet outta there" (Gen Z)
"booking it" / "bolting"

UX:
"accelerate-easing"
"exit-curve" / "departure-curve"
"dismiss-easing"
"out-easing"

L3:
"like winding up"
"like building momentum"
"slow then quick"
"gentle start, sharp end"

L4:
"like a rocket launching"
"like an arrow shot"
"like a runner sprinting"
"like wind picking up"
"like a car accelerating"
"like a train leaving"
"like a roller coaster drop"
"like a slingshot"

Brand:
"like notification dismissal"
"like modal closing"
"like swipe-away gesture"
"like delete animation"
```

#### Korean (60+)
```
L1:
"EASE_IN으로" / "이지 인" / "ease in"
"인 이징" / "출구 이징"
"가속 커브"

L2:
핵심:
"이지 인" / "이지인"
"가속하면서" / "가속하는"
"점점 빠르게"
"빨라지면서" / "빨라지는"
"가속도 붙으며"
"속도가 붙으며"
"느리게 시작해서 빨리"
"느린 시작, 빠른 끝"

감각:
"발사하듯" / "이륙하듯"
"떠나면서 가속"
"출발하면서"
"멀어지며 가속"
"빠져나가며"

캐주얼:
"휘릭 빠져나가듯"
"휘잉 떠나듯"
"휙 사라지듯"
"슝 가버리듯"
"날아가듯"

MZ/구어:
"휘릭" / "휘잉"
"휙 가버려"
"슈웅"
"날아가버려"

UX:
"가속 이징"
"퇴장 커브"
"디스미스 이징"
"아웃 이징"

L3:
"점점 가속하듯"
"점점 빨라지듯"
"느린 시작 빠른 끝"
"천천히 시작해서 빨리 마무리"
"잔잔하게 시작 격렬하게"

L4:
"로켓 발사하듯"
"화살이 발사되듯"
"러너가 스프린트하듯"
"바람이 거세지듯"
"자동차 가속하듯"
"기차가 출발하듯"
"롤러코스터 하강처럼"
"새총처럼"

브랜드:
"알림 닫힐 때처럼"
"모달 닫히듯"
"스와이프 삭제처럼"
"삭제 애니메이션처럼"
```

### 4.3 EASE_OUT — 감속 (도착)

**Figma type:** `"EASE_OUT"`  
**Use:** Entries, settling motion. **Most common for entry animations.**

#### English (70+)
```
L1:
"EASE_OUT" / "ease-out" / "ease out"
"out-easing" / "entry easing"
"deceleration curve"
"cubic-bezier(0, 0, 0.2, 1)" (approximate)

L2:
Core:
"ease out" / "easing out" / "eased out"
decelerating / "decelerating motion"
"slowing down" / "coming to rest"
"settling" / "settling in"
"landing" / "touching down"
"arriving" / "docking"
"fast start, slow finish"
"quick start, gentle end"

Sensory:
"gentle landing" / "soft touchdown"
"feather-light landing"
"floaty arrival"
"swooping in" / "swooping arrival"
"drifting in"
"settling in"
"dropping in"
"floating in"
"sinking in"

UX/Tech:
"decelerate-easing"
"entry-curve" / "arrival-curve"
"approach easing"
"settle-easing"
"in-easing"
"native iOS feel"
"Material entry"

L3:
"like a soft landing"
"like a gentle arrival"
"like drifting to rest"
"smooth deceleration"
"quick then easing"

L4:
"like a plane landing"
"like a leaf falling"
"like a feather drifting down"
"like sunset"
"like nightfall"
"like petals settling"
"like snow drifting down"
"like a balloon settling"
"glide-to-rest"
"drift-to-stop"
"like a parachute landing"
"like a swan landing on water"

Brand:
"like iOS modal appearance"
"like notification arriving"
"like Material card entry"
"like card flip settling"
"like dropdown opening"
```

#### Korean (70+)
```
L1:
"EASE_OUT으로" / "이지 아웃" / "ease out"
"아웃 이징" / "진입 이징"
"감속 커브"

L2:
핵심:
"이지 아웃" / "이지아웃"
"감속하면서" / "감속하는"
"점점 멈추듯" / "점점 느려지듯"
"느려지면서" / "느려지는"
"도착하듯" / "안착하듯"
"착륙하듯" / "내려앉듯"
"멎듯" / "멈추듯"
"빠르게 시작해서 천천히"
"빠른 시작, 부드러운 끝"

감각:
"사뿐히 내려앉듯"
"살포시" / "살그머니"
"살랑살랑 내려오듯"
"깃털처럼 내려앉듯"
"눈송이 내리듯"
"솜털처럼 안착"
"부드럽게 안착"
"슬며시 도착"
"슬며시 정착"
"잔잔하게 내려앉듯"

UX/Tech:
"감속 이징"
"진입 커브" / "도착 커브"
"안착 이징"
"인 이징"
"iOS 네이티브 느낌"
"머티리얼 진입"

L3:
"부드럽게 멈추듯"
"점점 멈춰가듯"
"슈우우 멈추듯"
"드디어 정착하듯"
"천천히 안착"
"느릿느릿 도착"

L4:
자연:
"비행기 착륙하듯"
"낙엽 떨어지듯"
"깃털이 떠다니듯 내려앉듯"
"노을 지듯"
"밤이 깔리듯"
"꽃잎 떨어지듯"
"눈송이 내려앉듯"
"풍선이 천천히 가라앉듯"
"낙하산 펴지듯"
"백조가 물에 내려앉듯"
"파라슈트 착륙"

브랜드:
"iOS 모달 등장처럼"
"알림 도착하듯"
"머티리얼 카드 진입"
"카드 플립 안착"
"드롭다운 열림"
```

### 4.4 EASE_IN_AND_OUT — 양방향 부드러움

**Figma type:** `"EASE_IN_AND_OUT"`  
**Use:** Bidirectional movement, toggles, tab switches. Balanced feel.

#### English (60+)
```
L1:
"EASE_IN_AND_OUT" / "ease in and out"
"ease in-out" / "in-out easing"
"S-curve" / "sigmoid curve"
"cubic-bezier(0.4, 0, 0.4, 1)" (approximate)

L2:
Core:
"ease in and out" / "ease in-out"
"in-and-out easing"
"smooth both ends"
"gentle on both sides"
balanced / "balanced motion"
symmetric / "symmetric easing"
"slow start, slow end"
"gentle start, gentle end"

Sensory:
silky / "silky motion"
buttery / "buttery motion"
natural / "natural motion"
fluid / "fluid motion"
flowing / "flowing motion"
smooth / "really smooth"

UX/Tech:
"S-curve motion"
"sigmoid easing"
"natural-feel easing"
"default smooth"
"production default"

L3:
"like silk flowing"
"like a wave"
"like a pendulum"
"like a swing"

L4:
"like a wave swelling and falling"
"like breathing"
"like a pendulum swing"
"like a wave breaking"
"like a sigh"
"like a heartbeat (smoothed)"
"like ocean tide"

Brand:
"like default web transition"
"like Material standard"
"like balanced motion"
```

#### Korean (60+)
```
L1:
"EASE_IN_AND_OUT으로" / "이지 인 앤 아웃"
"양방향 이징" / "양방향 부드러움"
"S 곡선" / "시그모이드"
"in-out 이징"

L2:
핵심:
"이지 인앤아웃"
"양쪽 다 부드럽게"
"양 끝 부드럽게"
"균형있게" / "균형있는"
"대칭적으로" / "대칭적인"
"천천히 시작 천천히 끝"
"잔잔히 시작 잔잔히 끝"
"매끄럽게 양쪽으로"

감각:
실키하게 / 실키한
버터리하게 / 버터리한
자연스럽게 / 자연스러운
유체같이 / 유체처럼
흐름같이 / 흐름처럼
"진짜 부드럽게"
"엄청 부드럽게"

UX/Tech:
"S 곡선 모션"
"시그모이드 이징"
"자연 이징"
"디폴트 부드러움"
"프로덕션 디폴트"

L3:
"실크 흐르듯"
"파도처럼"
"진자처럼"
"그네처럼"
"매끄러운 호선"

L4:
"파도가 일었다 가라앉듯"
"호흡하듯"
"진자가 흔들리듯"
"파도가 부서지듯"
"한숨처럼"
"심장 박동처럼 (부드러운)"
"바다의 조수처럼"
"숨 들이마쉬듯"

브랜드:
"웹 기본 전환처럼"
"머티리얼 표준"
"균형있는 모션"
```

### 4.5 EASE_OUT_BACK — 오버슛 후 안착

**Figma type:** `"EASE_OUT_BACK"`  
**Use:** Playful entries, modal "pop", notification with personality.

#### English (60+)
```
L1:
"EASE_OUT_BACK" / "ease-out-back"
"back-easing out"
"overshoot easing"
"out-back curve"

L2:
Core:
"overshoot and settle"
"bounce-back"
"snap into place"
"back-easing" / "back-out"
"rubber-band feel"
"elastic-out"
"slingshot in"
"yo-yo end"

Sensory:
"pop and settle"
"snap-with-give"
"settle-with-bounce"
"come-and-recoil"
"arrive-and-spring-back"

Casual:
"the bounce-back motion"
"the rubber-band feel"
"that satisfying snap"
"with personality"
"with character"
"playful arrival"

UX:
"playful entry"
"personality-rich entry"
"character-rich motion"

L3:
"swoosh-pop"
"whoosh-settle"
"bounce-in"
"poppy entry"

L4:
"like a basketball settling"
"like a basketball after a dunk"
"like a swing reaching its peak"
"like a yo-yo at the end"
"like a fishing line snap-back"
"like a slingshot release end"
"like jelly settling"

Brand:
"like Instagram heart bounce"
"like iOS reachability bounce"
"like Apple Pencil tap"
"like notification pop"
"playful modal pop"
```

#### Korean (60+)
```
L1:
"EASE_OUT_BACK으로" / "이지 아웃 백"
"백 이징 아웃"
"오버슛 이징"
"아웃 백 커브"

L2:
핵심:
"넘어갔다 돌아오듯"
"오버슛하면서 안착"
"용수철처럼 정착"
"튕기다 자리잡듯"
"러버밴드 느낌"
"엘라스틱 아웃"

감각:
"퐁 하고 안착"
"살짝 넘어갔다 돌아오듯"
"통통 튀고 정착"
"도착하고 살짝 튀어오르듯"
"안착하면서 살짝 출렁"

캐주얼:
"바운스백 느낌"
"러버밴드 느낌"
"만족스러운 스냅"
"캐릭터 있는 모션"
"성격 있는 모션"
"장난스럽게 안착"

MZ/구어:
"통실통실 안착"
"콩 하고 자리잡듯"
"퐁 자리잡듯"

UX:
"장난스러운 진입"
"성격있는 진입"
"개성있는 모션"

L3:
"슈우슝-퐁"
"휘잉-퐁"
"바운스 인"
"퐁 진입"

L4:
"농구공이 안착하듯"
"덩크 후 농구공처럼"
"그네 정점처럼"
"요요 끝처럼"
"낚싯줄 스냅백처럼"
"새총 끝처럼"
"젤리 안착"

브랜드:
"인스타 하트 바운스처럼"
"iOS 리치빌리티 바운스"
"애플 펜슬 탭처럼"
"알림 팝처럼"
"장난스러운 모달 팝"
```

### 4.6 EASE_IN_BACK — 준비 동작 후 가속

**Figma type:** `"EASE_IN_BACK"`  
**Use:** Dramatic exits with anticipation. Element pulls back before launching out.

#### English (50+)
```
L1:
"EASE_IN_BACK" / "ease-in-back"
"back-easing in" / "in-back curve"
"anticipation easing"

L2:
Core:
"wind-up then go"
"anticipation"
"step back to leap"
"pull back then launch"
"loaded spring exit"
"recoil and shoot"
"reverse then accelerate"

Sensory:
"the wind-up motion"
"the anticipation pull"
"the loaded launch"
"the prepare-and-go"

UX:
"dramatic exit"
"anticipated exit"
"character-rich exit"

L3:
"backward-then-forward"
"reverse-then-forward"
"the backstep launch"

L4:
"like winding up a punch"
"like pulling back a slingshot"
"like a basketball player jump"
"like a tennis serve wind-up"
"like a baseball pitcher's recoil"
"like a cat pre-pounce"
"like an arrow drawn back"

Brand:
"dramatic dismissal"
"game UI exit"
"hero animation exit"
```

#### Korean (50+)
```
L1:
"EASE_IN_BACK으로" / "이지 인 백"
"백 이징 인" / "인 백 커브"
"준비 동작 이징"

L2:
핵심:
"뒤로 빠졌다 나가듯"
"준비동작 후 떠남"
"장전됐다 나가듯"
"뒤로 갔다가 휙"
"움츠리고 나가듯"
"되돌아갔다 가속"
"역방향 후 가속"

감각:
"준비 동작"
"움츠림 후 발사"
"장전 후 발사"
"준비 후 떠남"

UX:
"드라마틱한 퇴장"
"기대감 있는 퇴장"
"성격있는 퇴장"

L3:
"뒤로 갔다 앞으로"
"역방향 후 가속"
"백스텝 발사"

L4:
"펀치 휘두를 준비"
"새총 잡아당기듯"
"농구선수 점프 준비"
"테니스 서브 준비"
"야구 투수의 반동"
"고양이 뛰기 전 자세"
"활시위 당겨지듯"

브랜드:
"드라마틱한 퇴출"
"게임 UI 퇴장"
"히어로 애니메이션 퇴장"
```

### 4.7 EASE_IN_AND_OUT_BACK — 양 끝 오버슛

**Figma type:** `"EASE_IN_AND_OUT_BACK"`  
**Use:** Maximum drama. Both anticipation and overshoot.

#### English (40+)
```
L1:
"EASE_IN_AND_OUT_BACK"
"in-out-back" / "double-back easing"

L2:
"anticipate and overshoot"
"back-and-forth bounce"
"wind-up and settle"
"dramatic in and out"
"theatrical curve"
"both ends back"

L3:
"swing back and rebound"
"recoil and overshoot"

L4:
"like a stage curtain dramatic"
"like a magician's reveal"
"like ceremonial gesture"
"like a slap motion (theatrical)"
"like a punchline"
```

#### Korean (40+)
```
L1:
"EASE_IN_AND_OUT_BACK으로"
"양끝 오버슛"
"더블 백 이징"

L2:
"뒤로 갔다가 오버슛하면서 안착"
"준비동작 후 튕기듯 정착"
"양 끝 다 튕기듯"
"드라마틱한 진입과 안착"
"극적인 양방향 이징"

L3:
"흔들렸다 반동"
"움츠렸다 오버슛"

L4:
"무대 커튼 극적으로"
"마술사의 공개처럼"
"의식적 제스처"
"극장식 슬랩 모션"
"펀치라인처럼"
```

### 4.8 GENTLE Spring — 은은한 스프링

**Figma type:** `"GENTLE"` (preset)  
**Use:** Subtle scaling, careful UI elements.

#### English (50+)
```
L1:
"GENTLE" / "gentle spring" / "GENTLE preset"
"Figma gentle"

L2:
Core:
"subtle spring" / "soft bounce"
"gentle spring" / "neutral spring"
"barely-there bounce"
"mild spring" / "modest spring"
"understated bounce"
"refined spring"

Sensory:
"soft jiggle"
"slight wobble"
"gentle wobble"
"feather spring"
"whisper spring"
"butterfly spring"

UX:
"subtle scale animation"
"careful UI bounce"
"refined interaction"

L3:
"hint of spring"
"trace of bounce"
"soft give"
"mild give"
"slight rebound"

L4:
"like a soft pillow"
"like memory foam"
"like a gentle nod"
"like a soft handshake"
"like a polite bow"
"like cushioned landing"
"like marshmallow press"
"like soft cotton bounce"
```

#### Korean (50+)
```
L1:
"GENTLE로" / "젠틀 스프링" / "GENTLE 프리셋"
"피그마 젠틀"

L2:
핵심:
"은은하게 튕기듯"
"부드럽게 살짝 튕기듯"
"잔잔한 스프링"
"조심스러운 바운스"
"미세한 스프링"
"약한 스프링"
"절제된 바운스"
"세련된 스프링"

감각:
"살랑살랑 흔들림"
"미세한 흔들림"
"잔잔한 흔들림"
"깃털 스프링"
"속삭임 스프링"
"나비 스프링"

UX:
"미세한 스케일 애니메이션"
"조심스러운 UI 바운스"
"세련된 인터랙션"

L3:
"스프링의 힌트"
"살짝 튕김"
"미세한 반발"
"약한 반발"
"잔잔한 리바운드"

L4:
"부드러운 베개처럼"
"메모리폼처럼"
"부드러운 끄덕임"
"부드러운 악수"
"정중한 인사"
"쿠션 착륙"
"마쉬멜로 누르듯"
"부드러운 솜 바운스"
```

### 4.9 QUICK Spring — 빠른 스프링

**Figma type:** `"QUICK"` (preset)  
**Use:** Toasts, notifications, snappy feedback.

#### English (50+)
```
L1:
"QUICK" / "quick spring" / "QUICK preset"
"Figma quick"

L2:
Core:
"snappy spring" / "quick bounce"
"toast-style bounce"
"notification spring"
"responsive spring"
"crisp spring"
"sharp spring"
"alert spring"
"quick rebound"

Sensory:
"crisp bounce"
"sharp pop"
"snappy give"
"tight rebound"
"quick recoil"

UX:
"toast notification feel"
"snackbar bounce"
"feedback bounce"
"acknowledgment spring"
"confirmation pop"

L3:
"quick spring action"
"snappy rebound"
"crisp jiggle"
"sharp wobble"

L4:
"like a snap of a wire"
"like a quick salute"
"like a tap-and-bounce"
"like notification arriving"
"like elastic snap"
"like a quick handshake"
```

#### Korean (50+)
```
L1:
"QUICK으로" / "퀵 스프링" / "QUICK 프리셋"
"피그마 퀵"

L2:
핵심:
"탁탁 튕기듯"
"토스트같이 통통"
"알림처럼 살짝 튀어나오듯"
"퀵 스프링"
"빠른 바운스"
"날카로운 스프링"
"민첩한 스프링"
"신속한 바운스"

감각:
"날카로운 바운스"
"샤프한 팝"
"탁탁한 반발"
"민첩한 리바운드"
"신속한 반동"

UX:
"토스트 알림 느낌"
"스낵바 바운스"
"피드백 바운스"
"확인 스프링"
"승인 팝"

L3:
"빠른 스프링 액션"
"민첩한 리바운드"
"날카로운 흔들림"
"샤프한 워블"

L4:
"와이어 스냅처럼"
"빠른 경례처럼"
"탭 후 바운스"
"알림 도착처럼"
"엘라스틱 스냅"
"빠른 악수처럼"
```

### 4.10 BOUNCY Spring — 통통 튀는 스프링

**Figma type:** `"BOUNCY"` (preset)  
**Use:** Likes, playful UI, delightful moments. The most expressive spring.

#### English (70+)
```
L1:
"BOUNCY" / "bouncy spring" / "BOUNCY preset"
"Figma bouncy"

L2:
Core:
bouncy / springy / elastic / lively
"playful spring" / "joyful spring"
"heart bounce" / "lively bounce"
"pronounced bounce"
"expressive spring"

Onomatopoeic:
boing / boingy / sproing / poing
jelly / jellylike / "jelly-bounce"
jiggly / wobbly / wiggle
"bounce-bounce" / "hop"
"skip" / "pop"

Casual:
"vibey bounce"
"chef's-kiss bounce"
"main-character bounce"
"dramatic bounce"
"subtle bounce" (with caveat)
"soft bounce" / "hard bounce"

Modern slang:
"bouncy af"
"jelly af"
"absolutely bouncy"
"sends bouncy"

Tech/Design:
"spring-loaded feel"
"physics-based bounce"
"mass-spring system"
"Disney bounce"
"Pixar bounce"
"iOS bounce" / "Cupertino bounce"

L3:
"poppy bounce"
"hoppy bounce"
"playful jiggle"
"animated wobble"

L4:
Physical:
"like a trampoline"
"like a basketball"
"like a slinky"
"like a bobbing apple"
"like a yo-yo"
"like a swing"
"like jelly settling"
"like a rubber ball"
"like a bouncing castle"

Brand:
"like Instagram heart"
"like Facebook reaction"
"like TikTok like"
"like Discord notification"
"like game UI"
"like Mario jumping"
"like Pixar character"
```

#### Korean (70+)
```
L1:
"BOUNCY로" / "바운시 스프링" / "BOUNCY 프리셋"
"피그마 바운시"

L2:
핵심:
탄력있게 / 탄력있는
통통 / 통통하게 / 통통튀듯
튕기듯 / 튕기는 / 튕긴다
스프링같이 / 스프링처럼
탄성있게 / 탄성있는
"표정있는 스프링"
"개성있는 바운스"

의성어:
폴짝폴짝 / 폴짝
깡총깡총 / 깡총
출렁출렁 / 출렁
콩콩 / 콩콩콩
통통통 / 통통
또각또각 / 또각

캐주얼:
"통실통실"
"토실토실"
"보들보들"
"말랑말랑"
"푹신하게"
"쫀득쫀득"
"탱탱하게"

MZ/구어:
"개통통" (강조)
"진짜 통통"
"엄청 튕기게"
"미친 듯 바운스"
"통통이"

Tech/Design:
"스프링 로드 느낌"
"물리 기반 바운스"
"매스-스프링 시스템"
"디즈니 바운스"
"픽사 바운스"
"iOS 바운스" / "쿠퍼티노 바운스"

L3:
"퐁퐁 바운스"
"껑충 바운스"
"장난스러운 흔들림"
"활기찬 워블"

L4:
물리:
"트램폴린처럼"
"농구공처럼"
"슬링키처럼"
"사과 바운스처럼"
"요요처럼"
"그네처럼"
"젤리 안착"
"고무공처럼"
"바운싱 캐슬처럼"

브랜드:
"인스타 하트처럼"
"페북 반응처럼"
"틱톡 좋아요처럼"
"디스코드 알림처럼"
"게임 UI처럼"
"마리오 점프처럼"
"픽사 캐릭터처럼"
```

### 4.11 SLOW Spring — 느린 스프링

**Figma type:** `"SLOW"` (preset)  
**Use:** Fullscreen content scaling, dramatic settles.

#### English (50+)
```
L1:
"SLOW" / "slow spring" / "SLOW preset"
"Figma slow"

L2:
Core:
"slow spring" / "settled spring"
"deliberate spring"
"fullscreen scaling"
"steady spring"
"slow natural settle"
"weighty spring"
"substantial spring"

Sensory:
"heavy spring"
"slow rebound"
"gradual spring"
"unhurried bounce"
"measured spring"
"steady give"

UX:
"fullscreen reveal"
"dramatic content reveal"
"hero content spring"

L3:
"slow swell"
"gradual rise"
"deliberate motion"
"patient spring"

L4:
"like a yoga breath"
"like a slow exhale"
"like a tide rising"
"like dough rising"
"like a balloon inflating"
"like a stage curtain rising"
"like a slow-motion bounce"

Brand:
"like fullscreen app open"
"like image gallery zoom"
"like Netflix tile expansion"
"like Apple TV+ intro"
```

#### Korean (50+)
```
L1:
"SLOW로" / "슬로우 스프링" / "SLOW 프리셋"
"피그마 슬로우"

L2:
핵심:
"천천히 안착하듯"
"느긋한 스프링"
"차분하게 스프링"
"전체화면 확장하듯"
"안정적 스프링"
"느린 자연 안착"
"묵직한 스프링"
"육중한 스프링"

감각:
"무거운 스프링"
"느린 반발"
"점진적 스프링"
"여유로운 바운스"
"신중한 스프링"
"안정된 반발"

UX:
"전체화면 공개"
"드라마틱 컨텐츠 공개"
"히어로 컨텐츠 스프링"

L3:
"느린 부풀어오름"
"점진적 상승"
"신중한 모션"
"인내심 있는 스프링"

L4:
"요가 호흡처럼"
"천천히 숨 내쉬듯"
"조수가 차오르듯"
"반죽이 부풀듯"
"풍선 부풀어 오르듯"
"무대 커튼 올라가듯"
"슬로우 모션 바운스"

브랜드:
"전체화면 앱 열림처럼"
"이미지 갤러리 줌"
"넷플릭스 타일 확장"
"애플TV+ 인트로처럼"
```

### 4.12 CUSTOM_CUBIC_BEZIER — 커스텀 베지어

**Figma type:** `"CUSTOM_CUBIC_BEZIER"` with `easingFunctionCubicBezier: {x1,y1,x2,y2}`

#### Common preset patterns
```
Material 3 Emphasized:
EN: "Material 3 emphasized" / "Material emphasized"
KO: "머티리얼 3 강조" / "Material 3 강조"
→ easingFunctionCubicBezier: { x1: 0.2, y1: 0, x2: 0, y2: 1 }

Apple/iOS Standard:
EN: "iOS standard" / "Cupertino" / "Apple smooth"
KO: "iOS 표준" / "쿠퍼티노" / "애플 부드러움"
→ easingFunctionCubicBezier: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }

Custom user-defined:
EN: "bezier(0.4, 0, 0.6, 1)" / "cubic-bezier custom"
KO: "베지어 직접 지정" / "베지어 0.4, 0, 0.6, 1"
→ Use exact values

When to use:
- User specifies exact x1, y1, x2, y2 values
- Brand-specific motion that doesn't fit Figma natives
- Need "emphasized" Material-style curve
```

### 4.13 CUSTOM_SPRING — 커스텀 스프링

**Figma type:** `"CUSTOM_SPRING"` with `easingFunctionSpring: {mass, stiffness, damping, initialVelocity}`

#### When to use
```
- User specifies exact spring physics
- Need specific behavior beyond GENTLE/QUICK/BOUNCY/SLOW
- Reproduce specific app's bounce feel

Common patterns:
"Very bouncy" / "엄청 튀게":
  { mass: 1, stiffness: 600, damping: 10, initialVelocity: 0 }

"Soft jelly" / "쫀득쫀득":
  { mass: 1.5, stiffness: 100, damping: 30, initialVelocity: 0 }

"Tight snap" / "딱 안착":
  { mass: 1, stiffness: 400, damping: 35, initialVelocity: 0 }

"Wobbly jelly" / "흐물흐물":
  { mass: 2, stiffness: 80, damping: 12, initialVelocity: 0 }

User specifies: "damping 15, stiffness 300" → use exact values
```

### 4.14 Easing Decision Tree

```
User input includes spring/bounce vocabulary?
├─ YES → Spring preset or CUSTOM_SPRING
│   ├─ "subtle/gentle/은은하게" → GENTLE
│   ├─ "quick/snappy/탁탁" → QUICK
│   ├─ "bouncy/lively/통통" → BOUNCY
│   ├─ "slow/settled/느긋한" → SLOW
│   └─ "exact values" → CUSTOM_SPRING
│
└─ NO → Cubic-style easing
    ├─ "linear/mechanical/일정하게" → LINEAR
    ├─ Direction: entry/landing/안착 → EASE_OUT
    ├─ Direction: exit/departing/떠나듯 → EASE_IN
    ├─ Direction: bidirectional/양방향 → EASE_IN_AND_OUT
    ├─ Has overshoot/anticipation
    │   ├─ "overshoot then settle/오버슛" → EASE_OUT_BACK
    │   ├─ "wind-up then leave/움츠림" → EASE_IN_BACK
    │   └─ "both ends back/양끝" → EASE_IN_AND_OUT_BACK
    └─ Brand-specific or "emphasized"
        ├─ "Material" → CUSTOM_CUBIC_BEZIER(0.2,0,0,1)
        ├─ "iOS smooth" → CUSTOM_CUBIC_BEZIER(0.25,0.1,0.25,1)
        └─ User-specified bezier → CUSTOM_CUBIC_BEZIER
```

---

## 5. Transition Dictionary / Transition 사전

8 Figma transition types (3 simple + 5 directional). Each with 50-80 vocabulary entries.

### 5.1 DISSOLVE — 페이드/디졸브

**Figma type:** `"DISSOLVE"` (SimpleTransition)  
**Behavior:** Pure opacity transition. No movement.  
**Use:** Tab switches, unrelated content, modal backdrops.

#### English (60+)
```
L1:
"DISSOLVE" / "DISSOLVE transition"
"Figma dissolve" / "opacity transition"
"alpha transition" / "cross-fade type"

L2:
Core:
fade / "fade in" / "fade out" / "cross-fade"
dissolve / "cross-dissolve" / "dissolve in"
blend / blending / "blend transition"
"opacity blend" / "alpha blend"
wash / "wash in" / "wash out"
melt / "melt in"
bleed / "bleed through"

Sensory:
"mist in" / "mist out"
"fog in" / "fog out"
"haze in" / "haze out"
"blur out" (in dissolve sense)
"evaporate" / "evaporating"
"vanish" / "vanishing"
"dematerialize"
"materialize"
"phase in" / "phase out"

Cinematic:
"film fade" / "movie dissolve"
"cinema fade" / "scene fade"
"atmospheric fade"
"mood transition"
"fade to black" / "fade from white"

UX/Tech:
"opacity transition"
"alpha-blend transition"
"soft swap"
"silent transition"
"invisible motion"

Modern slang:
"vibes-only transition"
"clean fade"
"smooth fade af"

L3:
"foggy fade" / "misty fade"
"smoky transition"
"smoky fade"
"silent fade"

L4:
"like fog rolling in"
"like smoke clearing"
"like dawn breaking"
"like ink dispersing in water"
"like cloud forming"
"like steam dissipating"
"like consciousness fading"
"like a dream sequence"
"like ghost appearing"
```

#### Korean (60+)
```
L1:
"DISSOLVE로" / "DISSOLVE 트랜지션"
"피그마 디졸브" / "투명도 전환"
"알파 전환" / "크로스페이드 타입"

L2:
핵심:
페이드 / 페이드 인 / 페이드 아웃
디졸브 / 크로스 디졸브
"서서히" / "점점" / "점차적으로"
"흐려지면서" / "흐려지듯"
"사라지면서" / "사라지듯"
"옅어지면서" / "옅어지듯"
"흩어지면서" / "흩어지듯"
"녹아내리듯" / "녹아드는"
"블렌드" / "블렌딩"

감각:
"안개처럼" / "안개 같이"
"안개로 사라지듯"
"김 서리듯"
"연기처럼" / "연기 같이"
"흐릿하게" / "흐릿하니"
"사라사라" / "사르륵"
"증발하듯"
"증발하면서"
"흩날리듯"
"비물질화"

시네마틱:
"필름 페이드" / "영화 디졸브"
"시네마 페이드"
"씬 페이드"
"분위기 전환"
"검은색으로 페이드"
"흰색에서 페이드"

UX/Tech:
"투명도 전환"
"알파 블렌드 전환"
"부드러운 스왑"
"조용한 전환"
"보이지 않는 모션"

MZ/구어:
"바이브 전환"
"클린 페이드"
"부드러운 페이드"

L3:
"안개 같은 페이드"
"연기 같은 전환"
"훅 사라지듯"
"슈우 사라지듯"

L4:
"안개가 밀려오듯"
"연기가 걷히듯"
"새벽이 밝아오듯"
"먹물이 물에 퍼지듯"
"구름이 형성되듯"
"수증기 사라지듯"
"의식이 사라지듯"
"꿈 같은 장면"
"유령이 나타나듯"
```

### 5.2 SMART_ANIMATE — 자동 매칭 변형

**Figma type:** `"SMART_ANIMATE"` (SimpleTransition)  
**Behavior:** Auto-matches same-named layers between frames.  
**Use:** Card → detail, button → loading, hero animations.

#### English (60+)
```
L1:
"SMART_ANIMATE" / "Figma Smart Animate"
"smart animate transition"
"shared element transition"
"automatic layer matching"
"matching layers transition"

L2:
Core:
morph / morphing / "morph transition"
transform / transforming / "transform between"
"shape-shift" / "shape-shifting"
"shared element" / "shared element animation"
"magic move" / "magic transition"
"hero animation" / "hero transition"
"continuous element"
"connected motion"
"persistent element"
"connected animation"

Material 3 specific:
"container transform"
"Material container transform"
"Material morph"

iOS specific:
"iOS hero"
"hero transition"
"shared element iOS"

Sensory:
"melt into"
"flow into"
"merge into"
"blend into"
"morph into"
"evolve into"
"transition into"
"reshape into"
"liquid transition"
"fluid change"

UX/Tech:
"connected animation"
"matched element transition"
"linked layer animation"
"auto-tween between frames"

L3:
"smoothly morph"
"seamlessly transform"
"flow-transform"
"liquid-shift"
"organic-change"

L4:
"like origami unfolding"
"like paper folding"
"like a transformer transforming"
"like liquid metal shape-shifting"
"like a chameleon changing color"
"like ice melting"
"like water freezing"
"like clay molding"
"like wax shaping"
"like a butterfly emerging"

Brand:
"like Material 3 container expand"
"like iOS card-to-detail"
"like Apple Photos zoom"
"like Notion page expand"
"like a Pinterest pin expand"
"like Instagram story tap"
```

#### Korean (60+)
```
L1:
"SMART_ANIMATE로" / "피그마 스마트 애니메이트"
"스마트 애니메이트 전환"
"공유 요소 전환"
"자동 레이어 매칭"
"매칭 레이어 전환"

L2:
핵심:
모핑 / 모핑 전환
트랜스폼 / 트랜스폼 전환
"모양 바뀌면서" / "모양이 변형되면서"
"형태가 변하면서" / "형태가 바뀌면서"
"이어지듯" / "끊김없이 이어지듯"
"같은 요소가" / "동일 요소가"
"연결되면서" / "이어지면서"
"히어로 애니메이션" / "히어로 트랜지션"
"공유 요소" / "공유 요소 애니메이션"
"매직 무브" / "매직 전환"
"지속 요소" / "연결 모션"

머티리얼 3:
"컨테이너 트랜스폼"
"머티리얼 컨테이너 트랜스폼"
"머티리얼 모프"

iOS:
"iOS 히어로"
"히어로 전환"
"iOS 공유 요소"

감각:
"녹아들 듯"
"흘러들 듯"
"합쳐지듯"
"섞여들 듯"
"변형되듯"
"진화하듯"
"변모하듯"
"형태가 다르게"
"액체 전환"
"유체 변화"

UX/Tech:
"연결 애니메이션"
"매치 요소 전환"
"링크된 레이어 애니메이션"
"자동 트윈"

L3:
"부드럽게 변형"
"매끄럽게 변형"
"흐름타며 변형"
"액체처럼 변형"
"유기적 변화"

L4:
"오리가미 펼쳐지듯"
"종이 접기처럼"
"트랜스포머가 변신하듯"
"액체 금속이 변형되듯"
"카멜레온 색 바뀌듯"
"얼음 녹듯"
"물이 어는 듯"
"점토 빚어지듯"
"왁스 형태 만들듯"
"나비가 우화하듯"

브랜드:
"머티리얼 3 컨테이너 확장처럼"
"iOS 카드-디테일처럼"
"애플 포토 줌처럼"
"노션 페이지 확장"
"핀터레스트 핀 확장"
"인스타 스토리 탭"
```

### 5.3 SCROLL_ANIMATE — 스크롤 애니메이션

**Figma type:** `"SCROLL_ANIMATE"` (SimpleTransition)  
**Behavior:** Scroll-based smooth animation.  
**Use:** Scroll-linked transitions, parallax-like.

#### English (40+)
```
L1:
"SCROLL_ANIMATE" / "scroll-animate transition"
"scroll-based animation"

L2:
"scroll animation"
"scroll-linked"
"scroll-driven"
"scroll-triggered smooth"
"scroll-tied motion"
"parallax-like"
"scroll-paced animation"
"linked-to-scroll"

L3:
"smoothly scroll-tied"
"scroll-controlled"

L4:
"like parallax depth"
"like a movie storyboard scrolling"
"like Apple product page scroll"
"like a comic book pan"
```

#### Korean (40+)
```
L1:
"SCROLL_ANIMATE로" / "스크롤 애니메이트"
"스크롤 기반 애니메이션"

L2:
"스크롤 따라"
"스크롤에 맞춰"
"스크롤 애니메이션"
"스크롤 연동"
"스크롤 기반"
"스크롤 묶임 모션"
"패럴랙스 같이"
"스크롤 페이싱"

L3:
"스크롤에 부드럽게 묶인"
"스크롤 제어"

L4:
"패럴랙스 깊이감처럼"
"영화 스토리보드 스크롤"
"애플 제품 페이지 스크롤"
"만화책 팬처럼"
```

### 5.4 MOVE_IN / MOVE_OUT — 위에 들어오기

**Figma type:** `"MOVE_IN"` / `"MOVE_OUT"` (DirectionalTransition)  
**Behavior:** Destination moves over origin. Origin stays put.  
**Use:** Drawer, side panel, hamburger menu, bottom sheet, toast.

#### English (60+)
```
L1:
"MOVE_IN" / "MOVE_OUT"
"move in transition" / "move out transition"
"Figma move"
"overlay slide"

L2:
Core:
"move in from [direction]"
"slide on top from [direction]"
"slide over"
"slide above"
"move over origin"
"overlay from side"

UI patterns:
"drawer from [side]"
"drawer slide"
"side drawer"
"panel from side"
"side panel"
"off-canvas menu"
"off-canvas slide"
"sheet from bottom"
"bottom sheet"
"hamburger menu opening"
"side menu reveal"

Sensory:
"slide in over"
"glide over"
"sweep over"
"swing in over"
"unfold from side"
"emerge from edge"

Notification specific:
"notification banner from top"
"banner from top"
"toast slide-in"

L3:
"slide-in-on-top"
"overlay-slide"
"come-and-sit-on-top"

L4:
"like a curtain sliding over"
"like a drawer pulled out"
"like a card placed on top"
"like a tray sliding out"
"like a side drawer in a cabinet"
"like a billboard sliding in"
"like Apple iOS Control Center"
"like a notification banner"
```

#### Korean (60+)
```
L1:
"MOVE_IN" / "MOVE_OUT"
"무브 인 전환" / "무브 아웃 전환"
"피그마 무브"
"오버레이 슬라이드"

L2:
핵심:
"[방향]에서 위로 들어와"
"[방향]에서 덮으면서"
"위로 슬라이드"
"위에 슬라이드"
"기존 위로 이동"
"옆에서 오버레이"

UI 패턴:
"드로어 열리듯"
"드로어 슬라이드"
"사이드 드로어"
"사이드 패널 들어오듯"
"사이드 패널"
"오프캔버스 메뉴"
"오프캔버스 슬라이드"
"바텀시트 올라오듯"
"바텀 시트"
"햄버거 메뉴 열림"
"사이드 메뉴 공개"

감각:
"위에 슬라이드 인"
"위로 글라이드"
"위로 스위프"
"위로 스윙 인"
"옆에서 펼쳐지듯"
"가장자리에서 솟아나듯"

알림:
"위에서 알림 배너"
"상단에서 배너"
"토스트 슬라이드 인"

L3:
"위에 슬라이드 인"
"오버레이 슬라이드"
"와서 위에 앉듯"

L4:
"커튼이 위에 슬라이드되듯"
"서랍이 빠져나오듯"
"카드가 위에 놓이듯"
"트레이가 빠져나오듯"
"캐비닛 사이드 드로어"
"광고판 슬라이드 인"
"iOS 컨트롤 센터처럼"
"알림 배너처럼"
```

### 5.5 PUSH — 함께 밀어내기

**Figma type:** `"PUSH"` (DirectionalTransition)  
**Behavior:** Destination pushes origin away. Both move together.  
**Use:** Onboarding steps, carousel, iOS navigation, swipe.

#### English (60+)
```
L1:
"PUSH" / "PUSH transition"
"Figma push"

L2:
Core:
"push transition"
"push in" / "push out"
"swipe to next"
"page push"
"page next" / "page previous"
"carousel-style"
"swipe navigation"

iOS specific:
"iOS push" / "iOS push navigation"
"iOS drill-in"
"drill-in"
"drill-down navigation"
"hierarchical push"
"breadcrumb forward"
"step forward"

Carousel:
"swipeable carousel"
"slideshow advance"
"image carousel push"
"banner carousel"

Sensory:
"shove sideways"
"push together"
"slide both"
"pair-slide"

L3:
"page-flip" (in push sense)
"swiping pages"
"flipping cards"
"next-card animation"

L4:
"like a slideshow advance"
"like a deck of cards being dealt"
"like a slide projector advance"
"like an old-school slideshow"
"like Snapchat stories"
"like Instagram stories swipe"
"like TikTok scroll"
"like a Rolodex"
"like train cars in motion"
"like a conveyor belt advance"
```

#### Korean (60+)
```
L1:
"PUSH" / "PUSH 전환"
"피그마 푸시"

L2:
핵심:
"푸시 전환"
"푸시 인" / "푸시 아웃"
"다음으로 스와이프"
"페이지 푸시"
"페이지 다음" / "페이지 이전"
"캐러셀처럼"
"스와이프 네비게이션"

iOS:
"iOS 푸시" / "iOS 푸시 네비게이션"
"iOS 드릴인"
"드릴인 네비게이션"
"드릴다운 네비게이션"
"계층적 푸시"
"브레드크럼 진행"
"단계 진행"

캐러셀:
"스와이프 캐러셀"
"슬라이드쇼 진행"
"이미지 캐러셀 푸시"
"배너 캐러셀"

감각:
"옆으로 밀어내듯"
"함께 밀어내듯"
"같이 슬라이드"
"페어 슬라이드"
"다음으로 밀어"

L3:
"페이지 넘기듯" (푸시 의미로)
"페이지 스와이핑"
"카드 플립"
"다음 카드 애니메이션"

L4:
"슬라이드쇼 진행"
"카드 한 장씩 나눠주듯"
"슬라이드 프로젝터 진행"
"옛날식 슬라이드쇼"
"스냅챗 스토리처럼"
"인스타 스토리 스와이프"
"틱톡 스크롤처럼"
"롤로덱스처럼"
"기차 칸이 움직이듯"
"컨베이어 벨트 진행"
```

### 5.6 SLIDE_IN / SLIDE_OUT — 슬라이드 + 디졸브

**Figma type:** `"SLIDE_IN"` / `"SLIDE_OUT"` (DirectionalTransition)  
**Behavior:** Destination slides while origin dissolves.  
**Use:** Softer alternative to PUSH or MOVE.

#### English (50+)
```
L1:
"SLIDE_IN" / "SLIDE_OUT"
"slide-in transition" / "slide-out transition"
"Figma slide"

L2:
Core:
"slide in with fade"
"slide and fade"
"soft slide"
"gentle slide-in"
"slide while fading"
"slide with dissolve"
"slide-fade hybrid"

Sensory:
"slip in"
"glide in"
"drift in"
"slide-in soft"

UX:
"soft entry"
"gentle entry"
"slide-fade entry"

L3:
"slide-with-give"
"glide-and-fade"
"slip-in soft"

L4:
"like an apparition sliding in"
"like a ghost gliding in"
"like a layer revealing"
"like a card being placed"
"like a movie subtitle appearing"
```

#### Korean (50+)
```
L1:
"SLIDE_IN" / "SLIDE_OUT"
"슬라이드 인 전환" / "슬라이드 아웃 전환"
"피그마 슬라이드"

L2:
핵심:
"슬라이드하면서 사라져"
"옆으로 가면서 디졸브"
"부드럽게 슬라이드"
"흐려지면서 슬라이드"
"슬라이드 + 디졸브"
"슬라이드 페이드 하이브리드"

감각:
"슬립 인"
"글라이드 인"
"드리프트 인"
"부드럽게 슬라이드 인"

UX:
"부드러운 진입"
"잔잔한 진입"
"슬라이드 페이드 진입"

L3:
"슬라이드 위드 기브"
"글라이드 앤 페이드"
"슬립 인 소프트"

L4:
"환영이 슬라이드 인하듯"
"유령이 글라이드 인하듯"
"레이어가 공개되듯"
"카드가 놓이듯"
"영화 자막이 나타나듯"
```

### 5.7 No Transition (Instant) — 즉시 변경

**Set transition to null or omit field entirely**

#### English
```
L1:
"null transition" / "no transition" / "transition: null"
"omit transition" / "instant transition"

L2:
"instant" / "immediate" / "no animation"
"hard cut" / "jump cut" / "direct change"
"abrupt" / "sudden" / "discrete"
"snap-change"

L3:
"boom" / "bam" / "pop"
"poof" / "abracadabra"
"voila" / "ta-da"
"in a snap" / "just like that"

L4:
"like flicking a switch"
"like teleporting"
"like magic"
"like a jump cut in film"
```

#### Korean
```
L1:
"null 트랜지션" / "트랜지션 없이"
"전환 없이"

L2:
"즉시" / "바로" / "그냥 변경"
"즉각" / "단번에"
"하드 컷" / "직접 변경"
"갑작스럽게" / "갑자기"

L3:
"짠" / "쨘" / "팡"
"펑" / "뿅"
"한 방에"

L4:
"스위치 켜듯"
"순간이동처럼"
"마술처럼"
"영화 점프 컷처럼"
```

### 5.8 MOVE vs PUSH vs SLIDE Decision Tree

Critical disambiguation. Most commonly confused area.

```
User wants origin to STAY visible (overlay-like)?
├─ YES → MOVE_IN (destination on top of origin, origin stays)
│   Examples:
│   - Hamburger menu opens (background stays)
│   - Bottom sheet rises
│   - Notification banner from top
│   - Modal overlay

User wants origin to MOVE OUT (swipe-like)?
├─ YES → PUSH (both frames slide together)
│   Examples:
│   - iOS next page
│   - Onboarding step forward
│   - Carousel swipe
│   - Image gallery swipe

User wants origin to FADE while new comes in?
├─ YES → SLIDE_IN (slide + dissolve hybrid)
│   Examples:
│   - Soft tab transition
│   - Content fade-and-slide
│   - Subtitle/caption changes

User just wants opacity change (no motion)?
├─ YES → DISSOLVE
│   Examples:
│   - Tab switch (unrelated)
│   - Modal backdrop
│   - Theme change

User wants same element to transform shape/position?
├─ YES → SMART_ANIMATE
│   Examples:
│   - Card → detail view
│   - Avatar → full photo
│   - Button → loading state

User wants slide + element morph combo?
└─ YES → PUSH/MOVE/SLIDE with matchLayers: true
    Examples:
    - Material 3 container transform with direction
    - Story page swipe with element continuity
```

---

## 6. Direction Dictionary / 방향 사전

DirectionalTransitions require `direction`. 4 values × 30-50 vocabulary entries.

### 6.1 LEFT — 오른쪽에서 들어와 왼쪽으로

**Figma value:** `direction: "LEFT"`  
**Meaning:** Destination enters from the right side, moves leftward. Origin pushed/covered toward left.

#### English (40+)
```
L1:
"direction: LEFT" / "LEFT direction"

L2:
"from the right" / "from right side"
"right-to-left" / "right to left"
"rightward to leftward"
"moves leftward"
"slides left"

Navigation context:
"next" / "next page" / "next step"
"forward" / "going forward"
"advance" / "advancing"
"drill in" / "drill-in"
"proceed" / "proceeding"
"continue" / "continuing"
"onward" / "go on"
"go next"
"step forward"

Mobile gesture:
"swipe left" (origin moves left)
"swipe to next"
"swipe forward"

iOS specific:
"iOS push next"
"iOS forward"
"iOS push navigation"
"iOS drill-in"

L3:
"flow leftward"
"travel left"
"glide left"

L4:
"like turning a page right-to-left"
"like reading direction (Western)"
"like book pages opening"
"like Western timeline forward"
```

#### Korean (40+)
```
L1:
"direction: LEFT" / "LEFT 방향"

L2:
"오른쪽에서" / "오른쪽에서부터"
"오른쪽에서 들어와"
"우측에서 들어와"
"우측에서 좌측으로"
"왼쪽으로 이동"
"왼쪽으로 슬라이드"

네비게이션:
"다음으로" / "다음으로 진행"
"다음 화면" / "다음 단계"
"앞으로" / "앞으로 진행"
"진행" / "진행하면"
"넘겨" / "넘기면"
"드릴인" / "드릴인 네비"
"계속" / "계속하면"
"나아가" / "앞으로 가"

모바일 제스처:
"왼쪽으로 스와이프"
"다음으로 스와이프"
"앞으로 스와이프"

iOS:
"iOS 다음 화면처럼"
"iOS 진행"
"iOS 푸시 네비게이션"
"iOS 드릴인"

L3:
"왼쪽으로 흐름"
"왼쪽으로 이동"
"왼쪽으로 글라이드"

L4:
"오른쪽-왼쪽 페이지 넘기듯"
"서양 독서 방향처럼"
"책 페이지 열리듯"
"서양 타임라인 진행처럼"
```

### 6.2 RIGHT — 왼쪽에서 들어와 오른쪽으로

**Figma value:** `direction: "RIGHT"`  
**Meaning:** Destination enters from the left side, moves rightward.

#### English (40+)
```
L1:
"direction: RIGHT" / "RIGHT direction"

L2:
"from the left" / "from left side"
"left-to-right" / "left to right"
"leftward to rightward"
"moves rightward"
"slides right"

Navigation context:
"back" / "going back"
"previous" / "go to previous"
"return" / "returning"
"pop back" / "popping back"
"backward" / "backwards"
"step back"
"undo navigation"
"reverse"
"prior page"

Mobile gesture:
"swipe right" (origin moves right)
"swipe to previous"
"swipe back"

iOS specific:
"iOS pop back"
"iOS back gesture"
"iOS swipe back"

L3:
"flow rightward"
"travel right"
"glide right"

L4:
"like reversing a page"
"like going back in history"
"like book pages closing"
```

#### Korean (40+)
```
L1:
"direction: RIGHT" / "RIGHT 방향"

L2:
"왼쪽에서" / "왼쪽에서부터"
"왼쪽에서 들어와"
"좌측에서 들어와"
"좌측에서 우측으로"
"오른쪽으로 이동"
"오른쪽으로 슬라이드"

네비게이션:
"뒤로" / "뒤로 가기"
"이전으로" / "이전 화면으로"
"이전" / "이전 페이지"
"돌아가" / "돌아가기"
"되돌아가" / "되돌리기"
"뒤" / "뒤쪽"
"역방향" / "역으로"
"이전으로 진행"
"백 가기"

모바일 제스처:
"오른쪽으로 스와이프"
"이전으로 스와이프"
"뒤로 스와이프"

iOS:
"iOS 뒤로 가기"
"iOS 백 제스처"
"iOS 스와이프 백"

L3:
"오른쪽으로 흐름"
"오른쪽으로 이동"
"오른쪽으로 글라이드"

L4:
"페이지를 거꾸로 넘기듯"
"히스토리 뒤로 가듯"
"책 페이지 덮히듯"
```

### 6.3 TOP — 아래에서 들어와 위로

**Figma value:** `direction: "TOP"`  
**Meaning:** Destination enters from bottom, moves upward.

#### English (40+)
```
L1:
"direction: TOP" / "TOP direction"

L2:
"from the bottom" / "from below"
"bottom-to-top" / "bottom to top"
"rising" / "rising up"
"upward" / "moving up"
"swiping up"
"slides up"

UI patterns:
"bottom sheet up"
"bottom sheet rising"
"rising banner"
"action sheet"
"keyboard appearing"
"toolbar from bottom"

Gesture:
"swipe up"
"flick up"
"pull up"

L3:
"flow upward"
"soar up"
"glide up"
"rise up"

L4:
"like a balloon rising"
"like steam rising"
"like a sunrise"
"like a curtain rising"
"like a tide rising"
"like elevator going up"
"like a rocket lifting off"
"like a phoenix rising"
```

#### Korean (40+)
```
L1:
"direction: TOP" / "TOP 방향"

L2:
"아래에서" / "아래에서부터"
"아래에서 들어와"
"아래에서 위로"
"위로 올라와"
"위로 이동"
"올라와" / "올라오는"
"솟아오르듯" / "솟아오르는"
"위로 스와이프"
"위로 슬라이드"

UI 패턴:
"바텀시트가 올라와"
"바텀시트 상승"
"솟아오르는 배너"
"액션 시트"
"키보드 등장"
"하단 툴바"

제스처:
"위로 스와이프"
"위로 플릭"
"위로 당기기"

L3:
"위로 흐름"
"위로 솟구침"
"위로 글라이드"
"솟아오르듯"

L4:
"풍선이 떠오르듯"
"수증기 올라오듯"
"일출처럼"
"커튼이 올라가듯"
"조수가 차오르듯"
"엘리베이터 상승"
"로켓 발사"
"피닉스 비상"
```

### 6.4 BOTTOM — 위에서 들어와 아래로

**Figma value:** `direction: "BOTTOM"`  
**Meaning:** Destination enters from top, moves downward.

#### English (40+)
```
L1:
"direction: BOTTOM" / "BOTTOM direction"

L2:
"from the top" / "from above"
"top-to-bottom" / "top to bottom"
"falling" / "dropping"
"downward" / "moving down"
"dropping down"
"slides down"

UI patterns:
"notification drop"
"notification from top"
"banner drop"
"header reveal"
"drop-down menu falling"
"alert appearing"

Gesture:
"swipe down"
"flick down"
"pull down"
"drag down"

L3:
"flow downward"
"drop down"
"glide down"
"plummet"

L4:
"like rain falling"
"like a feather falling"
"like a guillotine drop"
"like a leaf falling"
"like a banner unfurling"
"like a curtain dropping"
"like elevator descending"
"like a notification dropping"
```

#### Korean (40+)
```
L1:
"direction: BOTTOM" / "BOTTOM 방향"

L2:
"위에서" / "위에서부터"
"위에서 내려와"
"위에서 아래로"
"아래로 내려와"
"아래로 이동"
"내려오는" / "떨어지는"
"하강" / "하강하는"
"떨어지듯"
"아래로 슬라이드"

UI 패턴:
"알림이 위에서 내려와"
"상단 알림"
"배너 드롭"
"헤더 공개"
"드롭다운 메뉴 떨어짐"
"알럿 등장"

제스처:
"아래로 스와이프"
"아래로 플릭"
"아래로 당기기"
"아래로 드래그"

L3:
"아래로 흐름"
"아래로 떨어짐"
"아래로 글라이드"
"급강하"

L4:
"비가 내리듯"
"깃털이 떨어지듯"
"기요틴 떨어지듯"
"잎이 떨어지듯"
"현수막이 펼쳐지듯"
"커튼이 떨어지듯"
"엘리베이터 하강"
"알림이 내려오듯"
```

### 6.5 Direction Default Inference

When user doesn't specify direction:

```
Action: "next" / "forward" / "다음" / "앞으로" → LEFT
Action: "back" / "previous" / "이전" / "뒤로" → RIGHT
Action: "open drawer left side" / "왼쪽 메뉴" → RIGHT (entering from left)
Action: "open drawer right side" / "오른쪽 메뉴" → LEFT (entering from right)
Action: "bottom sheet" / "바텀시트" → TOP (entering from bottom)
Action: "notification" / "토스트" / "알림" → BOTTOM (typically drops from top)
Action: "keyboard" / "키보드" → TOP (rising from bottom)
Action: undefined → LEFT (most common navigation default)
```

---

## 7. Combined Patterns / 복합 패턴

Common transition + easing + duration combinations for typical UI moments.

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

// Toast notification appearing from top
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

// Material 3 container transform
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
  easing: { type: "BOUNCY" },
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
  matchLayers: true,  // ★ enables smart-animate behavior
  easing: { type: "EASE_OUT" },
  duration: 0.4
}

// Dramatic exit with anticipation
{
  type: "DISSOLVE",
  easing: { type: "EASE_IN_BACK" },
  duration: 0.4
}
```

---

## 8. Domain Adjustments / 도메인 보정

Same expression interpreted differently per domain.

### 8.1 Finance / Enterprise
```
Default tendencies:
- Prefer EASE_IN_AND_OUT (balanced, professional)
- Avoid CUSTOM_SPRING with high stiffness (jarring)
- Duration cap: md (0.15s) for most cases
- Prefer DISSOLVE over directional transitions
- Avoid SMART_ANIMATE on critical flows

"smooth" → DISSOLVE + EASE_IN_AND_OUT + md (0.15s)
"snappy" → DISSOLVE + EASE_OUT + sm (0.10s)
"emphasized" → DISSOLVE + CUSTOM_CUBIC_BEZIER + md
```

### 8.2 Social / Entertainment
```
Default tendencies:
- Embrace BOUNCY/QUICK spring presets
- SMART_ANIMATE for delight
- Duration: lg (0.25s) or xl (0.4s) frequently
- Playful EASE_OUT_BACK for entries

"smooth" → SMART_ANIMATE + EASE_OUT + lg (0.25s)
"playful" → SMART_ANIMATE + BOUNCY + xl
"dramatic" → DISSOLVE + EASE_OUT_BACK + xxl
```

### 8.3 B2B / Productivity
```
Default tendencies:
- Functional, fast
- Prefer EASE_OUT for entries (quick comprehension)
- Duration: sm-md range
- LINEAR for color/opacity-only changes

"smooth" → DISSOLVE + EASE_OUT + md (0.15s)
"snappy" → DISSOLVE + EASE_OUT + xs (0.07s)
```

### 8.4 Gaming / Playful
```
Default tendencies:
- BOUNCY / CUSTOM_SPRING liberal use
- EASE_*_BACK for personality
- Duration: xl+ frequent
- SMART_ANIMATE for transforms

"smooth" → SMART_ANIMATE + EASE_OUT_BACK + xl (0.4s)
"playful" → SMART_ANIMATE + BOUNCY + xl
"epic" → SMART_ANIMATE + CUSTOM_SPRING + xxl
```

### 8.5 Accessibility-first / Medical
```
Default tendencies:
- DISSOLVE preferred (avoid motion sickness)
- LINEAR or EASE_IN_AND_OUT (predictable)
- Avoid BOUNCY/CUSTOM_SPRING (jarring for vestibular issues)
- Avoid SMART_ANIMATE if elements move significantly
- Honor prefers-reduced-motion → DISSOLVE only
- Duration cap: lg (0.25s)

"smooth" → DISSOLVE + EASE_IN_AND_OUT + lg (0.25s)
"clear" → DISSOLVE + EASE_OUT + md
```

---

## 9. Validation Checklist / 검증 체크리스트

### 9.1 Transition Schema Validation
```
[ ] transition.type ∈ 8 valid values:
    DISSOLVE | SMART_ANIMATE | SCROLL_ANIMATE | 
    MOVE_IN | MOVE_OUT | PUSH | SLIDE_IN | SLIDE_OUT

[ ] If type is directional (MOVE/PUSH/SLIDE):
    [ ] direction field exists: LEFT | RIGHT | TOP | BOTTOM
    [ ] matchLayers field exists: boolean

[ ] easing.type ∈ 13 valid values
[ ] If CUSTOM_CUBIC_BEZIER: easingFunctionCubicBezier with x1, y1, x2, y2 (0-1)
[ ] If CUSTOM_SPRING: easingFunctionSpring with mass, stiffness, damping, initialVelocity
[ ] duration is number in seconds, range 0.01 - 10
```

### 9.2 Semantic Validation
```
[ ] SMART_ANIMATE only used when matching layer names exist
[ ] Direction matches user intent (next → LEFT, back → RIGHT)
[ ] Duration appropriate for context
[ ] Easing direction matches transition direction
    - Entry → EASE_OUT preferred
    - Exit → EASE_IN preferred
    - Bidirectional → EASE_IN_AND_OUT preferred
[ ] Accessibility check:
    - User mentioned accessibility → DISSOLVE + LINEAR/EASE_IN_AND_OUT
    - Avoid CUSTOM_SPRING high stiffness
```

### 9.3 Domain-aware Adjustment
```
[ ] Domain detected (finance/social/B2B/gaming/medical)
[ ] Default tokens adjusted per domain
[ ] User override respected (if explicit)
```

---

## 10. LLM System Prompt Guide / LLM 프롬프트

```
You are converting natural language to Figma Prototype animation properties.
Output must conform exactly to Figma's Plugin API Transition and Easing types.

# CRITICAL CONSTRAINTS
- transition.type ∈ {DISSOLVE, SMART_ANIMATE, SCROLL_ANIMATE, MOVE_IN, MOVE_OUT, PUSH, SLIDE_IN, SLIDE_OUT}
- Directional transitions REQUIRE direction (LEFT/RIGHT/TOP/BOTTOM) + matchLayers (boolean)
- easing.type ∈ 13 Figma natives or CUSTOM_*
- CUSTOM_CUBIC_BEZIER REQUIRES easingFunctionCubicBezier
- CUSTOM_SPRING REQUIRES easingFunctionSpring
- duration in SECONDS (not ms)
- For "instant": set transition to null

# DO NOT OUTPUT
- Abstract names like "morph", "fade", "slide" → use Figma natives
- Abstract easing like "standard", "emphasized" → use natives or CUSTOM
- Duration in ms → convert to seconds

# Detection Procedure
1. Detect language (Korean/English/Bilingual)
2. Detect expression level (L1/L2/L3/L4)
3. Detect intent (Enter/Exit/Move/Transform/Emphasize)
4. Map dimensions independently:
   a. Duration → 1 of 7 tokens → seconds
   b. Easing → 1 of 13 Figma natives or CUSTOM
   c. Transition type → 1 of 8 Figma natives or null (instant)
   d. Direction (if Directional) → LEFT/RIGHT/TOP/BOTTOM
5. Apply intensity modifiers (super/very/매우/엄청)
6. Apply negation (not bouncy/튀지 않게)
7. Apply domain context (finance/social/B2B/gaming/medical)
8. Validate against constraints
9. Output Reaction.action.transition object

# Output Format
{
  detected_language: "ko" | "en" | "bilingual",
  detected_level: "L1" | "L2" | "L3" | "L4",
  detected_intent: "Enter" | "Exit" | "Move" | "Transform" | "Emphasize",
  detected_modifiers: ["intensity_boost", ...],
  detected_domain: "finance" | "social" | "B2B" | "gaming" | "medical",
  reasoning: "...",
  transition_object: {
    type: "...",  // Figma valid
    direction?: "...",  // if Directional
    matchLayers?: boolean,  // if Directional
    easing: { type: "...", ... },  // Figma valid
    duration: 0.25  // seconds
  },
  confirmation_message: "..."  // in user's language
}
```

---

## 11. Appendix / 부록

### Appendix A: Token Count Summary

| Dimension | Tokens | Avg vocab/token (EN+KO) |
|---|---|---|
| Duration | 7 | 130-170 |
| Easing | 13 + 2 custom | 100-140 |
| Transition | 8 | 100-130 |
| Direction | 4 | 60-80 |

### Appendix B: Quick Reference (English)

#### Easing
| Token | Best For | Common phrases |
|---|---|---|
| LINEAR | Color/opacity | "linear", "mechanical", "robotic" |
| EASE_IN | Exits | "ease in", "departing", "accelerating" |
| EASE_OUT | Entries (default) | "ease out", "landing", "settling" |
| EASE_IN_AND_OUT | Bidirectional | "smooth", "silky", "natural" |
| EASE_OUT_BACK | Playful entry | "overshoot", "snap into place" |
| EASE_IN_BACK | Dramatic exit | "wind-up then go", "anticipation" |
| EASE_IN_AND_OUT_BACK | Maximum drama | "both ends overshoot" |
| GENTLE | Subtle scaling | "subtle spring", "soft" |
| QUICK | Toasts | "snappy spring", "crisp" |
| BOUNCY | Likes, playful | "bouncy", "springy", "jelly" |
| SLOW | Fullscreen scale | "settled spring", "weighty" |
| CUSTOM_CUBIC_BEZIER | Brand-specific | "Material emphasized", "iOS feel" |
| CUSTOM_SPRING | Specific physics | "damping X, stiffness Y" |

#### Transition
| Token | Behavior | Common phrases |
|---|---|---|
| DISSOLVE | Pure fade | "fade", "cross-fade", "dissolve" |
| SMART_ANIMATE | Auto-match | "morph", "shared element", "hero" |
| SCROLL_ANIMATE | Scroll-linked | "scroll animation" |
| MOVE_IN/OUT | Over origin | "drawer", "side panel", "bottom sheet" |
| PUSH | Both move | "next", "carousel", "swipe" |
| SLIDE_IN/OUT | Slide + fade | "soft slide", "slide while fading" |
| null | Instant | "instant", "no transition", "boom" |

### Appendix C: Quick Reference (한국어)

#### Easing
| 토큰 | 적합 용도 | 자주 쓰는 표현 |
|---|---|---|
| LINEAR | 색상/투명도 | "일정하게", "기계적으로", "칼각으로" |
| EASE_IN | 퇴장 | "이지 인", "떠나듯", "가속하면서" |
| EASE_OUT | 진입 (기본) | "이지 아웃", "안착하듯", "사뿐히" |
| EASE_IN_AND_OUT | 양방향 | "부드럽게", "자연스럽게", "스무스" |
| EASE_OUT_BACK | 장난스러운 진입 | "오버슛", "튕기다 안착" |
| EASE_IN_BACK | 드라마틱 퇴장 | "준비동작 후", "움츠리고 나가듯" |
| EASE_IN_AND_OUT_BACK | 최대 드라마 | "양 끝 다 튕기듯" |
| GENTLE | 미세 스케일 | "은은하게", "잔잔한 스프링" |
| QUICK | 토스트 | "탁탁 튕기듯", "퀵 스프링" |
| BOUNCY | 좋아요, 장난 | "탄력있게", "통통", "튕기듯" |
| SLOW | 전체화면 | "천천히 안착", "묵직한 스프링" |
| CUSTOM_CUBIC_BEZIER | 브랜드 특정 | "Material 강조", "iOS 느낌" |
| CUSTOM_SPRING | 특정 물리 | "damping X, stiffness Y" |

#### Transition
| 토큰 | 동작 | 자주 쓰는 표현 |
|---|---|---|
| DISSOLVE | 순수 페이드 | "서서히", "흐려지면서", "디졸브" |
| SMART_ANIMATE | 자동 매칭 | "모핑", "변형되면서", "이어지듯" |
| SCROLL_ANIMATE | 스크롤 연동 | "스크롤 따라" |
| MOVE_IN/OUT | 위에 들어옴 | "드로어 열리듯", "바텀시트 올라옴" |
| PUSH | 함께 이동 | "다음으로", "캐러셀처럼", "스와이프" |
| SLIDE_IN/OUT | 슬라이드 + 페이드 | "부드러운 슬라이드", "흐려지며 슬라이드" |
| null | 즉시 | "즉시", "트랜지션 없이", "짠" |

### Appendix D: Direction Quick Reference

| Direction | Means | Common phrases |
|---|---|---|
| LEFT | From right, moves left | "next", "다음", "iOS push" |
| RIGHT | From left, moves right | "back", "이전", "iOS pop" |
| TOP | From bottom, moves up | "bottom sheet", "올라와", "rising" |
| BOTTOM | From top, moves down | "notification", "내려와", "drop" |

### Appendix E: Domain × Pattern Matrix

| Domain | Easing | Transition | Duration |
|---|---|---|---|
| Finance/Enterprise | EASE_IN_AND_OUT | DISSOLVE | md (0.15s) |
| Social/Entertainment | EASE_OUT or BOUNCY | SMART_ANIMATE | lg (0.25s) |
| B2B/Productivity | EASE_OUT | DISSOLVE | sm-md |
| Gaming/Playful | EASE_OUT_BACK or BOUNCY | SMART_ANIMATE | xl (0.4s) |
| Accessibility/Medical | EASE_IN_AND_OUT | DISSOLVE | lg (0.25s) |

### Appendix F: Brand Pattern

| Brand | Transition | Easing | Duration |
|---|---|---|---|
| iOS default | PUSH (LEFT) | EASE_IN_AND_OUT | 0.35s |
| Material 3 emphasized | SMART_ANIMATE | CUSTOM_CUBIC_BEZIER(0.2,0,0,1) | 0.5s |
| Instagram heart | SMART_ANIMATE | BOUNCY | 0.4s |
| Toss payment | PUSH (LEFT) | EASE_OUT | 0.3s |
| Slack message | DISSOLVE | EASE_OUT | 0.15s |
| Notion page open | SMART_ANIMATE | EASE_IN_AND_OUT | 0.4s |
| Netflix intro | DISSOLVE | EASE_IN_AND_OUT | 0.8s |
| Game UI explosive | SMART_ANIMATE | CUSTOM_SPRING | 0.6s |
| Apple Pay | DISSOLVE | EASE_OUT | 0.25s |

---

## 12. Cross-document Disambiguation / 자매 문서 간 충돌 해소

★ NEW in v2.7.1: Resolves ambiguities between Animation and Trigger dictionaries.

자매 문서(Trigger Dictionary)와 같은 자연어 어휘가 다른 의미로 매핑될 수 있어요. 이 섹션은 그 충돌을 해소합니다.

### 12.1 Time Expression Conflict / 시간 표현 충돌

The most critical disambiguation. Same word means different things in different dimensions.

| Expression | In Animation (Duration) | In Trigger (AFTER_TIMEOUT) |
|---|---|---|
| "한참" / "a while" | XXL Duration (0.6s+, how long animation) | 5.0초 (when to fire) |
| "오래" / "long" | XL or XXL Duration (animation speed) | 5.0초+ (when to fire) |
| "잠깐" / "a moment" | rarely Duration | 0.5초 (when to fire) |
| "잠시" / "briefly" | rarely Duration | 1.0초 (when to fire) |

### 12.2 Disambiguation Decision Rules

```
Rule 1: Sentence position
- "X 후에 [동작]" / "after X, [verb]" → Time = Trigger (AFTER_TIMEOUT)
  Example: "한참 후에 사라져" → AFTER_TIMEOUT 5s + (Animation: fade default)
  
- "[동작] X (속도/스타일)" / "[verb] X (speed)" → Time = Animation Duration
  Example: "한참 천천히 사라져" → DISSOLVE + EASE_OUT + XL/XXL

Rule 2: Verb proximity
- Time expression closer to "후에/지나면/뒤에" → Trigger
- Time expression closer to verb of motion → Animation

Rule 3: Compound expression
- "X 후에 Y 천천히" → Both (Trigger: X seconds, Animation: Y speed)
  Example: "3초 후에 천천히 사라져" 
  → AFTER_TIMEOUT timeout: 3.0
  → DISSOLVE + EASE_OUT + XL (0.4s)
```

### 12.3 Onomatopoeia Cross-domain (의태어/의성어 교차 등장)

Same onomatopoeia can appear in both dictionaries with different semantic roles.

| Expression | In Animation | In Trigger |
|---|---|---|
| "휙" / "whoosh" | XS Duration + EASE_IN (speed/easing modifier) | ON_DRAG (drag gesture) |
| "확" / "yank" | sm Duration intensifier | ON_DRAG (forceful drag) |
| "쓱" / "swipe" | sm-md Duration | ON_DRAG (swipe gesture) |
| "탁" / "tap" | xs Duration intensifier | ON_CLICK (tap) |
| "톡" / "poke" | sm Duration intensifier | ON_CLICK (light tap) |
| "통통" / "bouncy" | BOUNCY easing | (not in Trigger) |

### 12.4 Onomatopoeia Disambiguation Rules

```
Rule 1: Is it the main verb or a modifier?
- "휙 사라져" → "사라져"가 동사, "휙"은 modifier
  → Animation: DISSOLVE + EASE_IN + XS (휙 modifies speed)
  → Trigger: parent context (e.g. ON_CLICK)

- "휙 밀어" → "밀어"가 drag 동사, "휙"은 manner
  → Trigger: ON_DRAG
  → Animation: SMART_ANIMATE + EASE_OUT + sm

Rule 2: Object of action
- If object is direction (옆으로 휙, 위로 휙) → likely ON_DRAG trigger
- If object is state (휙 사라져, 휙 등장) → modifier for Animation

Rule 3: Action verb context
- Drag/swipe verbs (밀어, 끌어, 던져) + onomatopoeia → ON_DRAG
- State change verbs (사라져, 나타나, 변해) + onomatopoeia → Animation modifier

Rule 4: Multi-dimension assignment
A single word can modify MULTIPLE dimensions simultaneously:
- "부드럽게" affects BOTH Duration (LG) AND Easing (EASE_IN_AND_OUT)
- "통통" affects ONLY Easing (BOUNCY)
- "확" affects Duration (xs) AND Trigger context (ON_DRAG if drag verb present)
```

### 12.5 Common Disambiguation Examples

```
"3초 후에 부드럽게 사라져"
  Trigger: AFTER_TIMEOUT timeout: 3.0
  Animation: DISSOLVE + EASE_OUT + LG (0.25s)
  Reasoning: "3초 후에" = trigger time, "부드럽게" = animation manner

"천천히 사라져"
  Trigger: (depends on parent context, often ON_CLICK)
  Animation: DISSOLVE + EASE_IN + XL (0.4s)
  Reasoning: "천천히" modifies the disappearance speed, no trigger time signal

"휙 사라져"
  Trigger: parent context (likely ON_CLICK)
  Animation: DISSOLVE + EASE_IN + XS (0.07s)
  Reasoning: "휙" is speed modifier on state-change verb

"휙 밀어"
  Trigger: ON_DRAG (drag verb present)
  Animation: SMART_ANIMATE + EASE_OUT + sm
  Reasoning: "휙" is manner on drag verb

"한참 후에 천천히 등장"
  Trigger: AFTER_TIMEOUT timeout: 5.0
  Animation: DISSOLVE + EASE_OUT + XL (0.4s)
  Reasoning: 두 개의 시간 표현이 분리됨 — "한참 후에"=trigger, "천천히"=animation

"잠깐 떴다가 사라져"
  Trigger: AFTER_TIMEOUT timeout: 0.5 (after appearing)
  Animation: DISSOLVE + EASE_IN + sm (quick fade out)
  Reasoning: "잠깐"이 떠있는 시간 = trigger, "사라져"가 두 번째 동작
```

### 12.6 Modifier Multi-dimension Assignment

A key insight: **one natural language modifier can affect multiple Animation dimensions simultaneously.**

핵심 원칙: 자연어 modifier 하나가 여러 Animation 차원에 동시 영향을 줄 수 있어요.

| Modifier | Duration | Easing | Transition |
|---|---|---|---|
| "부드럽게" / "smooth" | LG (0.25s) | EASE_IN_AND_OUT | (no preference) |
| "빠르게" / "quick" | XS (0.07s) | (no preference) | (no preference) |
| "통통" / "bouncy" | (no preference) | BOUNCY | (no preference) |
| "휙" / "whoosh" | XS | EASE_IN | (no preference) |
| "강조해서" / "emphasized" | XL (0.4s) | CUSTOM_CUBIC_BEZIER | (no preference) |
| "드라마틱하게" / "dramatic" | XXL (0.6s+) | EASE_IN_AND_OUT | (no preference) |
| "스르륵" / "smooth glide" | MD (0.15s) | EASE_OUT | DISSOLVE or SMART_ANIMATE |
| "사뿐히" / "softly land" | LG (0.25s) | EASE_OUT | (no preference) |

The LLM should apply ALL relevant dimensions when matching a modifier.

LLM은 modifier를 만나면 적용 가능한 모든 차원에 동시 적용해야 합니다.

### 12.7 Hand-off Protocol with Trigger Dictionary

Recommended processing order:

```
Step 1: Trigger Detection (using Trigger Dictionary v2.7.1)
  - Identify the trigger type
  - Extract any trigger-specific time (AFTER_TIMEOUT) or keys (ON_KEY_DOWN)
  
Step 2: Animation Detection (using Animation Dictionary v2.7.1)
  - Apply default pairing from Trigger Dictionary Section 18.2
  - Override with user-specified animation modifiers
  - Multi-dimension assignment per Section 12.6

Step 3: Disambiguation (this section)
  - Check for cross-document conflicts
  - Resolve per rules in 12.2 and 12.4
  
Step 4: Validation
  - Trigger schema (Trigger Dictionary Section 15)
  - Animation schema (this document Section 9)
```

---

## Change Log / 변경 이력

- **v2.7.1** (2026-05-20): **Cross-document disambiguation added.** Section 12 resolves time-expression and onomatopoeia conflicts with Trigger Dictionary. Multi-dimension modifier assignment rules. Hand-off protocol with sister document. All v2.7 vocabulary preserved.
- **v2.7** (2026-05-20): Animation vocabulary heavily expanded. Each Duration/Easing/Transition/Direction token now has 50-100+ EN/KO entries across L1-L4 levels. Document split into Trigger (Part 1) and Animation (Part 2).
- **v2.6** (2026-05-20): Complete consolidation of all sections.
- **v2.5** (2026-05-20): Trigger vocabulary heavily expanded.
- **v2.4** (2026-05-20): Full Trigger type coverage.
- **v2.3** (2026-05-20): Figma API alignment for Transition/Easing.
- **v2.2** (2026-05-20): English vocabulary expanded.
- **v2.1** (2026-05-20): Korean vocabulary expanded.
- **v2.0** (2026-05-20): 4-level expression classification.
- **v1.0** (2026-05-19): Initial version.

---

## License / Sources

- **Figma Plugin API**:
  - https://developers.figma.com/docs/plugins/api/Transition/
  - https://developers.figma.com/docs/plugins/api/Easing/
- IBM Carbon Design System, Google Material Design 3, Apple HIG, Microsoft Fluent 2, Adobe Spectrum, Atlassian Design System, Audi UI, GitHub Primer, Uber Base, Pinterest Gestalt
