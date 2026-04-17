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

let previousMaxAlcohol = null;
let previousLeaderName = null;
let previousTop3Names = [];
let recordBadgeTimeout = null;
let leaderBadgeTimeout = null;
let lastUpdatedId = null;
let isEventFinalized = false;
let currentShareLink = "";

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

function formatAlcohol(value) {
  return Number(value || 0).toFixed(2);
}

function getEntryIdFromName(name) {
  return slugify(name);
}

function getTitle(alcohol) {
  if (alcohol === 0) return "🧊 Șoferul serii";
  if (alcohol < 0.3) return "🙂 Încă ok";
  if (alcohol < 0.7) return "😏 Începe distracția";
  if (alcohol < 1.2) return "🔥 Pe val";
  return "👑 Regele nopții";
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

function updateGuestAvailability() {
  const formCard = document.getElementById("guestFormCard");
  const closedBanner = document.getElementById("guestClosedBanner");

  if (isEventFinalized) {
    formCard.classList.add("hidden");
    closedBanner.classList.remove("hidden");
  } else {
    formCard.classList.remove("hidden");
    closedBanner.classList.add("hidden");
  }
}

function renderGuestQr(link) {
  const qrBox = document.getElementById("guestQrcode");
  qrBox.innerHTML = "";

  new QRCode(qrBox, {
    text: link,
    width: 160,
    height: 160
  });
}

function copyGuestEventLink() {
  if (!currentShareLink) {
    alert("Linkul nu este încă disponibil.");
    return;
  }

  navigator.clipboard.writeText(currentShareLink)
    .then(() => {
      alert("Link copiat.");
    })
    .catch(() => {
      alert("Nu am putut copia linkul.");
    });
}

function shareGuestOnWhatsApp() {
  if (!currentShareLink) {
    alert("Linkul nu este încă disponibil.");
    return;
  }

  const text = `Intră în clasamentul alcooltest: ${currentShareLink}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}

function loadEvent() {
  if (!eventId) {
    document.getElementById("event-title").innerText = "Link invalid. Lipsește evenimentul.";
    return;
  }

  currentShareLink = `${window.location.origin}${window.location.pathname}?event=${eventId}`;
  document.getElementById("guestLinkBox").innerHTML =
    `<a href="${currentShareLink}" target="_blank">${currentShareLink}</a>`;
  renderGuestQr(currentShareLink);

  db.collection("events")
    .doc(eventId)
    .onSnapshot((doc) => {
      if (!doc.exists) {
        document.getElementById("event-title").innerText = "Eveniment inexistent.";
        return;
      }

      const eventData = doc.data();
      isEventFinalized = !!eventData.isFinalized;

      document.getElementById("event-title").innerText = `Eveniment: ${eventData.name}`;
      applyTheme(eventData.theme || "party");
      updateGuestAvailability();
      listenToLeaderboard();
    }, (error) => {
      console.error(error);
      document.getElementById("event-title").innerText = "Eroare la încărcarea evenimentului.";
    });
}

let leaderboardSubscribed = false;

function submitData() {
  const name = document.getElementById("name").value.trim();
  const alcoholValue = document.getElementById("alcohol").value.trim();
  const alcohol = parseFloat(alcoholValue);
  const status = document.getElementById("statusMessage");

  if (!eventId) {
    alert("Eveniment invalid.");
    return;
  }

  if (isEventFinalized) {
    alert("Evenimentul este finalizat. Nu se mai pot introduce rezultate.");
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
          lastUpdatedId = entryId;
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
        lastUpdatedId = entryId;
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
  if (leaderboardSubscribed) return;
  leaderboardSubscribed = true;

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

function showNewRecordHighlight(newMax) {
  const badge = document.getElementById("recordBadge");
  const maxBox = document.querySelector(".max-box");

  badge.innerText = `🔥 Record nou: ${formatAlcohol(newMax)}`;
  badge.classList.remove("hidden");
  badge.classList.add("show-record");

  if (maxBox) {
    maxBox.classList.add("record-pulse");
  }

  if (typeof confetti === "function") {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 }
    });
  }

  if (recordBadgeTimeout) {
    clearTimeout(recordBadgeTimeout);
  }

  recordBadgeTimeout = setTimeout(() => {
    badge.classList.remove("show-record");
    badge.classList.add("hidden");
    if (maxBox) {
      maxBox.classList.remove("record-pulse");
    }
  }, 3500);
}

function showLeaderHighlight(name) {
  const badge = document.getElementById("recordBadge");
  badge.innerText = `👑 Lider nou: ${name}`;
  badge.classList.remove("hidden");
  badge.classList.add("show-record");

  if (leaderBadgeTimeout) {
    clearTimeout(leaderBadgeTimeout);
  }

  leaderBadgeTimeout = setTimeout(() => {
    badge.classList.remove("show-record");
    badge.classList.add("hidden");
  }, 3500);
}

function updateStats(entries) {
  const count = entries.length;

  let total = 0;
  let max = 0;

  entries.forEach((entry) => {
    const value = Number(entry.alcohol || 0);
    total += value;
    if (value > max) {
      max = value;
    }
  });

  const avg = count ? total / count : 0;

  document.getElementById("statCount").innerText = count;
  document.getElementById("statAvg").innerText = avg.toFixed(2);
  document.getElementById("statMax").innerText = max.toFixed(2);

  if (previousMaxAlcohol !== null && max > previousMaxAlcohol) {
    showNewRecordHighlight(max);
  }

  previousMaxAlcohol = max;
}

function renderGuestRanking(entries) {
  updateStats(entries);

  const podium = document.getElementById("guestPodium");
  const restList = document.getElementById("guestRestList");

  podium.innerHTML = "";
  restList.innerHTML = "";

  if (!entries.length) {
    podium.innerHTML = '<div class="podium-empty">Nu există încă rezultate.</div>';
    previousLeaderName = null;
    previousTop3Names = [];
    return;
  }

  const first = entries[0] || null;
  const second = entries[1] || null;
  const third = entries[2] || null;
  const rest = entries.slice(3);

  const currentLeaderName = first ? first.name : null;
  const currentTop3Names = [first?.name || null, second?.name || null, third?.name || null];

  if (previousLeaderName && currentLeaderName && previousLeaderName !== currentLeaderName) {
    showLeaderHighlight(currentLeaderName);
  }

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

    const wasInTop3 = previousTop3Names.includes(item.person.name);
    if (!wasInTop3) {
      card.classList.add("podium-flash");
    }

    if (item.place === 1 && previousLeaderName && previousLeaderName !== item.person.name) {
      card.classList.add("leader-glow");
    }

    if (item.person.id === lastUpdatedId) {
      card.classList.add("new-entry-highlight");
    }

    card.innerHTML = `
      <div class="place">${item.medal}</div>
      <div class="name">
        <strong>${escapeHtml(item.person.name)}</strong>
        <div class="fun-title">${getTitle(item.person.alcohol)}</div>
      </div>
      <div class="score"><strong>${formatAlcohol(item.person.alcohol)}</strong></div>
    `;
    podium.appendChild(card);
  });

  rest.forEach((item, idx) => {
    const li = document.createElement("li");
    li.className = "ranking-item";

    if (item.id === lastUpdatedId) {
      li.classList.add("new-entry-highlight");
    }

    li.innerHTML = `
      <div>
        <span class="rank-number">${idx + 4}.</span>
        <span>${escapeHtml(item.name)}</span>
        <div class="fun-title">${getTitle(item.alcohol)}</div>
        <span class="normal-score">${formatAlcohol(item.alcohol)}</span>
      </div>
    `;
    restList.appendChild(li);
  });

  previousLeaderName = currentLeaderName;
  previousTop3Names = currentTop3Names;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("submitBtn").addEventListener("click", submitData);
  document.getElementById("copyGuestEventLinkBtn").addEventListener("click", copyGuestEventLink);
  document.getElementById("shareGuestWhatsappBtn").addEventListener("click", shareGuestOnWhatsApp);
  loadEvent();
});