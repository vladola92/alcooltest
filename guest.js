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

const params = new URLSearchParams(window.location.search);
const eventId = params.get("event");

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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getEntryIdFromName(name) {
  return slugify(name);
}

function loadEvent() {
  if (!eventId) {
    document.getElementById("event-title").innerText = "Link invalid. Lipsește evenimentul.";
    return;
  }

  db.collection("events").doc(eventId).get()
    .then((doc) => {
      if (!doc.exists) {
        document.getElementById("event-title").innerText = "Eveniment inexistent.";
        return;
      }

      document.getElementById("event-title").innerText = `Eveniment: ${doc.data().name}`;
      listenToLeaderboard();
    })
    .catch((error) => {
      console.error(error);
      document.getElementById("event-title").innerText = "Eroare la încărcarea evenimentului.";
    });
}

function submitData() {
  const name = document.getElementById("name").value.trim();
  const alcoholValue = document.getElementById("alcohol").value.trim();
  const alcohol = parseFloat(alcoholValue);
  const status = document.getElementById("statusMessage");

  if (!eventId) {
    alert("Eveniment invalid.");
    return;
  }

  if (!name || alcoholValue === "" || isNaN(alcohol)) {
    alert("Completează toate câmpurile.");
    return;
  }

  if (alcohol < 0 || alcohol > 5) {
    alert("Introdu o valoare validă pentru alcoolemie.");
    return;
  }

  const entryId = getEntryIdFromName(name);
  const entryRef = db.collection("events").doc(eventId).collection("entries").doc(entryId);

  entryRef.get()
    .then((doc) => {
      if (doc.exists) {
        const existing = doc.data();

        if (Number(existing.alcohol) === alcohol) {
          status.innerText = "Acest nume are deja aceeași valoare. Nu am adăugat duplicat.";
          return null;
        }

        return entryRef.update({
          name,
          alcohol,
          updatedAt: Date.now()
        }).then(() => {
          status.innerText = "Alcoolemia a fost actualizată pentru acest nume.";
          document.getElementById("name").value = "";
          document.getElementById("alcohol").value = "";
        });
      }

      return entryRef.set({
        name,
        alcohol,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }).then(() => {
        status.innerText = "Rezultatul a fost adăugat.";
        document.getElementById("name").value = "";
        document.getElementById("alcohol").value = "";
      });
    })
    .catch((error) => {
      console.error(error);
      alert("Eroare la salvare: " + error.message);
    });
}

function listenToLeaderboard() {
  db.collection("events")
    .doc(eventId)
    .collection("entries")
    .onSnapshot((snapshot) => {
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

      renderGuestRanking(entries);
    }, (error) => {
      console.error("listenToLeaderboard error:", error);
      alert("Eroare la citirea clasamentului: " + error.message);
    });
}

function renderGuestRanking(entries) {
  const podium = document.getElementById("guestPodium");
  const restList = document.getElementById("guestRestList");

  podium.innerHTML = "";
  restList.innerHTML = "";

  if (!entries.length) {
    podium.innerHTML = '<div class="podium-empty">Nu există încă rezultate.</div>';
    return;
  }

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  const podiumOrder = [1, 0, 2];

  podiumOrder.forEach((index) => {
    const item = top3[index];
    if (!item) {
      const empty = document.createElement("div");
      empty.className = "podium-card empty";
      empty.innerHTML = `<div class="place">-</div><div class="name">Liber</div>`;
      podium.appendChild(empty);
      return;
    }

    const places = ["🥇", "🥈", "🥉"];
    const actualPlace = index === 1 ? 1 : index === 0 ? 2 : 3;

    const card = document.createElement("div");
    card.className = `podium-card place-${actualPlace}`;
    card.innerHTML = `
      <div class="place">${places[actualPlace - 1]}</div>
      <div class="name"><strong>${escapeHtml(item.name)}</strong></div>
      <div class="score"><strong>${item.alcohol}</strong></div>
    `;
    podium.appendChild(card);
  });

  rest.forEach((item, idx) => {
    const li = document.createElement("li");
    li.className = "ranking-item";
    li.innerHTML = `
      <div>
        <span class="rank-number">${idx + 4}.</span>
        <span>${escapeHtml(item.name)}</span>
        <span class="normal-score">${item.alcohol}</span>
      </div>
    `;
    restList.appendChild(li);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("submitBtn").addEventListener("click", submitData);
  loadEvent();
});