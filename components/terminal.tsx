"use client";

import { useEffect  } from "react";
import {
  sizeOf,
  colorOf,
  isViolet,
  ROUND_SECONDS,
  HISTORY_MAX,
  DEPTH_MAX,
  PAYOUT,
  PLAN,
  buildPrediction,
 
  type Prediction,
  type Status,
} from "@/lib/engine";

interface Row {
  period: string;
  predLabel: string;
  predMode: string;
  target: number;
  actual: number;
  aColor: string;
  aViolet: boolean;
  status: Status;
  win: boolean;
}

export default function Terminal() {
  useEffect(() => { const API_URL =
  "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json";

async function fetchGameHistory() {
  const res = await fetch(`${API_URL}?ts=${Date.now()}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  const json = await res.json();

  const list =
    json?.data?.list ??
    json?.data?.result?.list ??
    json?.result?.list ??
    [];

  return list.map((item: any) => ({
    period: String(
      item.issueNumber ??
      item.issue ??
      item.period ??
      item.issueNo ??
      ""
    ),
    result: Number(
      item.number ??
      item.result ??
      item.openNumber ??
      item.openNum ??
      0
    ),
  })).filter((x: any) => x.period && Number.isFinite(x.result));
}
    const $ = (id: string) => document.getElementById(id)!;

    const state = {
      results: [] as number[],
      rows: [] as Row[],
      period: "",
      level: 0,
      balance: 1000,
      currentPrediction: null as Prediction | null,
      stats: { wins: 0, loss: 0, skips: 0, jackpot: 0, streak: 0, best: 0, net: 0 },
      auto: true,
      volatility: 0.3,
    };

   

    function renderForecast(pred: Prediction) {
      $("engineTag").textContent = "ENGINE: " + pred.engine;
      const callMain = $("callMain");
      const callSub = $("callSub");
      const callCard = $("callCard");

      callCard.classList.remove("animate-card-in");
      void callCard.offsetWidth;
      callCard.classList.add("animate-card-in");

      const themes: Record<string, { color: string; border: string; shadow: string; from: string; sub: string }> = {
        BIG: { color: "text-teal neon-text-teal", border: "border-teal/40", shadow: "shadow-glow-teal", from: "from-teal/10", sub: "SIZE MODE · 5-6-7-8-9" },
        SMALL: { color: "text-violet neon-text-violet", border: "border-violet/40", shadow: "shadow-glow-violet", from: "from-violet/10", sub: "SIZE MODE · 0-1-2-3-4" },
        GREEN: { color: "text-teal neon-text-teal", border: "border-teal/40", shadow: "shadow-glow-teal", from: "from-teal/10", sub: "COLOR MODE · 1-3-5-7-9" },
        RED: { color: "text-rose neon-text-violet", border: "border-rose/40", shadow: "shadow-glow-rose", from: "from-rose/10", sub: "COLOR MODE · 0-2-4-6-8" },
        SKIP: { color: "text-muted", border: "border-edge", shadow: "", from: "from-transparent", sub: "MARKET UNCLEAR · STANDING DOWN" },
      };
      const t = themes[pred.pick] || themes.SKIP;

      callCard.className =
        "animate-card-in flex h-full flex-col items-center justify-center rounded-2xl border p-6 bg-gradient-to-b to-transparent " +
        `${t.border} ${t.shadow} ${t.from}`;
      callMain.className = "mt-1 text-6xl font-extrabold tracking-tight " + t.color;
      callMain.textContent = pred.pick;
      callSub.textContent = t.sub;

      const confPct = Math.round(pred.conf * 100);
      $("confVal").textContent = confPct + "%";
      ($("confBar") as HTMLElement).style.width = confPct + "%";
      $("confVal").className = pred.pick === "SKIP" ? "text-muted" : "text-teal";

      $("jackpotTarget").textContent = String(pred.jackpot.digit);
      $("jackpotProb").textContent = (pred.jackpot.prob * 100).toFixed(1) + "%";
      const jt = $("jackpotTarget");
      jt.classList.remove("digit-pop");
      void jt.offsetWidth;
      jt.classList.add("digit-pop");

      document.querySelectorAll<HTMLElement>(".engine-row").forEach((row) => {
        const k = row.dataset.k as keyof Prediction["engines"];
        const e = pred.engines[k];
        const sig = row.querySelector(".sig")!;
        const bar = row.querySelector<HTMLElement>(".bar")!;
        if (!e || !e.pick) {
          sig.textContent = "IDLE";
          bar.style.width = "8%";
        } else {
          sig.textContent = e.pick + " " + Math.round(e.conf * 100) + "%";
          bar.style.width = Math.round(e.conf * 100) + "%";
        }
      });

      const vol = state.volatility;
      ($("volBar") as HTMLElement).style.width = Math.round(vol * 100) + "%";
      const volState = $("volState");
      if (vol >= 0.9) {
        volState.textContent = "EXTREME";
        volState.className = "text-rose";
      } else if (vol > 0.62) {
        volState.textContent = "CHOPPY";
        volState.className = "text-gold";
      } else {
        volState.textContent = "STABLE";
        volState.className = "text-teal";
      }

      renderPlan();
    }

    function renderPlan() {
      ["lvl1", "lvl2", "lvl3"].forEach((id, i) => {
        const el = $(id);
        const active = i === state.level;
        el.className =
          "rounded-xl border p-3 text-center transition " +
          (active
            ? "border-violet/60 bg-violet/10 shadow-glow-violet"
            : i < state.level
              ? "border-rose/40 bg-rose/5"
              : "border-edge bg-panel");
      });
      $("activeLvl").textContent = String(state.level + 1);
      $("activeStake").textContent = PLAN[state.level] + "u";
      const stake = PLAN[state.level];
      const prior = PLAN.slice(0, state.level).reduce((a, b) => a + b, 0);
      const net = stake * PAYOUT - stake - prior;
      $("cycleNet").textContent = "+" + net;
      $("balance").textContent = state.balance.toFixed(1);
    }

    function resolveRound(pred: Prediction, actual: number) {
      const aSize = sizeOf(actual);
      const aColor = colorOf(actual);
      const jackpotHit = pred.jackpot.digit === actual;

      let status: Status = "SKIP";
      let win = false;

      if (pred.mode === "SKIP") {
        state.stats.skips++;
        state.stats.streak = 0;
      } else {
        if (pred.mode === "SIZE") win = pred.pick === aSize;
        else if (pred.mode === "COLOR") win = pred.pick === aColor;

        const stake = PLAN[state.level];
        if (win) {
          const prior = PLAN.slice(0, state.level).reduce((a, b) => a + b, 0);
          const profit = stake * PAYOUT - stake - prior;
          state.balance += stake * PAYOUT - stake;
          state.stats.wins++;
          state.stats.streak = state.stats.streak >= 0 ? state.stats.streak + 1 : 1;
          state.stats.net += profit;
          status = "WIN";
          state.level = 0;
        } else {
          state.balance -= stake;
          state.stats.loss++;
          state.stats.streak = state.stats.streak <= 0 ? state.stats.streak - 1 : -1;
          state.stats.net -= stake;
          status = "LOSS";
          state.level++;
          if (state.level >= PLAN.length) state.level = 0;
        }
      }

      if (jackpotHit) {
        state.stats.jackpot++;
        status = "JACKPOT";
      }
      state.stats.best = Math.max(state.stats.best, Math.abs(state.stats.streak), state.stats.streak);

      state.results.push(actual);
      if (state.results.length > DEPTH_MAX) state.results.shift();

      const row: Row = {
        period: pred.period,
        predLabel: pred.mode === "SKIP" ? "SKIP" : pred.pick,
        predMode: pred.mode,
        target: pred.jackpot.digit,
        actual,
        aColor,
        aViolet: isViolet(actual),
        status,
        win,
      };
      state.rows.unshift(row);
      if (state.rows.length > HISTORY_MAX) state.rows.pop();

      renderStats();
      renderHistory(true);
      flashConsole(status);
      if (status === "JACKPOT") fireJackpot(actual);
    }

    function renderStats() {
      const s = state.stats;
      const resolved = s.wins + s.loss;
      const wr = resolved ? Math.round((s.wins / resolved) * 100) : 0;
      $("statWinrate").textContent = wr + "%";
      $("statWins").textContent = String(s.wins);
      $("statLoss").textContent = String(s.loss);
      $("statSkips").textContent = String(s.skips);
      $("statJackpot").textContent = String(s.jackpot);
      $("statStreak").textContent = String(s.streak);
      $("statStreak").className =
        "text-2xl font-bold " + (s.streak > 0 ? "text-teal" : s.streak < 0 ? "text-rose" : "text-white");
      $("statBest").textContent = String(s.best);
      const netEl = $("statNet");
      netEl.textContent = (s.net >= 0 ? "+" : "") + s.net.toFixed(1) + "u";
      netEl.className = "text-2xl font-bold " + (s.net >= 0 ? "text-gold" : "text-rose");

      const mt = $("miniTrend");
      mt.innerHTML = "";
      const recent = state.rows.slice(0, 20).reverse();
      recent.forEach((r) => {
        const bar = document.createElement("div");
        let cls = "w-[6px] rounded-sm ";
        let h = 10;
        if (r.status === "JACKPOT") {
          cls += "bg-gold shadow-glow-gold";
          h = 30;
        } else if (r.status === "WIN") {
          cls += "bg-teal";
          h = 24;
        } else if (r.status === "LOSS") {
          cls += "bg-rose";
          h = 16;
        } else {
          cls += "bg-edge";
          h = 8;
        }
        bar.className = cls;
        bar.style.height = h + "px";
        mt.appendChild(bar);
      });
    }

    function statusTag(status: Status) {
      const map: Record<Status, string> = {
        WIN: `<span class="inline-flex items-center gap-1 rounded-md border border-teal/40 bg-teal/10 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-widest text-teal">WIN</span>`,
        LOSS: `<span class="inline-flex items-center gap-1 rounded-md border border-rose/40 bg-rose/10 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-widest text-rose">LOSS</span>`,
        SKIP: `<span class="inline-flex items-center gap-1 rounded-md border border-edge bg-panel px-2 py-0.5 font-mono text-[10px] font-semibold tracking-widest text-muted">SKIP</span>`,
        JACKPOT: `<span class="inline-flex items-center gap-1 rounded-md border border-gold/50 bg-gold/15 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-widest text-gold shadow-glow-gold">JACKPOT</span>`,
      };
      return map[status] || map.SKIP;
    }

    function predTag(row: Row) {
      if (row.predMode === "SKIP") return `<span class="font-mono text-[11px] text-muted">SKIP</span>`;
      const colors: Record<string, string> = {
        BIG: "text-teal",
        SMALL: "text-violet",
        GREEN: "text-teal",
        RED: "text-rose",
      };
      const dim = row.predMode === "COLOR" ? "COLOR" : "SIZE";
      return `<span class="font-mono text-[11px] font-semibold ${colors[row.predLabel] || "text-slate-300"}">${row.predLabel}</span><span class="ml-1 font-mono text-[9px] tracking-widest text-muted">${dim}</span>`;
    }

    function actualCell(row: Row) {
      const size = sizeOf(row.actual);
      const sizeColor = size === "BIG" ? "text-teal" : "text-violet";
      return `<span class="font-mono text-sm font-bold text-white">${row.actual}</span><span class="ml-1 font-mono text-[9px] tracking-widest ${sizeColor}">${size}</span>`;
    }

    function colorCell(row: Row) {
      const dotColor = row.aColor === "GREEN" ? "bg-teal" : "bg-rose";
      const violet = row.aViolet
        ? `<span class="badge-dot bg-violet shadow-glow-violet inline-block"></span>`
        : "";
      return `<span class="inline-flex items-center gap-1"><span class="badge-dot ${dotColor} inline-block"></span>${violet}<span class="font-mono text-[10px] tracking-widest text-muted">${row.aColor}${row.aViolet ? "+V" : ""}</span></span>`;
    }

    function renderHistory(animateFirst: boolean) {
      const body = $("historyBody");
      body.innerHTML = "";
      state.rows.forEach((row, idx) => {
        const tr = document.createElement("tr");
        tr.className =
          "border-t border-edge/60 hover:bg-panel2/60 " +
          (animateFirst && idx === 0 ? "animate-row-in" : "");
        tr.innerHTML = `
          <td class="py-2 pl-2 font-mono text-[11px] text-muted">${row.period}</td>
          <td class="py-2">${predTag(row)}</td>
          <td class="py-2 text-center font-mono text-sm font-semibold ${row.status === "JACKPOT" ? "text-gold neon-text-gold" : "text-gold/70"}">${row.target}</td>
          <td class="py-2 text-center">${actualCell(row)}</td>
          <td class="py-2 text-center">${colorCell(row)}</td>
          <td class="py-2 pr-2 text-right">${statusTag(row.status)}</td>`;
        body.appendChild(tr);
      });
    }

    function flashConsole(status: Status) {
      const wrap = $("predWrap");
      wrap.classList.remove("flash-win", "flash-loss", "flash-skip");
      void wrap.offsetWidth;
      if (status === "WIN" || status === "JACKPOT") wrap.classList.add("flash-win");
      else if (status === "LOSS") wrap.classList.add("flash-loss");
      else wrap.classList.add("flash-skip");
    }

    function fireJackpot(digit: number) {
      const overlay = $("jackpotOverlay");
      $("jackpotDigit").textContent = String(digit);
      overlay.classList.remove("hidden");
      overlay.classList.add("flex");
      const inner = overlay.querySelector<HTMLElement>(".relative")!;
      inner.classList.remove("jackpot-shake");
      void inner.offsetWidth;
      inner.classList.add("jackpot-shake");

      const colors = ["#22e0c8", "#a06bff", "#ffcb52", "#ff5d8f"];
      for (let i = 0; i < 70; i++) {
        const c = document.createElement("div");
        c.className = "confetti";
        c.style.left = Math.random() * 100 + "vw";
        c.style.background = colors[i % colors.length];
        c.style.animation = `confetti-fall ${2 + Math.random() * 1.8}s ${Math.random() * 0.3}s linear forwards`;
        c.style.opacity = "0.95";
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 4200);
      }
      setTimeout(() => {
        overlay.classList.add("hidden");
        overlay.classList.remove("flex");
      }, 1800);
    }

    const ARC_LEN = 2 * Math.PI * 52;
    let timeLeft = ROUND_SECONDS;

    function tickTimer() {
      const arc = $("timerArc");
      const frac = timeLeft / ROUND_SECONDS;
      (arc as unknown as SVGElement & { style: CSSStyleDeclaration }).style.strokeDashoffset = String(
        ARC_LEN * (1 - frac),
      );
      if (timeLeft <= 5) {
        arc.setAttribute("stroke", "#ff5d8f");
        $("roundState").textContent = "LOCKED";
        $("roundState").className =
          "rounded-md border border-rose/40 bg-rose/10 px-2 py-0.5 font-mono text-[10px] tracking-widest text-rose";
      } else if (timeLeft <= 10) {
        arc.setAttribute("stroke", "#ffcb52");
        $("roundState").textContent = "CLOSING";
        $("roundState").className =
          "rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 font-mono text-[10px] tracking-widest text-gold";
      } else {
        arc.setAttribute("stroke", "#22e0c8");
        $("roundState").textContent = "OPEN";
        $("roundState").className =
          "rounded-md border border-teal/40 bg-teal/10 px-2 py-0.5 font-mono text-[10px] tracking-widest text-teal";
      }
      $("timerNum").textContent = String(timeLeft).padStart(2, "0");
    }

    function nextPeriod(period: string): string {
  const m = period.match(/^(.*?)(\d+)$/);
  if (!m) return period;

  return (
    m[1] +
    String(Number(m[2]) + 1).padStart(m[2].length, "0")
  );
}

let lastCompletedPeriod =
  localStorage.getItem("nexus-wingo-last-completed") || "";

function persistHistory() {
  try {
    localStorage.setItem(
      "nexus-wingo-history",
      JSON.stringify({
        rows: state.rows,
        stats: state.stats,
        level: state.level,
        balance: state.balance,
        lastCompletedPeriod,
      }),
    );
  } catch {}
}

function restoreHistory() {
  try {
    const raw = localStorage.getItem("nexus-wingo-history");
    if (!raw) return;

    const saved = JSON.parse(raw);

    if (Array.isArray(saved.rows)) {
      state.rows = saved.rows.slice(0, HISTORY_MAX);
    }

    if (saved.stats) {
      state.stats = {
        ...state.stats,
        ...saved.stats,
      };
    }

    if (Number.isInteger(saved.level)) {
      state.level = Math.max(
        0,
        Math.min(PLAN.length - 1, saved.level),
      );
    }

    if (Number.isFinite(saved.balance)) {
      state.balance = saved.balance;
    }

    if (typeof saved.lastCompletedPeriod === "string") {
      lastCompletedPeriod = saved.lastCompletedPeriod;
    }
  } catch {}
}

async function startRound() {
  try {
    const history = await fetchGameHistory();

    if (!history.length) return;

    const latest = history[0];

    const completedPeriod = String(latest.period);
    const actualNumber = Number(latest.result);

    if (!completedPeriod || !Number.isFinite(actualNumber)) {
      return;
    }

    const nextPeriod =
      (BigInt(completedPeriod) + 1n).toString();

    // Previous prediction result resolve
    if (
      state.currentPrediction &&
      state.currentPrediction.period === completedPeriod
    ) {
      resolveRound(
        state.currentPrediction,
        actualNumber
      );
    }

    // Create prediction for NEXT period
    if (
      !state.currentPrediction ||
      state.currentPrediction.period !== nextPeriod
    ) {
      state.results = history
        .map((item: { result: number }) => item.result)
        .filter(
          (value: number) =>
            value >= 0 && value <= 9
        )
        .reverse();

      const { prediction, volatility } =
        buildPrediction(
          state.results,
          state.level,
          nextPeriod
        );

      state.period = nextPeriod;
      state.volatility = volatility;
      state.currentPrediction = prediction;

      $("periodNum").textContent = nextPeriod;

      renderForecast(prediction);
    }

    // Real-time 60 second countdown
    timeLeft =
      ROUND_SECONDS -
      (Math.floor(Date.now() / 1000) %
        ROUND_SECONDS);

    tickTimer();

  } catch (error) {
    console.error(
      "WinGo API sync failed:",
      error
    );
  }
}




  // API polling decides WIN/LOSS resolution.
}

    function telemetry() {
      const ping = 18 + Math.floor(Math.random() * 22);
      $("ping").textContent = "· " + ping + "ms";
      $("coreLatency").textContent = String(ping);
      $("coreLoad").textContent = String(35 + Math.floor(Math.random() * 30));
      $("coreEntropy").textContent = (0.45 + Math.random() * 0.4).toFixed(2);
      const health = Math.max(90, 100 - Math.floor(state.volatility * 12) - Math.floor(Math.random() * 4));
      $("coreHealthVal").textContent = health + "%";
      ($("coreHealthBar") as HTMLElement).style.width = health + "%";
    }

    function clockTick() {
      const now = new Date();
      $("clock").textContent =
        String(now.getUTCHours()).padStart(2, "0") +
        ":" +
        String(now.getUTCMinutes()).padStart(2, "0") +
        ":" +
        String(now.getUTCSeconds()).padStart(2, "0");
    }

    function seedHistory() {
      let d = Math.floor(Math.random() * 10);
      for (let i = 0; i < 45; i++) {
        if (Math.random() < 0.4) {
          const band = sizeOf(d) === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
          d = band[Math.floor(Math.random() * band.length)];
        } else {
          d = Math.floor(Math.random() * 10);
        }
        state.results.push(d);
      }
    }

    const autoBtn = $("autoBtn");
    const onAuto = () => {
      state.auto = !state.auto;
      if (state.auto) {
        autoBtn.textContent = "AUTO · ON";
        autoBtn.className =
          "rounded-lg border border-violet/40 bg-violet/10 px-4 py-2 font-mono text-[11px] font-semibold tracking-widest text-violet shadow-glow-violet transition hover:bg-violet/20";
        startRound();
      } else {
        autoBtn.textContent = "AUTO · OFF";
        autoBtn.className =
          "rounded-lg border border-edge bg-panel px-4 py-2 font-mono text-[11px] font-semibold tracking-widest text-muted transition hover:bg-panel2";
        $("roundState").textContent = "PAUSED";
      }
    };
function loop() {
  if (!state.auto) return;

  timeLeft =
    ROUND_SECONDS -
    (Math.floor(Date.now() / 1000) % ROUND_SECONDS);

  tickTimer();

  startRound();
}
    autoBtn.addEventListener("click", onAuto);

    seedHistory();
    renderStats();
    renderHistory(false);
    startRound();
    clockTick();

    const clockId = window.setInterval(clockTick, 1000);
    const loopId = window.setInterval(loop, 1000);
    telemetry();
    const teleId = window.setInterval(telemetry, 2500);

    return () => {
      autoBtn.removeEventListener("click", onAuto);
      clearInterval(clockId);
      clearInterval(loopId);
      clearInterval(teleId);
    };
  }, []);

  return (
    <>
      {/* Jackpot overlay */}
      <div
        id="jackpotOverlay"
        className="fixed inset-0 z-[80] hidden items-center justify-center bg-obsidian/70 backdrop-blur-sm"
      >
        <div className="relative text-center">
          <div className="jackpot-burst absolute inset-0 -z-10 rounded-full blur-3xl bg-gold/30" />
          <div className="font-mono text-sm tracking-[0.5em] text-gold neon-text-gold">JACKPOT HIT</div>
          <div id="jackpotDigit" className="mt-2 text-[9rem] leading-none font-extrabold text-gold neon-text-gold">
            7
          </div>
          <div className="mt-2 font-mono text-xs tracking-[0.35em] text-gold/80">
            EXACT DIGIT FORECAST CONFIRMED
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {/* HEADER */}
        <header className="grid-lines relative overflow-hidden rounded-2xl border border-edge glass p-5">
          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl border border-teal/40 bg-teal/10 shadow-glow-teal">
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-teal" fill="none" stroke="currentColor" strokeWidth={1.6}>
                  <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5 19 19M19 5l-2.5 2.5M7.5 16.5 5 19" />
                  <circle cx="12" cy="12" r="3.2" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                  NEXUS<span className="text-teal neon-text-teal"> · </span>
                  <span className="font-semibold text-muted">AI PREDICTION TERMINAL</span>
                </h1>
                <p className="font-mono text-[11px] tracking-[0.25em] text-muted">
                  WIN&nbsp;GO · MULTI-ENGINE FORECAST CORE · v3.7
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-edge bg-panel px-3 py-2">
                <span className="pulse-dot badge-dot bg-teal shadow-glow-teal" />
                <span className="font-mono text-[11px] tracking-widest text-teal">SERVER LIVE</span>
                <span id="ping" className="font-mono text-[11px] text-muted">
                  · 24ms
                </span>
              </div>
              <div className="rounded-lg border border-edge bg-panel px-3 py-2 font-mono text-[11px] tracking-widest text-muted">
                <span id="clock">--:--:--</span> UTC
              </div>
              <button
                id="autoBtn"
                className="rounded-lg border border-violet/40 bg-violet/10 px-4 py-2 font-mono text-[11px] font-semibold tracking-widest text-violet shadow-glow-violet transition hover:bg-violet/20"
              >
                AUTO&nbsp;·&nbsp;ON
              </button>
            </div>
          </div>
        </header>

        {/* TOP GRID */}
        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Timer + core */}
          <div className="lg:col-span-4">
            <div className="relative h-full overflow-hidden rounded-2xl border border-edge glass p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] tracking-[0.25em] text-muted">ROUND LOCK</span>
                <span
                  id="roundState"
                  className="rounded-md border border-teal/40 bg-teal/10 px-2 py-0.5 font-mono text-[10px] tracking-widest text-teal"
                >
                  OPEN
                </span>
              </div>

              <div className="relative mx-auto mt-3 grid h-44 w-44 place-items-center">
                <svg viewBox="0 0 120 120" className="timer-ring h-44 w-44">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#1b2233" strokeWidth={8} />
                  <circle
                    id="timerArc"
                    className="timer-progress"
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="#22e0c8"
                    strokeWidth={8}
                    strokeLinecap="round"
                    strokeDasharray="326.7"
                    strokeDashoffset="0"
                  />
                </svg>
                <div className="absolute text-center">
                  <div id="timerNum" className="font-mono text-5xl font-bold text-white">
                    30
                  </div>
                  <div className="font-mono text-[10px] tracking-[0.3em] text-muted">SECONDS</div>
                </div>
              </div>

              <div className="mt-3 text-center">
                <div className="font-mono text-[11px] tracking-widest text-muted">CURRENT PERIOD</div>
                <div id="periodNum" className="font-mono text-lg font-semibold text-white">
                  --------
                </div>
              </div>

              {/* core health */}
              <div className="core-scan mt-4 rounded-xl border border-edge bg-panel2 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-[0.25em] text-muted">CORE HEALTH</span>
                  <span id="coreHealthVal" className="font-mono text-[11px] font-semibold text-teal">
                    98%
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-edge">
                  <div
                    id="coreHealthBar"
                    className="h-full rounded-full bg-gradient-to-r from-teal via-violet to-teal shadow-glow-teal transition-all duration-700"
                    style={{ width: "98%" }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-panel px-1 py-1.5">
                    <div id="coreLatency" className="font-mono text-sm font-semibold text-white">
                      24
                    </div>
                    <div className="font-mono text-[9px] tracking-widest text-muted">LATENCY</div>
                  </div>
                  <div className="rounded-lg bg-panel px-1 py-1.5">
                    <div id="coreLoad" className="font-mono text-sm font-semibold text-white">
                      41
                    </div>
                    <div className="font-mono text-[9px] tracking-widest text-muted">LOAD%</div>
                  </div>
                  <div className="rounded-lg bg-panel px-1 py-1.5">
                    <div id="coreEntropy" className="font-mono text-sm font-semibold text-white">
                      0.62
                    </div>
                    <div className="font-mono text-[9px] tracking-widest text-muted">ENTROPY</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Prediction console */}
          <div className="lg:col-span-8">
            <div id="predWrap" className="relative h-full overflow-hidden rounded-2xl border border-edge glass p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] tracking-[0.25em] text-muted">AI FORECAST · NEXT PERIOD</span>
                <span
                  id="engineTag"
                  className="rounded-md border border-violet/40 bg-violet/10 px-2 py-0.5 font-mono text-[10px] tracking-widest text-violet"
                >
                  ENGINE: MARKOV
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <div
                    id="callCard"
                    className="animate-card-in flex h-full flex-col items-center justify-center rounded-2xl border border-teal/40 bg-gradient-to-b from-teal/10 to-transparent p-6 shadow-glow-teal"
                  >
                    <div className="font-mono text-[11px] tracking-[0.35em] text-muted">PRIMARY CALL</div>
                    <div id="callMain" className="mt-1 text-6xl font-extrabold tracking-tight text-teal neon-text-teal">
                      BIG
                    </div>
                    <div id="callSub" className="mt-1 font-mono text-xs tracking-widest text-muted">
                      SIZE MODE · 5-6-7-8-9
                    </div>
                    <div className="mt-4 w-full max-w-xs">
                      <div className="flex items-center justify-between font-mono text-[10px] tracking-widest text-muted">
                        <span>CONFIDENCE</span>
                        <span id="confVal" className="text-teal">
                          86%
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-edge">
                        <div
                          id="confBar"
                          className="h-full rounded-full bg-gradient-to-r from-teal to-violet transition-all duration-700"
                          style={{ width: "86%" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-gold/40 bg-gradient-to-b from-gold/10 to-transparent p-5 shadow-glow-gold">
                    <div className="font-mono text-[11px] tracking-[0.3em] text-gold/80">JACKPOT DIGIT</div>
                    <div id="jackpotTarget" className="digit-pop mt-1 text-6xl font-extrabold text-gold neon-text-gold">
                      7
                    </div>
                    <div className="font-mono text-[10px] tracking-widest text-muted">SEED × FREQ BIAS</div>
                    <div className="mt-3 flex items-center gap-1">
                      <span className="font-mono text-[10px] text-muted">HIT PROB</span>
                      <span id="jackpotProb" className="font-mono text-[11px] font-semibold text-gold">
                        14.8%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* staking plan */}
              <div className="mt-4 rounded-2xl border border-edge bg-panel2 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] tracking-[0.25em] text-muted">3-LEVEL RECOVERY PLAN</span>
                  <span className="font-mono text-[11px] text-muted">
                    CYCLE NET{" "}
                    <span id="cycleNet" className="text-teal">
                      +0
                    </span>
                    u
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div id="lvl1" className="rounded-xl border border-edge bg-panel p-3 text-center transition">
                    <div className="font-mono text-[10px] tracking-widest text-muted">LEVEL 1</div>
                    <div className="mt-1 text-2xl font-bold text-white">
                      1<span className="text-sm text-muted">u</span>
                    </div>
                    <div className="font-mono text-[9px] text-muted">WIN → +1u</div>
                  </div>
                  <div id="lvl2" className="rounded-xl border border-edge bg-panel p-3 text-center transition">
                    <div className="font-mono text-[10px] tracking-widest text-muted">LEVEL 2</div>
                    <div className="mt-1 text-2xl font-bold text-white">
                      3<span className="text-sm text-muted">u</span>
                    </div>
                    <div className="font-mono text-[9px] text-muted">WIN → +2u</div>
                  </div>
                  <div id="lvl3" className="rounded-xl border border-edge bg-panel p-3 text-center transition">
                    <div className="font-mono text-[10px] tracking-widest text-muted">LEVEL 3</div>
                    <div className="mt-1 text-2xl font-bold text-white">
                      8<span className="text-sm text-muted">u</span>
                    </div>
                    <div className="font-mono text-[9px] text-muted">WIN → +4u</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono text-[11px] text-muted">
                    ACTIVE LEVEL:{" "}
                    <span id="activeLvl" className="text-violet">
                      1
                    </span>{" "}
                    · STAKE{" "}
                    <span id="activeStake" className="text-white">
                      1u
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-muted">
                    BALANCE{" "}
                    <span id="balance" className="text-gold">
                      1000.0
                    </span>
                    u
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ENGINE + STATS */}
        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="h-full rounded-2xl border border-edge glass p-5">
              <div className="font-mono text-[11px] tracking-[0.25em] text-muted">ANALYSIS ENGINES</div>
              <div className="mt-3 space-y-3">
                {[
                  { k: "dragon", label: "Dragon Streaks", color: "text-teal", bar: "bg-teal" },
                  { k: "zigzag", label: "Zig-Zag Alternation", color: "text-violet", bar: "bg-violet" },
                  { k: "mirror", label: "Mirror / Symmetry", color: "text-rose", bar: "bg-rose" },
                  { k: "markov", label: "Markov Chain", color: "text-gold", bar: "bg-gold" },
                ].map((e) => (
                  <div key={e.k} className="engine-row" data-k={e.k}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">{e.label}</span>
                      <span className={`sig font-mono text-[11px] ${e.color}`}>--</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-edge">
                      <div className={`bar h-full rounded-full ${e.bar}`} style={{ width: "0%" }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-edge bg-panel2 p-3">
                <div className="flex items-center justify-between font-mono text-[11px] text-muted">
                  <span>MARKET VOLATILITY</span>
                  <span id="volState" className="text-teal">
                    STABLE
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-edge">
                  <div
                    id="volBar"
                    className="h-full rounded-full bg-gradient-to-r from-teal via-gold to-rose transition-all duration-500"
                    style={{ width: "30%" }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="grid h-full grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-edge glass p-4">
                <div className="font-mono text-[10px] tracking-widest text-muted">WIN RATE</div>
                <div id="statWinrate" className="mt-1 text-3xl font-bold text-teal neon-text-teal">
                  0%
                </div>
                <div className="font-mono text-[10px] text-muted">non-skip calls</div>
              </div>
              <div className="rounded-2xl border border-edge glass p-4">
                <div className="font-mono text-[10px] tracking-widest text-muted">WINS / LOSS</div>
                <div className="mt-1 text-3xl font-bold text-white">
                  <span id="statWins" className="text-teal">
                    0
                  </span>
                  <span className="text-xl text-muted"> / </span>
                  <span id="statLoss" className="text-rose">
                    0
                  </span>
                </div>
                <div className="font-mono text-[10px] text-muted">resolved rounds</div>
              </div>
              <div className="rounded-2xl border border-edge glass p-4">
                <div className="font-mono text-[10px] tracking-widest text-muted">SKIPS</div>
                <div id="statSkips" className="mt-1 text-3xl font-bold text-muted">
                  0
                </div>
                <div className="font-mono text-[10px] text-muted">low-confidence</div>
              </div>
              <div className="rounded-2xl border border-edge glass p-4">
                <div className="font-mono text-[10px] tracking-widest text-muted">JACKPOT HITS</div>
                <div id="statJackpot" className="mt-1 text-3xl font-bold text-gold neon-text-gold">
                  0
                </div>
                <div className="font-mono text-[10px] text-muted">exact digit</div>
              </div>

              <div className="col-span-2 rounded-2xl border border-edge glass p-4 sm:col-span-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-6">
                    <div>
                      <div className="font-mono text-[10px] tracking-widest text-muted">CURRENT STREAK</div>
                      <div id="statStreak" className="text-2xl font-bold text-white">
                        0
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] tracking-widest text-muted">BEST STREAK</div>
                      <div id="statBest" className="text-2xl font-bold text-violet">
                        0
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] tracking-widest text-muted">NET PROFIT</div>
                      <div id="statNet" className="text-2xl font-bold text-gold">
                        +0.0u
                      </div>
                    </div>
                  </div>
                  <div className="flex items-end gap-[3px]" id="miniTrend" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HISTORY */}
        <section className="mt-4 rounded-2xl border border-edge glass p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="pulse-dot badge-dot bg-rose shadow-glow-rose" />
              <span className="font-mono text-[11px] tracking-[0.25em] text-muted">
                REALTIME DATA STREAM · LAST 60 RESULTS
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest">
              <span className="rounded border border-teal/40 bg-teal/10 px-2 py-0.5 text-teal">WIN</span>
              <span className="rounded border border-rose/40 bg-rose/10 px-2 py-0.5 text-rose">LOSS</span>
              <span className="rounded border border-edge bg-panel px-2 py-0.5 text-muted">SKIP</span>
              <span className="rounded border border-gold/40 bg-gold/10 px-2 py-0.5 text-gold">JACKPOT</span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-widest text-muted">
                  <th className="pb-2 pl-2">Period</th>
                  <th className="pb-2">Prediction</th>
                  <th className="pb-2 text-center">Target Digit</th>
                  <th className="pb-2 text-center">Actual</th>
                  <th className="pb-2 text-center">Color</th>
                  <th className="pb-2 pr-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody id="historyBody" className="align-middle" />
            </table>
          </div>
        </section>

        <footer className="mt-6 pb-4 text-center font-mono text-[10px] tracking-[0.25em] text-muted">
          NEXUS TERMINAL · SIMULATED FORECAST ENGINE · FOR DEMONSTRATION &amp; ENTERTAINMENT ONLY · NOT FINANCIAL
          ADVICE
        </footer>
      </div>
    </>
  );
}
