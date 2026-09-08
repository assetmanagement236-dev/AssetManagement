/**
 * Firebase Configuration, Authentication & Synchronization Module
 * Company Asset Management System
 */

let firebaseConfig = {
  apiKey: "AIzaSyBGlHP7nVvOS1w7n8pl4-0Mw1LWW_TIZ_8",
  authDomain: "assetmanagement-am.firebaseapp.com",
  projectId: "assetmanagement-am",
  storageBucket: "assetmanagement-am.firebasestorage.app",
  messagingSenderId: "182515802731",
  appId: "1:182515802731:web:bb465f7e255beb585cc72e",
};

const savedConfig = localStorage.getItem("eq_firebase_config");
if (savedConfig) {
  try {
    const parsed = JSON.parse(savedConfig);
    if (parsed && parsed.projectId && parsed.apiKey) {
      firebaseConfig = parsed;
    }
  } catch (err) {
    console.warn("Could not parse saved Firebase config", err);
  }
}

let db = null;
let auth = null;
let isFirebaseConnected = false;
let currentUserUID = null;

// Store listener unsubscribes
let unsubInventory = null;
let unsubLogs = null;
let unsubTransfers = null;

function initFirebase() {
  if (typeof firebase === "undefined") {
    console.warn("Firebase SDK not loaded.");
    updateFirebaseStatusUI(false, "SDK Not Loaded");
    return;
  }

  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.firestore();
      auth = firebase.auth();
      isFirebaseConnected = true;
      console.log("✅ Firebase initialized successfully!");

      // Listen for Authentication State Changes
      auth.onAuthStateChanged((user) => {
        if (user) {
          // User is signed in
          currentUserUID = user.uid;
          console.log("🔒 Authenticated as UID:", currentUserUID);
          updateFirebaseStatusUI(true, "Cloud Synced");
          document.getElementById("firebaseAuthScreen").classList.add("hidden");

          if (document.getElementById("activeUserEmail")) {
            document.getElementById("activeUserEmail").textContent = user.email;
          }

          // Trigger Data Load from LocalStorage specific to this UID, then start Firebase listeners
          loadData(true); // pass flag that auth changed
          setupRealtimeListeners();
        } else {
          // User is signed out
          console.log("🔓 User is signed out");
          currentUserUID = null;
          updateFirebaseStatusUI(false, "Logged Out");
          document
            .getElementById("firebaseAuthScreen")
            .classList.remove("hidden");

          // Clear active user session details securely
          inventory = [];
          issueLogs = [];
          borrowedTransfers = [];
          unsubscribeAll();
          if (typeof renderAll === "function") {
            renderAll();
          }
        }
      });
    } catch (error) {
      console.error("❌ Firebase initialization error:", error);
      updateFirebaseStatusUI(false, "Config Error");
    }
  } else {
    updateFirebaseStatusUI(false, "Local Mode");
  }
}

// User Collection Reference Helper
function getUserDb() {
  if (!db || !currentUserUID) return null;
  return db.collection("users").doc(currentUserUID);
}

function updateFirebaseStatusUI(isConnected, text) {
  const badge = document.getElementById("firebaseStatusBadge");
  if (!badge) return;
  if (isConnected) {
    badge.className =
      "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-status-success/15 text-status-success border border-status-success/30 cursor-pointer hover:bg-status-success/25 transition-colors whitespace-nowrap";
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-status-success block"></span> <span class="hidden sm:inline">${text}</span>`;
  } else {
    badge.className =
      "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-container-low text-text-secondary border border-surface-border cursor-pointer hover:bg-surface-border transition-colors whitespace-nowrap";
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-status-warning block"></span> <span class="hidden sm:inline">${text}</span>`;
  }
}

function unsubscribeAll() {
  if (unsubInventory) unsubInventory();
  if (unsubLogs) unsubLogs();
  if (unsubTransfers) unsubTransfers();
  unsubInventory = null;
  unsubLogs = null;
  unsubTransfers = null;
}

// Realtime sync from Firebase Firestore isolated to currentUserUID
function setupRealtimeListeners() {
  const userDb = getUserDb();
  if (!userDb) return;

  unsubscribeAll(); // Clear any stale listeners

  // Sync Inventory
  unsubInventory = userDb.collection("asset_inventory").onSnapshot(
    (snapshot) => {
      const remoteInventory = [];
      snapshot.forEach((doc) => {
        remoteInventory.push(doc.data());
      });
      inventory = remoteInventory;
      localStorage.setItem(
        `eq_inventory_${currentUserUID}`,
        JSON.stringify(inventory),
      );
      if (typeof renderAll === "function") renderAll();
    },
    (error) => {
      console.error("Error listening to inventory:", error);
    },
  );

  // Sync Logs
  unsubLogs = userDb.collection("asset_logs").onSnapshot(
    (snapshot) => {
      const remoteLogs = [];
      snapshot.forEach((doc) => {
        remoteLogs.push(doc.data());
      });
      remoteLogs.sort((a, b) => b.id - a.id);
      issueLogs = remoteLogs;
      localStorage.setItem(
        `eq_logs_${currentUserUID}`,
        JSON.stringify(issueLogs),
      );
      if (typeof renderAll === "function") renderAll();
    },
    (error) => {
      console.error("Error listening to logs:", error);
    },
  );

  // Sync Transfers
  unsubTransfers = userDb.collection("asset_transfers").onSnapshot(
    (snapshot) => {
      const remoteTransfers = [];
      snapshot.forEach((doc) => {
        remoteTransfers.push(doc.data());
      });
      remoteTransfers.sort((a, b) => b.id - a.id);
      borrowedTransfers = remoteTransfers;
      localStorage.setItem(
        `eq_transfers_${currentUserUID}`,
        JSON.stringify(borrowedTransfers),
      );
      if (typeof renderAll === "function") renderAll();
    },
    (error) => {
      console.error("Error listening to transfers:", error);
    },
  );
}

// Sync local changes to Firebase Firestore isolated to currentUserUID
async function syncToFirebase() {
  const userDb = getUserDb();
  if (!userDb || !isFirebaseConnected) return;

  try {
    const invBatch = db.batch();
    inventory.forEach((item) => {
      const docRef = userDb.collection("asset_inventory").doc(String(item.id));
      invBatch.set(docRef, item, { merge: true });
    });
    // For smaller batches, we can commit loops, but assuming < 500 items per batch
    await invBatch.commit();

    const logBatch = db.batch();
    issueLogs.forEach((log) => {
      const docRef = userDb.collection("asset_logs").doc(String(log.id));
      logBatch.set(docRef, log, { merge: true });
    });
    await logBatch.commit();

    const transferBatch = db.batch();
    borrowedTransfers.forEach((transfer) => {
      const docRef = userDb
        .collection("asset_transfers")
        .doc(String(transfer.id));
      transferBatch.set(docRef, transfer, { merge: true });
    });
    await transferBatch.commit();
  } catch (err) {
    console.error("Error syncing data to Firebase:", err);
  }
}

// Atomic delete explicitly handles cross-device deletion
async function deleteFromFirebase(collectionName, id) {
  const userDb = getUserDb();
  if (!userDb || !isFirebaseConnected) return;

  try {
    await userDb.collection(collectionName).doc(String(id)).delete();
  } catch (err) {
    console.error("Error deleting from Firebase:", err);
  }
}

// Global Auth UI Handlers
let isLoginMode = true;
function toggleAuthMode() {
  isLoginMode = !isLoginMode;
  document.getElementById("authSubmitBtn").innerHTML = isLoginMode
    ? `<span class="material-symbols-outlined text-lg">login</span> Sign In`
    : `<span class="material-symbols-outlined text-lg">person_add</span> Create Account`;
  document.getElementById("authToggleText").textContent = isLoginMode
    ? "Sign Up Instead"
    : "Sign In Instead";
  document.getElementById("authAlert").classList.add("hidden");
}

function handleAuthSubmit(e) {
  e.preventDefault();
  const alertBox = document.getElementById("authAlert");
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  alertBox.classList.add("hidden");

  if (!auth) return;

  const btn = document.getElementById("authSubmitBtn");
  btn.disabled = true;

  if (isLoginMode) {
    auth
      .signInWithEmailAndPassword(email, password)
      .catch((err) => {
        showAuthError(err.message);
      })
      .finally(() => (btn.disabled = false));
  } else {
    auth
      .createUserWithEmailAndPassword(email, password)
      .catch((err) => {
        showAuthError(err.message);
      })
      .finally(() => (btn.disabled = false));
  }
}

function showAuthError(msg) {
  const alertBox = document.getElementById("authAlert");
  alertBox.textContent = msg;
  alertBox.classList.remove("hidden");
  alertBox.classList.add(
    "bg-status-alert/10",
    "border-status-alert/30",
    "text-status-alert",
  );
}

function signOutUser() {
  if (auth) {
    auth.signOut().catch((err) => console.error("Sign out error:", err));
  }
}

// Function to save Firebase config via UI Modal
function saveFirebaseConfigFromUI(configObj) {
  localStorage.setItem("eq_firebase_config", JSON.stringify(configObj));
  firebaseConfig = configObj;
  initFirebase();
}
