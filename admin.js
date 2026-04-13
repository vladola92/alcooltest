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

let currentAdminEventId = null;
let unsubscribeAdminLeaderboard = null;

function makeEventId(name) {
  const clean = name
    .toLowerCase()
    .trim()
    .replace(/ă/g, "a")
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/ș|ş/g, "s")
    .replace(/ț|ţ/g, "t")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const randomPart = Math.floor(Math.random() * 9000) + 1000;
  return `${clean}-${randomPart}`;
}

function createEvent() {
  const eventNameInput = document.getElementById("eventName");
  const createMessage = document.getElementById("createMessage");
  const eventLink = document.getElementById("eventLink");

  const eventName = eventNameInput.value.trim();

  if (!eventName) {
    alert("Introdu numele evenimentului.");
    return;
  }

  createMessage.innerText = "Se creează evenimentul...";
  eventLink.innerHTML = "";

  const eventId = makeEventId(eventName);

  db.collection("events").doc(eventId).set({
    name: eventName,
    createdAt: Date.now()
  })
  .then(() => {
    const guestLink = "https://vladola92.github.io/alcooltest/guest.html?event=" + eventId;

    createMessage.innerText = "Eveniment creat cu succes. Cod: " + eventId;
    eventLink.innerHTML = '<a href="' + guestLink + '" target="_blank">' + guestLink + '</a>';

    document.getElementById("adminEventId").value = eventId;
    currentAdminEventId = eventId;
    loadAdminEvent();
  })
  .catch((error) => {
    createMessage.innerText = "";
    alert("Eroare la crearea evenimentului: " + error.message);
    console.error("createEvent error:", error);
  });
}

function loadAdminEvent() {
  const eventId = document.getElementById("adminEventId").value.trim();

  if (!eventId) {
    alert("Introdu codul evenimentului.");
    return;
  }

  currentAdminEventId = eventId;

  db.collection("events").doc(eventId).get()
    .then((doc) => {
      const nameEl = document.getElementById("adminEventName");
      const list = document.getElementById("adminLeaderboard");

      if (!doc.exists) {
        nameEl.innerText = "Eveniment inexistent.";
        list.innerHTML = "";
        return;
      }

      const data = doc.data();
      nameEl.innerText = "Eveniment: " + data.name;
      listenToAdminLeaderboard(eventId);
    })
    .catch((error) => {
      alert("Eroare la încărcarea evenimentului: " + error.message);
      console.error("loadAdminEvent error:", error);
    });
}

function listenToAdminLeaderboard(eventId) {
  if (unsubscribeAdminLeaderboard) {
    unsubscribeAdminLeaderboard();
  }

  unsubscribeAdminLeaderboard = db.collection("events")
    .doc(eventId)
    .collection("entries")
    .orderBy("alcohol", "desc")
    .onSnapshot(
      (snapshot) => {
        const list = document.getElementById("adminLeaderboard");
        list.innerHTML = "";

        if (snapshot.empty) {
          list.innerHTML = "<li>Nu există încă rezultate pentru acest eveniment.</li>";
          return;
        }

        let position = 1;

        snapshot.forEach((doc) => {
          const data = doc.data();
          const li = document.createElement("li");

          li.innerHTML =
            "<strong>" + position + ". " + data.name + " – " + data.alcohol + "</strong><br><br>" +
            "<button data-id=\"" + doc.id + "\">Șterge</button>";

          const btn = li.querySelector("button");
          btn.addEventListener("click", function () {
            deleteEntry(doc.id);
          });

          list.appendChild(li);
          position++;
        });
      },
      (error) => {
        alert("Eroare la citirea clasamentului: " + error.message);
        console.error("listenToAdminLeaderboard error:", error);
      }
    );
}

function deleteEntry(entryId) {
  if (!currentAdminEventId) {
    alert("Nu este încărcat niciun eveniment.");
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
    alert("Nu este încărcat niciun eveniment.");
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

document.addEventListener("DOMContentLoaded", function () {
  const createBtn = document.getElementById("createEventBtn");
  const loadBtn = document.getElementById("loadEventBtn");
  const resetBtn = document.getElementById("resetBtn");

  createBtn.addEventListener("click", createEvent);
  loadBtn.addEventListener("click", loadAdminEvent);
  resetBtn.addEventListener("click", resetLeaderboard);

  console.log("admin.js loaded corect");
});