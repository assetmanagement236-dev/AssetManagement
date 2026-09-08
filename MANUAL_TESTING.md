# SaaS Authentication Manual Testing Guide

Because live automated browser tests were unavailable, please run through this manual checklist to verify the system's production readiness:

## 1. Firebase Initial State Verification

- [ ] Ensure that Firebase Authentication (Email/Password) is enabled in your Firebase Console.
- [ ] Ensure that the `firestore.rules` file has been copy-pasted into your Firebase Console Rules tab.

## 2. Persistent Login (Initialization Flow)

- [ ] **Login:** Sign into your account.
- [ ] **Persistence & Flicker Test:** Refresh the page (F5).
- [ ] **Expected Result:** You should briefly see the clean "Verifying secure session..." splash screen, which waits for Firebase. The app should smoothly seamlessly transition to your dashboard WITHOUT briefly flashing the Login Screen.
- [ ] **Browser Re-open:** Close and re-open the browser tab. Firebase Web SDK should restore the session robustly. You should still be logged in.

## 3. Account Switching & Listener Cleanup Test

- [ ] **Login:** Sign in as `accountA@test.com`. Keep the dashboard open.
- [ ] **Logout & Refresh:** Click Sign Out. The dashboard data must flush completely. The login screen should immediately appear. Refresh the page to be sure.
- [ ] **Switch:** Sign in as `accountB@test.com`.
- [ ] **Expected Result:** The UI, local cache, statistics, and any arrays must show ZERO data from Account A. Account old data is never referenced.

## 4. Multi-Device Listener Isolation Test

- [ ] Log in as `accountA@test.com` on your mobile device.
- [ ] Log in as `accountB@test.com` on your computer.
- [ ] Add a new Asset on the mobile device (Account A).
- [ ] **Expected Result:** Account B's computer screen should NOT receive the ping from Firebase. Only a device logged in as Account A should react to the listener.

## 5. CSV Export Isolation Test

- [ ] Add unique assets while logged in as Account A, and distinct ones as Account B.
- [ ] Click "Download CSV Daily Backup" on both accounts.
- [ ] **Expected Result:** The CSV generated for Account A will physically only contain elements belonging to Account A, proving the memory context is strictly bound. (Wait for Firebase to connect fully before downloading).

## 6. Real Developer Security Bypasses (The true boundary test)

The frontend HTML overlays are built for UX, _not_ for hard security. The ultimate boundary lies strictly at Google's servers. Let's prove it:

- [ ] **Unauthenticated Access Test:** Completely Sign Out of the application.
- [ ] Open Chrome DevTools (F12) -> Console. Type `getUserDb()`. It will return `null`.
- [ ] Attempt to manually read from Firestore: `db.collection('users').doc('fake').collection('asset_inventory').get().then(console.log).catch(console.error)`
- [ ] **Expected Result:** Firebase returns an immediate **Permission Denied / Missing Permissions** error. Unauthenticated queries fail.
- [ ] **Cross-User Bypasses Test:** While logged in as `accountA`, try to manually fetch or edit `accountB`'s database document via Console.
- [ ] **Expected Result:** Firebase returns a **Permission Denied** error because your token `request.auth.uid` does not strictly equal `accountB`.
- [ ] **UI Bypass Test:** While Signed Out, open DevTools -> Elements. Delete the `<div id="firebaseAuthScreen">` and the splash screen.
- [ ] **Expected Result:** The application interface is visually revealed underneath. However, it will appear empty and dead. Clicking "sync" or "Submit" goes nowhere and fails silently or explicitly in the console. **Visual hacking does not compromise protected database systems.**
