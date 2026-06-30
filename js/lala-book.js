/* La Lasagna — reservation form submit. Posts the form to /api/book as JSON and
   shows an inline status message (EN/FI by <html lang>). Falls back to a normal
   form POST if JS is unavailable. */
(function () {
  var form = document.querySelector("form.lala-form");
  if (!form) return;

  var MSG = {
    en: {
      sending: "Sending…",
      ok: "Thank you! Your reservation request has been sent — we'll get back to you soon.",
      err: "Sorry, something went wrong. Please email lalasagnahelsinki@gmail.com or call +358 40 365 1664.",
    },
    fi: {
      sending: "Lähetetään…",
      ok: "Kiitos! Varauspyyntösi on lähetetty — otamme sinuun pian yhteyttä.",
      err: "Pahoittelut, jokin meni pieleen. Lähetä sähköpostia osoitteeseen lalasagnahelsinki@gmail.com tai soita +358 40 365 1664.",
    },
  };
  function t(k) {
    var l = (document.documentElement.lang || "en").slice(0, 2);
    return (MSG[l] || MSG.en)[k];
  }

  // status line
  var status = document.createElement("div");
  status.className = "lala-status lala-no-translate";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  form.appendChild(status);

  // styles
  var st = document.createElement("style");
  st.textContent =
    ".lala-status{margin-top:14px;font-weight:700;font-size:15px;line-height:1.4;min-height:1px;}" +
    ".lala-status.sending{opacity:.7;}" +
    ".lala-status.ok{color:#34c759;}" +
    ".lala-status.err{color:#ff5a4d;}";
  (document.head || document.body).appendChild(st);

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var btn = form.querySelector('button[type="submit"], .lala-send');
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = v; });

    status.textContent = t("sending");
    status.className = "lala-status lala-no-translate sending";
    if (btn) btn.disabled = true;

    fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
      .then(function (j) {
        if (j && j.ok) {
          status.textContent = t("ok");
          status.className = "lala-status lala-no-translate ok";
          form.reset();
        } else {
          status.textContent = (j && j.error) ? j.error : t("err");
          status.className = "lala-status lala-no-translate err";
        }
      })
      .catch(function () {
        status.textContent = t("err");
        status.className = "lala-status lala-no-translate err";
      })
      .finally(function () { if (btn) btn.disabled = false; });
  });
})();
