# SaaS Authentication Manual Testing Guide

Because live automated browser tests were unavailable, please run through this manual checklist to verify the system's production readiness:

## 1. Firebase Initial State Verification

- [ ] Ensure that Firebase Authentication (Email/Password) is enabled in your Firebase Console.
- [ ] Ensure that the `firestore.rules` file has been copy-pasted into your Firebase Console Rules tab.

## 2. UI & Interaction Flow Testing

- [ ] **Splash Screen Load:** Refresh the page. You should see a brief "Verifying secure session..." hourglass screen instead of a flickering dashboard.
- [ ] **Login Screen Rendering:** If you aren't logged in, the new split-screen design should render nicely without overlapping content.
- [ ] **Password Visibility Toggle:** Type a password and click the eye icon to verify it toggles between hidden and visible.

## 3. Persistent Sessions

- [ ] **Login:** Create a new test account or log into an existing one.
- [ ] **Persistence:** Refresh the browser `F5`. Ensure that you are completely logged in smoothly, bypassing the login screen seamlessly because Firebase Web SDK correctly handled Auth persistence.
- [ ] **Browser Re-open:** Close the browser tab entirely. Re-open it. Verify you are still logged in.

## 4. Account Isolation & Data Integrity

- [ ] **Isolation Test (Account A):** Sign in as `userA@test.com`. Add a unique asset "Apple Laptop".
- [ ] **Cross-Pollination Check:** Click Sign Out. Register or Sign in as `userB@test.com`.
- [ ] **Verify Silo:** Verify that "Apple Laptop" is nowhere to be seen in the Dashboard or CSV Export for User B.
- [ ] **Local Storage Clearing:** When you sign out as User A, you can open DevTools (Application -> Local Storage) to visually verify that in-memory collections (`eq_inventory_...`) exist explicitly bound to their specific User IDs, not globally floating.

## 5. Security & DevTools Bypass Attempt

- [ ] Open the application in Incognito Mode.
- [ ] Open Chrome DevTools (F12) -> Elements. finding `<div id="firebaseAuthScreen">` and manually delete the node, OR apply `display: none` to it.
- [ ] Observe the main application underneath. Attempt to click "Add Asset" or sync data.
- [ ] **Expected Verdict:** The UI behaves inertly or fails gracefully. No protected data is visible. If you attempt a write, it goes nowhere. Firebase Rules permanently act as the invisible backend wall.

## 6. Real-Time Multiple Device Test

- [ ] Log into `userA@test.com` on your computer.
- [ ] Log into `userA@test.com` on your mobile phone.
- [ ] Delete an asset from your phone.
- [ ] **Expected Verdict:** Watch your computer screen instantly update out of thin air, securely confirming real-time isolated data sync.
