/**
 * Firebase Configuration & Synchronization Module
 * Company Asset Management System
 *
 * Instructions:
 * Option 1: Enter your Firebase project credentials below manually.
 * Option 2: Use the "Cloud Sync / Firebase Setup" button inside the web app navbar to paste your configuration directly in the browser!
 */

let firebaseConfig = {
  apiKey: "AIzaSyBGlHP7nVvOS1w7n8pl4-0Mw1LWW_TIZ_8",
  authDomain: "assetmanagement-am.firebaseapp.com",
  projectId: "assetmanagement-am",
  storageBucket: "assetmanagement-am.firebasestorage.app",
  messagingSenderId: "182515802731",
  appId: "1:182515802731:web:bb465f7e255beb585cc72e",
};

// Check if credentials exist in localStorage (saved via UI setup modal)
const savedConfig = localStorage.getItem("eq_firebase_config");
if (savedConfig) {
  try {
    const parsed = JSON.parse(savedConfig);
    if (parsed && parsed.projectId && parsed.apiKey) {
      firebaseConfig = parsed;
    }
  } catch (err) {
    console.warn(
      "Could not parse saved Firebase config from localStorage",
      err,
    );
  }
}

let db = null;
let isFirebaseConnected = false;

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
      isFirebaseConnected = true;
      updateFirebaseStatusUI(true, "Cloud Synced");
      setupRealtimeListeners();
      console.log("✅ Firebase initialized successfully!");
    } catch (error) {
      console.error("❌ Firebase initialization error:", error);
      updateFirebaseStatusUI(false, "Config Error");
    }
  } else {
    updateFirebaseStatusUI(false, "Local Mode");
  }
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

// Realtime sync from Firebase Firestore
function setupRealtimeListeners() {
  if (!db) return;

  // Sync Inventory
  db.collection("asset_inventory").onSnapshot(
    (snapshot) => {
      if (!snapshot.empty) {
        const remoteInventory = [];
        snapshot.forEach((doc) => {
          remoteInventory.push(doc.data());
        });
        inventory = remoteInventory;
        localStorage.setItem("eq_v10_inventory", JSON.stringify(inventory));
        localStorage.setItem("eq_v8_inventory", JSON.stringify(inventory));
        renderAll();
      }
    },
    (error) => {
      console.error("Error listening to inventory:", error);
    },
  );

  // Sync Logs
  db.collection("asset_logs").onSnapshot(
    (snapshot) => {
      if (!snapshot.empty) {
        const remoteLogs = [];
        snapshot.forEach((doc) => {
          remoteLogs.push(doc.data());
        });
        // Sort by ID descending
        remoteLogs.sort((a, b) => b.id - a.id);
        issueLogs = remoteLogs;
        localStorage.setItem("eq_v10_logs", JSON.stringify(issueLogs));
        localStorage.setItem("eq_v8_logs", JSON.stringify(issueLogs));
        renderAll();
      }
    },
    (error) => {
      console.error("Error listening to logs:", error);
    },
  );

  // Sync Transfers
  db.collection("asset_transfers").onSnapshot(
    (snapshot) => {
      if (!snapshot.empty) {
        const remoteTransfers = [];
        snapshot.forEach((doc) => {
          remoteTransfers.push(doc.data());
        });
        remoteTransfers.sort((a, b) => b.id - a.id);
        borrowedTransfers = remoteTransfers;
        localStorage.setItem(
          "eq_v10_transfers",
          JSON.stringify(borrowedTransfers),
        );
        renderAll();
      }
    },
    (error) => {
      console.error("Error listening to transfers:", error);
    },
  );
}

// Sync local changes to Firebase Firestore
async function syncToFirebase() {
  if (!isFirebaseConnected || !db) return;

  try {
    // Bulk update Inventory collection
    const invBatch = db.batch();
    inventory.forEach((item) => {
      const docRef = db.collection("asset_inventory").doc(String(item.id));
      invBatch.set(docRef, item, { merge: true });
    });
    await invBatch.commit();

    // Bulk update Logs collection
    const logBatch = db.batch();
    issueLogs.forEach((log) => {
      const docRef = db.collection("asset_logs").doc(String(log.id));
      logBatch.set(docRef, log, { merge: true });
    });
    await logBatch.commit();

    // Bulk update Transfers collection
    const transferBatch = db.batch();
    borrowedTransfers.forEach((transfer) => {
      const docRef = db.collection("asset_transfers").doc(String(transfer.id));
      transferBatch.set(docRef, transfer, { merge: true });
    });
    await transferBatch.commit();

    console.log("☁️ Successfully synced data to Firebase!");
  } catch (err) {
    console.error("Error syncing data to Firebase:", err);
  }
}

// Function to save Firebase config via UI Modal
function saveFirebaseConfigFromUI(configObj) {
  localStorage.setItem("eq_firebase_config", JSON.stringify(configObj));
  firebaseConfig = configObj;
  initFirebase();
}
