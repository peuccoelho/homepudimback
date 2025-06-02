 async function logar() {
    const senha = document.getElementById("senha").value.trim();

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senha })
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem("adminToken", data.token);
      window.location.href = "/admin.html";
    } else {
      alert("❌ Senha incorreta!");
    }
  }

