const firebaseConfig = {
  apiKey: "AIzaSyAe1UVjVsYMSCi3soTi2DrVA9ZtzuPfXZE",
  authDomain: "alcooltest-c1676.firebaseapp.com",
  projectId: "alcooltest-c1676",
  storageBucket: "alcooltest-c1676.firebasestorage.app",
  messagingSenderId: "891446581473",
  appId: "1:891446581473:web:c95aaf7d30d334ae1c7fa0",
  measurementId: "G-GEKN2DSJZ3"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

const ADMIN_PASSWORD = "alcooltest2026";

let currentAdminEventId = null;
let currentGuestLink = "";
let unsubscribeEntries = null;
let unsubscribeEvents = null;

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/ă/g, "a")
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/ș|ş/g, "s")
    .replace(/ț|ţ/g, "t")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeEventId(name) {
  const slug = slugify(name);
  const randomPart = Math.floor(Math.random() * 9000) + 1000;
  return `${slug}-${randomPart}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatAlcohol(value) {
  return Number(value || 0).toFixed(2);
}

function getGuestLink(eventId) {
  return `https://vladola92.github.io/alcooltest/guest.html?event=${eventId}`;
}

function applyTheme(theme) {
  document.body.classList.remove(
    "theme-party",
    "theme-wedding",
    "theme-baptism",
    "theme-birthday"
  );
  document.body.classList.add(`theme-${theme}`);
}

function showAdminApp() {
  document.getElementById("admin-login").classList.add("hidden");
  document.getElementById("admin-app").classList.remove("hidden");
  listenToEvents();
}

function logoutAdmin() {
  localStorage.removeItem("alcooltest_admin_ok");
  location.reload();
}

function loginAdmin() {
  const password = document.getElementById("adminPassword").value;
  const message = document.getElementById("loginMessage");

  if (password === ADMIN_PASSWORD) {
    localStorage.setItem("alcooltest_admin_ok", "yes");
    showAdminApp();
  } else {
    message.innerText = "Parolă incorectă.";
  }
}

function createEvent() {
  const input = document.getElementById("eventName");
  const themeInput = document.getElementById("eventTheme");
  const message = document.getElementById("createMessage");

  const eventName = input.value.trim();
  const eventTheme = themeInput.value;

  if (!eventName) {
    alert("Introdu numele evenimentului.");
    return;
  }

  message.innerText = "Se creează evenimentul...";

  const eventId = makeEventId(eventName);

  db.collection("events")
    .doc(eventId)
    .set({
      name: eventName,
      slug: slugify(eventName),
      theme: eventTheme,
      createdAt: Date.now()
    })
    .then(() => {
      message.innerText = `Eveniment creat: ${eventName}`;
      input.value = "";
      selectEvent(eventId);
    })
    .catch((error) => {
      alert("Eroare la crearea evenimentului: " + error.message);
      console.error("createEvent error:", error);
      message.innerText = "";
    });
}

function listenToEvents() {
  if (unsubscribeEvents) unsubscribeEvents();

  unsubscribeEvents = db.collection("events").onSnapshot(
    (snapshot) => {
      const list = document.getElementById("eventsList");
      list.innerHTML = "";

      const events = [];
      snapshot.forEach((doc) => {
        events.push({ id: doc.id, ...doc.data() });
      });

      events.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      if (!events.length) {
        list.innerHTML = '<div class="muted">Nu există încă evenimente.</div>';
        return;
      }

      events.forEach((item) => {
        const btn = document.createElement("button");
        btn.className = "event-item";
        btn.innerHTML = `
          <strong>${escapeHtml(item.name || item.id)}</strong>
          <span>${escapeHtml(item.id)}</span>
          <span>Tema: ${escapeHtml(item.theme || "party")}</span>
        `;
        btn.addEventListener("click", () => selectEvent(item.id));
        list.appendChild(btn);
      });
    },
    (error) => {
      console.error("listenToEvents error:", error);
      alert("Eroare la citirea listei de evenimente: " + error.message);
    }
  );
}

function selectEvent(eventId) {
  currentAdminEventId = eventId;

  db.collection("events")
    .doc(eventId)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        alert("Eveniment inexistent.");
        return;
      }

      const data = doc.data();
      currentGuestLink = getGuestLink(eventId);

      document.getElementById("selectedEventName").innerText = data.name || "-";
      document.getElementById("selectedEventCode").innerText = eventId;
      document.getElementById("eventLinkBox").innerHTML =
        `<a href="${currentGuestLink}" target="_blank">${currentGuestLink}</a>`;

      applyTheme(data.theme || "party");
      renderQr(currentGuestLink);
      listenToEntries(eventId);
    })
    .catch((error) => {
      alert("Eroare la încărcarea evenimentului: " + error.message);
      console.error("selectEvent error:", error);
    });
}

function listenToEntries(eventId) {
  if (unsubscribeEntries) unsubscribeEntries();

  unsubscribeEntries = db.collection("events")
    .doc(eventId)
    .collection("entries")
    .onSnapshot(
      (snapshot) => {
        const entries = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          entries.push({
            id: doc.id,
            name: data.name || "",
            alcohol: Number(data.alcohol || 0),
            updatedAt: Number(data.updatedAt || data.createdAt || 0)
          });
        });

        entries.sort((a, b) => {
          if (b.alcohol !== a.alcohol) return b.alcohol - a.alcohol;
          return a.updatedAt - b.updatedAt;
        });

        renderAdminRanking(entries);
      },
      (error) => {
        console.error("listenToEntries error:", error);
        alert("Eroare la citirea clasamentului: " + error.message);
      }
    );
}

function renderQr(text) {
  const qrBox = document.getElementById("qrcode");
  qrBox.innerHTML = "";

  new QRCode(qrBox, {
    text: text,
    width: 180,
    height: 180
  });
}

function copyGuestLink() {
  if (!currentGuestLink) {
    alert("Selectează mai întâi un eveniment.");
    return;
  }

  navigator.clipboard.writeText(currentGuestLink)
    .then(() => {
      alert("Link copiat.");
    })
    .catch(() => {
      alert("Nu am putut copia linkul.");
    });
}

function renderAdminRanking(entries) {
  const podium = document.getElementById("adminPodium");
  const restList = document.getElementById("adminRestList");

  podium.innerHTML = "";
  restList.innerHTML = "";

  if (!entries.length) {
    podium.innerHTML = '<div class="podium-empty">Nu există încă rezultate.</div>';
    return;
  }

  const first = entries[0] || null;
  const second = entries[1] || null;
  const third = entries[2] || null;
  const rest = entries.slice(3);

  const podiumItems = [
    { person: second, place: 2, medal: "🥈" },
    { person: first, place: 1, medal: "🥇" },
    { person: third, place: 3, medal: "🥉" }
  ];

  podiumItems.forEach((item) => {
    if (!item.person) {
      const empty = document.createElement("div");
      empty.className = "podium-card empty";
      empty.innerHTML = `<div class="place">-</div><div class="name">Liber</div>`;
      podium.appendChild(empty);
      return;
    }

    const card = document.createElement("div");
    card.className = `podium-card place-${item.place}`;
    card.innerHTML = `
      <div class="place">${item.medal}</div>
      <div class="name"><strong>${escapeHtml(item.person.name)}</strong></div>
      <div class="score"><strong>${formatAlcohol(item.person.alcohol)}</strong></div>
      <button class="trash-btn" title="Șterge" aria-label="Șterge">🗑️</button>
    `;

    card.querySelector(".trash-btn").addEventListener("click", () => deleteEntry(item.person.id));
    podium.appendChild(card);
  });

  rest.forEach((item, idx) => {
    const li = document.createElement("li");
    li.className = "ranking-item";
    li.innerHTML = `
      <div>
        <span class="rank-number">${idx + 4}.</span>
        <span>${escapeHtml(item.name)}</span>
        <span class="normal-score">${formatAlcohol(item.alcohol)}</span>
      </div>
      <button class="trash-btn" title="Șterge" aria-label="Șterge">🗑️</button>
    `;
    li.querySelector(".trash-btn").addEventListener("click", () => deleteEntry(item.id));
    restList.appendChild(li);
  });
}

function deleteEntry(entryId) {
  if (!currentAdminEventId) {
    alert("Selectează un eveniment.");
    return;
  }

  db.collection("events")
    .doc(currentAdminEventId)
    .collection("entries")
    .doc(entryId)
    .delete()
    .catch((error) => {
      alert("Eroare la ștergere: " + error.message);
      console.error("deleteEntry error:", error);
    });
}

function resetLeaderboard() {
  if (!currentAdminEventId) {
    alert("Selectează un eveniment.");
    return;
  }

  const ok = confirm("Sigur vrei să resetezi clasamentul?");
  if (!ok) return;

  db.collection("events")
    .doc(currentAdminEventId)
    .collection("entries")
    .get()
    .then((snapshot) => {
      const promises = [];
      snapshot.forEach((doc) => {
        promises.push(doc.ref.delete());
      });
      return Promise.all(promises);
    })
    .then(() => {
      alert("Clasamentul a fost resetat.");
    })
    .catch((error) => {
      alert("Eroare la resetare: " + error.message);
      console.error("resetLeaderboard error:", error);
    });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loginBtn").addEventListener("click", loginAdmin);
  document.getElementById("logoutBtn").addEventListener("click", logoutAdmin);
  document.getElementById("createEventBtn").addEventListener("click", createEvent);
  document.getElementById("copyLinkBtn").addEventListener("click", copyGuestLink);
  document.getElementById("resetBtn").addEventListener("click", resetLeaderboard);

  if (localStorage.getItem("alcooltest_admin_ok") === "yes") {
    showAdminApp();
  }
});