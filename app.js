// Data Storage Architecture (V10 with FirebaseAuth Isolation)
let inventory = [];
let issueLogs = [];
let borrowedTransfers = [];
let customSuggestions = [];
let employees = [];
let attendanceLogs = [];
let editingEmpId = null;
let currentTeamMembers = [];
let currentBoxItems = [];
let pendingReset = false;
let exportModalObj, manageSuggestionsModalObj, returnModalObj, firebaseModalObj;

function loadData() {
  const uid =
    typeof currentUserUID !== "undefined" && currentUserUID
      ? currentUserUID
      : "anonymous";

  inventory = JSON.parse(localStorage.getItem(`eq_inventory_${uid}`)) || [];
  issueLogs = JSON.parse(localStorage.getItem(`eq_logs_${uid}`)) || [];
  borrowedTransfers =
    JSON.parse(localStorage.getItem(`eq_transfers_${uid}`)) || [];
  customSuggestions =
    JSON.parse(localStorage.getItem(`eq_custom_suggestions_${uid}`)) || [];
  employees = JSON.parse(localStorage.getItem(`eq_employees_${uid}`)) || [];
  attendanceLogs =
    JSON.parse(localStorage.getItem(`eq_attendance_${uid}`)) || [];

  if (typeof renderAll === "function") {
    renderAll();
  }
}

// Initial fallback load
loadData();

// Set Default Dates
if (document.getElementById("i_date"))
  document.getElementById("i_date").valueAsDate = new Date();
if (document.getElementById("l_date"))
  document.getElementById("l_date").valueAsDate = new Date();
if (document.getElementById("r_date"))
  document.getElementById("r_date").valueAsDate = new Date();
if (document.getElementById("att_date_filter"))
  document.getElementById("att_date_filter").valueAsDate = new Date();

const today = new Date();
if (document.getElementById("exp_month"))
  document.getElementById("exp_month").value = today.toISOString().slice(0, 7);

function saveData() {
  const uid =
    typeof currentUserUID !== "undefined" && currentUserUID
      ? currentUserUID
      : "anonymous";

  localStorage.setItem(`eq_inventory_${uid}`, JSON.stringify(inventory));
  localStorage.setItem(`eq_logs_${uid}`, JSON.stringify(issueLogs));
  localStorage.setItem(
    `eq_transfers_${uid}`,
    JSON.stringify(borrowedTransfers),
  );
  localStorage.setItem(
    `eq_custom_suggestions_${uid}`,
    JSON.stringify(customSuggestions),
  );
  localStorage.setItem(`eq_employees_${uid}`, JSON.stringify(employees));
  localStorage.setItem(`eq_attendance_${uid}`, JSON.stringify(attendanceLogs));

  // Sync with Firebase Firestore if connected
  if (typeof syncToFirebase === "function") {
    syncToFirebase();
  }

  renderAll();
}

function formatSerialText(offSerial, eqSerial) {
  let parts = [];
  if (offSerial && offSerial !== "N/A") parts.push(`Off SN: ${offSerial}`);
  if (eqSerial && eqSerial !== "N/A") parts.push(`Eq SN: ${eqSerial}`);
  return parts.length > 0 ? parts.join(" | ") : "N/A";
}

function toggleItemTypeFields() {
  const type = document.getElementById("m_type").value;
  const eqFields = document.getElementById("equipment_fields");
  const accFields = document.getElementById("accessory_fields");
  const qtyInput = document.getElementById("m_qty");

  if (type === "EQUIPMENT") {
    eqFields.classList.remove("d-none");
    accFields.classList.add("d-none");
    qtyInput.removeAttribute("required");
  } else {
    eqFields.classList.add("d-none");
    accFields.classList.remove("d-none");
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

// --- BOX ACCESSORIES (SET ITEMS) IN MASTER CREATION ---
function addBoxItem() {
  const nameInput = document.getElementById("box_item_name");
  const qtyInput = document.getElementById("box_item_qty");
  const name = nameInput.value.trim();
  const qty = parseInt(qtyInput.value) || 1;

  if (!name) {
    alert("Please enter a box item name (e.g. Battery, Charger)");
    return;
  }

  const existing = currentBoxItems.find(
    (b) => b.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) {
    existing.qty += qty;
    existing.originalQty = existing.qty;
  } else {
    currentBoxItems.push({
      name: name,
      qty: qty,
      originalQty: qty,
    });
  }

  nameInput.value = "";
  qtyInput.value = "1";
  renderBoxItemChips();
}

function removeBoxItem(index) {
  currentBoxItems.splice(index, 1);
  renderBoxItemChips();
}

function renderBoxItemChips() {
  const container = document.getElementById("box_items_container");
  if (!container) return;
  if (currentBoxItems.length === 0) {
    container.innerHTML =
      '<small class="text-muted" id="empty_box_text">No box items added to set yet.</small>';
    return;
  }
  container.innerHTML = currentBoxItems
    .map(
      (b, idx) => `
        <span class="box-item-chip">
            <i class="bi bi-box me-1"></i>${b.name} (${b.qty}) 
            <i class="bi bi-x-circle-fill text-danger ms-1" style="cursor:pointer;" onclick="removeBoxItem(${idx})"></i>
        </span>
    `,
    )
    .join("");
}

// --- INTER-SET BORROW & ACCESSORY TRANSFER SYSTEM ---
function updateTransferDropdowns() {
  const fromSelect = document.getElementById("t_from_set");
  const toSelect = document.getElementById("t_to_set");
  if (!fromSelect || !toSelect) return;

  const equipmentList = inventory.filter((i) => i.type === "EQUIPMENT");

  const currentFrom = fromSelect.value;
  const currentTo = toSelect.value;

  fromSelect.innerHTML = '<option value="">-- Select Source Set --</option>';
  toSelect.innerHTML = '<option value="">-- Select Destination Set --</option>';

  equipmentList.forEach((eq) => {
    const serials = formatSerialText(eq.serial, eq.equipmentSerial);
    const modelStr =
      eq.model && eq.model !== "N/A" ? `(Model: ${eq.model}) ` : "";

    const optFrom = document.createElement("option");
    optFrom.value = eq.id;
    optFrom.textContent = `${eq.name} ${modelStr}(${serials})`;
    fromSelect.appendChild(optFrom);

    const optTo = document.createElement("option");
    optTo.value = eq.id;
    optTo.textContent = `${eq.name} ${modelStr}(${serials})`;
    toSelect.appendChild(optTo);
  });

  if (currentFrom) fromSelect.value = currentFrom;
  if (currentTo) toSelect.value = currentTo;
}

function updateSourceBoxAccessoriesDropdown() {
  const fromId = parseInt(document.getElementById("t_from_set").value);
  const accSelect = document.getElementById("t_accessory_item");
  if (!accSelect) return;

  accSelect.innerHTML = '<option value="">-- Select Accessory --</option>';

  if (!fromId) return;

  const sourceEq = inventory.find((i) => i.id === fromId);
  if (sourceEq && sourceEq.boxItems && sourceEq.boxItems.length > 0) {
    sourceEq.boxItems.forEach((b, idx) => {
      if (b.qty > 0) {
        const opt = document.createElement("option");
        opt.value = idx;
        opt.textContent = `${b.name} (Available in set: ${b.qty})`;
        accSelect.appendChild(opt);
      }
    });
  } else {
    accSelect.innerHTML =
      '<option value="">No box accessories in source set!</option>';
  }
}

function processBoxTransfer(e) {
  e.preventDefault();
  const fromId = parseInt(document.getElementById("t_from_set").value);
  const accIndex = parseInt(document.getElementById("t_accessory_item").value);
  const toId = parseInt(document.getElementById("t_to_set").value);
  const qty = parseInt(document.getElementById("t_qty").value) || 1;
  const reason = document.getElementById("t_reason").value.trim();

  if (fromId === toId) {
    alert("Source Set and Destination Set cannot be the same!");
    return;
  }

  const sourceEq = inventory.find((i) => i.id === fromId);
  const destEq = inventory.find((i) => i.id === toId);

  if (!sourceEq || !destEq) {
    alert("Invalid Equipment Set selection!");
    return;
  }

  if (isNaN(accIndex) || !sourceEq.boxItems || !sourceEq.boxItems[accIndex]) {
    alert("Please select a valid accessory to borrow!");
    return;
  }

  const sourceBoxItem = sourceEq.boxItems[accIndex];

  if (qty > sourceBoxItem.qty) {
    alert(
      `Cannot borrow ${qty} x ${sourceBoxItem.name}. Only ${sourceBoxItem.qty} available in source set!`,
    );
    return;
  }

  // Deduct quantity from Source Set
  sourceBoxItem.qty -= qty;

  // Add/Increment quantity in Destination Set
  if (!destEq.boxItems) destEq.boxItems = [];
  const destBoxItem = destEq.boxItems.find(
    (b) => b.name.toLowerCase() === sourceBoxItem.name.toLowerCase(),
  );

  if (destBoxItem) {
    destBoxItem.qty += qty;
  } else {
    destEq.boxItems.push({
      name: sourceBoxItem.name,
      qty: qty,
      originalQty: 0, // Transferred in, so original base is 0
      borrowedIn: true,
    });
  }

  // Create Borrow/Transfer Log Record
  const transferLog = {
    id: Date.now(),
    date: new Date().toLocaleDateString(),
    sourceId: sourceEq.id,
    sourceSerial: sourceEq.serial,
    sourceName: sourceEq.name,
    destId: destEq.id,
    destSerial: destEq.serial,
    destName: destEq.name,
    itemName: sourceBoxItem.name,
    qty: qty,
    reason: reason,
    active: true,
  };

  borrowedTransfers.unshift(transferLog);

  document.getElementById("transferForm").reset();
  alert(
    `✅ Successfully transferred ${qty} x ${sourceBoxItem.name} from ${sourceEq.name} (${sourceEq.serial}) to ${destEq.name} (${destEq.serial})`,
  );

  saveData();
}

function returnBorrowedAccessory(transferId) {
  const transfer = borrowedTransfers.find((t) => t.id === transferId);
  if (!transfer || !transfer.active) return;

  if (
    confirm(
      `Return ${transfer.qty} x ${transfer.itemName} back to original set ${transfer.sourceName} (${transfer.sourceSerial})?`,
    )
  ) {
    const sourceEq = inventory.find((i) => i.id === transfer.sourceId);
    const destEq = inventory.find((i) => i.id === transfer.destId);

    if (sourceEq) {
      if (!sourceEq.boxItems) sourceEq.boxItems = [];
      const sItem = sourceEq.boxItems.find(
        (b) => b.name.toLowerCase() === transfer.itemName.toLowerCase(),
      );
      if (sItem) {
        sItem.qty += transfer.qty;
      } else {
        sourceEq.boxItems.push({
          name: transfer.itemName,
          qty: transfer.qty,
          originalQty: transfer.qty,
        });
      }
    }

    if (destEq && destEq.boxItems) {
      const dItem = destEq.boxItems.find(
        (b) => b.name.toLowerCase() === transfer.itemName.toLowerCase(),
      );
      if (dItem) {
        dItem.qty -= transfer.qty;
        if (dItem.qty <= 0 && dItem.originalQty === 0) {
          destEq.boxItems = destEq.boxItems.filter(
            (b) => b.name.toLowerCase() !== transfer.itemName.toLowerCase(),
          );
        }
      }
    }

    transfer.active = false;
    saveData();
    alert(
      `✅ ${transfer.qty} x ${transfer.itemName} returned to ${transfer.sourceName}!`,
    );
  }
}

function renderBorrowedList() {
  const container = document.getElementById("borrowed_list_container");
  if (!container) return;

  const activeTransfers = borrowedTransfers.filter((t) => t.active);

  if (activeTransfers.length === 0) {
    container.innerHTML =
      '<small class="text-muted">No accessories currently borrowed or transferred between sets.</small>';
    return;
  }

  container.innerHTML = activeTransfers
    .map(
      (t) => `
        <div class="p-2 mb-2 bg-white border rounded d-flex justify-content-between align-items-center">
            <div>
                <span class="badge bg-warning text-dark me-1"><i class="bi bi-arrow-left-right me-1"></i>Transferred</span>
                <strong>${t.itemName} (x${t.qty})</strong>
                <div class="small text-muted">
                    From: <b class="text-primary">${t.sourceName} (${t.sourceSerial})</b> &rarr; To: <b class="text-success">${t.destName} (${t.destSerial})</b>
                </div>
                <div class="small text-muted"><i>Reason: ${t.reason}</i> (${t.date})</div>
            </div>
            <div>
                <button class="btn btn-sm btn-outline-success py-1 px-2" onclick="returnBorrowedAccessory(${t.id})">
                    <i class="bi bi-box-arrow-in-left me-1"></i> Return to Original Set
                </button>
            </div>
        </div>
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
    const model = document.getElementById("m_model").value.trim() || "N/A";
    const serial = document.getElementById("m_serial").value.trim() || "N/A";
    const equipmentSerial =
      document.getElementById("m_eq_serial").value.trim() || "N/A";
    const condition = document.getElementById("m_condition").value;
    const problems = document.getElementById("m_problems").value.trim();

    if (serial !== "N/A") {
      const duplicateItem = inventory.find(
        (item) =>
          item.type === "EQUIPMENT" &&
          item.serial &&
          item.serial !== "N/A" &&
          item.serial.toLowerCase() === serial.toLowerCase(),
      );
      if (duplicateItem) {
        alert(`⚠️ Warning: Duplicate Office Serial Number "${serial}" exists!`);
        return;
      }
    }

    inventory.push({
      id: Date.now(),
      type: "EQUIPMENT",
      name: name,
      model: model,
      serial: serial,
      equipmentSerial: equipmentSerial,
      quantity: 1,
      condition: condition,
      problems: problems || "No reported issues",
      boxItems: JSON.parse(JSON.stringify(currentBoxItems)),
      isIssued: false,
      exported: false,
    });

    document.getElementById("m_model").value = "";
    document.getElementById("m_serial").value = "";
    document.getElementById("m_eq_serial").value = "";
    document.getElementById("m_problems").value = "";
    currentBoxItems = [];
    renderBoxItemChips();
    alert(
      `✅ ${name} ${model !== "N/A" ? `(${model})` : ""} added to master inventory.`,
    );
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
        model: "N/A",
        serial: "N/A",
        equipmentSerial: "N/A",
        quantity: qty,
        condition: "Good",
        problems: "Standard Stock",
        boxItems: [],
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
    if (typeof deleteFromFirebase === "function") {
      deleteFromFirebase("asset_inventory", id);
    }
  }
}

// --- RENDER MULTI-ITEM ISSUE CHECKBOXES ---
function renderMultiItemSelection() {
  const container = document.getElementById("multi_item_container");
  if (!container) return;
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
      let boxChips = "";
      if (item.boxItems && item.boxItems.length > 0) {
        boxChips = `<div class="mt-1">${item.boxItems.map((b) => `<span class="box-item-chip"><i class="bi bi-box me-1"></i>${b.name} (${b.qty})</span>`).join("")}</div>`;
      }

      const serialsStr = formatSerialText(item.serial, item.equipmentSerial);
      const modelStr =
        item.model && item.model !== "N/A" ? `Model: ${item.model} | ` : "";

      html += `
                <div class="form-check py-1 border-bottom border-light">
                    <input class="form-check-input issue-checkbox" type="checkbox" data-type="EQUIPMENT" data-id="${item.id}" id="chk_${item.id}">
                    <label class="form-check-label w-100" for="chk_${item.id}">
                        <div class="d-flex justify-content-between align-items-center">
                            <span><strong>${item.name}</strong> <small class="text-primary">(${modelStr}${serialsStr})</small></span>
                            <span class="badge bg-light text-dark border">${item.condition}</span>
                        </div>
                        ${boxChips}
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
        model: item.model || "N/A",
        serial: item.serial || "N/A",
        equipmentSerial: item.equipmentSerial || "N/A",
        boxItems: item.boxItems
          ? JSON.parse(JSON.stringify(item.boxItems))
          : [],
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
        model: "N/A",
        serial: `ACC-ISSUE (Qty: ${issueQty})`,
        equipmentSerial: "N/A",
        boxItems: [],
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
function toggleLostTypeFields() {
  const targetType = document.getElementById("l_target_type").value;
  const boxItemDiv = document.getElementById("lost_box_item_div");
  const boxQtyDiv = document.getElementById("lost_box_qty_div");

  if (targetType === "BOX_ITEM") {
    boxItemDiv.classList.remove("d-none");
    boxQtyDiv.classList.remove("d-none");
  } else {
    boxItemDiv.classList.add("d-none");
    boxQtyDiv.classList.add("d-none");
  }
}

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
      opt.value = i.id;
      const serialsStr = formatSerialText(i.serial, i.equipmentSerial);
      opt.textContent = `${i.model && i.model !== "N/A" ? `Model: ${i.model} | ` : ""}${serialsStr} ${i.isIssued ? "(Issued)" : "(In Stock)"}`;
    } else {
      opt.value = i.id;
      opt.textContent = `Accessory Stock (${i.quantity} available)`;
    }
    serialSelect.appendChild(opt);
  });

  updateLostBoxItemsDropdown();
}

function updateLostBoxItemsDropdown() {
  const targetType = document.getElementById("l_target_type").value;
  if (targetType !== "BOX_ITEM") return;

  const selectedId = parseInt(document.getElementById("l_serial").value);
  const boxItemSelect = document.getElementById("l_box_item");

  boxItemSelect.innerHTML =
    '<option value="">-- Select Box Accessory --</option>';

  if (!selectedId) return;

  const item = inventory.find((i) => i.id === selectedId);
  if (item && item.boxItems && item.boxItems.length > 0) {
    item.boxItems.forEach((b, idx) => {
      if (b.qty > 0) {
        const opt = document.createElement("option");
        opt.value = idx;
        opt.textContent = `${b.name} (Qty in set: ${b.qty})`;
        boxItemSelect.appendChild(opt);
      }
    });
  } else {
    boxItemSelect.innerHTML =
      '<option value="">No box accessories in this set!</option>';
  }
}

function reportLostEquipment(e) {
  e.preventDefault();
  const date = document.getElementById("l_date").value;
  const person = document.getElementById("l_person").value.trim();
  const targetType = document.getElementById("l_target_type").value;
  const name = document.getElementById("l_name").value;
  const itemVal = document.getElementById("l_serial").value;
  const incident = document.getElementById("l_incident").value.trim();
  const fir = document.getElementById("l_fir").value.trim() || "N/A";
  const recovery = document.getElementById("l_recovery").value;
  const fineAmount =
    document.getElementById("l_fine_amount").value.trim() || "N/A";

  const itemId = parseInt(itemVal);
  const itemIndex = inventory.findIndex(
    (i) => i.id === itemId || (i.name === name && i.type === "ACCESSORY"),
  );

  if (itemIndex === -1) {
    alert("Item not found in inventory!");
    return;
  }

  const item = inventory[itemIndex];

  if (targetType === "BOX_ITEM") {
    const boxItemIdx = parseInt(document.getElementById("l_box_item").value);
    const lostQty = parseInt(document.getElementById("l_qty").value) || 1;

    if (isNaN(boxItemIdx) || !item.boxItems || !item.boxItems[boxItemIdx]) {
      alert("Please select a valid box accessory component that was lost!");
      return;
    }

    const boxComp = item.boxItems[boxItemIdx];
    if (lostQty > boxComp.qty) {
      alert(
        `Cannot report ${lostQty} lost. Only ${boxComp.qty} present in this set!`,
      );
      return;
    }

    if (
      !confirm(
        `Are you sure you want to report ${lostQty} x ${boxComp.name} as LOST from set ${name}?`,
      )
    )
      return;

    boxComp.qty -= lostQty;

    issueLogs.unshift({
      id: Date.now(),
      groupId: "LOST-ACC-" + Date.now(),
      type: "LOST",
      itemType: "BOX_ACCESSORY",
      issueDate: date,
      returnDate: "N/A",
      leader: person,
      receiver: person,
      returner: "N/A",
      mismatchReason: "",
      projectId: "SET ACCESSORY LOST",
      members: [],
      name: `${name} [Lost Box Part: ${boxComp.name} (x${lostQty})]`,
      model: item.model || "N/A",
      serial: item.serial || "N/A",
      equipmentSerial: item.equipmentSerial || "N/A",
      boxItems: [
        { name: boxComp.name, qty: lostQty, originalQty: boxComp.originalQty },
      ],
      issueCondition: "PARTIAL SET LOST",
      issueProblems: `Box Item (${boxComp.name} x${lostQty}) Lost | Incident: ${incident} | FIR: ${fir} | Action: ${recovery}`,
      returnCondition: "INCOMPLETE SET",
      returnProblems: `Set Accessory ${boxComp.name} missing`,
      remarks: incident,
      fineAmount: fineAmount,
      active: false,
      exported: false,
    });

    alert(
      `✅ Lost accessory report submitted. ${lostQty} x ${boxComp.name} deducted from equipment set.`,
    );
  } else {
    if (!confirm(`Are you sure you want to report entire ${name} as LOST?`))
      return;

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
      model: item.model || "N/A",
      serial: item.serial || "N/A",
      equipmentSerial: item.equipmentSerial || "N/A",
      boxItems: item.boxItems ? JSON.parse(JSON.stringify(item.boxItems)) : [],
      issueCondition: "LOST",
      issueProblems: `FULL ITEM LOST | Incident: ${incident} | FIR: ${fir} | Recovery: ${recovery}`,
      returnCondition: "LOST",
      returnProblems: "ITEM MISSING FROM STOCK",
      remarks: incident,
      fineAmount: fineAmount,
      active: false,
      exported: false,
    });

    alert("Full item lost report submitted! Item removed from master stock.");
  }

  document.getElementById("lostForm").reset();
  document.getElementById("l_date").valueAsDate = new Date();
  toggleLostTypeFields();
  saveData();
}

// --- RETURN SINGLE ITEM MODAL LOGIC ---
let originalReceiver = "";

function openReturnModal(logId) {
  const log = issueLogs.find((l) => l.id === logId);
  if (!log) return;

  originalReceiver = log.receiver || log.leader;

  document.getElementById("modal_log_id").value = log.id;
  document.getElementById("modal_eq_name").innerText = log.name;

  const modelStr =
    log.model && log.model !== "N/A" ? `Model: ${log.model} | ` : "";
  const serialsStr = formatSerialText(log.serial, log.equipmentSerial);
  document.getElementById("modal_eq_serial").innerText =
    `${modelStr}${serialsStr}`;

  document.getElementById("modal_project_id").innerText =
    log.projectId || "N/A";
  document.getElementById("modal_issue_receiver").innerText = originalReceiver;
  document.getElementById("modal_issue_cond").innerText = log.issueCondition;
  document.getElementById("modal_issue_prob").innerText =
    log.issueProblems || "None";

  const boxContainer = document.getElementById("modal_eq_box_items");
  if (boxContainer) {
    if (log.boxItems && log.boxItems.length > 0) {
      boxContainer.innerHTML = log.boxItems
        .map(
          (b) =>
            `<span class="box-item-chip"><i class="bi bi-box me-1"></i>${b.name} (x${b.qty})</span>`,
        )
        .join("");
    } else {
      boxContainer.innerHTML =
        '<small class="text-muted">No box items registered with this set.</small>';
    }
  }

  document.getElementById("r_is_lost").value = "NO";
  document.getElementById("r_date").valueAsDate = new Date();
  document.getElementById("r_returner").value = originalReceiver;
  document.getElementById("r_condition").value = log.issueCondition;
  document.getElementById("r_problems").value =
    log.issueProblems !== "No reported issues" ? log.issueProblems : "";
  document.getElementById("r_fine_amount").value = "";

  toggleReturnLostFields();
  checkPersonMismatch();

  returnModalObj = new bootstrap.Modal(document.getElementById("returnModal"));
  returnModalObj.show();
}

function toggleReturnLostFields() {
  const isLost = document.getElementById("r_is_lost").value;
  const divCond = document.getElementById("div_r_cond");
  const divProb = document.getElementById("div_r_prob");
  const divFine = document.getElementById("div_r_fine");
  const lblReturner = document.getElementById("lbl_returner");
  const btnSubmit = document.getElementById("btn_return_submit");

  if (isLost === "YES") {
    divCond.classList.add("d-none");
    divFine.classList.remove("d-none");
    lblReturner.innerText = "Person Held Responsible / Reported By";
    divProb.querySelector("label").innerText =
      "Explain Incident / How it was lost in site";
    document.getElementById("r_problems").placeholder =
      "e.g. Lost in river survey / Stolen from site...";
    btnSubmit.className =
      "w-full py-3 bg-status-alert text-white rounded-xl text-sm font-bold hover:opacity-95 transition-all flex items-center justify-center gap-2 shadow-sm";
    btnSubmit.innerHTML =
      '<span class="material-symbols-outlined text-lg">warning</span> Confirm Item Lost at Site';
  } else {
    divCond.classList.remove("d-none");
    divFine.classList.add("d-none");
    lblReturner.innerText = "Person Returning Item";
    divProb.querySelector("label").innerText = "Updated Defect Details";
    document.getElementById("r_problems").placeholder =
      "Any new defects details...";
    btnSubmit.className =
      "w-full py-3 bg-status-success text-white rounded-xl text-sm font-bold hover:opacity-95 transition-all flex items-center justify-center gap-2 shadow-sm";
    btnSubmit.innerHTML =
      '<span class="material-symbols-outlined text-lg">published_with_changes</span> Confirm Single Item Return';
  }
}

function checkPersonMismatch() {
  const returner = document.getElementById("r_returner").value.trim();
  const mismatchDiv = document.getElementById("mismatch_reason_div");
  if (
    returner.toLowerCase() !== originalReceiver.toLowerCase() &&
    returner !== ""
  ) {
    mismatchDiv.classList.remove("d-none");
  } else {
    mismatchDiv.classList.add("d-none");
  }
}

function submitReturn(e) {
  e.preventDefault();
  const logId = parseInt(document.getElementById("modal_log_id").value);
  const isLost = document.getElementById("r_is_lost").value;
  const returnDate = document.getElementById("r_date").value;
  const returner = document.getElementById("r_returner").value.trim();
  const mismatchReason = document
    .getElementById("r_mismatch_reason")
    .value.trim();

  const log = issueLogs.find((l) => l.id === logId);
  if (!log) return;

  if (isLost === "YES") {
    const lostDetails =
      document.getElementById("r_problems").value.trim() ||
      "Lost at site during work";
    const fineAmt =
      document.getElementById("r_fine_amount").value.trim() || "N/A";

    log.active = false;
    log.type = "LOST";
    log.returnDate = returnDate;
    log.returner = returner;
    log.returnCondition = "LOST AT SITE";
    log.returnProblems = `LOST AT SITE | Details: ${lostDetails}`;
    log.mismatchReason = mismatchReason;
    log.fineAmount = fineAmt;
    log.exported = false;

    const invIndex = inventory.findIndex(
      (i) =>
        (i.serial && i.serial !== "N/A" && i.serial === log.serial) ||
        (i.type === "ACCESSORY" && i.name === log.name),
    );
    if (invIndex !== -1) {
      const item = inventory[invIndex];
      if (item.type === "EQUIPMENT") {
        inventory.splice(invIndex, 1);
      } else {
        item.quantity = Math.max(0, item.quantity - 1);
      }
    }

    alert(
      "⚠️ Equipment recorded as LOST AT SITE! Master inventory updated and moved to incident history.",
    );
  } else {
    const returnCond = document.getElementById("r_condition").value;
    const returnProbs =
      document.getElementById("r_problems").value.trim() ||
      "No reported issues";

    log.active = false;
    log.returnDate = returnDate;
    log.returner = returner;
    log.returnCondition = returnCond;
    log.returnProblems = returnProbs;
    log.mismatchReason = mismatchReason;
    log.exported = false;

    if (log.itemType === "EQUIPMENT") {
      const item = inventory.find(
        (i) =>
          (i.serial && i.serial !== "N/A" && i.serial === log.serial) ||
          i.name === log.name,
      );
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
          model: "N/A",
          serial: "N/A",
          equipmentSerial: "N/A",
          quantity: qtyToReturn,
          condition: returnCond,
          problems: returnProbs,
          boxItems: [],
          isIssued: false,
          exported: false,
        });
      }
    }
    alert("Item successfully returned to stock!");
  }

  returnModalObj.hide();
  saveData();
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

  updateTransferDropdowns();
}

// --- RENDER TABLES & PANELS ---
function renderAll() {
  renderSummaryTable();
  renderMasterTable();
  renderMultiItemSelection();
  renderIssueDropdowns();
  renderBorrowedList();
  renderLogs();
  if (typeof updateEmployeeDatalist === "function") updateEmployeeDatalist();
  if (typeof renderEmployees === "function") renderEmployees();
  if (typeof renderAttendancePanel === "function") renderAttendancePanel();
  if (typeof updateSourceBoxAccessoriesDropdown === "function")
    updateSourceBoxAccessoriesDropdown();
}

function renderSummaryTable() {
  const tbody = document.querySelector("#summaryTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const summary = {};
  let totalUnits = 0;
  let totalAvail = 0;
  let totalIssued = 0;

  inventory.forEach((item) => {
    if (!summary[item.name])
      summary[item.name] = { total: 0, available: 0, type: item.type };

    if (item.type === "EQUIPMENT") {
      summary[item.name].total += 1;
      totalUnits += 1;
      if (!item.isIssued) {
        summary[item.name].available += 1;
        totalAvail += 1;
      } else {
        totalIssued += 1;
      }
    } else {
      summary[item.name].total += item.quantity;
      summary[item.name].available += item.quantity;
      totalUnits += item.quantity;
      totalAvail += item.quantity;
    }
  });

  const keys = Object.keys(summary);
  document.getElementById("totalEquipmentTypes").innerText =
    `${keys.length} Items`;

  const statTypes = document.getElementById("stat_total_types");
  const statUnits = document.getElementById("stat_total_units");
  const statAvail = document.getElementById("stat_avail_units");
  const statIssued = document.getElementById("stat_issued_units");

  if (statTypes) statTypes.innerText = keys.length;
  if (statUnits) statUnits.innerText = totalUnits;
  if (statAvail) statAvail.innerText = totalAvail;
  if (statIssued) statIssued.innerText = totalIssued;

  if (keys.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="3" class="text-center text-muted py-3">No items added yet.</td></tr>';
    return;
  }

  keys.forEach((name) => {
    const avail = summary[name].available;
    const badgeStyle =
      avail > 0
        ? "bg-status-success/10 text-status-success border border-status-success/30"
        : "bg-status-alert/10 text-status-alert border border-status-alert/30";

    tbody.innerHTML += `
      <tr class="hover:bg-surface-container-low/50 transition-colors">
        <td class="px-4 py-3 align-middle text-left">
          <div class="font-bold text-text-primary text-xs sm:text-sm">${name}</div>
          <div class="text-[10px] text-text-secondary font-semibold tracking-wider uppercase inline-block bg-surface-container-high/60 px-2 py-0.5 rounded mt-0.5">${summary[name].type}</div>
        </td>
        <td class="px-4 py-3 align-middle text-center font-bold text-text-primary text-sm">${summary[name].total}</td>
        <td class="px-4 py-3 align-middle text-right">
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${badgeStyle} inline-block whitespace-nowrap">${avail} Available</span>
        </td>
      </tr>
    `;
  });
}

function renderMasterTable() {
  const tbody = document.querySelector("#masterTable tbody");
  if (!tbody) return;
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

      // Set Integrity Check
      let isSetIncomplete = false;
      let missingDetails = [];

      if (item.boxItems) {
        item.boxItems.forEach((b) => {
          if (b.originalQty && b.qty < b.originalQty) {
            isSetIncomplete = true;
            missingDetails.push(
              `${b.name} (Missing: ${b.originalQty - b.qty})`,
            );
          }
        });
      }

      let setIntegrityBadge = isSetIncomplete
        ? `<div class="mt-1.5"><span class="badge badge-incomplete"><i class="bi bi-exclamation-triangle-fill me-1"></i>INCOMPLETE SET (${missingDetails.join(", ")})</span></div>`
        : item.boxItems && item.boxItems.length > 0
          ? `<div class="mt-1.5"><span class="badge bg-status-success/10 text-status-success border border-status-success/30" style="font-size:0.7rem;"><i class="bi bi-check-circle me-1"></i>COMPLETE SET</span></div>`
          : "";

      let boxChips = "";
      if (item.boxItems && item.boxItems.length > 0) {
        boxChips = `<div class="mt-1.5 flex flex-wrap gap-1">${item.boxItems.map((b) => `<span class="box-item-chip"><i class="bi bi-box me-1"></i>${b.name} (${b.qty})</span>`).join("")}</div>`;
      }

      const serialsStr = formatSerialText(item.serial, item.equipmentSerial);
      const serialsHtml =
        serialsStr !== "N/A"
          ? `<div class="font-mono text-xs text-primary font-bold tracking-tight leading-snug">${serialsStr}</div>`
          : `<span class="text-xs text-text-secondary font-mono">N/A</span>`;

      const modelHtml =
        item.model && item.model !== "N/A"
          ? `<div class="text-[11px] text-text-secondary font-medium leading-snug mt-1">Model: <span class="font-semibold text-text-primary">${item.model}</span></div>`
          : "";

      tbody.innerHTML += `
        <tr class="hover:bg-surface-container-low/50 transition-colors">
          <td class="px-4 py-3.5 align-middle">
            <div class="flex flex-col gap-0.5">
              ${serialsHtml}
              ${modelHtml}
            </div>
          </td>
          <td class="px-4 py-3.5 align-middle">
            <div class="font-bold text-text-primary text-xs sm:text-sm">${item.name}</div>
            ${setIntegrityBadge}
            ${boxChips}
          </td>
          <td class="px-4 py-3.5 align-middle text-center">
            <div class="inline-flex flex-col items-center gap-1">
              <span class="condition-badge ${condClass}">${item.condition}</span>
              <span class="text-[11px] text-text-secondary font-normal block leading-tight whitespace-normal max-w-[140px]">${item.problems || "No reported issues"}</span>
            </div>
          </td>
          <td class="px-4 py-3.5 align-middle text-center">
            ${statusBadge}
          </td>
          <td class="px-4 py-3.5 align-middle text-right">
            <button class="p-1.5 text-status-alert hover:bg-status-alert/15 rounded-lg transition-colors inline-flex items-center justify-center border border-status-alert/20" onclick="deleteMasterItem(${item.id})" title="Delete Item">
              <span class="material-symbols-outlined text-base">delete</span>
            </button>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML += `
        <tr class="hover:bg-surface-container-low/50 transition-colors bg-status-warning/5">
          <td class="px-4 py-3.5 align-middle"><span class="badge badge-accessory">ACCESSORY</span></td>
          <td class="px-4 py-3.5 align-middle font-bold text-text-primary text-xs sm:text-sm">${item.name}</td>
          <td class="px-4 py-3.5 align-middle text-center"><span class="text-xs text-text-secondary">Loose Consumable Item</span></td>
          <td class="px-4 py-3.5 align-middle text-center"><span class="badge bg-surface-container-high text-text-primary border border-surface-border">Qty: ${item.quantity}</span></td>
          <td class="px-4 py-3.5 align-middle text-right">
            <button class="p-1.5 text-status-alert hover:bg-status-alert/15 rounded-lg transition-colors inline-flex items-center justify-center border border-status-alert/20" onclick="deleteMasterItem(${item.id})" title="Delete Item">
              <span class="material-symbols-outlined text-base">delete</span>
            </button>
          </td>
        </tr>
      `;
    }
  });
}

function renderLogs() {
  const pendingTbody = document.querySelector("#pendingLogTable tbody");
  const returnedTbody = document.querySelector("#returnedLogTable tbody");
  const queryInput = document.getElementById("searchLog");
  if (!pendingTbody || !returnedTbody || !queryInput) return;

  const query = queryInput.value.toLowerCase();

  pendingTbody.innerHTML = "";
  returnedTbody.innerHTML = "";

  const filteredLogs = issueLogs.filter(
    (l) =>
      l.leader.toLowerCase().includes(query) ||
      (l.receiver && l.receiver.toLowerCase().includes(query)) ||
      (l.returner && l.returner.toLowerCase().includes(query)) ||
      l.name.toLowerCase().includes(query) ||
      (l.model && l.model.toLowerCase().includes(query)) ||
      (l.serial && l.serial.toLowerCase().includes(query)) ||
      (l.equipmentSerial && l.equipmentSerial.toLowerCase().includes(query)) ||
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

      let boxChips = "";
      if (log.boxItems && log.boxItems.length > 0) {
        boxChips = `<div class="mt-1">${log.boxItems.map((b) => `<span class="box-item-chip"><i class="bi bi-box me-1"></i>${b.name} (x${b.qty})</span>`).join("")}</div>`;
      }

      const serialsStr = formatSerialText(log.serial, log.equipmentSerial);
      const modelStr =
        log.model && log.model !== "N/A"
          ? `<div class="small text-muted">Model: <b>${log.model}</b></div>`
          : "";

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
                        ${modelStr}
                        <small class="text-muted">Serials: <b>${serialsStr}</b></small>
                        ${boxChips}
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
      const serialsStr = formatSerialText(log.serial, log.equipmentSerial);
      const modelStr =
        log.model && log.model !== "N/A"
          ? `<div class="small text-muted">Model: <b>${log.model}</b></div>`
          : "";

      if (log.type === "LOST") {
        returnedTbody.innerHTML += `
                    <tr class="table-danger">
                        <td><span class="badge badge-lost mb-1">LOST REPORT</span><br><small class="fw-bold">${log.issueDate}</small></td>
                        <td><span class="badge bg-danger">MISSING</span></td>
                        <td><div class="fw-bold">${log.leader}</div><small class="text-muted">In-Charge / Receiver: <b>${log.receiver || log.leader}</b></small></td>
                        <td>
                          <div class="fw-bold text-danger">${log.name}</div>
                          ${modelStr}
                          <small>Serials: <b>${serialsStr}</b></small>
                        </td>
                        <td>
                            <small class="d-block">${log.issueProblems || log.returnProblems}</small>
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

      let boxChips = "";
      if (log.boxItems && log.boxItems.length > 0) {
        boxChips = `<div class="mt-1">${log.boxItems.map((b) => `<span class="box-item-chip"><i class="bi bi-box me-1"></i>${b.name} (x${b.qty})</span>`).join("")}</div>`;
      }

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
                        ${modelStr}
                        <small class="text-muted">Serials: <b>${serialsStr}</b></small>
                        ${boxChips}
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
  if (issueLogs.length === 0 && borrowedTransfers.length === 0) {
    alert("No movement or incident logs available to reset.");
    return;
  }

  if (
    confirm(
      "To reset Part 2 Logs & Inter-set transfers, you MUST first download the backup CSV file.\n\nClick OK to open download options.",
    )
  ) {
    pendingReset = true;
    openExportModal();
  }
}

// --- EXPORT MODAL & CSV EXPORT WITH DYNAMIC DAILY TIMESTAMP & DATE RANGE ---
function toggleExportScopeFields() {
  const scopeEl = document.querySelector('input[name="exportScope"]:checked');
  const scope = scopeEl ? scopeEl.value : "ALL";
  const monthDiv = document.getElementById("exp_month_container");
  const rangeDiv = document.getElementById("exp_date_range_container");
  const monthInput = document.getElementById("exp_month");
  const startInput = document.getElementById("exp_start_date");
  const endInput = document.getElementById("exp_end_date");

  if (scope === "DATE_RANGE") {
    if (monthDiv) monthDiv.classList.add("hidden");
    if (rangeDiv) rangeDiv.classList.remove("hidden");
    if (monthInput) monthInput.removeAttribute("required");
    if (startInput) startInput.setAttribute("required", "required");
    if (endInput) endInput.setAttribute("required", "required");
  } else {
    if (monthDiv) monthDiv.classList.remove("hidden");
    if (rangeDiv) rangeDiv.classList.add("hidden");
    if (monthInput) monthInput.setAttribute("required", "required");
    if (startInput) startInput.removeAttribute("required");
    if (endInput) endInput.removeAttribute("required");
  }
}

function openExportModal() {
  const now = new Date();
  const yearMonth = now.toISOString().substring(0, 7);
  const todayStr = now.toISOString().substring(0, 10);

  const expMonth = document.getElementById("exp_month");
  if (expMonth && !expMonth.value) expMonth.value = yearMonth;

  const startDateInput = document.getElementById("exp_start_date");
  const endDateInput = document.getElementById("exp_end_date");
  if (startDateInput && !startDateInput.value) {
    startDateInput.value = `${yearMonth}-01`;
  }
  if (endDateInput && !endDateInput.value) {
    endDateInput.value = todayStr;
  }

  toggleExportScopeFields();
  exportModalObj = new bootstrap.Modal(document.getElementById("exportModal"));
  exportModalObj.show();
}

function processExport(e) {
  e.preventDefault();
  const scopeEl = document.querySelector('input[name="exportScope"]:checked');
  const scope = scopeEl ? scopeEl.value : "ALL";
  const selectedMonth = document.getElementById("exp_month").value;
  const startDate = document.getElementById("exp_start_date").value;
  const endDate = document.getElementById("exp_end_date").value;

  let logsToExport = [];
  let inventoryToExport = [];
  let transfersToExport = [];
  let attendanceToExport = [];

  if (scope === "DATE_RANGE") {
    if (!startDate || !endDate) {
      alert("Please select both Start Date and End Date!");
      return;
    }
    if (startDate > endDate) {
      alert("Start Date cannot be later than End Date!");
      return;
    }

    logsToExport = issueLogs.filter((l) => {
      const issueD = l.issueDate ? l.issueDate.substring(0, 10) : "";
      const returnD = l.returnDate ? l.returnDate.substring(0, 10) : "";
      return (
        (issueD >= startDate && issueD <= endDate) ||
        (returnD >= startDate && returnD <= endDate)
      );
    });
    inventoryToExport = [...inventory];
    transfersToExport = borrowedTransfers.filter((t) => {
      const d = t.date ? t.date.substring(0, 10) : "";
      return d >= startDate && d <= endDate;
    });
    if (typeof attendanceLogs !== "undefined") {
      attendanceToExport = attendanceLogs.filter((a) => {
        const d = a.date ? a.date.substring(0, 10) : "";
        return d >= startDate && d <= endDate;
      });
    }
  } else if (scope === "ALL") {
    if (!selectedMonth) {
      alert("Please select a valid month!");
      return;
    }
    logsToExport = issueLogs.filter(
      (l) => l.issueDate.substring(0, 7) <= selectedMonth,
    );
    inventoryToExport = [...inventory];
    transfersToExport = [...borrowedTransfers];
    if (typeof attendanceLogs !== "undefined")
      attendanceToExport = [...attendanceLogs];
  } else {
    // NEW
    if (!selectedMonth) {
      alert("Please select a valid month!");
      return;
    }
    logsToExport = issueLogs.filter(
      (l) => l.issueDate.substring(0, 7) <= selectedMonth && !l.exported,
    );
    inventoryToExport = inventory.filter((i) => !i.exported);
    transfersToExport = borrowedTransfers.filter((t) => !t.exported);
    if (typeof attendanceLogs !== "undefined")
      attendanceToExport = attendanceLogs.filter((a) => !a.exported);
  }

  if (
    logsToExport.length === 0 &&
    inventoryToExport.length === 0 &&
    transfersToExport.length === 0 &&
    attendanceToExport.length === 0
  ) {
    alert("No data available for the selected export criteria!");
    return;
  }

  const now = new Date();
  const generatedAt = now.toLocaleString();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const mins = String(now.getMinutes()).padStart(2, "0");
  const dailyTimestamp = `${year}-${month}-${day}_${hours}-${mins}`;

  let csv = `========================================================================================================\n`;
  csv += `                               EQUIPMENT & ASSET MANAGEMENT REPORT                                      \n`;
  csv += `========================================================================================================\n`;
  if (scope === "DATE_RANGE") {
    csv += `Report Range : ${startDate} to ${endDate}\n`;
  } else {
    csv += `Report Month : ${selectedMonth}\n`;
  }
  csv += `Generated On : ${generatedAt}\n`;
  csv += `Data Scope   : ${
    scope === "ALL"
      ? "ALL HISTORICAL RECORDS"
      : scope === "NEW"
      ? "ONLY NEW / UN-DOWNLOADED DATA"
      : `CUSTOM DATE RANGE (${startDate} TO ${endDate})`
  }\n`;
  csv += `========================================================================================================\n\n`;

  // PART 1: MASTER STOCK INVENTORY & SET INTEGRITY
  csv += `--------------------------------------------------------------------------------------------------------\n`;
  csv += `PART 1: MASTER STOCK INVENTORY & SET INTEGRITY\n`;
  csv += `--------------------------------------------------------------------------------------------------------\n`;
  csv += `"ITEM TYPE","MODEL NUMBER","OFFICE SERIAL","EQUIPMENT SERIAL","ITEM NAME","SET INTEGRITY STATUS","BOX ACCESSORIES (CURRENT SET)","QUANTITY","INITIAL CONDITION","PROBLEM DETAILS","CURRENT STATUS"\n`;

  if (inventoryToExport.length === 0) {
    csv += `"No inventory items recorded."\n`;
  } else {
    inventoryToExport.forEach((i) => {
      let isIncomplete = false;
      let missingMsg = "COMPLETE SET";
      if (i.boxItems) {
        i.boxItems.forEach((b) => {
          if (b.originalQty && b.qty < b.originalQty) {
            isIncomplete = true;
            missingMsg = `INCOMPLETE (Missing ${b.originalQty - b.qty} x ${b.name})`;
          }
        });
      }

      const boxStr = i.boxItems
        ? i.boxItems.map((b) => `${b.name}(x${b.qty})`).join("; ")
        : "None";
      csv += `"${i.type}","${i.model || "N/A"}","${i.serial || "N/A"}","${i.equipmentSerial || "N/A"}","${i.name}","${missingMsg}","${boxStr}","${i.quantity}","${i.condition}","${i.problems || "None"}","${i.isIssued ? "ISSUED" : "AVAILABLE"}"\n`;
      i.exported = true;
    });
  }
  csv += `\n\n`;

  // INTER-SET TRANSFERS SECTION
  csv += `--------------------------------------------------------------------------------------------------------\n`;
  csv += `PART 1.5: INTER-SET BORROWED / TRANSFERRED ACCESSORIES\n`;
  csv += `--------------------------------------------------------------------------------------------------------\n`;
  csv += `"TRANSFER DATE","ACCESSORY ITEM","QTY","SOURCE SET","DESTINATION SET","REASON","STATUS"\n`;
  if (transfersToExport.length === 0) {
    csv += `"No inter-set transfers recorded."\n`;
  } else {
    transfersToExport.forEach((t) => {
      csv += `"${t.date}","${t.itemName}","${t.qty}","${t.sourceName} (${t.sourceSerial})","${t.destName} (${t.destSerial})","${t.reason}","${t.active ? "OUTSTANDING BORROWED" : "RETURNED TO ORIGINAL SET"}"\n`;
      t.exported = true;
    });
  }
  csv += `\n\n`;

  // PART 2.1
  const pendingLogsToExport = logsToExport.filter((l) => l.active === true);
  csv += `--------------------------------------------------------------------------------------------------------\n`;
  csv += `PART 2.1: RETURN PENDING / CURRENTLY ISSUED ITEMS\n`;
  csv += `--------------------------------------------------------------------------------------------------------\n`;
  csv += `"ISSUE GROUP ID","ISSUE DATE","PROJECT ID","TEAM LEADER","RECEIVER PERSON","TEAM MEMBERS","ITEM NAME","MODEL NUMBER","OFFICE SERIAL","EQUIPMENT SERIAL","INCLUDED BOX ACCESSORIES","ISSUE CONDITION","ISSUE PROBLEMS","REMARKS"\n`;

  if (pendingLogsToExport.length === 0) {
    csv += `"No pending issued items."\n`;
  } else {
    pendingLogsToExport.forEach((l) => {
      const membersStr = l.members ? l.members.join("; ") : "None";
      const boxStr = l.boxItems
        ? l.boxItems.map((b) => `${b.name}(x${b.qty})`).join("; ")
        : "None";
      csv += `"${l.groupId || "N/A"}","${l.issueDate}","${l.projectId || "N/A"}","${l.leader}","${l.receiver || ""}","${membersStr}","${l.name}","${l.model || "N/A"}","${l.serial || "N/A"}","${l.equipmentSerial || "N/A"}","${boxStr}","${l.issueCondition}","${l.issueProblems || "None"}","${l.remarks || ""}"\n`;
      l.exported = true;
    });
  }
  csv += `\n\n`;

  // PART 2.2
  const historyLogsToExport = logsToExport.filter((l) => l.active === false);
  csv += `--------------------------------------------------------------------------------------------------------\n`;
  csv += `PART 2.2: RETURNED & INCIDENT HISTORY LOGS\n`;
  csv += `--------------------------------------------------------------------------------------------------------\n`;
  csv += `"ISSUE GROUP ID","LOG TYPE","ISSUE DATE","RETURN DATE","PROJECT ID","TEAM LEADER","RECEIVER PERSON","RETURNED BY","MISMATCH REASON","TEAM MEMBERS","ITEM NAME","MODEL NUMBER","OFFICE SERIAL","EQUIPMENT SERIAL","INCLUDED BOX ACCESSORIES","RETURN CONDITION","RETURN PROBLEMS / INCIDENT DETAILS","FINE / COMP AMOUNT","REMARKS"\n`;

  if (historyLogsToExport.length === 0) {
    csv += `"No returned or incident history logs recorded."\n`;
  } else {
    historyLogsToExport.forEach((l) => {
      const membersStr = l.members ? l.members.join("; ") : "None";
      const boxStr = l.boxItems
        ? l.boxItems.map((b) => `${b.name}(x${b.qty})`).join("; ")
        : "None";
      csv += `"${l.groupId || "N/A"}","${l.type || "ISSUE"}","${l.issueDate}","${l.returnDate || "N/A"}","${l.projectId || "N/A"}","${l.leader}","${l.receiver || ""}","${l.returner || ""}","${l.mismatchReason || "N/A"}","${membersStr}","${l.name}","${l.model || "N/A"}","${l.serial || "N/A"}","${l.equipmentSerial || "N/A"}","${boxStr}","${l.returnCondition || "N/A"}","${l.returnProblems || l.issueProblems || "N/A"}","${l.fineAmount || "N/A"}","${l.remarks || ""}"\n`;
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
  csv += `\n\n`;

  // PART 4: DAILY STAFF ATTENDANCE LOGS
  csv += `--------------------------------------------------------------------------------------------------------\n`;
  csv += `PART 4: DAILY STAFF ATTENDANCE LOGS\n`;
  csv += `--------------------------------------------------------------------------------------------------------\n`;
  csv += `"DATE","EMPLOYEE NAME","DUTY TYPE","ATTENDANCE STATUS","PROJECT / LOCATION","CHECK-IN TIME","CHECK-OUT TIME"\n`;
  if (attendanceToExport.length === 0) {
    csv += `"No attendance records in this period."\n`;
  } else {
    attendanceToExport.forEach((a) => {
      csv += `"${a.date}","${a.empName}","${a.dutyType || "Office"}","${a.status}","${a.projectLocation || "N/A"}","${a.inTime || "N/A"}","${a.outTime || "N/A"}"\n`;
      a.exported = true;
    });
  }
  csv += `\n=================================== END OF REPORT ===================================\n`;

  saveData();

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("download", `Asset_Backup_${dailyTimestamp}.csv`);
  a.click();

  exportModalObj.hide();

  if (pendingReset) {
    setTimeout(() => {
      if (
        confirm(
          "Are you absolutely sure? This will delete all history forever.",
        )
      ) {
        issueLogs = [];
        borrowedTransfers = [];
        saveData();

        if (
          typeof isFirebaseConnected !== "undefined" &&
          isFirebaseConnected &&
          typeof getUserDb === "function"
        ) {
          const userDb = getUserDb();
          if (userDb) {
            userDb
              .collection("asset_logs")
              .get()
              .then((snapshot) => {
                snapshot.forEach((doc) => doc.ref.delete());
              });
            userDb
              .collection("asset_transfers")
              .get()
              .then((snapshot) => {
                snapshot.forEach((doc) => doc.ref.delete());
              });
          }
        }

        alert("Part 2 Movement Logs & Inter-set Transfers have been reset!");
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

  const uiBtn = document.getElementById("pwaInstallSidebarBtn");
  if (uiBtn) {
    uiBtn.classList.remove("hidden");
    uiBtn.classList.add("flex");
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

      const uiBtn = document.getElementById("pwaInstallSidebarBtn");
      if (uiBtn) {
        uiBtn.classList.add("hidden");
        uiBtn.classList.remove("flex");
      }
    });
  } else {
    alert(
      "Your browser either does not support web app installation, or you have already installed it.",
    );
  }
}

// Ensure Service Worker is registered (Mandatory for PWA installation prompts)
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

// --- STAFF DIRECTORY MANAGEMENT ---
function addEmployee(e) {
  e.preventDefault();
  const nameInput = document.getElementById("emp_name");
  const desigInput = document.getElementById("emp_designation");
  const phoneInput = document.getElementById("emp_phone");

  if (!nameInput) return;

  const name = nameInput.value.trim();
  const desig = desigInput.value.trim() || "Field Staff";
  const phone = phoneInput.value.trim() || "N/A";

  if (!name) return;

  if (editingEmpId) {
    const empIndex = employees.findIndex((emp) => emp.id === editingEmpId);
    if (empIndex !== -1) {
      employees[empIndex].name = name;
      employees[empIndex].designation = desig;
      employees[empIndex].phone = phone;
    }
    editingEmpId = null;
  } else {
    employees.push({
      id: Date.now(),
      name: name,
      designation: desig,
      phone: phone,
      addedDate: new Date().toISOString().slice(0, 10),
    });
  }

  nameInput.value = "";
  desigInput.value = "";
  phoneInput.value = "";

  saveData();
  alert(`✅ Employee "${name}" saved to directory!`);
}

function renderEmployees() {
  const tbody = document.querySelector("#employeeTable tbody");
  const badge = document.getElementById("totalEmployeesBadge");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (badge) badge.innerText = `${employees.length} Staff`;

  if (employees.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-3">No employees registered yet. Add team members above!</td></tr>`;
    return;
  }

  // Find active assignments from active issue logs
  const activeAssignments = {};
  issueLogs.forEach((log) => {
    if (log.active) {
      if (log.leader) activeAssignments[log.leader.toLowerCase()] = log.projectId || "Field Site";
      if (log.receiver) activeAssignments[log.receiver.toLowerCase()] = log.projectId || "Field Site";
      if (log.members && Array.isArray(log.members)) {
        log.members.forEach((m) => {
          activeAssignments[m.toLowerCase()] = log.projectId || "Field Site";
        });
      }
    }
  });

  employees.forEach((emp) => {
    const assignedProject = activeAssignments[emp.name.toLowerCase()];
    const statusBadge = assignedProject
      ? `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20"><i class="bi bi-briefcase me-1"></i>Assigned (${assignedProject})</span>`
      : `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-status-success/10 text-status-success border border-status-success/20"><i class="bi bi-check-circle me-1"></i>Available</span>`;

    tbody.innerHTML += `
      <tr class="hover:bg-surface-container-low/50 transition-colors">
        <td class="px-4 py-3 align-middle">
          <div class="font-bold text-text-primary text-xs sm:text-sm">${emp.name}</div>
          <div class="text-[11px] text-text-secondary">${emp.designation} | Ph: ${emp.phone || "N/A"}</div>
        </td>
        <td class="px-4 py-3 align-middle text-center">${statusBadge}</td>
        <td class="px-4 py-3 align-middle text-right">
          <button class="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors inline-flex items-center justify-center border border-primary/20 me-1" onclick="editEmployee(${emp.id})" title="Edit Employee">
            <span class="material-symbols-outlined text-base">edit</span>
          </button>
          <button class="p-1.5 text-status-alert hover:bg-status-alert/15 rounded-lg transition-colors inline-flex items-center justify-center border border-status-alert/20" onclick="deleteEmployee(${emp.id})" title="Delete Employee">
            <span class="material-symbols-outlined text-base">delete</span>
          </button>
        </td>
      </tr>
    `;
  });
}

function editEmployee(id) {
  const emp = employees.find((e) => e.id === id);
  if (!emp) return;
  document.getElementById("emp_name").value = emp.name;
  document.getElementById("emp_designation").value = emp.designation;
  document.getElementById("emp_phone").value = emp.phone;
  editingEmpId = id;
}

function deleteEmployee(id) {
  if (confirm("Are you sure you want to remove this employee from directory?")) {
    employees = employees.filter((e) => e.id !== id);
    saveData();
    if (typeof deleteFromFirebase === "function") {
      deleteFromFirebase("asset_employees", id);
    }
  }
}

function updateEmployeeDatalist() {
  const datalist = document.getElementById("employeeDatalist");
  if (!datalist) return;
  datalist.innerHTML = "";
  employees.forEach((emp) => {
    const opt = document.createElement("option");
    opt.value = emp.name;
    opt.label = `${emp.designation}`;
    datalist.appendChild(opt);
  });
}

// --- ATTENDANCE MANAGEMENT ---
function renderAttendancePanel() {
  const dateInput = document.getElementById("att_date_filter");
  if (!dateInput) return;

  if (!dateInput.value) {
    dateInput.valueAsDate = new Date();
  }

  const selectedDate = dateInput.value;
  const assignedTbody = document.querySelector("#assignedAttendanceTable tbody");
  const availableTbody = document.querySelector("#availableAttendanceTable tbody");

  if (!assignedTbody || !availableTbody) return;

  assignedTbody.innerHTML = "";
  availableTbody.innerHTML = "";

  // Identify assigned vs available employees
  const activeAssignments = {};
  issueLogs.forEach((log) => {
    if (log.active) {
      if (log.leader) activeAssignments[log.leader.toLowerCase()] = log.projectId || "Field Site";
      if (log.receiver) activeAssignments[log.receiver.toLowerCase()] = log.projectId || "Field Site";
      if (log.members && Array.isArray(log.members)) {
        log.members.forEach((m) => {
          activeAssignments[m.toLowerCase()] = log.projectId || "Field Site";
        });
      }
    }
  });

  const existingLogsForDate = attendanceLogs.filter((l) => l.date === selectedDate);
  const logMap = {};
  existingLogsForDate.forEach((l) => {
    logMap[l.empId] = l;
  });

  let assignedCount = 0;
  let availableCount = 0;

  employees.forEach((emp) => {
    const isAssigned = !!activeAssignments[emp.name.toLowerCase()];
    const existingLog = logMap[emp.id] || {};
    const status = existingLog.status || (isAssigned ? "Present" : "Present");
    const inTime = existingLog.inTime || "09:00";
    const outTime = existingLog.outTime || "18:00";
    const notes = existingLog.notes || "";

    const rowHtml = `
      <tr class="hover:bg-surface-container-low/50 transition-colors">
        <td class="px-3 py-2.5 align-middle">
          <div class="font-bold text-text-primary text-xs">${emp.name}</div>
          <input type="hidden" name="emp_id[]" value="${emp.id}" />
          <input type="hidden" name="emp_name_${emp.id}" value="${emp.name}" />
          <input type="hidden" name="assign_type_${emp.id}" value="${isAssigned ? "Assigned Field" : "Available Office"}" />
        </td>
        <td class="px-3 py-2.5 align-middle">
          <span class="text-xs text-text-secondary font-medium">${isAssigned ? activeAssignments[emp.name.toLowerCase()] : emp.designation}</span>
        </td>
        <td class="px-3 py-2.5 align-middle">
          <select name="status_${emp.id}" class="px-2 py-1 border border-surface-border rounded-lg text-xs bg-background outline-none font-bold">
            <option value="Present" ${status === "Present" ? "selected" : ""}>✅ Present</option>
            <option value="Absent" ${status === "Absent" ? "selected" : ""}>❌ Absent</option>
            <option value="Late" ${status === "Late" ? "selected" : ""}>⚠️ Late</option>
            <option value="Half Day" ${status === "Half Day" ? "selected" : ""}>⏳ Half Day</option>
            <option value="Leave" ${status === "Leave" ? "selected" : ""}>🏖️ Leave</option>
          </select>
        </td>
        <td class="px-3 py-2.5 align-middle">
          <input type="time" name="in_time_${emp.id}" value="${inTime}" class="px-2 py-1 border border-surface-border rounded-lg text-xs bg-background outline-none font-mono" />
        </td>
        <td class="px-3 py-2.5 align-middle">
          <input type="time" name="out_time_${emp.id}" value="${outTime}" class="px-2 py-1 border border-surface-border rounded-lg text-xs bg-background outline-none font-mono" />
        </td>
        <td class="px-3 py-2.5 align-middle">
          <input type="text" name="notes_${emp.id}" value="${notes}" placeholder="Optional notes..." class="w-full px-2 py-1 border border-surface-border rounded-lg text-xs bg-background outline-none" />
        </td>
      </tr>
    `;

    if (isAssigned) {
      assignedTbody.innerHTML += rowHtml;
      assignedCount++;
    } else {
      availableTbody.innerHTML += rowHtml;
      availableCount++;
    }
  });

  if (assignedCount === 0) {
    assignedTbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-2.5">No staff currently assigned to active field projects.</td></tr>`;
  }
  if (availableCount === 0) {
    availableTbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-2.5">No available staff in office directory.</td></tr>`;
  }

  renderAttendanceSummary();
  renderAttendanceHistory();
}

function saveAttendanceBatch(e) {
  e.preventDefault();
  const dateInput = document.getElementById("att_date_filter");
  if (!dateInput || !dateInput.value) return;

  const date = dateInput.value;
  const empIds = document.querySelectorAll('input[name="emp_id[]"]');

  empIds.forEach((input) => {
    const empId = parseInt(input.value);
    const empName = document.querySelector(`input[name="emp_name_${empId}"]`)?.value || "";
    const assignType = document.querySelector(`input[name="assign_type_${empId}"]`)?.value || "Office";
    const status = document.querySelector(`select[name="status_${empId}"]`)?.value || "Present";
    const inTime = document.querySelector(`input[name="in_time_${empId}"]`)?.value || "";
    const outTime = document.querySelector(`input[name="out_time_${empId}"]`)?.value || "";
    const notes = document.querySelector(`input[name="notes_${empId}"]`)?.value || "";

    const existingIdx = attendanceLogs.findIndex((l) => l.date === date && l.empId === empId);

    const logRecord = {
      id: existingIdx !== -1 ? attendanceLogs[existingIdx].id : Date.now() + Math.floor(Math.random() * 1000),
      date: date,
      empId: empId,
      empName: empName,
      assignType: assignType,
      status: status,
      inTime: inTime,
      outTime: outTime,
      notes: notes,
    };

    if (existingIdx !== -1) {
      attendanceLogs[existingIdx] = logRecord;
    } else {
      attendanceLogs.push(logRecord);
    }
  });

  saveData();
  alert(`✅ Daily attendance for ${date} saved successfully!`);
}

function renderAttendanceSummary() {
  const tbody = document.querySelector("#attendanceSummaryTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (employees.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-2.5">No employee records.</td></tr>`;
    return;
  }

  employees.forEach((emp) => {
    const empLogs = attendanceLogs.filter((l) => l.empId === emp.id);
    const totalRecorded = empLogs.length;
    const totalPresent = empLogs.filter((l) => l.status === "Present" || l.status === "Late" || l.status === "Half Day").length;

    tbody.innerHTML += `
      <tr class="hover:bg-surface-container-low/50 transition-colors">
        <td class="px-4 py-2.5 font-bold text-text-primary">${emp.name}</td>
        <td class="px-4 py-2.5 text-text-secondary">${emp.designation}</td>
        <td class="px-4 py-2.5 text-center font-bold text-status-success">${totalPresent} Days</td>
        <td class="px-4 py-2.5 text-center font-mono">${totalRecorded} Days</td>
      </tr>
    `;
  });
}

function renderAttendanceHistory() {
  const tbody = document.querySelector("#attendanceHistoryTable tbody");
  const queryInput = document.getElementById("searchAttendance");
  if (!tbody) return;

  const query = queryInput ? queryInput.value.toLowerCase() : "";
  tbody.innerHTML = "";

  const filteredLogs = attendanceLogs.filter(
    (l) =>
      l.date.includes(query) ||
      l.empName.toLowerCase().includes(query) ||
      l.status.toLowerCase().includes(query) ||
      (l.notes && l.notes.toLowerCase().includes(query))
  );

  if (filteredLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-2.5">No attendance history records found.</td></tr>`;
    return;
  }

  filteredLogs.sort((a, b) => b.date.localeCompare(a.date));

  filteredLogs.forEach((l) => {
    let statusClass = "bg-status-success/10 text-status-success border-status-success/30";
    if (l.status === "Absent") statusClass = "bg-status-alert/10 text-status-alert border-status-alert/30";
    if (l.status === "Late" || l.status === "Half Day") statusClass = "bg-status-warning/10 text-status-warning border-status-warning/30";
    if (l.status === "Leave") statusClass = "bg-primary/10 text-primary border-primary/30";

    tbody.innerHTML += `
      <tr class="hover:bg-surface-container-low/50 transition-colors">
        <td class="px-3 py-2.5 font-bold text-text-primary font-mono">${l.date}</td>
        <td class="px-3 py-2.5 font-bold text-text-primary">${l.empName}</td>
        <td class="px-3 py-2.5 text-text-secondary">${l.assignType || "Office"}</td>
        <td class="px-3 py-2.5"><span class="px-2 py-0.5 rounded text-xs font-bold border ${statusClass}">${l.status}</span></td>
        <td class="px-3 py-2.5 font-mono text-text-secondary">${l.inTime || "--:--"} to ${l.outTime || "--:--"}</td>
        <td class="px-3 py-2.5 text-text-secondary">${l.notes || "-"}</td>
      </tr>
    `;
  });
}

// --- INTER-SET ACCESSORY TRANSFER LOGIC ---
function updateSourceBoxAccessoriesDropdown() {
  const fromSelect = document.getElementById("t_from_set");
  const accSelect = document.getElementById("t_accessory_item");
  const toSelect = document.getElementById("t_to_set");

  if (!fromSelect || !accSelect || !toSelect) return;

  const currentFrom = fromSelect.value;
  const currentTo = toSelect.value;

  fromSelect.innerHTML = '<option value="">-- Select Source Set --</option>';
  toSelect.innerHTML = '<option value="">-- Select Destination Set --</option>';

  const equipmentSets = inventory.filter(
    (i) => i.type === "EQUIPMENT" && i.boxItems && i.boxItems.length > 0
  );

  equipmentSets.forEach((item) => {
    const serialsStr = formatSerialText(item.serial, item.equipmentSerial);
    const label = `${item.name} (${serialsStr}) ${item.isIssued ? "[Issued]" : "[In Stock]"}`;

    const optFrom = document.createElement("option");
    optFrom.value = item.id;
    optFrom.textContent = label;
    if (item.id.toString() === currentFrom) optFrom.selected = true;
    fromSelect.appendChild(optFrom);

    const optTo = document.createElement("option");
    optTo.value = item.id;
    optTo.textContent = label;
    if (item.id.toString() === currentTo) optTo.selected = true;
    toSelect.appendChild(optTo);
  });

  updateBoxAccessoriesListForSource();
}

function updateBoxAccessoriesListForSource() {
  const fromSelect = document.getElementById("t_from_set");
  const accSelect = document.getElementById("t_accessory_item");
  if (!fromSelect || !accSelect) return;

  const sourceId = parseInt(fromSelect.value);
  accSelect.innerHTML = '<option value="">-- Select Accessory to Transfer --</option>';

  if (!sourceId) return;

  const sourceItem = inventory.find((i) => i.id === sourceId);
  if (sourceItem && sourceItem.boxItems && sourceItem.boxItems.length > 0) {
    sourceItem.boxItems.forEach((b, idx) => {
      if (b.qty > 0) {
        const opt = document.createElement("option");
        opt.value = idx;
        opt.textContent = `${b.name} (Available in set: ${b.qty})`;
        accSelect.appendChild(opt);
      }
    });
  } else {
    accSelect.innerHTML = '<option value="">No accessories available in this set</option>';
  }
}

function processBoxTransfer(e) {
  e.preventDefault();
  const fromId = parseInt(document.getElementById("t_from_set").value);
  const accIdx = parseInt(document.getElementById("t_accessory_item").value);
  const toId = parseInt(document.getElementById("t_to_set").value);
  const qty = 1;

  if (!fromId || isNaN(accIdx) || !toId) {
    alert("Please select source set, accessory, and destination set!");
    return;
  }

  if (fromId === toId) {
    alert("Source and destination equipment sets cannot be the same!");
    return;
  }

  const sourceItem = inventory.find((i) => i.id === fromId);
  const destItem = inventory.find((i) => i.id === toId);

  if (!sourceItem || !destItem) {
    alert("Selected equipment sets not found!");
    return;
  }

  const accItem = sourceItem.boxItems[accIdx];
  if (!accItem || accItem.qty < qty) {
    alert(`Insufficient quantity! Only ${accItem ? accItem.qty : 0} available.`);
    return;
  }

  accItem.qty -= qty;

  if (!destItem.boxItems) destItem.boxItems = [];
  const destAccIdx = destItem.boxItems.findIndex(
    (b) => b.name.toLowerCase() === accItem.name.toLowerCase()
  );

  if (destAccIdx !== -1) {
    destItem.boxItems[destAccIdx].qty += qty;
  } else {
    destItem.boxItems.push({
      name: accItem.name,
      qty: qty,
      originalQty: qty,
    });
  }

  const transferLog = {
    id: Date.now(),
    date: new Date().toISOString().slice(0, 10),
    sourceSet: `${sourceItem.name} (${formatSerialText(sourceItem.serial, sourceItem.equipmentSerial)})`,
    destSet: `${destItem.name} (${formatSerialText(destItem.serial, destItem.equipmentSerial)})`,
    accessoryName: accItem.name,
    qty: qty,
  };

  borrowedTransfers.push(transferLog);

  saveData();
  alert(`✅ Successfully transferred ${qty}x ${accItem.name} from ${sourceItem.name} to ${destItem.name}!`);
}

document.addEventListener("DOMContentLoaded", () => {
  const fromSetEl = document.getElementById("t_from_set");
  if (fromSetEl) {
    fromSetEl.addEventListener("change", updateBoxAccessoriesListForSource);
  }
});
