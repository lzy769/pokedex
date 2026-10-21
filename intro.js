(function () {
  const intro = document.getElementById("intro");
  if (!intro) return;
  window.addEventListener("load", () => {
    setTimeout(() => {
      intro.classList.add("hide");
    }, 1400);
  });
})();