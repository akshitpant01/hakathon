const state = { overview: null, resources: null, prescription: null, easyRead: false, locality: "Neemrana", lang: "en" };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])).replace(/\p{Extended_Pictographic}|\uFE0F|\uFE0E|\u200D/gu,"");
const iconPaths = {
  home:'<path d="m3 10 9-7 9 7M5.5 9v12h13V9M9.5 21v-7h5v7"/>',
  file:'<path d="M7 3h7l5 5v13H7zM14 3v6h5M10 13h6M10 17h6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  pulse:'<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  pin:'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  sparkle:'<path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.5 2.6-1.7-.7-.2.1a8 8 0 0 1-1.5.9l-.2.1-.3 1.8h-3l-.3-1.8-.2-.1a8 8 0 0 1-1.5-.9l-.2-.1-1.7.7-1.5-2.6 1.4-1.1.1-.2a8 8 0 0 1 0-1.8l-.1-.2-1.4-1.1 1.5-2.6 1.7.7.2-.1a8 8 0 0 1 1.5-.9l.2-.1.3-1.8h3l.3 1.8.2.1a8 8 0 0 1 1.5.9l.2.1 1.7-.7 1.5 2.6-1.4 1.1-.1.2a8 8 0 0 1 0 1.8Z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  smile:'<circle cx="12" cy="12" r="9"/><path d="M8 14s1.3 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
  neutral:'<circle cx="12" cy="12" r="9"/><path d="M8 15h8M9 9h.01M15 9h.01"/>',
  frown:'<circle cx="12" cy="12" r="9"/><path d="M8 17s1.3-2 4-2 4 2 4 2M9 9h.01M15 9h.01"/>',
  cross:'<path d="M12 4v16M4 12h16"/>',
  leaf:'<path d="M20 4c-8 0-14 3-14 10a6 6 0 0 0 6 6c7 0 10-6 8-16Z"/><path d="M5 21c2-5 6-8 12-12"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
};
function icon(name, className="line-icon") { return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${iconPaths[name] || iconPaths.sparkle}</svg>`; }
function hydrateIcons(root=document) { root.querySelectorAll("[data-icon]").forEach(node => { node.innerHTML=icon(node.dataset.icon); }); }

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || data.message || data.quality_warning || "Something went wrong. Please try again.");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}
function jsonPost(url, body) { return api(url, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); }
function toast(message, error = false) {
  const region = $("#toast-region");
  const item = document.createElement("div"); item.className = `toast${error ? " error" : ""}`; item.textContent = message;
  region.append(item); setTimeout(() => item.remove(), 4300);
}
function go(view) {
  const target = $(`#view-${view}`); if (!target) return;
  $$(".view").forEach(v => v.classList.toggle("active", v === target));
  $$(".nav-item[data-view]").forEach(n => n.classList.toggle("active", n.dataset.view === view));
  $("#page-title").textContent = target.dataset.page || "Overview";
  $("#sidebar").classList.remove("open"); window.scrollTo({top:0,behavior:"smooth"});
  if (view === "medicines") renderMedicines();
  if (view === "nearby" && !$("#facility-list").dataset.loaded) loadFacilities();
}
function readTime(value) {
  if (!value) return "Any time";
  const [h,m] = value.split(":").map(Number); const suffix = h >= 12 ? "PM" : "AM"; return `${(h%12)||12}:${String(m).padStart(2,"0")} ${suffix}`;
}
function isTodayReminder(r) { return r.enabled && !r.taken_today; }
function activeReminders() { return (state.overview?.reminders || []).filter(r => r.enabled); }
function renderOverview() {
  const reminders = activeReminders(); const data = state.overview || {};
  const scope=data.service_scope || {};
  if(scope.demo_read_only){
    $("#prototype-heading").textContent="Public demonstration";
    $("#prototype-detail").textContent=scope.notice;
    document.body.classList.add("public-demo");
    $("#prescription-file").disabled=true;
    $("#scan-button").disabled=true;
    ["#vitals-form","#wellness-form","#progress-form","#issue-form"].forEach(selector=>$(selector).querySelectorAll("input,select,textarea,button").forEach(el=>el.disabled=true));
    $("#chat-form").querySelectorAll("textarea,button").forEach(el=>el.disabled=true);
    $("#share-schedule").disabled=true;
  }
  $("#nav-reminder-count").textContent = reminders.length;
  $("#metric-medicines").textContent = new Set(reminders.map(r => r.medicine_name)).size;
  const bp = data.vitals?.find(v => /blood pressure|रक्तचाप/i.test(v.metric_name));
  const spo2 = data.vitals?.find(v => /spo2|oxygen|ऑक्सीजन/i.test(v.metric_name));
  $("#metric-bp").textContent = bp ? `${bp.value} ${bp.unit}` : "—";
  $("#metric-bp-note").textContent = bp ? bp.status_flag : "Add a reading when you’re ready";
  $("#metric-spo2").textContent = spo2 ? `${spo2.value}${spo2.unit}` : "—";
  $("#metric-spo2-note").textContent = spo2 ? spo2.status_flag : "A quick check-in, whenever";
  $("#metric-nearby").textContent = data.nearby?.directory_status === "unavailable_for_location" ? "Pilot" : (data.nearby?.total_found ?? "—");
  const today = reminders.slice().sort((a,b) => (a.reminder_time||"").localeCompare(b.reminder_time||"")).slice(0,3);
  $("#today-list").innerHTML = today.length ? today.map(r => `<div class="today-item"><span class="time-block">${escapeHtml(readTime(r.reminder_time))}</span><span><strong>${escapeHtml(r.medicine_name)}</strong><small>${escapeHtml(r.dosage)} · ${escapeHtml(r.food_relation || r.timing_label || "")}</small></span><button class="taken-check ${r.taken_today ? "done" : ""}" data-reminder="${escapeHtml(r.id)}" data-action="taken" aria-label="Mark ${escapeHtml(r.medicine_name)} taken">${r.taken_today ? icon("check") : ""}</button></div>`).join("") : `<div class="empty-state compact"><span class="empty-icon">${icon("clock")}</span><strong>Your schedule will live here</strong><p>Scan a prescription to add your first reminder.</p><button class="button button-outline" data-go="prescription">Read a prescription</button></div>`;
  $("#today-list").querySelectorAll("[data-reminder]").forEach(b => b.addEventListener("click", () => reminderAction(b.dataset.reminder, "taken")));
  renderMedicines(); renderVitalsHistory(); renderWellnessHistory(); renderIssueHistory();
}
function renderMedicines() {
  const all = state.overview?.reminders || []; const active = all.filter(r => r.enabled);
  $("#medicine-summary").innerHTML = `<span class="summary-pill"><b>${active.length}</b> active reminders</span><span class="summary-pill"><b>${new Set(active.map(r=>r.medicine_name)).size}</b> medicines</span><span class="summary-pill"><b>${all.filter(r=>r.taken_today).length}</b> marked taken today</span>`;
  $("#medicine-list").innerHTML = all.length ? all.slice().sort((a,b)=>(a.reminder_time||"").localeCompare(b.reminder_time||"")).map(r => `<article class="reminder-card ${r.enabled ? "" : "disabled-card"}"><span class="reminder-time">${escapeHtml(readTime(r.reminder_time))}</span><span class="reminder-info"><strong>${escapeHtml(r.medicine_name)}</strong><p>${escapeHtml(r.dosage)} · ${escapeHtml(r.food_relation || r.timing_label || "")}${r.source_prescription_date ? ` · From ${escapeHtml(r.source_prescription_date)}` : ""}</p></span><span class="reminder-actions"><label class="time-edit"><span>Change time</span><input type="time" value="${escapeHtml(r.reminder_time)}" aria-label="New time for ${escapeHtml(r.medicine_name)}" data-time-for="${escapeHtml(r.id)}"></label><button class="mini-action" data-reminder="${escapeHtml(r.id)}" data-action="time">Save time</button><button class="mini-action" data-reminder="${escapeHtml(r.id)}" data-action="taken">${r.taken_today ? "Taken" : "Mark taken"}</button><button class="mini-action" data-reminder="${escapeHtml(r.id)}" data-action="toggle">${r.enabled ? "Pause" : "Resume"}</button><button class="mini-action delete" data-reminder="${escapeHtml(r.id)}" data-action="delete">Remove</button></span></article>`).join("") : `<div class="surface empty-state"><span class="empty-icon">${icon("clock")}</span><strong>No reminders just yet</strong><p>When you’re ready, scan your prescription and review every detail before creating a reminder.</p><button class="button button-green" data-go="prescription">Read a prescription <span>→</span></button></div>`;
  $("#medicine-list").querySelectorAll("[data-reminder]").forEach(b => b.addEventListener("click", () => b.dataset.action === "time" ? changeReminderTime(b.dataset.reminder) : reminderAction(b.dataset.reminder, b.dataset.action)));
}
async function changeReminderTime(id) {
  const field=[...$("#medicine-list").querySelectorAll("[data-time-for]")].find(x=>x.dataset.timeFor===id);
  if(!field?.value){toast("Choose a reminder time first.",true);return;}
  try{state.overview.reminders=(await jsonPost(`/api/reminders/${encodeURIComponent(id)}/time`,{time:field.value})).reminders;renderOverview();toast("Reminder time updated.");}
  catch(err){toast(err.message,true);}
}
async function refresh() { state.overview = await api("/api/overview"); renderOverview(); }
async function reminderAction(id, action) {
  if (action === "delete" && !(await confirm("Remove this reminder?", "This removes this reminder from your local schedule."))) return;
  try { state.overview.reminders = (await jsonPost(`/api/reminders/${encodeURIComponent(id)}/${action}`, {})).reminders; renderOverview(); toast(action === "taken" ? "Marked as taken. Take care." : action === "delete" ? "Reminder removed." : "Reminder updated."); }
  catch (err) { toast(err.message, true); }
}
function confirm(title, copy) {
  return new Promise(resolve => {
    const dialog = $("#confirm-dialog"); $("#dialog-title").textContent = title; $("#dialog-copy").textContent = copy;
    const confirmButton = $("#dialog-confirm"); const onClose = () => { dialog.removeEventListener("close", onClose); resolve(dialog.returnValue === "confirm"); };
    dialog.addEventListener("close", onClose); dialog.showModal(); confirmButton.focus();
  });
}
function showPrescription(prescription, demo = false) {
  state.prescription = prescription;
  const root = $("#prescription-results");
  if (!prescription || !prescription.medicines?.length) {
    root.hidden = false; root.innerHTML = `<div class="surface empty-state"><strong>We couldn’t read any medicine details.</strong><p>${escapeHtml(prescription?.original_text || "Try a clearer photo, or ask a pharmacist to help you read it.")}</p></div>`; return;
  }
  const status = prescription.extraction_status || "NEEDS REVIEW";
  root.hidden = false;
  root.innerHTML = `<section class="surface scan-surface"><div class="result-header"><div><span class="section-eyebrow">STEP 02 · YOUR REVIEW</span><h2>Check every detail.</h2><p class="welcome-sub">Nothing is added to your schedule until you confirm it.</p></div><span class="scan-badge">${demo ? "Sample · Demo mode" : escapeHtml(status)}</span></div>${prescription.original_text ? `<div class="raw-text"><strong>What the reader saw:</strong> ${escapeHtml(prescription.original_text)}</div>` : ""}<div class="review-list">${prescription.medicines.map((m,i)=>`
    <article class="medicine-review ${m.is_uncertain ? "uncertain" : ""}" data-index="${i}">
      <div class="medicine-review-head"><strong>Medicine ${i+1}${m.candidate_medicine_name ? ` · ${escapeHtml(m.candidate_medicine_name)}` : ""}</strong>${m.is_uncertain ? `<span class="uncertain-tag">Needs a closer look</span>` : `<span class="scan-badge">Review each field</span>`}</div>
      ${m.is_uncertain ? `<p class="uncertainty-copy">${escapeHtml(m.uncertainty_reason || "Some writing may be unclear. Please compare every field with the paper prescription.")}</p>` : ""}
      <div class="field-grid">${[["raw_medicine_name","As written",m.raw_medicine_name], ["candidate_medicine_name","Medicine name",m.candidate_medicine_name], ["strength","Strength",m.strength], ["dose_instruction_raw","Dose",m.dose_instruction_raw], ["frequency_raw","How often",m.frequency_raw], ["timing_raw","When to take",m.timing_raw], ["duration_raw","For how long",m.duration_raw]].map(([key,label,value])=>`<label>${label}<input data-field="${key}" value="${escapeHtml(value || "")}" placeholder="Not clear from prescription" /></label>`).join("")}</div>
      <label class="review-confirm"><input type="checkbox" data-confirm /> I checked this information against the prescription.</label>
      <div class="result-actions"><button class="button button-green save-medicine" data-index="${i}">Confirm & set reminder <span>→</span></button></div>
    </article>`).join("")}</div><div class="photo-tips"><span class="tip-mark">${icon("sparkle")}</span><div><strong>Keep your original prescription close</strong><p>Ask your doctor or pharmacist about any word, dose, or timing you cannot verify. Do not take a medicine based on an uncertain reading.</p></div></div></section>`;
  root.scrollIntoView({behavior:"smooth",block:"start"});
  if(state.overview?.service_scope?.demo_read_only){
    const note=document.createElement("p");
    note.className="public-demo-inline-note";
    note.textContent="Public demo: review the synthetic example only. Saving reminders and entering personal information are disabled.";
    root.querySelector(".result-header").append(note);
  }
  root.querySelectorAll(".save-medicine").forEach(button=>{
    if(state.overview?.service_scope?.demo_read_only)button.disabled=true;
    button.addEventListener("click",()=>scheduleMedicine(Number(button.dataset.index),button.closest(".medicine-review")));
  });
}
async function scheduleMedicine(index, card, acknowledge = false) {
  const checkbox = $("[data-confirm]", card);
  if (!checkbox.checked) { toast("Please confirm you checked this medicine against the paper prescription.", true); checkbox.focus(); return; }
  const medicine = {...state.prescription.medicines[index]};
  card.querySelectorAll("[data-field]").forEach(input => medicine[input.dataset.field] = input.value.trim() || null);
  if (!medicine.raw_medicine_name?.trim() || !medicine.candidate_medicine_name?.trim() || !medicine.dose_instruction_raw || !medicine.frequency_raw || !medicine.timing_raw) {
    toast("Name, dose, frequency, and timing must be clear before a reminder can be set. Please ask a pharmacist if the prescription is unclear.", true); return;
  }
  medicine.user_confirmed = true;
  try {
    await jsonPost("/api/reminders", {medicine,prescription_id:state.prescription.id,prescription_date:state.prescription.prescription_date,acknowledge_conflicts:acknowledge});
    state.overview = await api("/api/overview"); renderOverview(); toast("Your reminder is saved. You can change it any time."); go("medicines");
  } catch (err) {
    if (err.status === 409 && err.data?.conflicts?.length && !acknowledge) {
      const conflict = err.data.conflicts.map(c=>`${c.medicine_name}: saved ${c.existing_dosage}; this prescription says ${c.new_dosage}`).join(". ");
      if (await confirm("This differs from an existing reminder", `${conflict}. Please check with your prescriber before changing your schedule. Save this new reminder anyway?`)) scheduleMedicine(index,card,true);
      return;
    }
    toast(err.message, true);
  }
}
async function scanImage(file) {
  if (!file) return;
  if (file.size > 10*1024*1024) { toast("Please choose an image smaller than 10 MB.",true); return; }
  const button = $("#scan-button"); button.disabled = true; button.innerHTML = "Reading carefully… <span>◌</span>";
  const form = new FormData(); form.append("prescription",file);
  try { const result = await api("/api/prescriptions/scan",{method:"POST",body:form}); showPrescription(result.prescription); if (result.quality_warning) toast(result.quality_warning); }
  catch(err) { toast(err.message,true); }
  finally { button.disabled = !$("#prescription-file").files[0]; button.innerHTML = "Read this prescription <span>→</span>"; }
}
async function runDemo(scenario) {
  try { const result = await jsonPost("/api/prescriptions/demo",{scenario}); showPrescription(result.prescription,true); toast("Sample loaded. Review the details before creating any reminder."); }
  catch(err) { toast(err.message,true); }
}
function renderVitalsHistory() {
  const readings = state.overview?.vitals || []; const root=$("#vitals-history");
  root.innerHTML = readings.length ? `<table class="history-table"><thead><tr><th>WHEN</th><th>MEASURE</th><th>READING</th><th>NOTE</th></tr></thead><tbody>${readings.slice(0,8).map(v=>`<tr><td>${escapeHtml(v.timestamp)}</td><td>${escapeHtml(v.metric_name)}</td><td><strong>${escapeHtml(v.value)} ${escapeHtml(v.unit)}</strong></td><td>${escapeHtml(v.status_flag)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty-state compact"><p>No readings yet. You can add one above whenever it feels useful.</p></div>`;
}
function renderWellnessHistory() {
  const latest=state.overview?.wellness?.[0]; if(!latest)return;
  $("#wellness-result").innerHTML=`<div class="checkin-result">Your check-in is saved. ${escapeHtml(latest.supportive_advice_hindi)}${latest.tele_manas_recommended ? ` <a href="tel:14416">Call Tele-MANAS at 14416</a>.` : ""}</div>`;
}
function renderIssueHistory() {
  const latest=state.overview?.issues?.[0]; if(!latest)return;
  $("#issue-result").innerHTML=`<div class="checkin-result ${latest.is_severe_alert?"warning":""}">${latest.is_severe_alert?"This may need urgent medical attention. Contact emergency services or a doctor now. ":"Your note has been saved. "}${escapeHtml(latest.issue_type)}${latest.is_severe_alert?` <a href="tel:108">Call 108</a>`:""}</div>`;
}
async function loadFacilities(locality=$("#locality").value.trim() || "Neemrana") {
  locality=locality.trim();
  if(!locality){toast("Enter a town or city to search.",true);return;}
  $("#facility-list").innerHTML = `<div class="surface empty-state"><strong>Looking for nearby care…</strong></div>`;
  try {
    const data=await api(`/api/facilities?locality=${encodeURIComponent(locality)}&radius=10`); $("#facility-list").dataset.loaded="true";
    $("#facility-count").textContent=data.directory_status === "unavailable_for_location" ? "No verified sample listings here" : `${data.total_found} places to know`;
    $("#maps-search").href=data.fallback_maps_query;
    const categoryName={clinic:"HEALTH CENTRE",chemist:"PHARMACY",jan_aushadhi:"JAN AUSHADHI",doctor:"DOCTOR'S CLINIC"};
    $("#facility-list").innerHTML=data.facilities?.length?data.facilities.map(f=>`<article class="facility-card"><div class="facility-top"><div><span class="facility-type">${categoryName[f.category]||"HEALTH SERVICE"}</span><h3>${escapeHtml(state.lang==="hi"?f.name_hindi:f.name_en)}</h3></div><span class="facility-distance">${escapeHtml(f.distance_miles)} mi · ${escapeHtml(f.distance_km)} km</span></div><p>${escapeHtml(f.address)}</p><span class="facility-hours">${icon("clock")} ${escapeHtml(f.timing)}</span>${f.services?.length?`<p>${f.services.slice(0,3).map(escapeHtml).join(" · ")}</p>`:""}<div class="facility-actions"><a class="button button-outline" href="${escapeHtml(f.tel_url)}">Call ${escapeHtml(f.phone)} ↗</a><a class="button button-green" target="_blank" rel="noreferrer" href="${escapeHtml(f.directions_url)}">Directions ↗</a></div></article>`).join(""):`<div class="surface empty-state"><strong>${escapeHtml(data.directory_notice || "No sample places found in this radius.")}</strong><p>${data.directory_status === "unavailable_for_location" ? "This prototype cannot verify care listings for this town. Use a trusted local directory or emergency service." : "Try a supported demo town or widen the search."}</p>${data.directory_status === "unavailable_for_location" ? "" : `<a class="button button-outline" target="_blank" rel="noreferrer" href="${escapeHtml(data.fallback_maps_query)}">Search sample area in Maps ↗</a>`}</div>`;
  } catch(err) { $("#facility-list").innerHTML=`<div class="surface empty-state"><strong>Care listings could not be loaded.</strong><p>${escapeHtml(err.message)} Try again in a moment.</p><button class="button button-outline" type="button" data-retry-facilities>Try again</button></div>`; }
}
async function loadResources() {
  try {
    state.resources=await api("/api/resources");
    $("#emergency-list").innerHTML=state.resources.emergency.map(e=>`<div class="emergency-row"><span><strong>${escapeHtml(e.name_en)}</strong><small>${escapeHtml(e.desc_hindi||"")}</small></span><a href="tel:${escapeHtml(e.number)}">${escapeHtml(e.number)} ↗</a></div>`).join("");
    const topics=state.resources.prevention || [];
    $("#prevention-list").innerHTML=topics.slice(0,3).map(t=>`<article class="prevention-card"><span class="prevention-icon">${icon("leaf")}</span><h3>${escapeHtml(t.title_en||t.title_hindi||"Health tip")}</h3><p>${escapeHtml((t.action_points_en||t.action_points||[])[0]||t.subtitle_en||t.subtitle||"")}</p></article>`).join("");
  } catch(err) {
    console.warn("Optional resources did not load",err);
    $("#emergency-list").innerHTML=`<p role="status">Emergency contacts could not be loaded. If this is urgent, use your local emergency number.</p>`;
    $("#prevention-list").innerHTML=`<p role="status">Health resources are temporarily unavailable.</p>`;
  }
}
function formData(form) { return Object.fromEntries(new FormData(form).entries()); }
function setBusy(button, busy, text="Saving…") { if(!button.dataset.original) button.dataset.original=button.innerHTML; button.disabled=busy; button.innerHTML=busy?text:button.dataset.original; }

document.addEventListener("click", event => {
  const viewButton=event.target.closest("[data-view]"); if(viewButton) go(viewButton.dataset.view);
  const goButton=event.target.closest("[data-go]"); if(goButton) go(goButton.dataset.go);
  const demo=event.target.closest("[data-demo]"); if(demo) runDemo(demo.dataset.demo);
  if(event.target.closest("#share-schedule")) shareSchedule();
  if(event.target.closest("[data-retry-facilities]")){ $("#facility-list").dataset.loaded=""; loadFacilities(); }
});
$("#mobile-menu").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
$("#text-size").addEventListener("click",toggleEasyRead);
$("#text-size-setting").addEventListener("click",toggleEasyRead);
function toggleEasyRead() { state.easyRead=!state.easyRead; document.body.classList.toggle("easy-read",state.easyRead); $("#text-size").setAttribute("aria-pressed",String(state.easyRead)); $("#text-size-setting").textContent=state.easyRead?"Turn off easy read":"Turn on easy read"; }
$("#prescription-file").addEventListener("change",event=>{
  const file=event.target.files[0]; if(!file)return;
  if(file.size>10*1024*1024){toast("Please choose an image smaller than 10 MB.",true);event.target.value="";return;}
  const preview=$("#upload-preview"); preview.src=URL.createObjectURL(file); preview.style.display="block"; $("#scan-button").disabled=false;
  $("#upload-zone").querySelector("strong").textContent=file.name;
});
$("#scan-button").addEventListener("click",()=>scanImage($("#prescription-file").files[0]));
const zone=$("#upload-zone");
zone.addEventListener("dragover",e=>{e.preventDefault();zone.classList.add("dragging")});
zone.addEventListener("dragleave",()=>zone.classList.remove("dragging"));
zone.addEventListener("drop",e=>{e.preventDefault();zone.classList.remove("dragging");const file=e.dataTransfer.files[0];if(file){const input=$("#prescription-file");const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event("change"));}});

$("#vital-kind").addEventListener("change",event=>{
  const settings={bp:["mmHg","e.g. 120/80"],spo2:["%","e.g. 98"],sugar:["mg/dL","e.g. 105"],temp:["°F","e.g. 98.6"],pulse:["bpm","e.g. 72"]};
  const [unit,placeholder]=settings[event.target.value]; $("#vital-unit").textContent=unit; $("#vital-value").placeholder=placeholder;
});
$("#vitals-form").addEventListener("submit",async e=>{
  e.preventDefault(); const form=e.currentTarget; const data=formData(form); const button=$("button[type=submit]",form); setBusy(button,true);
  const types={bp:["Blood Pressure","mmHg"],spo2:["SpO2","%"],sugar:["Blood Sugar","mg/dL"],temp:["Temperature","°F"],pulse:["Pulse","bpm"]};
  try { const saved=await jsonPost("/api/vitals",{device_type:data.device_type,metric_name:types[data.kind][0],value:data.value,unit:types[data.kind][1]}); const reading=saved.reading; await refresh(); form.reset(); $("#vital-kind").dispatchEvent(new Event("change")); $("#vital-result").innerHTML=reading.alert_message?`<div class="checkin-result warning" role="alert">${escapeHtml(reading.alert_message)} <a href="tel:108">Call 108</a> · <a href="tel:112">Call 112</a></div>`:`<div class="checkin-result" role="status">Reading saved: ${escapeHtml(reading.status_flag)}.</div>`; toast(reading.alert_message?"This reading may need prompt medical attention.":"Your reading has been saved.",Boolean(reading.alert_message)); }
  catch(err) { toast(err.message,true); } finally { setBusy(button,false); }
});
$("#wellness-form").addEventListener("submit",async e=>{
  e.preventDefault(); const form=e.currentTarget; const button=$("button[type=submit]",form); setBusy(button,true);
  try { const result=await jsonPost("/api/wellness",{...formData(form),lang:state.lang}); const r=result.checkin; $("#wellness-result").innerHTML=`<div class="checkin-result ${r.tele_manas_recommended?"warning":""}">${escapeHtml(r.supportive_advice_hindi)}${r.tele_manas_recommended?` <a href="tel:14416">Call Tele-MANAS 14416</a>.`:""}</div>`; await refresh(); toast("Your check-in is saved."); }
  catch(err){toast(err.message,true);}finally{setBusy(button,false);}
});
$("#progress-form").addEventListener("submit",async e=>{
  e.preventDefault();const form=e.currentTarget;const button=$("button[type=submit]",form);setBusy(button,true);
  try{const result=await jsonPost("/api/progress",{...formData(form),lang:state.lang});const c=result.checkin;$("#progress-result").innerHTML=`<div class="checkin-result ${c.doctor_visit_advised?"warning":""}"><strong>Your check-in: ${c.recovery_score}%</strong><br/>${escapeHtml(c.recommendation_hindi)}${c.doctor_visit_advised?` <a href="tel:108">Find urgent help ↗</a>`:""}</div>`;await refresh();toast("Your recovery check-in is saved.");}catch(err){toast(err.message,true);}finally{setBusy(button,false);}
});
$("#issue-form").addEventListener("submit",async e=>{
  e.preventDefault();const form=e.currentTarget;const button=$("button[type=submit]",form);setBusy(button,true);
  try{const result=await jsonPost("/api/issues",formData(form));const issue=result.issue;$("#issue-result").innerHTML=`<div class="checkin-result ${issue.is_severe_alert?"warning":""}">${issue.is_severe_alert?`This may need urgent medical attention. Please contact a doctor now. <a href="tel:108">Call 108</a>`:"Your concern has been saved so you can discuss it with your doctor."}</div>`;form.reset();await refresh();if(issue.is_severe_alert)toast("A severe concern was detected. Please seek urgent medical help.",true);else toast("Your note is saved.");}catch(err){toast(err.message,true);}finally{setBusy(button,false);}
});
$("#locality-form").addEventListener("submit",e=>{e.preventDefault();$("#facility-list").dataset.loaded="";loadFacilities();});
async function shareSchedule(){
  const items=activeReminders().slice().sort((a,b)=>(a.reminder_time||"").localeCompare(b.reminder_time||""));
  if(!items.length){toast("There are no active reminders to share yet.",true);return;}
  if(!(await confirm("Share this medicine schedule?","This prepares a message containing medicine names, doses, and times for you to choose a family contact in WhatsApp.")))return;
  const lines=items.map(r=>`• ${r.medicine_name} — ${r.dosage}, ${readTime(r.reminder_time)} (${r.food_relation||r.timing_label||""})`);
  const url=`https://wa.me/?text=${encodeURIComponent(`Sehat Saathi — medicine schedule\n${lines.join("\n")}`)}`;
  window.open(url,"_blank","noopener,noreferrer");
}
$("#chat-form").addEventListener("submit",async e=>{
  e.preventDefault();const form=e.currentTarget;const input=$("textarea",form);const question=input.value.trim();if(!question)return;
  const messages=$("#chat-messages");const bubble=document.createElement("div");bubble.className="chat-bubble user";bubble.innerHTML=`<span class="chat-label">YOU</span><p>${escapeHtml(question)}</p>`;messages.append(bubble);
  input.value="";const waiting=document.createElement("div");waiting.className="chat-bubble bot";waiting.innerHTML=`<span class="chat-label">SAATHI</span><p>One moment, let me think…</p>`;messages.append(waiting);messages.scrollTop=messages.scrollHeight;
  try{const result=await jsonPost("/api/chat",{question,prescription:state.prescription});waiting.querySelector("p").textContent=result.answer;}
  catch(err){waiting.remove();toast(err.message,true);}messages.scrollTop=messages.scrollHeight;
});

async function init(){
  hydrateIcons();
  $(".overline").innerHTML=`<span class="sun-dot"></span> ${new Intl.DateTimeFormat("en",{weekday:"long",month:"long",day:"numeric"}).format(new Date()).toUpperCase()} <span class="overline-divider">·</span> NEEMRANA PILOT`;
  try { await Promise.all([refresh(),loadResources()]); }
  catch(err){toast(`Could not load your care details: ${err.message}`,true);}
}
init();


/* ─── Additional wiring for language toggle and prompt cards ─── */

// ── Language toggle ────────────────────────────────────────────
document.addEventListener("click", e => {
  const langBtn = e.target.closest(".lang-btn");
  if (langBtn) {
    state.lang = langBtn.dataset.lang || "en";
    $$(".lang-btn").forEach(b => b.classList.toggle("active-lang", b === langBtn));
    toast(state.lang === "hi" ? "Hindi mode selected." : "English mode selected.");
  }
  // Prompt cards in chat
  const promptCard = e.target.closest(".prompt-card");
  if (promptCard) {
    const textarea = $("#chat-form textarea");
    if (textarea && !textarea.disabled) {
      textarea.value = promptCard.querySelector("p")?.textContent || "";
      textarea.focus();
    }
  }
});

// ── Text-size setting button in Preferences ───────────────────
const textSizeSetting = $("#text-size-setting");
if (textSizeSetting) {
  textSizeSetting.addEventListener("click", () => {
    state.easyRead = !state.easyRead;
    document.body.classList.toggle("easy-read", state.easyRead);
    textSizeSetting.textContent = state.easyRead ? "Turn off easy read" : "Turn on easy read";
    textSizeSetting.classList.toggle("active", state.easyRead);
    const topBtn = $("#text-size");
    if (topBtn) {
      topBtn.setAttribute("aria-pressed", state.easyRead);
      topBtn.classList.toggle("active", state.easyRead);
    }
  });
}

// ── Top-bar text-size toggle ──────────────────────────────────
const textSizeBtn = $("#text-size");
if (textSizeBtn) {
  textSizeBtn.addEventListener("click", () => {
    state.easyRead = !state.easyRead;
    document.body.classList.toggle("easy-read", state.easyRead);
    textSizeBtn.setAttribute("aria-pressed", state.easyRead);
    textSizeBtn.classList.toggle("active", state.easyRead);
    const settingBtn = $("#text-size-setting");
    if (settingBtn) {
      settingBtn.textContent = state.easyRead ? "Turn off easy read" : "Turn on easy read";
      settingBtn.classList.toggle("active", state.easyRead);
    }
  });
}

// ── Mobile sidebar toggle ─────────────────────────────────────
const mobileMenuBtn = $("#mobile-menu");
if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener("click", () => {
    $("#sidebar").classList.toggle("open");
  });
  // Close sidebar on backdrop click
  document.addEventListener("click", e => {
    const sidebar = $("#sidebar");
    if (sidebar?.classList.contains("open") && !sidebar.contains(e.target) && e.target !== mobileMenuBtn) {
      sidebar.classList.remove("open");
    }
  });
}
