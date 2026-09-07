# 📦 Equipment & Asset Management System (PWA + Firebase Cloud Sync)

A modern, responsive, progressive web application (PWA) designed for tracking equipment, accessories, multi-item team allocations, returns, defect logs, lost items, and automated stock calculations. Equipped with **real-time Firebase Cloud Database synchronization** across mobile phones and desktop laptops.

---

## 🚀 Quick Links & Deployment

- **🌐 Live Production Website:** [https://asset-management-app-blush.vercel.app](https://asset-management-app-blush.vercel.app)
- **💻 GitHub Repository:** [https://github.com/GaziMahmudur/asset-management-app](https://github.com/GaziMahmudur/asset-management-app)
- **🏷️ Official GitHub Release:** [https://github.com/GaziMahmudur/asset-management-app/releases/tag/v1.0.0](https://github.com/GaziMahmudur/asset-management-app/releases/tag/v1.0.0)

---

## 📱 Mobile App Installation Guide (Android & iOS)

This web application is built as an **Installable Progressive Web App (PWA)** with standalone app UI, service worker caching, and native app icons.

### 🤖 Android Setup (Chrome / Edge / Brave):
1. Open [https://asset-management-app-blush.vercel.app](https://asset-management-app-blush.vercel.app) on your Android mobile browser.
2. Tap the **"Install Mobile App"** button at the top navbar OR open the browser menu (**3 dots ⋮**) in top right.
3. Select **"Add to Home Screen"** or **"Install App"**.
4. The app icon will be added to your mobile home screen and app drawer, functioning like a native Android app!

### 🍏 iPhone / iOS Setup (Safari):
1. Open [https://asset-management-app-blush.vercel.app](https://asset-management-app-blush.vercel.app) in **Safari**.
2. Tap the **Share** button (box with an upward arrow at the bottom).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **"Add"** in the top right.

---

## ⚡ Real-Time Firebase Multi-Device Data Syncing

When you input or update data from your **Phone** or **Laptop**, all connected devices will instantly sync automatically via Firebase Firestore!

### How Cloud Sync Works:
1. The app connects to the configured Firebase Firestore database (`assetmanagement-am`).
2. Data changes (Adding items, issuing gear, returning equipment, reporting lost gear) trigger background batch updates to Firestore.
3. Real-time `onSnapshot` listeners listen for changes and update the UI across all connected phones and laptops seamlessly without refreshing the page.
4. **Offline Mode Support:** If internet connection drops, changes remain saved locally in `localStorage` and automatically sync to Cloud Firestore upon reconnection.

---

## ✨ Features Breakdown

- **Master Inventory Management:** Serialized main equipment tracking & consumable accessory quantity management.
- **Auto-Calculated Stock Summary:** Live calculation of total stock vs available stock.
- **Smart Auto-Suggestions:** Remembers previously typed equipment names with custom suggestion management.
- **Multi-Item Allocation:** Issue multiple main equipments and accessories to team leaders/members in a single transaction.
- **Single Item Return & Mismatch Detection:** Tracks return date, returner name, and flags person mismatch with mandatory reason input.
- **Incident & Lost Reporting:** Tracks FIR numbers, fine/compensation amounts, recovery status, and automatically updates stock.
- **Formatted CSV Export & Backup Workflow:** Export full monthly inventory reports and enforce CSV backups before clearing movement history logs.

---

## 🛠️ Technology Stack
- **Frontend:** HTML5, CSS3, JavaScript (ES6+), Bootstrap 5, Bootstrap Icons
- **PWA Capabilities:** Web App Manifest (`manifest.json`), Service Worker (`sw.js`)
- **Backend & Cloud Database:** Firebase Firestore (Compat SDK v10.8.0)
- **Deployment & Hosting:** Vercel Global CDN
- **Version Control:** Git & GitHub

---

*Developed for company equipment & asset tracking.*
