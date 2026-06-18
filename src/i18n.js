const STORAGE_KEY = "gs3d-language-mode";
const LANG_MODES = ["auto", "en", "jp"];

const translations = {
  en: {
    "title.main": "Gray-Scott 3D",
    "title.about": "Gray-Scott 3D | Guide",
    "meta.main.description":
      "Explore three-dimensional Gray-Scott reaction-diffusion patterns in the browser.",
    "meta.about.description": "Model notes, parameters, and references for Gray-Scott 3D.",
    "brand.subtitle": "3D reaction-diffusion simulation",
    "nav.about": "Guide",
    "nav.github": "GitHub",
    "nav.back": "Back to simulation",
    "aria.pageNav": "Page navigation",
    "aria.lang": "Language",
    "aria.params": "Parameters",
    "aria.viewMode": "View mode",
    "aria.computeMode": "Compute backend",
    "aria.stage": "3D view",
    "aria.transport": "Playback controls",
    "aria.slices": "Slices",
    "aria.side": "Status and links",
    "lang.auto": "AUTO",
    "lang.en": "EN",
    "lang.jp": "JP",
    "section.presets": "Presets",
    "section.display": "View",
    "section.compute": "Compute",
    "section.parameters": "Parameters",
    "view.volume": "Volume",
    "view.surface": "Surface",
    "compute.cpu": "CPU",
    "compute.gpgpu": "GPGPU",
    "compute.note": "Switching restarts from the same seed and parameters.",
    "control.feed": "F (feed)",
    "control.kill": "k (kill)",
    "control.threshold": "Threshold",
    "control.speed": "Steps/frame",
    "control.boundary": "Boundary",
    "control.advanced": "Advanced settings",
    "control.du": "Diffusion U",
    "control.dv": "Diffusion V",
    "control.grid": "Grid",
    "control.dx": "dx",
    "control.seed": "seed",
    "aria.feed": "F feed rate",
    "aria.feedNumber": "Numeric F feed rate",
    "aria.feedNudge": "Fine tune F",
    "aria.kill": "k kill rate",
    "aria.killNumber": "Numeric k kill rate",
    "aria.killNudge": "Fine tune k",
    "option.neumann": "Neumann: zero-flux",
    "option.periodic": "Periodic: wrap edges",
    "status.stopped": "Paused",
    "status.running": "Running",
    "step.label": "step",
    "viewer.hint": "Drag to rotate, wheel to zoom",
    "button.play": "Play",
    "button.pause": "Pause",
    "button.reset": "Reset",
    "button.randomSeed": "New seed",
    "button.export": "Save image",
    "slice.xy": "XY / center Z",
    "slice.xz": "XZ / center Y",
    "slice.yz": "YZ / center X",
    "side.overview": "Overview",
    "side.summary":
      "Render the V concentration field as a volume or an isosurface. Start from a preset, then move F and k to compare how three-dimensional patterns change.",
    "side.about": "Guide and references",
    "metrics.title": "Status",
    "metrics.backend": "Backend",
    "metrics.computeMs": "Frame time",
    "metrics.readbackMs": "Readback",
    "metrics.cellsPerSecond": "Throughput",
    "metrics.maxV": "Max V",
    "metrics.avgV": "Mean V",
    "metrics.activeV": "Visible",
    "webgl.error": "This browser does not support WebGL2, which is required for 3D volume rendering.",
    "preset.snake.name": "Snake",
    "preset.snake.note": "F=0.058 / k=0.067",
    "preset.snake-disc.name": "Snake&Disk",
    "preset.snake-disc.note": "F=0.074 / k=0.063 / 100³",
    "preset.fk-0020-00555.name": "Pulsing spot",
    "preset.fk-0020-00555.note": "F=0.020 / k=0.0555",
    "preset.fk-0020-00600.name": "Pulsing spot",
    "preset.fk-0020-00600.note": "F=0.020 / k=0.0600",
    "preset.fk-0025-00575.name": "Pulsing tube",
    "preset.fk-0025-00575.note": "F=0.025 / k=0.0575",
    "preset.lamellar-0028-00560.name": "Lamellar",
    "preset.lamellar-0028-00560.note": "F=0.028 / k=0.0560",
    "preset.pulsing-tube-0028-00635.name": "Pulsing tube",
    "preset.pulsing-tube-0028-00635.note": "F=0.028 / k=0.0635",
    "about.caption": "model notes and references",
    "about.lead.title": "About this app",
    "about.lead.p1":
      "The original Gray-Scott model comes from a well-mixed autocatalytic reaction in a continuous stirred tank reactor <span class=\"citation-group\">[<a class=\"citation\" href=\"#ref-gray-scott-1983\">1</a>, <a class=\"citation\" href=\"#ref-gray-scott-1984\">2</a>]</span>. In that setting the model is an ordinary differential equation system, without spatial structure.",
    "about.lead.p2":
      "The spatial reaction-diffusion version used for pattern formation adds diffusion and position dependence to that reaction system. Pearson's work is the key starting point for the familiar Gray-Scott patterns controlled by F and k <a class=\"citation\" href=\"#ref-pearson-1993\">[3]</a>. This app shows the regions where V is concentrated in three dimensions.",
    "about.lead.p3":
      "Three-dimensional Gray-Scott studies are less common than two-dimensional examples, but they do exist. Representative references include Leppänen et al.'s three-dimensional Turing-pattern study <a class=\"citation\" href=\"#ref-leppanen-2002\">[6]</a> and the 3D Turing-pattern study by Shoji, Yamada, Ueyama, and Ohta <a class=\"citation\" href=\"#ref-shoji-2007\">[7]</a>. Still, the relationship between parameters, initial conditions, boundaries, and morphology in 3D is not yet mapped as broadly as it is in 2D. The Physica D papers by Nishiura and Ueyama are related background on self-replication and spatio-temporal behavior <span class=\"citation-group\">[<a class=\"citation\" href=\"#ref-nishiura-ueyama-1999\">4</a>, <a class=\"citation\" href=\"#ref-nishiura-ueyama-2001\">5</a>]</span>.",
    "about.lead.p5":
      "For a broad visual map of two-dimensional Gray-Scott patterns, Munafo's XMorphia page is a useful companion reference <a class=\"citation\" href=\"#ref-mrob\">[8]</a>. However, two-dimensional parameter regions do not necessarily correspond directly to three-dimensional behavior, so this app's presets are tuned separately for 3D exploration.",
    "about.lead.p6":
      "There is also an older YouTube playlist of simulation results by Daishin Ueyama <a class=\"citation\" href=\"#ref-ueyama-youtube\">[10]</a>. The implementation and rendering differ from this browser app, but it is a useful record of earlier three-dimensional simulations.",
    "about.lead.p4":
      "This is an educational visualization rather than a research workstation. The browser version uses a simple explicit finite-difference update so the pattern can keep moving while the parameters are adjusted.",
    "about.equations.title": "Reaction and equations",
    "about.equations.note":
      "The term UV² is the local reaction: V helps create more V by consuming U. The F(1-U) term restores U toward its feed value, while -(F+k)V removes V through flow and decay. The diffusion terms spread both substances to neighboring points. The balance of these reaction, feed, removal, and diffusion terms is why small changes in F and k can change the visible form so strongly <a class=\"citation\" href=\"#ref-pearson-1993\">[3]</a>.",
    "about.controls.title": "Controls",
    "about.control.f": "F",
    "about.control.f.desc": "The feed rate of U. It changes how quickly depleted U is replenished.",
    "about.control.k": "k",
    "about.control.k.desc": "The removal rate of V. Together with F, it separates spots, tubes, layers, and other regimes.",
    "about.control.threshold": "Threshold",
    "about.control.threshold.desc":
      "The V concentration level used for display. Isosurface mode usually reads better with a lower value.",
    "about.control.boundary": "Boundary",
    "about.control.boundary.desc":
      "Neumann treats the edge as zero-flux. Periodic connects each face to the opposite face.",
    "about.control.view": "Volume / surface",
    "about.control.view.desc":
      "Volume mode accumulates the concentration field like a luminous cloud. Surface mode draws a mesh at a single concentration level.",
    "about.compute.title": "Computation backend",
    "about.compute.p1":
      "The simulation uses an explicit finite-difference update. At each grid point it reads the current U and V values plus the six neighboring points, then advances diffusion, reaction, feed, and removal terms to the next time step. This local stencil update is suitable for both CPU and GPU execution.",
    "about.compute.p2":
      "CPU mode updates the U and V <code>Float32Array</code> fields in a Web Worker. Running the numerical loop outside the main browser thread helps keep the interface responsive.",
    "about.compute.p3":
      "GPGPU mode also uses WebGL2 for the numerical update. U and V are packed into an <code>RGBA32F</code> 2D texture, a fragment shader performs one Gray-Scott step, and two textures are alternated as ping-pong framebuffers for repeated updates.",
    "about.compute.p4":
      "The current implementation still reads the displayed V field back from the GPU each frame so it can reuse the existing Three.js <code>Data3DTexture</code> renderer, slice views, and Marching Cubes surface mode. It is therefore not a fully GPU-resident pipeline. The frame time, readback, and throughput values in the app are live measurements for comparing CPU and GPGPU behavior on the current browser and GPU.",
    "about.compute.p5":
      "This Gray-Scott update is especially favorable for GPGPU execution. Each grid point can be advanced almost independently, using only its own value and the six nearest neighbors. Because this browser version uses an explicit update rather than a global linear solver such as ICCG, the same small calculation can be applied to many grid points in parallel. In the current presets, the U and V diffusion coefficients are on the same order of magnitude, and the reaction terms do not contain extremely large rate constants. That also allows a relatively large explicit time step, which helps the simulation move well in the browser.",
    "about.ref.mrob.note":
      "A visual catalogue of many two-dimensional Gray-Scott patterns. The parameter map should not be read as a direct guide to the 3D presets here.",
    "about.ref.youtube.note": "An older playlist of simulation result videos by Daishin Ueyama.",
    "about.refs.title": "References and readings",
    "about.note.date": "note, Jan 30, 2025."
  },
  jp: {
    "title.main": "Gray-Scott 3D",
    "title.about": "Gray-Scott 3D | 説明",
    "meta.main.description":
      "Gray-Scott モデルの3次元反応拡散パターンをブラウザで観察できる啓蒙用Webアプリ。",
    "meta.about.description": "Gray-Scott 3D のモデル説明、操作パラメータ、参考文献。",
    "brand.subtitle": "3次元反応拡散モデルのシミュレーション",
    "nav.about": "解説",
    "nav.github": "GitHub",
    "nav.back": "シミュレーションへ戻る",
    "aria.pageNav": "ページ移動",
    "aria.lang": "言語",
    "aria.params": "パラメータ",
    "aria.viewMode": "表示モード",
    "aria.computeMode": "計算方式",
    "aria.stage": "3D表示",
    "aria.transport": "操作",
    "aria.slices": "断面",
    "aria.side": "状態とリンク",
    "lang.auto": "AUTO",
    "lang.en": "EN",
    "lang.jp": "JP",
    "section.presets": "プリセット",
    "section.display": "表示",
    "section.compute": "計算",
    "section.parameters": "パラメータ",
    "view.volume": "Volume",
    "view.surface": "等値面",
    "compute.cpu": "CPU",
    "compute.gpgpu": "GPGPU",
    "compute.note": "切り替えると同じ seed とパラメータで再計算します。",
    "control.feed": "F（供給率）",
    "control.kill": "k（除去率）",
    "control.threshold": "表示しきい値",
    "control.speed": "ステップ/表示",
    "control.boundary": "境界条件",
    "control.advanced": "詳細設定",
    "control.du": "拡散 U",
    "control.dv": "拡散 V",
    "control.grid": "格子",
    "control.dx": "空間刻み dx",
    "control.seed": "seed",
    "aria.feed": "F（供給率）",
    "aria.feedNumber": "F（供給率）の数値",
    "aria.feedNudge": "Fを微調整",
    "aria.kill": "k（除去率）",
    "aria.killNumber": "k（除去率）の数値",
    "aria.killNudge": "kを微調整",
    "option.neumann": "Neumann: 端で反射",
    "option.periodic": "Periodic: 反対側へ接続",
    "status.stopped": "停止中",
    "status.running": "計算中",
    "step.label": "step",
    "viewer.hint": "ドラッグで回転、ホイールで拡大",
    "button.play": "再生",
    "button.pause": "一時停止",
    "button.reset": "リセット",
    "button.randomSeed": "別の種",
    "button.export": "画像保存",
    "slice.xy": "XY / Z中央",
    "slice.xz": "XZ / Y中央",
    "slice.yz": "YZ / X中央",
    "side.overview": "Overview",
    "side.summary":
      "V 濃度場を Volume または等値面で表示します。プリセットを起点に F と k を動かして、3次元パターンの変化を比較できます。",
    "side.about": "解説と参考文献",
    "metrics.title": "状態",
    "metrics.backend": "計算方式",
    "metrics.computeMs": "処理時間",
    "metrics.readbackMs": "転送/変換",
    "metrics.cellsPerSecond": "更新速度",
    "metrics.maxV": "V 最大",
    "metrics.avgV": "V 平均",
    "metrics.activeV": "表示点",
    "webgl.error": "このブラウザでは3Dボリューム表示に必要な WebGL2 が使えません。",
    "preset.snake.name": "Snake",
    "preset.snake.note": "F=0.058 / k=0.067",
    "preset.snake-disc.name": "Snake&Disk",
    "preset.snake-disc.note": "F=0.074 / k=0.063 / 100³",
    "preset.fk-0020-00555.name": "脈動スポット",
    "preset.fk-0020-00555.note": "F=0.020 / k=0.0555",
    "preset.fk-0020-00600.name": "脈動スポット",
    "preset.fk-0020-00600.note": "F=0.020 / k=0.0600",
    "preset.fk-0025-00575.name": "脈動 Tube",
    "preset.fk-0025-00575.note": "F=0.025 / k=0.0575",
    "preset.lamellar-0028-00560.name": "ラメラー",
    "preset.lamellar-0028-00560.note": "F=0.028 / k=0.0560",
    "preset.pulsing-tube-0028-00635.name": "脈動 Tube",
    "preset.pulsing-tube-0028-00635.note": "F=0.028 / k=0.0635",
    "about.caption": "model notes and references",
    "about.lead.title": "このアプリについて",
    "about.lead.p1":
      "Gray-Scott モデルの原型は、よく混ざった連続攪拌槽の自己触媒反応として導入されたものです <span class=\"citation-group\">[<a class=\"citation\" href=\"#ref-gray-scott-1983\">1</a>, <a class=\"citation\" href=\"#ref-gray-scott-1984\">2</a>]</span>。この段階では空間構造を持たない常微分方程式系です。",
    "about.lead.p2":
      "パターン形成でよく使われる空間版は、この反応系に拡散と位置依存性を入れた反応拡散系です。F と k の値で多様な模様が現れる、という Gray-Scott パターンの基点としてここでは Pearson の仕事を参照します <a class=\"citation\" href=\"#ref-pearson-1993\">[3]</a>。このアプリでは、3次元空間で物質 V が濃くなった場所を表示します。",
    "about.lead.p3":
      "3次元の Gray-Scott 研究は2次元の例ほど多くありませんが、いくつかあります。代表例として、Leppänen らによる3次元 Turing パターンの研究 <a class=\"citation\" href=\"#ref-leppanen-2002\">[6]</a> と、Shoji、Yamada、Ueyama、Ohta による3次元パターンの論文 <a class=\"citation\" href=\"#ref-shoji-2007\">[7]</a> を参照します。ただし、3次元におけるパラメータ、初期値、境界条件と形の関係は、2次元のように広く整理されているとはまだ言いにくい状況です。Physica D の2本は、Gray-Scott モデルにおける自己複製や時空カオスを理解するための関連する背景として置いています <span class=\"citation-group\">[<a class=\"citation\" href=\"#ref-nishiura-ueyama-1999\">4</a>, <a class=\"citation\" href=\"#ref-nishiura-ueyama-2001\">5</a>]</span>。",
    "about.lead.p5":
      "2次元の Gray-Scott パターンを広く眺めるには、Munafo による XMorphia のページが豊富な図例を見せてくれる良い読み物です <a class=\"citation\" href=\"#ref-mrob\">[8]</a>。ただし、2次元のパラメータ領域が3次元の挙動へそのまま対応するとは限りません。このアプリのプリセットは、3次元で観察しやすいように別に調整しています。",
    "about.lead.p6":
      "上山大信による、かなり古いシミュレーション結果の動画プレイリストもあります <a class=\"citation\" href=\"#ref-ueyama-youtube\">[10]</a>。現在のアプリとは実装や表示方法が異なりますが、3次元パターンがどのように見えていたかを知るための記録です。",
    "about.lead.p4":
      "ここでは研究用の厳密な計算環境ではなく、パラメータを触りながらパターン形成の雰囲気をつかむための一般向けのブラウザアプリとして作っています。計算は単純な差分陽解法にして、操作中も模様が動き続けることを優先しています。",
    "about.equations.title": "反応と方程式",
    "about.equations.note":
      "UV² の項は局所的な反応を表します。V が U を消費しながらさらに V を増やす、という自己触媒的な働きです。F(1-U) は U を供給濃度へ戻す項で、-(F+k)V は流れによる希釈と V の除去を合わせた項です。拡散項は U と V を隣の点へ広げます。反応、供給、除去、拡散の釣り合いが少し変わるだけで、見える形が大きく変わります <a class=\"citation\" href=\"#ref-pearson-1993\">[3]</a>。",
    "about.controls.title": "操作の意味",
    "about.control.f": "F",
    "about.control.f.desc": "U の供給率です。反応で減った U が戻る速さを調整します。",
    "about.control.k": "k",
    "about.control.k.desc": "V の除去率です。F と組み合わせて、スポット、管、層状構造などの違いを作ります。",
    "about.control.threshold": "表示しきい値",
    "about.control.threshold.desc": "V がどれくらい濃い場所を見せるかを決めます。等値面では少し低めの値が見やすくなります。",
    "about.control.boundary": "境界条件",
    "about.control.boundary.desc": "Neumann は箱の端で反射、Periodic は反対側の面へつながる空間として扱います。",
    "about.control.view": "Volume / 等値面",
    "about.control.view.desc": "Volume は濃度場を雲のように積分表示し、等値面は同じ濃度の面をメッシュとして描きます。",
    "about.compute.title": "計算方式",
    "about.compute.p1":
      "計算は差分陽解法です。各格子点では現在の U、V と6方向の隣接点を読み、拡散、反応、供給、除去の項を使って次の時刻の値を求めます。このような局所的なステンシル計算は、CPU でも GPU でも実装しやすい形です。",
    "about.compute.p2":
      "CPU モードでは Web Worker 上で <code>Float32Array</code> の U、V 配列を更新します。画面本体とは別スレッドで計算するため、ブラウザの操作を止めにくくしています。",
    "about.compute.p3":
      "GPGPU モードでは WebGL2 を計算にも使います。U と V を <code>RGBA32F</code> の2次元テクスチャに詰め、fragment shader で1ステップ分の Gray-Scott 更新を行い、2枚のテクスチャを ping-pong しながら交互に読み書きします。",
    "about.compute.p4":
      "ただし現在の実装は、表示するたびに V の濃度場を GPU から読み戻し、既存の Three.js の <code>Data3DTexture</code>、断面図、Marching Cubes 表示へ渡しています。そのため完全に GPU 上だけで完結する構成ではありません。処理時間、転送/変換、更新速度は、この読み戻しも含めた実測値として CPU と GPGPU を比較するための目安です。",
    "about.compute.p5":
      "この Gray-Scott 計算では特に GPGPU の効果が出やすくなります。更新は各格子点でほぼ独立しており、必要なのは自分自身と隣接6点の値だけです。さらに今回は ICCG のような大域的な線形方程式ソルバを使わず、同じ陽的な更新式を多数の格子点に繰り返し適用するため、GPU の並列計算と相性がよくなります。現在のプリセットでは U と V の拡散係数が同じ桁で、反応項にも極端に大きな速度定数が入っていないため、陽解法でも比較的大きな時間刻みを取れることも、ブラウザ上で動かしやすい理由です。",
    "about.ref.mrob.note":
      "2次元 Gray-Scott パターンを豊富な図例で見せてくれるサイト。ただし、このパラメータ図を3次元プリセットへ直接対応させるものではありません。",
    "about.ref.youtube.note": "上山大信による、かなり古いシミュレーション結果の動画プレイリスト。",
    "about.refs.title": "参考文献・読み物",
    "about.note.date": "note, 2025年1月30日."
  }
};

let mode = readMode();
let locale = resolveLocale(mode);

function readMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return LANG_MODES.includes(stored) ? stored : "auto";
  } catch {
    return "auto";
  }
}

function resolveLocale(nextMode) {
  if (nextMode === "jp") return "jp";
  if (nextMode === "en") return "en";
  const primaryLanguage = navigator.language || navigator.languages?.[0] || "";
  return primaryLanguage.toLowerCase().startsWith("ja") ? "jp" : "en";
}

export function getLocale() {
  return locale;
}

export function translate(key) {
  return translations[locale]?.[key] ?? translations.en[key] ?? key;
}

function applyDocumentText() {
  document.documentElement.lang = locale === "jp" ? "ja" : "en";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = translate(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((element) => {
    element.innerHTML = translate(element.dataset.i18nHtml);
  });
  document.querySelectorAll("[data-i18n-content]").forEach((element) => {
    element.setAttribute("content", translate(element.dataset.i18nContent));
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", translate(element.dataset.i18nAriaLabel));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    element.setAttribute("title", translate(element.dataset.i18nTitle));
  });
  document.querySelectorAll("[data-lang-mode]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.langMode === mode));
  });
}

function setMode(nextMode, onLocaleChange) {
  if (!LANG_MODES.includes(nextMode)) return;
  mode = nextMode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Language switching should still work even when storage is unavailable.
  }
  locale = resolveLocale(mode);
  applyDocumentText();
  onLocaleChange?.(locale, mode);
}

export function setupI18n({ onLocaleChange } = {}) {
  mode = readMode();
  locale = resolveLocale(mode);
  applyDocumentText();
  document.querySelectorAll("[data-lang-mode]").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.langMode, onLocaleChange));
  });
  window.addEventListener("languagechange", () => {
    if (mode !== "auto") return;
    locale = resolveLocale(mode);
    applyDocumentText();
    onLocaleChange?.(locale, mode);
  });
  onLocaleChange?.(locale, mode);
  return {
    getLocale,
    translate,
    setMode: (nextMode) => setMode(nextMode, onLocaleChange)
  };
}
