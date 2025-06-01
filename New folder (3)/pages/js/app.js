// === Firebase Config ===
const firebaseConfig = {
  apiKey: "AIzaSyCjBwUEpCygnWeQZSeqSrWXS0sYLizXm6Q",
  authDomain: "smartlista-6b154.firebaseapp.com",
  projectId: "smartlista-6b154",
  storageBucket: "smartlista-6b154.firebasestorage.app",
  messagingSenderId: "297092480164",
  appId: "1:297092480164:web:42b0cdeb404933ce5c7a31"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;

// === SPA Navigacija ===
async function loadPage(page) {
  try {
    const res = await fetch(`pages/${page}.html`);
    if (!res.ok) throw new Error('Stranica nije pronađena');
    const html = await res.text();
    document.getElementById('page-content').innerHTML = html;
    const section = document.querySelector('#page-content section');
    if (section) section.classList.add('active');

    if (page === 'home') {
      const btn = document.getElementById('goToList');
      if (btn) btn.addEventListener('click', () => navigate('list'));
    }

    if (page === 'account') setupAccountPage();
    if (page === 'list' && currentUser) setupListPage();
  } catch (err) {
    document.getElementById('page-content').innerHTML =
      '<p style="color: red;">Greška: ' + err.message + '</p>';
  }
}

function navigate(page) {
  loadPage(page);
  document.querySelectorAll('#bottom-nav button').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-page') === page);
  });
}

function initNavigation() {
  document.querySelectorAll('#bottom-nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      navigate(btn.getAttribute('data-page'));
    });
  });
}
// === Liste iz Firestore ===
function setupListPage() {
  const uid = currentUser.uid;
  const listsRef = db.collection("users").doc(uid).collection("lists");

  const listSelector = document.getElementById("listSelector");
  const createListBtn = document.getElementById("createListBtn");
  const newListNameInput = document.getElementById("newListName");
  const activeListContainer = document.getElementById("activeListContainer");
  const activeListTitle = document.getElementById("activeListTitle");
  const itemList = document.getElementById("itemList");
  const itemNameInput = document.getElementById("itemName");
  const itemDeadlineInput = document.getElementById("itemDeadline");
  const addItemBtn = document.getElementById("addItem");

  let activeListId = null;

  async function renderListCards() {
    const snap = await listsRef.get();
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

  async function selectList(id, name) {
    activeListId = id;
    activeListTitle.textContent = name;
    activeListContainer.style.display = "block";
    renderItems();
  }

  async function renderItems() {
    const doc = await listsRef.doc(activeListId).get();
    const items = (doc.data().items || []);
    itemList.innerHTML = "";
    items.forEach((item, index) => {
      const div = document.createElement("div");
      div.className = "task-item" + (item.done ? " done" : "");

      const left = document.createElement("div");
      left.className = "task-item-left";

      const check = document.createElement("div");
      check.className = "custom-check";
      check.onclick = async () => {
        items[index].done = !items[index].done;
        await listsRef.doc(activeListId).update({
          items
        });
        renderItems();
      };

      const text = document.createElement("span");
      text.className = "task-item-text";
      text.textContent = item.name;

      const date = document.createElement("span");
      date.className = "task-item-date";
      date.textContent = item.deadline || "";

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

      left.appendChild(check);
      left.appendChild(text);
      left.appendChild(date);

      div.appendChild(left);
      div.appendChild(remove);
      itemList.appendChild(div);
    });
  }

  createListBtn.onclick = async () => {
    const name = newListNameInput.value.trim();
    if (!name) return;
    await listsRef.add({
      name,
      items: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    newListNameInput.value = "";
    renderListCards();
  };

  addItemBtn.onclick = async () => {
    const name = itemNameInput.value.trim();
    const deadline = itemDeadlineInput.value;
    if (!name || !activeListId) return;
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

  renderListCards();
}

// === Pokretanje aplikacije ===
window.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  auth.onAuthStateChanged(user => {
    currentUser = user;
    navigate("home");
  });
});

function setupAccountPage() {
  const authOptions = document.getElementById("authOptions");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const userInfoDiv = document.getElementById("userInfo");
  const settingsIcon = document.getElementById("settingsIcon");
  const settingsPopup = document.getElementById("settingsPopup");

  // Sakrij sve sekcije
  authOptions.style.display = "none";
  loginForm.style.display = "none";
  registerForm.style.display = "none";
  userInfoDiv.style.display = "none";
  if (settingsIcon) settingsIcon.style.display = "none";
  if (settingsPopup) settingsPopup.style.display = "none";

  auth.onAuthStateChanged(async user => {
    if (user) {
      currentUser = user;

      // 🔹 Povuci ime korisnika iz Firestore
      let name = "";
      try {
        const doc = await db.collection("users").doc(user.uid).get();
        if (doc.exists && doc.data().name) {
          name = doc.data().name;
        }
      } catch (e) {
        console.warn("Greška pri čitanju imena:", e);
      }

      // 🔹 Prikaz informacija
      userInfoDiv.style.display = "block";
      document.getElementById("userEmail").textContent = user.email;
      document.getElementById("userId").textContent = user.uid;
      document.getElementById("userName").textContent = name ?
        `${name}` :
        `Dobrodošli!`;

      if (settingsIcon) settingsIcon.style.display = "block";

      // ⚙️ Klik na dugme za podešavanja
      if (settingsIcon && settingsPopup) {
        settingsIcon.onclick = () => {
          settingsPopup.style.display =
            settingsPopup.style.display === "block" ? "none" : "block";
        };

        // Klik van popup-a zatvara ga
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

      // Odjava
      const logoutLink = document.getElementById("logoutLink");
      if (logoutLink) {
        logoutLink.onclick = async () => {
          await auth.signOut();
          currentUser = null;
          navigate("account");
        };
      }

      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) {
        logoutBtn.onclick = async () => {
          await auth.signOut();
          currentUser = null;
          navigate("account");
        };
      }
    } else {
      // 🔸 Nije prijavljen
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

      // Registracija
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

      // Prijava
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