const API_URL = window.HANKA_API_URL || "https://REPLACE-WITH-HANKA-WORKER.workers.dev/chat";
const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const messagesEl = document.getElementById("messages");
const conversation = [];

function addMessage(role, content, extraClass = "") {
  const article = document.createElement("article");
  article.className = `message ${role === "assistant" ? "hanka" : "user"} ${extraClass}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const label = document.createElement("strong");
  label.textContent = role === "assistant" ? "Hanka" : "Ty";
  const p = document.createElement("p");
  p.textContent = content;

  if (role === "assistant") {
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = "H";
    article.appendChild(avatar);
  }

  bubble.append(label, p);
  article.appendChild(bubble);
  messagesEl.appendChild(article);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return article;
}

function resizeInput() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 140) + "px";
}

input.addEventListener("input", resizeInput);
input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  const content = input.value.trim();
  if (!content || sendButton.disabled) return;

  conversation.push({ role: "user", content });
  addMessage("user", content);
  input.value = "";
  resizeInput();
  sendButton.disabled = true;

  const typing = addMessage("assistant", "Hanka myśli…", "typing");

  try {
    if (API_URL.includes("REPLACE-WITH-HANKA-WORKER")) {
      throw new Error("Worker URL is not configured yet.");
    }

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversation })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");

    typing.remove();
    conversation.push({ role: "assistant", content: data.answer });
    addMessage("assistant", data.answer);
  } catch (error) {
    typing.remove();
    addMessage("assistant", API_URL.includes("REPLACE-WITH-HANKA-WORKER")
      ? "Jeszcze mnie nie podłączyli do Cloudflare. 😄 Frontend działa — teraz potrzebuję adresu naszego Workera."
      : "Coś się wywaliło po drodze. Spróbuj jeszcze raz za moment.");
    console.error(error);
  } finally {
    sendButton.disabled = false;
    input.focus();
  }
});
