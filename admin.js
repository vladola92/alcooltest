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
        const row = document.createElement("div");
        row.className = "event-row";

        const btn = document.createElement("button");
        btn.className = "event-item";
        btn.innerHTML = `
          <strong>${escapeHtml(item.name || item.id)}</strong>
          <span>${escapeHtml(item.id)}</span>
          <span>Tema: ${escapeHtml(item.theme || "party")}</span>
        `;
        btn.addEventListener("click", () => selectEvent(item.id));

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "event-delete-btn";
        deleteBtn.innerHTML = "🗑️";
        deleteBtn.title = "Șterge evenimentul";
        deleteBtn.setAttribute("aria-label", "Șterge evenimentul");
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteEvent(item.id, item.name || item.id);
        });

        row.appendChild(btn);
        row.appendChild(deleteBtn);
        list.appendChild(row);
      });
    },
    (error) => {
      console.error("listenToEvents error:", error);
      alert("Eroare la citirea listei de evenimente: " + error.message);
    }
  );
}

function deleteEvent(eventId, eventName) {
  const ok = confirm(`Sigur vrei să ștergi evenimentul "${eventName}"?`);
  if (!ok) return;

  db.collection("events")
    .doc(eventId)
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
      return db.collection("events").doc(eventId).delete();
    })
    .then(() => {
      if (currentAdminEventId === eventId) {
        currentAdminEventId = null;
        currentGuestLink = "";
        document.getElementById("selectedEventName").innerText = "-";
        document.getElementById("selectedEventCode").innerText = "-";
        document.getElementById("eventLinkBox").innerHTML = "-";
        document.getElementById("adminPodium").innerHTML =
          '<div class="podium-empty">Selectează un eveniment</div>';
        document.getElementById("adminRestList").innerHTML = "";
        document.getElementById("qrcode").innerHTML = "";
      }

      alert("Evenimentul a fost șters.");
    })
    .catch((error) => {
      console.error("deleteEvent error:", error);
      alert("Eroare la ștergerea evenimentului: " + error.message);
    });
}