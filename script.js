const firebaseConfig = {
  apiKey: "AIzaSyAe1UVjVsYMSCi3soTi2DrVA9ZtzuPfXZE",
  authDomain: "alcooltest-c1676.firebaseapp.com",
  projectId: "alcooltest-c1676",
  storageBucket: "alcooltest-c1676.firebasestorage.app",
  messagingSenderId: "891446581473",
  appId: "1:891446581473:web:c95aaf7d30d334ae1c7fa0",
  measurementId: "G-GEKN2DSJZ3"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const params = new URLSearchParams(window.location.search);
const eventId = params.get("event") || "eveniment-demo";

document.getElementById("event-title").innerText = `Eveniment: ${eventId}`;

function submitData() {
    const name = document.getElementById("name").value.trim();
    const alcohol = parseFloat(document.getElementById("alcohol").value);

    if (!name || isNaN(alcohol)) {
        alert("Completează toate câmpurile!");
        return;
    }

    if (alcohol < 0 || alcohol > 5) {
        alert("Introdu o valoare validă pentru alcoolemie!");
        return;
    }

    db.collection("events")
      .doc(eventId)
      .collection("entries")
      .add({
          name: name,
          alcohol: alcohol,
          time: Date.now()
      })
      .then(() => {
          document.getElementById("name").value = "";
          document.getElementById("alcohol").value = "";
      })
      .catch((error) => {
          alert("A apărut o eroare la salvare: " + error.message);
          console.error(error);
      });
}

db.collection("events")
  .doc(eventId)
  .collection("entries")
  .orderBy("alcohol", "desc")
  .onSnapshot(
      (snapshot) => {
          const list = document.getElementById("leaderboard");
          list.innerHTML = "";

          let position = 1;

          snapshot.forEach((doc) => {
              const data = doc.data();
              const li = document.createElement("li");

              let medal = `${position}.`;
              if (position === 1) medal = "🥇";
              if (position === 2) medal = "🥈";
              if (position === 3) medal = "🥉";

              li.innerText = `${medal} ${data.name} – ${data.alcohol}`;
              list.appendChild(li);

              position++;
          });
      },
      (error) => {
          console.error("Eroare la citirea clasamentului:", error);
      }
  );