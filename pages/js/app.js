// === Firebase Config ===
const firebaseConfig = {
  apiKey: "AIzaSyCjBwUEpCygnWeQZSeqSrWXS0sYLizXm6Q",
  authDomain: "smartlista-6b154.firebaseapp.com",
  projectId: "smartlista-6b154",
  storageBucket: "smartlista-6b154.appspot.com",
  messagingSenderId: "297092480164",
  appId: "1:297092480164:web:42b0cdeb404933ce5c7a31"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;

// === SPA Navigacija ===
async function loadPage(page) {
  const res = await fetch(`pages/${page}.html`);
  const html = await res.text();
  document.getElementById("page-content").innerHTML = html;
  const section = document.querySelector("#page-content section");
  if (section) section.classList.add("active");

  if (page === "home") {
    const btn = document.getElementById("goToList");
    if (btn) btn.addEventListener("click", () => navigate("list"));
  }

  if (page === "account") setupAccountPage();
  if (page === "list" && currentUser) setupListPage();
}

function navigate(page) {
  loadPage(page);
  document.querySelectorAll("#bottom-nav button").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-page") === page);
  });
}

function initNavigation() {
  document.querySelectorAll("#bottom-nav button").forEach(btn => {
    btn.addEventListener("click", () => {
      navigate(btn.getAttribute("data-page"));
    });
  });
}

// === LISTA ===
function setupListPage() {
  const uid = currentUser.uid;
  const userEmail = currentUser.email;
  const listsRef = db.collection("lists");

  const listSelector = document.getElementById("listSelector");
  const createListBtn = document.getElementById("createListBtn");
  const newListNameInput = document.getElementById("newListName");
  const activeListContainer = document.getElementById("activeListContainer");
  const activeListTitle = document.getElementById("activeListTitle");
  const itemList = document.getElementById("itemList");
  const itemNameInput = document.getElementById("itemName");
  const itemDeadlineInput = document.getElementById("itemDeadline");
  const addItemBtn = document.getElementById("addItem");
  const shareInput = document.getElementById("shareEmail");
  const shareBtn = document.getElementById("shareBtn");
  const backToListsBtn = document.getElementById("backToListsBtn");
  const backToItemsBtn = document.getElementById("backToItemsBtn");

  if (backToItemsBtn) {
    backToItemsBtn.onclick = () => {
      renderItems();
      itemList.style.display = "block";
      document.querySelector(".list-input").style.display = "flex";
      document.querySelector(".share-section").style.display = "flex";
      document.getElementById("listMembersContainer").style.display = "none";
      backToItemsBtn.style.display = "none";
      backToListsBtn.style.display = "inline-block";
    };
  }

  let activeListId = null;

  async function renderListCards() {
    const snap = await listsRef.where("sharedWith", "array-contains", userEmail).get();
    listSelector.innerHTML = "";
    snap.forEach(doc => {
      const data = doc.data();
      const card = document.createElement("div");
      card.className = "list-card";
      const preview = (data.items || [])
        .slice(-3)
        .reverse()
        .map(i => `• ${i.name}`)
        .join("<br>");
      card.innerHTML = `<h3>${data.name}</h3><div class="list-preview">${preview || "<em>(nema stavki)</em>"}</div>`;
      card.onclick = () => selectList(doc.id, data.name);
      listSelector.appendChild(card);
    });
  }

  const listSettingsBtn = document.getElementById("listSettingsBtn");
  const listSettingsDropdown = document.getElementById("listSettingsDropdown");

  if (listSettingsBtn) {
    listSettingsBtn.onclick = (e) => {
      e.stopPropagation();
      listSettingsDropdown.style.display =
        listSettingsDropdown.style.display === "block" ? "none" : "block";
    };

    document.addEventListener("click", (e) => {
      if (!listSettingsDropdown.contains(e.target) && e.target !== listSettingsBtn) {
        listSettingsDropdown.style.display = "none";
      }
    });
  }

  window.showMembers = async function () {
    const doc = await db.collection("lists").doc(activeListId).get();
    const sharedEmails = doc.data().sharedWith || [];

    const members = await Promise.all(sharedEmails.map(async email => {
      const query = await db.collection("users").where("email", "==", email).get();
      const name = query.empty ? "Nepoznat korisnik" : query.docs[0].data().name;
      return {
        name,
        email
      };
    }));

    document.getElementById("itemList").style.display = "none";
    document.querySelector(".list-input").style.display = "none";
    document.querySelector(".share-section").style.display = "none";
    document.getElementById("backToListsBtn").style.display = "none";
    document.getElementById("listMembersContainer").style.display = "block";
    document.getElementById("backToItemsBtn").style.display = "inline-block";

    const ul = document.getElementById("listMembers");
    ul.innerHTML = "";
    members.forEach(member => {
      const li = document.createElement("li");
      li.className = "user-info-card";
      li.innerHTML = `
        <h3>${member.name}</h3>
        <p>${member.email}</p>
        <div style="text-align: right;">
          <button class="task-item-remove" onclick="removeMember('${member.email}')">Ukloni</button>
        </div>`;
      ul.appendChild(li);
    });
  };

  window.removeMember = async function (email) {
    if (!confirm(`Da li želiš da ukloniš člana: ${email}?`)) return;

    await db.collection("lists").doc(activeListId).update({
      sharedWith: firebase.firestore.FieldValue.arrayRemove(email)
    });

    showMembers();
  };

  window.showShareInput = function () {
    listSettingsDropdown.style.display = "none";

    // Sakrij sve osim share sekcije
    document.getElementById("itemList").style.display = "none";
    document.querySelector(".list-input").style.display = "none";
    document.getElementById("listMembersContainer").style.display = "none";
    document.getElementById("backToListsBtn").style.display = "none";

    const shareSection = document.querySelector(".share-section");
    if (shareSection) {
      shareSection.style.display = "flex";
      shareSection.scrollIntoView({
        behavior: "smooth"
      });
    }

    // Prikaži dugme za povratak na prethodnu listu
    const backToItemsBtn = document.getElementById("backToItemsBtn");
    if (backToItemsBtn) backToItemsBtn.style.display = "inline-block";
  };


  window.deleteActiveList = async function () {
    listSettingsDropdown.style.display = "none";
    if (!confirm("Da li sigurno želiš da obrišeš ovu listu?")) return;
    await db.collection("lists").doc(activeListId).delete();
    activeListId = null;
    location.reload();
  };

  async function selectList(id, name) {
    activeListId = id;
    activeListTitle.textContent = name;
    document.querySelector(".list-header").style.display = "none";
    document.querySelector(".create-list").style.display = "none";
    listSelector.style.display = "none";
    activeListContainer.style.display = "block";
    if (backToListsBtn) backToListsBtn.style.display = "inline-block";

    //  SAKRIJ sekciju za deljenje mejlom
    const shareSection = document.querySelector(".share-section");
    if (shareSection) shareSection.style.display = "none";

    renderItems();
  }


  if (backToListsBtn) {
    backToListsBtn.onclick = () => {
      activeListContainer.style.display = "none";
      listSelector.style.display = "flex";
      document.querySelector(".list-header").style.display = "block";
      document.querySelector(".create-list").style.display = "flex";
      backToListsBtn.style.display = "none";
      activeListTitle.textContent = "";
    };
  }

  async function renderItems() {
    const doc = await listsRef.doc(activeListId).get();
    const items = doc.data().items || [];
    itemList.innerHTML = "";

    items.forEach((item, index) => {
      const div = document.createElement("div");
      div.className = "task-item" + (item.done ? " done" : "");

      const left = document.createElement("div");
      left.className = "task-item-left";

      const doneBtn = document.createElement("button");
      doneBtn.className = "task-item-done";
      doneBtn.innerHTML = "✔";
      doneBtn.onclick = async () => {
        items[index].done = !items[index].done;
        await listsRef.doc(activeListId).update({
          items
        });
        renderItems();
      };

      const text = document.createElement("span");
      text.className = "task-item-text";
      text.textContent = `${index + 1}. ${item.name}`;

      const date = document.createElement("span");
      date.className = "task-item-date";
      date.textContent = item.deadline || "";

      left.appendChild(text);
      left.appendChild(date);

      const remove = document.createElement("button");
      remove.className = "task-item-remove";
      remove.innerHTML = "&times;";
      remove.onclick = async () => {
        items.splice(index, 1);
        await listsRef.doc(activeListId).update({
          items
        });
        renderItems();
      };

      const menuBtn = document.createElement("div");
      menuBtn.className = "menu-button";
      menuBtn.textContent = "⋮";
      menuBtn.onclick = (e) => {
        e.stopPropagation();
        togglePopupMenu(e.target, index, items);
      };

      div.appendChild(left);
      div.appendChild(remove);
      div.appendChild(doneBtn);
      div.appendChild(menuBtn);
      itemList.appendChild(div);
    });
  }

  function togglePopupMenu(target, index, items) {
    const existing = document.querySelector(".popup-menu");
    if (existing) existing.remove();

    const menu = document.createElement("div");
    menu.className = "popup-menu";
    menu.innerHTML = `
      <ul>
        <li onclick="pinItem(${index}); this.closest('.popup-menu').remove()">📌 Pinuj</li>
        <li onclick="setPriority(${index}, 'Visok'); this.closest('.popup-menu').remove()">🔴 Visok prioritet</li>
        <li onclick="setPriority(${index}, 'Srednji'); this.closest('.popup-menu').remove()">🟠 Srednji prioritet</li>
        <li onclick="setPriority(${index}, 'Nizak'); this.closest('.popup-menu').remove()">🟢 Nizak prioritet</li>
      </ul>`;

    document.body.appendChild(menu);

    const rect = target.getBoundingClientRect();
    menu.style.position = "absolute";
    menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
    menu.style.left = `${rect.right - 180}px`;
    menu.style.zIndex = 9999;
    menu.style.display = "block";

    setTimeout(() => {
      document.addEventListener("click", (e) => {
        if (!menu.contains(e.target)) menu.remove();
      }, {
        once: true
      });
    }, 0);
  }

  window.pinItem = async function (index) {
    const doc = await listsRef.doc(activeListId).get();
    const items = doc.data().items || [];
    const [item] = items.splice(index, 1);
    items.unshift(item);
    await listsRef.doc(activeListId).update({
      items
    });
    renderItems();
  };

  window.setPriority = async function (index, level) {
    const doc = await listsRef.doc(activeListId).get();
    const items = doc.data().items || [];
    items[index].priority = level;
    await listsRef.doc(activeListId).update({
      items
    });
    renderItems();
  };

  createListBtn.onclick = async () => {
    const name = newListNameInput.value.trim();
    if (!name) return;
    await listsRef.add({
      name,
      owner: uid,
      sharedWith: [userEmail],
      items: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    newListNameInput.value = "";
    renderListCards();
  };

  // === OVDE JE DODAT KOD ZA POZIV ===
  if (shareBtn && shareInput) {
    shareBtn.onclick = async () => {
      const shareTo = shareInput.value.trim();
      if (!shareTo || !activeListId) return;

      const doc = await db.collection("lists").doc(activeListId).get();
      const listName = doc.data().name;

      await db.collection("invites").add({
        to: shareTo,
        from: userEmail,
        listId: activeListId,
        listName,
        status: "pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      alert(`Poziv za deljenje poslat korisniku ${shareTo}`);
      shareInput.value = "";
    };
  }
  if (addItemBtn) {
    addItemBtn.onclick = async () => {
      const name = itemNameInput.value.trim();
      const deadline = itemDeadlineInput.value;

      if (!name) {
        alert("Unesite naziv stavke.");
        return;
      }

      const doc = await listsRef.doc(activeListId).get();
      const items = doc.data().items || [];

      items.push({
        name,
        deadline,
        done: false
      });

      await listsRef.doc(activeListId).update({
        items
      });

      itemNameInput.value = "";
      itemDeadlineInput.value = "";
      renderItems();
    };
  }


  renderListCards();
}


function setupAccountPage() {
  const authOptions = document.getElementById("authOptions");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const userInfoDiv = document.getElementById("userInfo");
  const settingsIcon = document.getElementById("settingsIcon");
  const settingsPopup = document.getElementById("settingsPopup");
  const accountHeader = document.querySelector(".account-header");
  const invitesSection = document.getElementById("invitesSection");
  const inviteList = document.getElementById("inviteList");
  const showInvitesBtn = document.getElementById("showInvites");

  authOptions.style.display = "none";
  loginForm.style.display = "none";
  registerForm.style.display = "none";
  userInfoDiv.style.display = "none";
  if (settingsPopup) settingsPopup.style.display = "none";
  if (invitesSection) invitesSection.style.display = "none";

  auth.onAuthStateChanged(async user => {
    if (user) {
      currentUser = user;

      const userDoc = await db.collection("users").doc(user.uid).get();
      const name = userDoc.exists ? userDoc.data().name : "(Nepoznato)";
      const email = user.email;
      const uid = user.uid;

      const listsSnap = await db.collection("lists").where("sharedWith", "array-contains", email).get();
      const listCount = listsSnap.size;

      if (accountHeader) accountHeader.style.display = "block";

      userInfoDiv.style.display = "flex";
      document.getElementById("userName").textContent = name;
      document.getElementById("userEmail").textContent = email;
      document.getElementById("userId").textContent = uid;
      document.getElementById("userListCount").textContent = listCount;

      if (settingsIcon) {
        settingsIcon.style.display = "block";
        settingsIcon.style.position = "absolute";
        settingsIcon.style.top = "20px";
        settingsIcon.style.right = "20px";
        settingsIcon.style.zIndex = "1001";
      }

      if (settingsIcon && settingsPopup) {
        settingsIcon.onclick = () => {
          settingsPopup.style.display = settingsPopup.style.display === "block" ? "none" : "block";
        };

        document.addEventListener("click", e => {
          if (
            settingsPopup.style.display === "block" &&
            !settingsPopup.contains(e.target) &&
            !settingsIcon.contains(e.target)
          ) {
            settingsPopup.style.display = "none";
          }
        });
      }

      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) {
        logoutBtn.onclick = async () => {
          await auth.signOut();
          currentUser = null;
          navigate("account");
        };
      }

      const logoutLink = document.getElementById("logoutLink");
      if (logoutLink) {
        logoutLink.onclick = async () => {
          await auth.signOut();
          currentUser = null;
          navigate("account");
        };
      }

      if (showInvitesBtn) {
        showInvitesBtn.onclick = async () => {
          invitesSection.style.display = "block";
          userInfoDiv.style.display = "none";
          inviteList.innerHTML = "";

          const inviteSnap = await db.collection("invites")
            .where("to", "==", currentUser.email)
            .where("status", "==", "pending")
            .get();

          if (inviteSnap.empty) {
            inviteList.innerHTML = "<li>Nema novih poziva.</li>";
            return;
          }

          inviteSnap.forEach(doc => {
            const data = doc.data();

            // ⬇⬇⬇ OVDJE UBACI ovaj kod koji si pitao ⬇⬇⬇
            const li = document.createElement("li");
            li.innerHTML = `
        <div class="invite-card">
          <strong>${data.from}</strong><br>
          želi da podeli listu <em>${data.listName}</em>
          <div class="invite-actions">
            <button class="invite-accept" onclick="acceptInvite('${doc.id}', '${data.listId}')">Prihvati</button>
            <button class="invite-decline" onclick="declineInvite('${doc.id}')">Odbij</button>
          </div>
        </div>
      `;
            inviteList.appendChild(li);
          });
        };
      }


    } else {
      if (accountHeader) accountHeader.style.display = "block";

      authOptions.style.display = "flex";
      loginForm.style.display = "none";
      registerForm.style.display = "none";
      userInfoDiv.style.display = "none";
      if (settingsIcon) settingsIcon.style.display = "none";
      if (settingsPopup) settingsPopup.style.display = "none";

      const loginBtn = document.getElementById("showLogin");
      const registerBtn = document.getElementById("showRegister");

      loginBtn.onclick = () => {
        loginForm.style.display = "block";
        registerForm.style.display = "none";
      };

      registerBtn.onclick = () => {
        registerForm.style.display = "block";
        loginForm.style.display = "none";
      };

      document.getElementById("registerSubmit").onclick = async () => {
        const email = document.getElementById("registerEmail").value.trim();
        const password = document.getElementById("registerPassword").value;
        const name = document.getElementById("registerName").value.trim();
        try {
          const userCred = await auth.createUserWithEmailAndPassword(email, password);
          await db.collection("users").doc(userCred.user.uid).set({
            email,
            name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          alert("Registracija uspešna!");
          navigate("account");
        } catch (err) {
          alert("Greška: " + err.message);
        }
      };

      document.getElementById("loginSubmit").onclick = async () => {
        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;
        try {
          await auth.signInWithEmailAndPassword(email, password);
          alert("Uspešna prijava!");
          navigate("account");
        } catch (err) {
          alert("Greška: " + err.message);
        }
      };
    }
  });
}

window.acceptInvite = async function (inviteId, listId) {
  const userEmail = auth.currentUser.email;

  await db.collection("lists").doc(listId).update({
    sharedWith: firebase.firestore.FieldValue.arrayUnion(userEmail)
  });

  await db.collection("invites").doc(inviteId).update({
    status: "accepted"
  });

  alert("Lista je dodata među tvoje liste.");
  document.getElementById("showInvites").click(); // osveži listu poziva
};

window.declineInvite = async function (inviteId) {
  await db.collection("invites").doc(inviteId).update({
    status: "declined"
  });

  alert("Poziv je odbijen.");
  document.getElementById("showInvites").click(); // osveži listu poziva
};

// === INIT ===
window.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  auth.onAuthStateChanged(user => {
    currentUser = user;
    navigate("home");
  });
});