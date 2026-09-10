const form = document.getElementById("loginForm");
const error = document.getElementById("error");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  error.textContent = "";

  const button = form.querySelector("button[type=submit]");
  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = "جاري تسجيل الدخول...";

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: document.getElementById("username").value.trim(),
        password: document.getElementById("password").value
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      error.textContent = data.error || "اسم المستخدم أو كلمة المرور غير صحيحة";
      return;
    }

    window.location.href = "/admin";
  } catch (err) {
    error.textContent = "تعذر الاتصال بالسيرفر. تأكد أن node server.js يعمل.";
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
});
