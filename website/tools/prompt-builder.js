/* NotebookLM prompt builder: pick what you want to make, who it's for and
   how long, and get a ready prompt (with the 14 NotebookTools slide styles
   for slide decks). */
(() => {
  const { $, esc, copy } = window.NTTools;
  const styles = window.NotebookToolsPromptLibrary?.slideDecks || [];
  let styleId = "";

  const GOALS = {
    slides: {
      label: "Slide deck",
      where: "Studio → Slide deck → the pencil (Customise) → Describe the slide deck.",
      build: (o) => `Create a slide deck from my sources for ${o.audience}. ${o.length === "short" ? "Keep it to about 8 slides." : o.length === "long" ? "Go into detail: 15 to 20 slides." : ""} ${o.focus ? `Focus on: ${o.focus}.` : ""}`
    },
    study: {
      label: "Study guide",
      where: "Paste it in the chat, or Studio → Reports → Study guide → Customise.",
      build: (o) => `Make a study guide from my sources for ${o.audience}. Include the key concepts with one-line definitions, the main ideas in a logical order, ${o.length === "short" ? "and 5" : o.length === "long" ? "two worked examples, common mistakes, and 15" : "common mistakes, and 10"} practice questions with answers at the end. ${o.focus ? `Focus on: ${o.focus}.` : ""} Use only my sources and cite them.`
    },
    quiz: {
      label: "Quiz",
      where: "Studio → Quiz → Customise, or paste it in the chat.",
      build: (o) => `Write a quiz from my sources for ${o.audience}: ${o.length === "short" ? "8" : o.length === "long" ? "25" : "15"} questions, mixing multiple choice and short answer, from easy to hard. After each answer, explain why it is right with a citation to the source. ${o.focus ? `Cover: ${o.focus}.` : ""}`
    },
    audio: {
      label: "Audio Overview",
      where: "Studio → Audio Overview → Customise → What should the AI hosts focus on?",
      build: (o) => `Explain my sources for ${o.audience}. ${o.length === "short" ? "Keep it brief and stick to the three most important points." : o.length === "long" ? "Take your time and go deep on how the ideas connect." : "Cover the main ideas and one or two examples."} ${o.focus ? `Spend most of the time on: ${o.focus}.` : ""} Define terms the first time you use them.`
    },
    briefing: {
      label: "Briefing / report",
      where: "Studio → Reports → Create your own, or paste it in the chat.",
      build: (o) => `Write a briefing for ${o.audience} from my sources with these sections: Situation, Key findings (each with a source citation), Risks or open questions, Recommended next steps. ${o.length === "short" ? "Max 300 words." : o.length === "long" ? "Up to 1,200 words." : "Max 600 words."} ${o.focus ? `Focus on: ${o.focus}.` : ""}`
    },
    flashcards: {
      label: "Flashcards",
      where: "Studio → Flashcards → Customise, or paste it in the chat.",
      build: (o) => `Create ${o.length === "short" ? "15" : o.length === "long" ? "50" : "30"} flashcards from my sources for ${o.audience}: one fact, definition or cause-and-effect per card, question on the front, short answer on the back. ${o.focus ? `Focus on: ${o.focus}.` : ""}`
    }
  };

  const AUDIENCE = {
    beginners: "complete beginners",
    students: "university students preparing for an exam",
    pros: "professionals who already know the basics",
    execs: "busy decision-makers"
  };

  function options() {
    return {
      goal: $("#pbGoal").value,
      audience: AUDIENCE[$("#pbAudience").value],
      length: $("#pbLength").value,
      focus: $("#pbFocus").value.trim().replace(/[.\s]+$/, "")
    };
  }

  function renderStyles() {
    const box = $("#pbStyles");
    const show = $("#pbGoal").value === "slides";
    $("#pbStylesField").hidden = !show;
    if (!show || box.dataset.ready) return;
    box.innerHTML = styles.map((s) => `<button type="button" class="tool-style" data-style="${esc(s.id)}" title="${esc(s.description)}">${esc(s.title.replace(/\s+deck$/i, ""))}<small>${esc(s.badge || "")}</small></button>`).join("");
    box.dataset.ready = "1";
  }

  function run() {
    renderStyles();
    const o = options();
    const goal = GOALS[o.goal];
    let prompt = goal.build(o).replace(/\s{2,}/g, " ").trim();
    if (o.goal === "slides") {
      const style = styles.find((s) => s.id === styleId);
      if (style) prompt += `\n\nStyle: ${style.prompt}`;
    }
    $("#pbOutput").value = prompt;
    $("#pbWhere").textContent = goal.where;
  }

  $("#pbStyles").addEventListener("click", (event) => {
    const button = event.target.closest("[data-style]");
    if (!button) return;
    styleId = styleId === button.dataset.style ? "" : button.dataset.style;
    document.querySelectorAll("#pbStyles .tool-style").forEach((b) => b.classList.toggle("is-on", b.dataset.style === styleId));
    run();
  });
  ["#pbGoal", "#pbAudience", "#pbLength"].forEach((s) => $(s).addEventListener("change", run));
  $("#pbFocus").addEventListener("input", run);
  $("#pbCopy").addEventListener("click", (e) => copy($("#pbOutput").value, e.currentTarget));
  run();
})();
