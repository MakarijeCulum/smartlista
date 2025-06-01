// === Firebase konfiguracija ===
const firebaseConfig = {
  apiKey: "AIzaSyCjBwUEpCygnWeQZSeqSrWXS0sYLizXm6Q",
  authDomain: "smartlista-6b154.firebaseapp.com",
  projectId: "smartlista-6b154",
  storageBucket: "smartlista-6b154.appspot.com",
  messagingSenderId: "297092480164",
  appId: "1:297092480164:web:42b0cdeb404933ce5c7a31",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;

// === Navigacija i učitavanje stranica ===
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

    if (page === 'list') setupListPage();
    if (page === 'account') setupAccountPage();

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

window.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  navigate('home');
});

// === Prikaz nalog stranice ===
function setupAccountPage() {
  const loginBtn = document.getElementById("showLogin");
  const registerBtn = document.getElementById("showRegister");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  if (loginBtn && registerBtn && loginForm && registerForm) {
    loginBtn.onclick = () => {
      loginForm.style.display = "block";
      registerForm.style.display = "none";
    };

    registerBtn.onclick = () => {
      registerForm.style.display = "block";
      loginForm.style.display = "none";
    };

    document.querySelector("#registerForm button").onclick = async () => {
      const email = document.getElementById("registerEmail").value.trim();
      const password = document.getElementById("registerPassword").value;
      try {
        const userCred = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection("users").doc(userCred.user.uid).set({
          email: email,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Registracija uspešna!");
        currentUser = userCred.user;
        navigate("list");
      } catch (err) {
        alert("Greška: " + err.message);
      }
    };

    document.querySelector("#loginForm button").onclick = async () => {
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;
      try {
        const userCred = await auth.signInWithEmailAndPassword(email, password);
        alert("Uspešna prijava!");
        currentUser = userCred.user;
        navigate("list");
      } catch (err) {
        alert("Greška: " + err.message);
      }
    };
  }
}

// === Liste ===
function setupListPage() {
  const listSelector = document.getElementById("listSelector");
  const createListBtn = document.getElementById("createListBtn");
  const newListNameInput = document.getElementById("newListName");
  const activeListContainer = document.getElementById("activeListContainer");
  const activeListTitle = document.getElementById("activeListTitle");
  const itemList = document.getElementById("itemList");
  const itemNameInput = document.getElementById("itemName");
  const itemDeadlineInput = document.getElementById("itemDeadline");
  const addItemBtn = document.getElementById("addItem");

  if (!currentUser) {
    listSelector.innerHTML = "<p style='color:red;'>Morate biti prijavljeni.</p>";
    return;
  }

  const listsRef = db.collection("users").doc(currentUser.uid).collection("lists");
  let currentListId = null;

  async function renderListCards() {
    const snapshot = await listsRef.get();
    listSelector.innerHTML = "";
    snapshot.forEach(doc => {
      const list = doc.data();
      const card = document.createElement("div");
      card.className = "list-card";
      const lastItems = (list.items || []).slice(-3).map(i => `• ${i.name}`).reverse().join("<br>");
      card.innerHTML = `<h3>${list.name}</h3><div class="list-preview">${lastItems || '(prazno)'}</div>`;
      card.onclick = () => loadList(doc.id, list.name);
      listSelector.appendChild(card);
    });
  }

  async function loadList(id, name) {
    currentListId = id;
    activeListTitle.textContent = name;
    activeListContainer.style.display = "block";
    renderItems();
  }

  async function renderItems() {
    const doc = await listsRef.doc(currentListId).get();
    const data = doc.data();
    const items = data.items || [];

    itemList.innerHTML = "";
    items.forEach((item, index) => {
      const div = document.createElement("div");
      div.className = "task-item" + (item.done ? " done" : "");

      const check = document.createElement("div");
      check.className = "custom-check";
      check.onclick = () => toggleDone(index);

      const span = document.createElement("span");
      span.className = "task-item-text";
      span.textContent = item.name;

      const date = document.createElement("span");
      date.className = "task-item-date";
      date.textContent = item.deadline;

      const removeBtn = document.createElement("button");
      removeBtn.className = "task-item-remove";
      removeBtn.innerHTML = "&times;";
      removeBtn.onclick = () => removeItem(index);

      const left = document.createElement("div");
      left.className = "task-item-left";
      left.appendChild(check);
      left.appendChild(span);
      left.appendChild(date);

      div.appendChild(left);
      div.appendChild(removeBtn);
      itemList.appendChild(div);
    });
  }

  async function toggleDone(index) {
    const doc = await listsRef.doc(currentListId).get();
    const items = doc.data().items || [];
    items[index].done = !items[index].done;
    await listsRef.doc(currentListId).update({ items });
    renderItems();
  }

  async function removeItem(index) {
    const doc = await listsRef.doc(currentListId).get();
    const items = doc.data().items || [];
    items.splice(index, 1);
    await listsRef.doc(currentListId).update({ items });
    renderItems();
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
    if (!name || !currentListId) return;

    const doc = await listsRef.doc(currentListId).get();
    const items = doc.data().items || [];
    items.push({ name, deadline, done: false });
    await listsRef.doc(currentListId).update({ items });

    itemNameInput.value = "";
    itemDeadlineInput.value = "";
    renderItems();
  };

  renderListCards();
}
