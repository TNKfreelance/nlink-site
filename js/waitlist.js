(function () {
  "use strict";

  // Web3Forms access key. Empty = the intake is not wired yet; the form then
  // shows an honest "opening shortly" message instead of pretending to submit.
  // Set the key (issued to the owner's address at web3forms.com) and redeploy.
  var WEB3FORMS_KEY = "3881f166-797c-47f7-9e95-67c412ba795e";
  var ENDPOINT = "https://api.web3forms.com/submit";

  var form = document.getElementById("waitlist-form");
  var note = document.getElementById("waitlist-note");
  if (!form || !note) return;

  function lang() {
    return document.body.getAttribute("data-lang") === "en" ? "en" : "ja";
  }
  var MSG = {
    pending: { ja: "ウェイトリストはまもなく開放します。少し後にもう一度お試しください。",
               en: "The waitlist opens shortly — please check back soon." },
    sending: { ja: "送信中…", en: "Sending…" },
    ok:      { ja: "登録を受け付けました。開放時にご連絡します。",
               en: "You're on the list. We'll reach out when access opens." },
    err:     { ja: "送信に失敗しました。時間をおいて再度お試しください。",
               en: "Something went wrong — please try again later." },
    invalid: { ja: "メールアドレスの形式を確認してください。",
               en: "Please enter a valid email address." }
  };
  function say(key) { note.textContent = MSG[key][lang()]; }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = (document.getElementById("email").value || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say("invalid"); return; }
    if (!WEB3FORMS_KEY) { say("pending"); return; }
    say("sending");
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject: "N-Link waitlist signup",
        from_name: "N-Link LP",
        email: email,
        botcheck: ""
      })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.success) { say("ok"); form.reset(); } else { say("err"); }
    }).catch(function () { say("err"); });
  });
})();
