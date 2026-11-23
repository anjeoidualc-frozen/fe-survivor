/* Fé Survivor - exportar o save do jogo web para o app Godot.
 * Como usar (qualquer um):
 *  1) Incluir este arquivo no jogo web (<script src="web_export_snippet.js"></script>) e lançar uma
 *     versão antes de migrar: aparece o botão "Exportar save" no canto da tela.
 *  2) Ou colar o conteúdo no console do navegador (F12) e rodar feExportSave().
 * O código copiado tem a forma FE1.<base64>.<checksum> e é colado no app Godot em "Importar save". */
(function () {
  var KEY = "fe-survivor-v1";

  function fnv(bytes) {
    var h = 2166136261;
    for (var i = 0; i < bytes.length; i++) {
      h ^= bytes[i];
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }

  function b64(bytes) {
    var s = "", CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH)
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }

  window.feExportCode = function () {
    var raw = localStorage.getItem(KEY);
    if (!raw) return null;
    var bytes = new TextEncoder().encode(raw);
    return "FE1." + b64(bytes) + "." + fnv(bytes);
  };

  window.feExportSave = async function () {
    var code = window.feExportCode();
    if (!code) { alert("Nenhum save encontrado neste aparelho."); return null; }
    try {
      await navigator.clipboard.writeText(code);
      alert("Código do save copiado! Abra o novo app e toque em \"Importar save\".");
    } catch (e) {
      prompt("Copie o código abaixo (selecione tudo) e cole no novo app:", code);
    }
    return code;
  };

  function addButton() {
    if (!document.body || document.getElementById("feExportBtn")) return;
    var b = document.createElement("button");
    b.id = "feExportBtn";
    b.textContent = "Exportar save";
    b.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:99999;padding:10px 14px;" +
      "font:bold 14px sans-serif;background:#2b2740;color:#ffd86b;border:2px solid #ffd86b;border-radius:8px;";
    b.onclick = function () { window.feExportSave(); };
    document.body.appendChild(b);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addButton);
  else addButton();
})();
