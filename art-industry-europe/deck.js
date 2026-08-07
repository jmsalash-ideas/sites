/* ═══════════════════════════════════════════════════════════════════════
   Navegación del deck. Sin dependencias.
   - flechas / espacio / PageUp-Down / Home-End
   - clic en los tercios laterales, swipe táctil
   - indicador n/16 y barra de progreso
   - tecla N: notas de construcción (nunca salen en el PDF)
   - hash #7 para enlazar a una diapositiva concreta
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var total  = slides.length;
  var idx    = 0;

  var elCur   = document.getElementById("cur");
  var elTotal = document.getElementById("total");
  var elBar   = document.getElementById("progress-bar");

  elTotal.textContent = total;

  /* El contador de la portada: cuántas cifras siguen sin verificar (plan §2).
     Se cuenta del DOM, no a mano, para que no pueda quedarse desfasado. */
  function refreshVerifyCount() {
    var n = document.querySelectorAll(".verify").length;
    var el = document.getElementById("verify-count");
    if (el) el.textContent = n;
    var badge = el && el.closest(".badge");
    if (badge && n === 0) badge.style.display = "none";
  }

  function show(i, pushHash) {
    idx = Math.max(0, Math.min(total - 1, i));
    slides.forEach(function (s, k) { s.classList.toggle("is-active", k === idx); });
    elCur.textContent = idx + 1;
    elBar.style.width = ((idx + 1) / total * 100) + "%";
    if (pushHash !== false) history.replaceState(null, "", "#" + (idx + 1));
  }

  var next = function () { show(idx + 1); };
  var prev = function () { show(idx - 1); };

  document.getElementById("next").addEventListener("click", next);
  document.getElementById("prev").addEventListener("click", prev);
  document.getElementById("notes").addEventListener("click", function () {
    document.body.classList.toggle("notes-on");
  });

  document.addEventListener("keydown", function (e) {
    switch (e.key) {
      case "ArrowRight": case "ArrowDown": case " ": case "PageDown":
        e.preventDefault(); next(); break;
      case "ArrowLeft": case "ArrowUp": case "PageUp":
        e.preventDefault(); prev(); break;
      case "Home": e.preventDefault(); show(0); break;
      case "End":  e.preventDefault(); show(total - 1); break;
      case "n": case "N": document.body.classList.toggle("notes-on"); break;
    }
  });

  /* Clic en el tercio izquierdo/derecho — cómodo con puntero en sala. */
  document.getElementById("stage").addEventListener("click", function (e) {
    if (e.target.closest(".hud")) return;
    var x = e.clientX / window.innerWidth;
    if (x > 0.66) next();
    else if (x < 0.34) prev();
  });

  /* Swipe horizontal. */
  var x0 = null;
  document.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) (dx < 0 ? next : prev)();
    x0 = null;
  }, { passive: true });

  refreshVerifyCount();
  var fromHash = parseInt((location.hash || "").slice(1), 10);
  show(isNaN(fromHash) ? 0 : fromHash - 1, false);
})();
