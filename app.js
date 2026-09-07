// Data Storage Architecture
let inventory = JSON.parse(localStorage.getItem("eq_v8_inventory")) || [];
let issueLogs = JSON.parse(localStorage.getItem("eq_v8_logs")) || [];
let customSuggestions =
  JSON.parse(localStorage.getItem("eq_v8_custom_suggestions")) || [];
let currentTeamMembers = [];
let pendingReset = false;
let exportModalObj, manageSuggestionsModalObj, returnModalObj, firebaseModalObj;

// Set Default Dates
document.getElementById("i_date").valueAsDate = new Date();
document.getElementById("l_date").valueAsDate = new Date();
document.getElementById("r_date").valueAsDate = new Date();

const today = new Date();
document.getElementById("exp_month").value = today.toISOString().slice(0, 7);

function saveData() {
  localStorage.setItem("eq_v8_inventory", JSON.stringify(inventory));
  localStorage.setItem("eq_v8_logs", JSON.stringify(issueLogs));
  localStorage.setItem(
    "eq_v8_custom_suggestions",
    JSON.stringify(customSuggestions),
  );

  // Sync with Firebase Firestore if connected
  if (typeof syncToFirebase === "function") {
    syncToFirebase();
  }

  renderAll();
}

function toggleItemTypeFields() {
  const type = document.getElementById("m_type").value;
  const eqFields = document.getElementById("equipment_fields");
  const accFields = document.getElementById("accessory_fields");
  const serialInput = document.getElementById("m_serial");
  const qtyInput = document.getElementById("m_qty");

  if (type === "EQUIPMENT") {
    eqFields.classList.remove("d-none");
    accFields.classList.add("d-none");
    serialInput.setAttribute("required", "required");
    qtyInput.removeAttribute("required");
  } else {
    eqFields.classList.add("d-none");
    accFields.classList.remove("d-none");
    serialInput.removeAttribute("required");
    qtyInput.setAttribute("required", "required");
  }
}

// --- SUGGESTION BOX ---
function getUniqueSuggestedNames() {
  const invNames = inventory.map((item) => item.name);
  return [...new Set([...invNames, ...customSuggestions])];
}

function filterSuggestions() {
  const inputVal = document.getElementById("m_name").value.toLowerCase().trim();
  const box = document.getElementById("custom_suggestion_box");
  const names = getUniqueSuggestedNames();
  const matches = names.filter((n) => n.toLowerCase().includes(inputVal));

  if (
    matches.length === 0 ||
    (matches.length === 1 && matches[0].toLowerCase() === inputVal)
  ) {
    box.classList.add("d-none");
    box.innerHTML = "";
    return;
  }

  box.innerHTML = matches
    .map(
      (name) => `
        <div class="suggestion-item" onclick="selectSuggestion('${name.replace(/'/g, "\\'")}')">${name}</div>
    `,
    )
    .join("");

  box.classList.remove("d-none");
}

function selectSuggestion(name) {
  document.getElementById("m_name").value = name;
  document.getElementById("custom_suggestion_box").classList.add("d-none");
}

document.addEventListener("click", function (e) {
  const nameInput = document.getElementById("m_name");
  const box = document.getElementById("custom_suggestion_box");
  if (nameInput && box && e.target !== nameInput && !box.contains(e.target)) {
    box.classList.add("d-none");
  }
});

function openManageSuggestionsModal() {
  const container = document.getElementById("suggestionListContainer");
  const names = getUniqueSuggestedNames();
  container.innerHTML = "";

  if (names.length === 0) {
    container.innerHTML =
      '<div class="p-3 text-center text-muted">No suggestion names stored yet.</div>';
  } else {
    names.forEach((name) => {
      container.innerHTML += `
                <div class="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                    <span class="fw-semibold text-dark">${name}</span>
                    <button class="btn btn-outline-danger btn-sm py-0 px-2" onclick="removeSuggestionName('${name.replace(/'/g, "\\'")}')">
                        <i class="bi bi-trash"></i> Remove
                    </button>
                </div>
            `;
    });
  }

  manageSuggestionsModalObj = new bootstrap.Modal(
    document.getElementById("manageSuggestionsModal"),
  );
  manageSuggestionsModalObj.show();
}

function removeSuggestionName(nameToRemove) {
  if (confirm(`Remove "${nameToRemove}" from suggestions?`)) {
    customSuggestions = customSuggestions.filter(
      (n) => n.toLowerCase() !== nameToRemove.toLowerCase(),
    );
    saveData();
    openManageSuggestionsModal();
  }
}

// --- TEAM MEMBERS ---
function addTeamMember() {
  const input = document.getElementById("member_input");
  const val = input.value.trim();
  if (val && !currentTeamMembers.includes(val)) {
    currentTeamMembers.push(val);
    input.value = "";
    renderTeamMemberChips();
  }
}

function removeTeamMember(index) {
  currentTeamMembers.splice(index, 1);
  renderTeamMemberChips();
}

function renderTeamMemberChips() {
  const container = document.getElementById("team_members_container");
  if (currentTeamMembers.length === 0) {
    container.innerHTML =
      '<small class="text-muted" id="empty_member_text">No additional members added yet.</small>';
    return;
  }
  container.innerHTML = currentTeamMembers
    .map(
      (m, idx) => `
        <span class="team-member-chip">
            ${m} <i class="bi bi-x-circle-fill text-danger ms-1" style="cursor:pointer;" onclick="removeTeamMember(${idx})"></i>
        </span>
    `,
    )
    .join("");
}

// --- MASTER INVENTORY ---
function addMasterItem(e) {
  e.preventDefault();
  const itemType = document.getElementById("m_type").value;
  const name = document.getElementById("m_name").value.trim();

  if (!customSuggestions.includes(name)) {
    customSuggestions.push(name);
  }

  if (itemType === "EQUIPMENT") {
    const serial = document.getElementById("m_serial").value.trim();
    const condition = document.getElementById("m_condition").value;
    const problems = document.getElementById("m_problems").value.trim();

    const duplicateItem = inventory.find(
      (item) =>
        item.type === "EQUIPMENT" &&
        item.serial.toLowerCase() === serial.toLowerCase(),
    );
    if (duplicateItem) {
      alert(`⚠️ Warning: Duplicate Serial Number "${serial}" exists!`);
      return;
    }

    inventory.push({
      id: Date.now(),
      type: "EQUIPMENT",
      name: name,
      serial: serial,
      quantity: 1,
      condition: condition,
      problems: problems || "No reported issues",
      isIssued: false,
      exported: false,
    });

    document.getElementById("m_serial").value = "";
    document.getElementById("m_problems").value = "";
    alert(`✅ ${name} (Serial: ${serial}) added to inventory.`);
  } else {
    const qty = parseInt(document.getElementById("m_qty").value);
    const existingAcc = inventory.find(
      (item) =>
        item.type === "ACCESSORY" &&
        item.name.toLowerCase() === name.toLowerCase(),
    );

    if (existingAcc) {
      existingAcc.quantity += qty;
      alert(`✅ Added ${qty} to ${name}. Total Stock: ${existingAcc.quantity}`);
    } else {
      inventory.push({
        id: Date.now(),
        type: "ACCESSORY",
        name: name,
        serial: "N/A",
        quantity: qty,
        condition: "Good",
        problems: "Standard Stock",
        isIssued: false,
        exported: false,
      });
      alert(`✅ Accessory ${name} (Qty: ${qty}) added.`);
    }

    document.getElementById("m_qty").value = "";
  }

  document.getElementById("m_name").value = "";
  document.getElementById("custom_suggestion_box").classList.add("d-none");
  saveData();
}

function deleteMasterItem(id) {
  const item = inventory.find((i) => i.id === id);
  if (item && item.isIssued) {
    alert("Cannot delete an item while it is currently issued!");
    return;
  }
  if (confirm("Delete this item permanently from inventory?")) {
    inventory = inventory.filter((i) => i.id !== id);
    saveData();
    if (
      typeof isFirebaseConnected !== "undefined" &&
      isFirebaseConnected &&
      db
    ) {
      db.collection("asset_inventory")
        .doc(String(id))
        .delete()
        .catch((err) => console.error("Firebase doc delete error:", err));
    }
  }
}

// --- RENDER MULTI-ITEM ISSUE CHECKBOXES ---
function renderMultiItemSelection() {
  const container = document.getElementById("multi_item_container");
  container.innerHTML = "";

  const availableEquipment = inventory.filter(
    (i) => i.type === "EQUIPMENT" && !i.isIssued,
  );
  const availableAccessories = inventory.filter(
    (i) => i.type === "ACCESSORY" && i.quantity > 0,
  );

  if (availableEquipment.length === 0 && availableAccessories.length === 0) {
    container.innerHTML =
      '<div class="text-center text-muted py-3">No available items in stock to issue.</div>';
    return;
  }

  let html = "";

  if (availableEquipment.length > 0) {
    html +=
      '<h6 class="fw-bold text-dark border-bottom pb-1 mb-2"><i class="bi bi-tools me-1"></i> Available Main Equipment</h6>';
    availableEquipment.forEach((item) => {
      html += `
                <div class="form-check py-1">
                    <input class="form-check-input issue-checkbox" type="checkbox" data-type="EQUIPMENT" data-id="${item.id}" id="chk_${item.id}">
                    <label class="form-check-label d-flex justify-content-between align-items-center" for="chk_${item.id}">
                        <span><strong>${item.name}</strong> <small class="text-primary">(Serial: ${item.serial})</small></span>
                        <span class="badge bg-light text-dark border">${item.condition}</span>
                    </label>
                </div>
            `;
    });
  }

  if (availableAccessories.length > 0) {
    html +=
      '<h6 class="fw-bold text-dark border-bottom pb-1 mt-3 mb-2"><i class="bi bi-box-seam me-1"></i> Available Accessories & Consumables</h6>';
    availableAccessories.forEach((item) => {
      html += `
                <div class="row align-items-center py-1">
                    <div class="col-8">
                        <div class="form-check">
                            <input class="form-check-input issue-checkbox" type="checkbox" data-type="ACCESSORY" data-id="${item.id}" id="chk_${item.id}" onchange="toggleAccQtyInput(${item.id})">
                            <label class="form-check-label" for="chk_${item.id}">
                                <strong>${item.name}</strong> <small class="text-muted">(Available: ${item.quantity})</small>
                            </label>
                        </div>
                    </div>
                    <div class="col-4">
                        <input type="number" class="form-control form-control-sm acc-qty-input" id="qty_${item.id}" min="1" max="${item.quantity}" value="1" disabled placeholder="Qty">
                    </div>
                </div>
            `;
    });
  }

  container.innerHTML = html;
}

function toggleAccQtyInput(id) {
  const chk = document.getElementById(`chk_${id}`);
  const qtyInput = document.getElementById(`qty_${id}`);
  if (chk.checked) {
    qtyInput.removeAttribute("disabled");
  } else {
    qtyInput.setAttribute("disabled", "disabled");
  }
}

// --- MULTI-ITEM ISSUE SUBMISSION ---
function issueEquipment(e) {
  e.preventDefault();
  const date = document.getElementById("i_date").value;
  const leader = document.getElementById("i_leader").value.trim();
  const receiver = document.getElementById("i_receiver").value.trim();
  const projectId = document.getElementById("i_project_id").value.trim();
  const remarks = document.getElementById("i_remarks").value.trim();

  const checkboxes = document.querySelectorAll(".issue-checkbox:checked");

  if (checkboxes.length === 0) {
    alert("⚠️ Please select at least ONE item to issue!");
    return;
  }

  const groupId = "GRP-" + Date.now();
  let issuedCount = 0;

  checkboxes.forEach((chk) => {
    const itemId = parseInt(chk.getAttribute("data-id"));
    const itemType = chk.getAttribute("data-type");
    const item = inventory.find((i) => i.id === itemId);

    if (!item) return;

    if (itemType === "EQUIPMENT") {
      item.isIssued = true;

      issueLogs.unshift({
        id: Date.now() + Math.floor(Math.random() * 1000),
        groupId: groupId,
        type: "ISSUE",
        itemType: "EQUIPMENT",
        issueDate: date,
        returnDate: "",
        leader: leader,
        receiver: receiver,
        returner: "",
        mismatchReason: "",
        projectId: projectId,
        members: [...currentTeamMembers],
        name: item.name,
        serial: item.serial,
        issueCondition: item.condition,
        issueProblems: item.problems,
        returnCondition: "",
        returnProblems: "",
        remarks: remarks,
        fineAmount: "",
        active: true,
        exported: false,
      });
      issuedCount++;
    } else if (itemType === "ACCESSORY") {
      const qtyInput = document.getElementById(`qty_${itemId}`);
      const issueQty = parseInt(qtyInput.value) || 1;

      if (issueQty > item.quantity) {
        alert(
          `Cannot issue ${issueQty} of ${item.name}. Only ${item.quantity} available!`,
        );
        return;
      }

      item.quantity -= issueQty;

      issueLogs.unshift({
        id: Date.now() + Math.floor(Math.random() * 1000),
        groupId: groupId,
        type: "ISSUE",
        itemType: "ACCESSORY",
        issueDate: date,
        returnDate: "",
        leader: leader,
        receiver: receiver,
        returner: "",
        mismatchReason: "",
        projectId: projectId,
        members: [...currentTeamMembers],
        name: item.name,
        serial: `ACC-ISSUE (Qty: ${issueQty})`,
        issueCondition: "Good",
        issueProblems: `Issued Quantity: ${issueQty}`,
        returnCondition: "",
        returnProblems: "",
        remarks: remarks,
        fineAmount: "",
        active: true,
        exported: false,
      });
      issuedCount++;
    }
  });

  document.getElementById("issueForm").reset();
  document.getElementById("i_date").valueAsDate = new Date();
  currentTeamMembers = [];
  renderTeamMemberChips();
  saveData();
  alert(`✅ Successfully issued ${issuedCount} item(s) to team!`);
}

// --- REPORT LOST ITEM ---
function reportLostEquipment(e) {
  e.preventDefault();
  const date = document.getElementById("l_date").value;
  const person = document.getElementById("l_person").value.trim();
  const name = document.getElementById("l_name").value;
  const serial = document.getElementById("l_serial").value;
  const incident = document.getElementById("l_incident").value.trim();
  const fir = document.getElementById("l_fir").value.trim() || "N/A";
  const recovery = document.getElementById("l_recovery").value;
  const fineAmount =
    document.getElementById("l_fine_amount").value.trim() || "N/A";

  const itemIndex = inventory.findIndex(
    (i) => i.name === name && (i.serial === serial || i.type === "ACCESSORY"),
  );

  if (itemIndex === -1) {
    alert("Item not found!");
    return;
  }

  const item = inventory[itemIndex];

  if (!confirm(`Are you sure you want to report ${name} as LOST?`)) return;

  if (item.type === "EQUIPMENT") {
    inventory.splice(itemIndex, 1);
  } else {
    item.quantity -= 1;
    if (item.quantity <= 0) inventory.splice(itemIndex, 1);
  }

  issueLogs.unshift({
    id: Date.now(),
    groupId: "LOST-" + Date.now(),
    type: "LOST",
    itemType: item.type,
    issueDate: date,
    returnDate: "N/A",
    leader: person,
    receiver: person,
    returner: "N/A",
    mismatchReason: "",
    projectId: "LOST INCIDENT",
    members: [],
    name: name,
    serial: serial,
    issueCondition: "LOST",
    issueProblems: `Incident: ${incident} | FIR: ${fir} | Recovery: ${recovery}`,
    returnCondition: "LOST",
    returnProblems: "ITEM MISSING",
    remarks: incident,
    fineAmount: fineAmount,
    active: false,
    exported: false,
  });

  document.getElementById("lostForm").reset();
  document.getElementById("l_date").valueAsDate = new Date();
  saveData();
  alert("Lost report submitted successfully!");
}

// --- RETURN SINGLE ITEM MODAL LOGIC ---
let originalReceiver = "";

function openReturnModal(logId) {
  const log = issueLogs.find((l) => l.id === logId);
  if (!log) return;

  originalReceiver = log.receiver || log.leader;

  document.getElementById("modal_log_id").value = log.id;
  document.getElementById("modal_eq_name").innerText = log.name;
  document.getElementById("modal_eq_serial").innerText = log.serial;
  document.getElementById("modal_project_id").innerText =
    log.projectId || "N/A";
  document.getElementById("modal_issue_receiver").innerText = originalReceiver;
  document.getElementById("modal_issue_cond").innerText = log.issueCondition;
  document.getElementById("modal_issue_prob").innerText =
    log.issueProblems || "None";

  document.getElementById("r_date").valueAsDate = new Date();
  document.getElementById("r_returner").value = originalReceiver;
  document.getElementById("r_condition").value = log.issueCondition;
  document.getElementById("r_problems").value =
    log.issueProblems !== "No reported issues" ? log.issueProblems : "";

  checkPersonMismatch();

  returnModalObj = new bootstrap.Modal(document.getElementById("returnModal"));
  returnModalObj.show();
}

function checkPersonMismatch() {
  const returnerVal = document.getElementById("r_returner").value.trim();
  const mismatchDiv = document.getElementById("mismatch_reason_div");

  if (
    returnerVal.toLowerCase() !== originalReceiver.toLowerCase() &&
    returnerVal !== ""
  ) {
    mismatchDiv.classList.remove("d-none");
  } else {
    mismatchDiv.classList.add("d-none");
  }
}

function submitReturn(e) {
  e.preventDefault();
  const logId = parseInt(document.getElementById("modal_log_id").value);
  const returnDate = document.getElementById("r_date").value;
  const returner = document.getElementById("r_returner").value.trim();
  const returnCond = document.getElementById("r_condition").value;
  const returnProbs =
    document.getElementById("r_problems").value.trim() || "No reported issues";
  const mismatchReason = document
    .getElementById("r_mismatch_reason")
    .value.trim();

  const log = issueLogs.find((l) => l.id === logId);
  if (log) {
    log.active = false;
    log.returnDate = returnDate;
    log.returner = returner;
    log.returnCondition = returnCond;
    log.returnProblems = returnProbs;
    log.mismatchReason = mismatchReason;
    log.exported = false;

    if (log.itemType === "EQUIPMENT") {
      const item = inventory.find((i) => i.serial === log.serial);
      if (item) {
        item.isIssued = false;
        item.condition = returnCond;
        item.problems = returnProbs;
      }
    } else {
      const match = log.serial.match(/\d+/);
      const qtyToReturn = match ? parseInt(match[0]) : 1;

      const item = inventory.find(
        (i) => i.type === "ACCESSORY" && i.name === log.name,
      );
      if (item) {
        item.quantity += qtyToReturn;
      } else {
        inventory.push({
          id: Date.now(),
          type: "ACCESSORY",
          name: log.name,
          serial: "N/A",
          quantity: qtyToReturn,
          condition: returnCond,
          problems: returnProbs,
          isIssued: false,
          exported: false,
        });
      }
    }
  }

  returnModalObj.hide();
  saveData();
  alert("Item successfully returned to stock!");
}

// --- DROPDOWNS ---
function updateLostSerialDropdown() {
  const selectedName = document.getElementById("l_name").value;
  const serialSelect = document.getElementById("l_serial");
  serialSelect.innerHTML =
    '<option value="">-- Select Serial / Ref --</option>';

  if (!selectedName) return;

  const list = inventory.filter((i) => i.name === selectedName);
  list.forEach((i) => {
    const opt = document.createElement("option");
    if (i.type === "EQUIPMENT") {
      opt.value = i.serial;
      opt.textContent = `Serial: ${i.serial} ${i.isIssued ? "(Issued)" : "(In Stock)"}`;
    } else {
      opt.value = i.name;
      opt.textContent = `Accessory Stock (${i.quantity} available)`;
    }
    serialSelect.appendChild(opt);
  });
}

function renderIssueDropdowns() {
  const lostNameSelect = document.getElementById("l_name");
  const allNames = [...new Set(inventory.map((i) => i.name))];

  lostNameSelect.innerHTML = '<option value="">-- Select Item --</option>';
  allNames.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    lostNameSelect.appendChild(opt);
  });
}

// --- RENDER TABLES ---
function renderAll() {
  renderSummaryTable();
  renderMasterTable();
  renderMultiItemSelection();
  renderIssueDropdowns();
  renderLogs();
}

function renderSummaryTable() {
  const tbody = document.querySelector("#summaryTable tbody");
  tbody.innerHTML = "";

  const summary = {};
  inventory.forEach((item) => {
    if (!summary[item.name])
      summary[item.name] = { total: 0, available: 0, type: item.type };

    if (item.type === "EQUIPMENT") {
      summary[item.name].total += 1;
      if (!item.isIssued) summary[item.name].available += 1;
    } else {
      summary[item.name].total += item.quantity;
      summary[item.name].available += item.quantity;
    }
  });

  const keys = Object.keys(summary);
  document.getElementById("totalEquipmentTypes").innerText =
    `${keys.length} Items`;

  if (keys.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="3" class="text-center text-muted py-3">No items added yet.</td></tr>';
    return;
  }

  keys.forEach((name) => {
    const avail = summary[name].available;
    const badgeClass = avail > 0 ? "bg-success" : "bg-danger";
    tbody.innerHTML += `
            <tr>
                <td class="fw-bold">${name} <small class="text-muted">(${summary[name].type})</small></td>
                <td class="text-center fw-semibold">${summary[name].total}</td>
                <td class="text-center"><span class="badge ${badgeClass}">${avail} Available</span></td>
            </tr>
        `;
  });
}

function renderMasterTable() {
  const tbody = document.querySelector("#masterTable tbody");
  tbody.innerHTML = "";

  if (inventory.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-center text-muted py-3">No item registered.</td></tr>';
    return;
  }

  inventory.forEach((item) => {
    if (item.type === "EQUIPMENT") {
      const statusBadge = item.isIssued
        ? '<span class="badge badge-issued">Issued</span>'
        : '<span class="badge badge-available">Available</span>';

      let condClass = "cond-good";
      if (item.condition === "Minor Fault") condClass = "cond-minor";
      if (item.condition === "Damaged") condClass = "cond-damaged";

      tbody.innerHTML += `
                <tr>
                    <td class="fw-bold text-primary">${item.serial}</td>
                    <td>${item.name}</td>
                    <td>
                        <div><span class="condition-badge ${condClass}">${item.condition}</span></div>
                        <small class="text-muted">${item.problems || "No reported issues"}</small>
                    </td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-outline-danger btn-sm py-0 px-2" onclick="deleteMasterItem(${item.id})"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>
            `;
    } else {
      tbody.innerHTML += `
                <tr class="table-warning bg-opacity-10">
                    <td><span class="badge badge-accessory">ACCESSORY</span></td>
                    <td class="fw-bold">${item.name}</td>
                    <td><small class="text-muted">Consumable Item</small></td>
                    <td><span class="badge bg-dark">Qty: ${item.quantity}</span></td>
                    <td>
                        <button class="btn btn-outline-danger btn-sm py-0 px-2" onclick="deleteMasterItem(${item.id})"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>
            `;
    }
  });
}

function renderLogs() {
  const pendingTbody = document.querySelector("#pendingLogTable tbody");
  const returnedTbody = document.querySelector("#returnedLogTable tbody");
  const query = document.getElementById("searchLog").value.toLowerCase();

  pendingTbody.innerHTML = "";
  returnedTbody.innerHTML = "";

  const filteredLogs = issueLogs.filter(
    (l) =>
      l.leader.toLowerCase().includes(query) ||
      (l.receiver && l.receiver.toLowerCase().includes(query)) ||
      (l.returner && l.returner.toLowerCase().includes(query)) ||
      l.name.toLowerCase().includes(query) ||
      l.serial.toLowerCase().includes(query) ||
      (l.projectId && l.projectId.toLowerCase().includes(query)),
  );

  const pendingLogs = filteredLogs.filter((l) => l.active === true);
  const historyLogs = filteredLogs.filter((l) => l.active === false);

  document.getElementById("pendingCount").innerText =
    `${pendingLogs.length} Pending`;
  document.getElementById("returnedCount").innerText =
    `${historyLogs.length} History Records`;

  // 1. PENDING LOGS
  if (pendingLogs.length === 0) {
    pendingTbody.innerHTML =
      '<tr><td colspan="6" class="text-center text-muted py-3">No pending items to return. All issued items are clear!</td></tr>';
  } else {
    pendingLogs.forEach((log) => {
      const memberChips =
        log.members && log.members.length > 0
          ? log.members
              .map((m) => `<span class="team-member-chip">${m}</span>`)
              .join("")
          : '<small class="text-muted">None</small>';

      let issueCondClass =
        log.issueCondition === "Minor Fault"
          ? "cond-minor"
          : log.issueCondition === "Damaged"
            ? "cond-damaged"
            : "cond-good";

      pendingTbody.innerHTML += `
                <tr class="table-warning bg-opacity-10">
                    <td><small class="fw-bold">${log.issueDate}</small></td>
                    <td><div class="fw-bold text-primary">${log.projectId || "N/A"}</div></td>
                    <td>
                        <div><small>Leader:</small> <b>${log.leader}</b></div>
                        <div><small>Receiver:</small> <b class="text-info">${log.receiver || log.leader}</b></div>
                        <div class="mt-1">${memberChips}</div>
                    </td>
                    <td>
                        <div class="fw-bold">${log.name}</div>
                        <small class="text-muted">Ref/Serial: <b>${log.serial}</b></small>
                    </td>
                    <td>
                        <div><span class="condition-badge ${issueCondClass}">${log.issueCondition}</span></div>
                        <small class="text-muted d-block">${log.issueProblems || "No issues"}</small>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger" onclick="openReturnModal(${log.id})"><i class="bi bi-box-arrow-in-left me-1"></i> Return</button>
                    </td>
                </tr>
            `;
    });
  }

  // 2. RETURNED LOGS
  if (historyLogs.length === 0) {
    returnedTbody.innerHTML =
      '<tr><td colspan="6" class="text-center text-muted py-3">No returned or incident history logs found.</td></tr>';
  } else {
    historyLogs.forEach((log) => {
      if (log.type === "LOST") {
        returnedTbody.innerHTML += `
                    <tr class="table-danger">
                        <td><span class="badge badge-lost mb-1">LOST REPORT</span><br><small class="fw-bold">${log.issueDate}</small></td>
                        <td><span class="badge bg-danger">MISSING</span></td>
                        <td><div class="fw-bold">${log.leader}</div><small class="text-muted">In-Charge</small></td>
                        <td><div class="fw-bold text-danger">${log.name}</div><small>Ref: <b>${log.serial}</b></small></td>
                        <td>
                            <small class="d-block">${log.issueProblems}</small>
                            <span class="badge bg-warning text-dark mt-1">Fine/Comp: ${log.fineAmount || "N/A"}</span>
                        </td>
                        <td><span class="badge bg-dark"><i class="bi bi-x-circle me-1"></i> Removed From Stock</span></td>
                    </tr>
                `;
        return;
      }

      const memberChips =
        log.members && log.members.length > 0
          ? log.members
              .map((m) => `<span class="team-member-chip">${m}</span>`)
              .join("")
          : '<small class="text-muted">None</small>';

      let returnCondClass =
        log.returnCondition === "Minor Fault"
          ? "cond-minor"
          : log.returnCondition === "Damaged"
            ? "cond-damaged"
            : "cond-good";

      returnedTbody.innerHTML += `
                <tr>
                    <td>
                        <small class="fw-bold text-muted">Issued: ${log.issueDate}</small><br>
                        <small class="fw-bold text-success">Returned: ${log.returnDate}</small>
                    </td>
                    <td><div class="fw-bold text-primary">${log.projectId || "N/A"}</div></td>
                    <td>
                        <div><small>Receiver:</small> <b>${log.receiver || log.leader}</b></div>
                        <div><small>Returned By:</small> <b class="text-success">${log.returner}</b></div>
                        ${log.mismatchReason ? `<small class="text-danger d-block"><b>Reason:</b> ${log.mismatchReason}</small>` : ""}
                        <div class="mt-1">${memberChips}</div>
                    </td>
                    <td>
                        <div class="fw-bold">${log.name}</div>
                        <small class="text-muted">Ref/Serial: <b>${log.serial}</b></small>
                    </td>
                    <td>
                        <div><span class="condition-badge ${returnCondClass}">${log.returnCondition}</span></div>
                        <small class="text-muted d-block">${log.returnProblems}</small>
                    </td>
                    <td><span class="badge badge-available"><i class="bi bi-check2-circle me-1"></i> Completed</span></td>
                </tr>
            `;
    });
  }
}

// --- RESET WORKFLOW ---
function triggerResetWorkflow() {
  if (issueLogs.length === 0) {
    alert("No movement or incident logs available to reset.");
    return;
  }

  if (
    confirm(
      "To reset Part 2 Logs, you MUST first download the backup CSV file.\n\nClick OK to open download options.",
    )
  ) {
    pendingReset = true;
    openExportModal();
  }
}

// --- EXPORT MODAL & CSV EXPORT ---
function openExportModal() {
  exportModalObj = new bootstrap.Modal(document.getElementById("exportModal"));
  exportModalObj.show();
}

function processExport(e) {
  e.preventDefault();
  const selectedMonth = document.getElementById("exp_month").value;
  const scope = document.querySelector(
    'input[name="exportScope"]:checked',
  ).value;

  if (!selectedMonth) {
    alert("Please select a valid month!");
    return;
  }

  let logsToExport = [];
  let inventoryToExport = [];

  if (scope === "ALL") {
    logsToExport = issueLogs.filter(
      (l) => l.issueDate.substring(0, 7) <= selectedMonth,
    );
    inventoryToExport = [...inventory];
  } else {
    logsToExport = issueLogs.filter(
      (l) => l.issueDate.substring(0, 7) <= selectedMonth && !l.exported,
    );
    inventoryToExport = inventory.filter((i) => !i.exported);
  }

  if (logsToExport.length === 0 && inventoryToExport.length === 0) {
    alert("No new or matching data available for the selected criteria!");
    return;
  }

  const now = new Date();
  const generatedAt = now.toLocaleString();

  let csv = `========================================================================================================\n`;
  csv += `                               EQUIPMENT & ASSET MANAGEMENT REPORT                                      \n`;
  csv += `========================================================================================================\n`;
  csv += `Report Month : ${selectedMonth}\n`;
  csv += `Generated On : ${generatedAt}\n`;
  csv += `Data Scope   : ${scope === "ALL" ? "ALL HISTORICAL RECORDS" : "ONLY NEW / UN-DOWNLOADED DATA"}\n`;
  csv += `========================================================================================================\n\n`;

  // PART 1
  csv += `--------------------------------------------------------------------------------------------------------\n`;
  csv += `PART 1: MASTER STOCK INVENTORY\n`;
  csv += `--------------------------------------------------------------------------------------------------------\n`;
  csv += `"ITEM TYPE","SERIAL / ID","ITEM NAME","QUANTITY","INITIAL CONDITION","PROBLEM DETAILS","CURRENT STATUS"\n`;

  if (inventoryToExport.length === 0) {
    csv += `"No inventory items recorded."\n`;
  } else {
    inventoryToExport.forEach((i) => {
      csv += `"${i.type}","${i.serial}","${i.name}","${i.quantity}","${i.condition}","${i.problems || "None"}","${i.isIssued ? "ISSUED" : "AVAILABLE"}"\n`;
      i.exported = true;
    });
  }
  csv += `\n\n`;

  // PART 2.1
  const pendingLogsToExport = logsToExport.filter((l) => l.active === true);
  csv += `--------------------------------------------------------------------------------------------------------\n`;
  csv += `PART 2.1: RETURN PENDING / CURRENTLY ISSUED ITEMS\n`;
  csv += `--------------------------------------------------------------------------------------------------------\n`;
  csv += `"ISSUE GROUP ID","ISSUE DATE","PROJECT ID","TEAM LEADER","RECEIVER PERSON","TEAM MEMBERS","ITEM NAME","SERIAL / REF","ISSUE CONDITION","ISSUE PROBLEMS","REMARKS"\n`;

  if (pendingLogsToExport.length === 0) {
    csv += `"No pending issued items."\n`;
  } else {
    pendingLogsToExport.forEach((l) => {
      const membersStr = l.members ? l.members.join("; ") : "None";
      csv += `"${l.groupId || "N/A"}","${l.issueDate}","${l.projectId || "N/A"}","${l.leader}","${l.receiver || ""}","${membersStr}","${l.name}","${l.serial}","${l.issueCondition}","${l.issueProblems || "None"}","${l.remarks || ""}"\n`;
      l.exported = true;
    });
  }
  csv += `\n\n`;

  // PART 2.2
  const historyLogsToExport = logsToExport.filter((l) => l.active === false);
  csv += `--------------------------------------------------------------------------------------------------------\n`;
  csv += `PART 2.2: RETURNED & INCIDENT HISTORY LOGS\n`;
  csv += `--------------------------------------------------------------------------------------------------------\n`;
  csv += `"ISSUE GROUP ID","LOG TYPE","ISSUE DATE","RETURN DATE","PROJECT ID","TEAM LEADER","RECEIVER PERSON","RETURNED BY","MISMATCH REASON","TEAM MEMBERS","ITEM NAME","SERIAL / REF","RETURN CONDITION","RETURN PROBLEMS / INCIDENT DETAILS","FINE / COMP AMOUNT","REMARKS"\n`;

  if (historyLogsToExport.length === 0) {
    csv += `"No returned or incident history logs recorded."\n`;
  } else {
    historyLogsToExport.forEach((l) => {
      const membersStr = l.members ? l.members.join("; ") : "None";
      csv += `"${l.groupId || "N/A"}","${l.type || "ISSUE"}","${l.issueDate}","${l.returnDate || "N/A"}","${l.projectId || "N/A"}","${l.leader}","${l.receiver || ""}","${l.returner || ""}","${l.mismatchReason || "N/A"}","${membersStr}","${l.name}","${l.serial}","${l.returnCondition || "N/A"}","${l.returnProblems || l.issueProblems || "N/A"}","${l.fineAmount || "N/A"}","${l.remarks || ""}"\n`;
      l.exported = true;
    });
  }
  csv += `\n\n`;

  // PART 3
  csv += `--------------------------------------------------------------------------------------------------------\n`;
  csv += `PART 3: LIVE STOCK SUMMARY (AUTO CALCULATED)\n`;
  csv += `--------------------------------------------------------------------------------------------------------\n`;
  csv += `"ITEM NAME","CATEGORY TYPE","TOTAL QUANTITY","AVAILABLE STOCK","ISSUED / OUT OF STOCK"\n`;

  const summary = {};
  inventoryToExport.forEach((item) => {
    if (!summary[item.name])
      summary[item.name] = { total: 0, available: 0, type: item.type };

    if (item.type === "EQUIPMENT") {
      summary[item.name].total += 1;
      if (!item.isIssued) summary[item.name].available += 1;
    } else {
      summary[item.name].total += item.quantity;
      summary[item.name].available += item.quantity;
    }
  });

  const summaryKeys = Object.keys(summary);
  if (summaryKeys.length === 0) {
    csv += `"No inventory summary available."\n`;
  } else {
    summaryKeys.forEach((name) => {
      const total = summary[name].total;
      const avail = summary[name].available;
      const issued = total - avail;
      csv += `"${name}","${summary[name].type}","${total}","${avail}","${issued}"\n`;
    });
  }
  csv += `\n=================================== END OF REPORT ===================================\n`;

  localStorage.setItem("eq_v8_inventory", JSON.stringify(inventory));
  localStorage.setItem("eq_v8_logs", JSON.stringify(issueLogs));

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("download", `Asset_Management_Report_${selectedMonth}.csv`);
  a.click();

  exportModalObj.hide();

  if (pendingReset) {
    setTimeout(() => {
      if (
        confirm("CSV Backup Report Downloaded!\n\nClear all Part 2 Logs now?")
      ) {
        issueLogs = [];
        saveData();

        if (
          typeof isFirebaseConnected !== "undefined" &&
          isFirebaseConnected &&
          db
        ) {
          db.collection("asset_logs")
            .get()
            .then((snapshot) => {
              snapshot.forEach((doc) => doc.ref.delete());
            });
        }

        alert("Part 2 Movement Logs have been reset!");
      }
      pendingReset = false;
    }, 800);
  }
}

// --- FIREBASE MODAL UI LOGIC ---
function openFirebaseModal() {
  if (typeof firebaseConfig !== "undefined") {
    document.getElementById("fb_apiKey").value = firebaseConfig.apiKey || "";
    document.getElementById("fb_projectId").value =
      firebaseConfig.projectId || "";
    document.getElementById("fb_authDomain").value =
      firebaseConfig.authDomain || "";
    document.getElementById("fb_storageBucket").value =
      firebaseConfig.storageBucket || "";
    document.getElementById("fb_messagingSenderId").value =
      firebaseConfig.messagingSenderId || "";
    document.getElementById("fb_appId").value = firebaseConfig.appId || "";
  }

  firebaseModalObj = new bootstrap.Modal(
    document.getElementById("firebaseModal"),
  );
  firebaseModalObj.show();
}

function saveFirebaseCredentials(e) {
  e.preventDefault();
  const config = {
    apiKey: document.getElementById("fb_apiKey").value.trim(),
    projectId: document.getElementById("fb_projectId").value.trim(),
    authDomain: document.getElementById("fb_authDomain").value.trim(),
    storageBucket: document.getElementById("fb_storageBucket").value.trim(),
    messagingSenderId: document
      .getElementById("fb_messagingSenderId")
      .value.trim(),
    appId: document.getElementById("fb_appId").value.trim(),
  };

  if (typeof saveFirebaseConfigFromUI === "function") {
    saveFirebaseConfigFromUI(config);
  }

  if (firebaseModalObj) {
    firebaseModalObj.hide();
  }
  alert("⚡ Firebase credentials updated and saved!");
}

function disconnectFirebase() {
  if (confirm("Disconnect Firebase cloud database and switch to Local Mode?")) {
    localStorage.removeItem("eq_firebase_config");
    if (typeof firebaseConfig !== "undefined") {
      firebaseConfig.apiKey = "";
      firebaseConfig.projectId = "";
    }
    if (typeof updateFirebaseStatusUI === "function") {
      updateFirebaseStatusUI(false, "Local Mode");
    }
    if (firebaseModalObj) {
      firebaseModalObj.hide();
    }
    alert("Disconnected from Firebase. Switched to Local Mode.");
  }
}

// Initialize application
renderAll();

// Initialize Firebase if config present
if (typeof initFirebase === "function") {
  initFirebase();
}

// --- PROGRESSIVE WEB APP (PWA) INSTALLATION LOGIC ---
let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById("pwaInstallBtn");
  if (btn) {
    btn.classList.remove("d-none");
  }
});

function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === "accepted") {
        console.log("User accepted PWA install prompt");
      }
      deferredPrompt = null;
      const btn = document.getElementById("pwaInstallBtn");
      if (btn) btn.classList.add("d-none");
    });
  } else {
    alert(
      "📱 To install this App on your Android/iOS phone:\n\n1. Open this website in Chrome / Safari\n2. Tap the browser Menu (3 dots or share button)\n3. Select 'Add to Home Screen' or 'Install App'",
    );
  }
}

// Register Service Worker for PWA Offline & Installable Web App
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) =>
        console.log("✅ PWA Service Worker registered:", reg.scope),
      )
      .catch((err) =>
        console.warn("❌ Service Worker registration failed:", err),
      );
  });
}
