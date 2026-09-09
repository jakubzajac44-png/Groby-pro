const SUPABASE_URL = "https://ybkrvinvvpntvgxsrijfz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Lnw-ZljjQK5e1GsusXPKtw_qZ0PFAnu";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = id => document.getElementById(id);
const dialog = $("dialog"), form = $("form");
let jobs = [];
let loading = false;

// This matches the GROBY-PRO table created in Supabase.
function toJob(row){
  return {
    id: row.id,
    client: row.klient_imie ?? "",
    phone: row.klient_telefon ?? "",
    cemetery: row.cmentarz ?? "",
    grave: row.lokalizacja_grobu ?? "",
    service: row.usluga ?? "",
    date: row.data ?? "",
    price: row.cena ?? 0,
    done: row.status === "Wykonane" || row.status === "wykonane" || row.status === "done" || row.status === true,
    notes: row.uwagi ?? ""
  };
}

function toRow(){
  const done = $("editId").dataset.done === "true";
  return {
    klient_imie: $("client").value.trim(),
    klient_telefon: $("phone").value.trim() || null,
    cmentarz: $("cemetery").value.trim() || null,
    lokalizacja_grobu: $("grave").value.trim() || null,
    usluga: $("service").value.trim() || null,
    data: $("date").value || null,
    cena: $("price").value === "" ? 0 : Number($("price").value),
    status: done ? "Wykonane" : "Do wykonania",
    uwagi: $("notes").value.trim() || null
  };
}

function money(v){return (Number(v)||0).toFixed(2).replace(".",",")+" zł"}
function esc(x){return String(x??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

function setMsg(text, error=false){
  $("statusMsg").textContent=text||"";
  $("statusMsg").style.color=error?"#b42318":"#166534";
}

function render(){
  const q=$("search").value.toLowerCase().trim(), f=$("filter").value;
  const visible=jobs.filter(j=>{
    const text=[j.client,j.phone,j.cemetery,j.grave,j.service,j.notes].join(" ").toLowerCase();
    return (!q||text.includes(q)) && (f==="all"||(f==="done"&&j.done)||(f==="open"&&!j.done));
  });
  $("countAll").textContent=jobs.length;
  $("countOpen").textContent=jobs.filter(j=>!j.done).length;
  $("countDone").textContent=jobs.filter(j=>j.done).length;
  $("sumMoney").textContent=money(jobs.filter(j=>j.done).reduce((s,j)=>s+(Number(j.price)||0),0));
  $("empty").style.display=visible.length?"none":"block";
  $("list").innerHTML=visible.map(j=>`
    <article class="job">
      <div class="jobtop">
        <div><h3>${esc(j.client)}</h3>
        <p>📞 ${esc(j.phone||"brak")} · 📍 ${esc(j.cemetery||"brak")}</p></div>
        <span class="badge ${j.done?"done":""}">${j.done?"Wykonane":"Do wykonania"}</span>
      </div>
      ${j.grave?`<p><b>Grób:</b> ${esc(j.grave)}</p>`:""}
      ${j.date?`<p><b>Termin:</b> ${esc(j.date)}</p>`:""}
      ${j.service?`<p><b>Usługa:</b> ${esc(j.service)}</p>`:""}
      <p><b>Cena:</b> ${money(j.price)}</p>
      ${j.notes?`<p><b>Uwagi:</b> ${esc(j.notes)}</p>`:""}
      <div class="jobbuttons">
        <button onclick="toggleDone('${j.id}')">${j.done?"↩ Oznacz jako niewykonane":"✓ Oznacz jako wykonane"}</button>
        <button onclick="editJob('${j.id}')">✏️ Edytuj</button>
        <button onclick="deleteJob('${j.id}')">🗑 Usuń</button>
      </div>
    </article>`).join("");
}

async function loadJobs(){
  setMsg("Ładowanie...");
  const {data,error}=await db.from("zlecenia").select("*").order("data",{ascending:true,nullsFirst:false});
  if(error){setMsg("Nie udało się pobrać zleceń: "+error.message,true);return}
  jobs=(data||[]).map(toJob);
  setMsg("");
  render();
}

function openNew(){
  form.reset(); $("editId").value=""; $("editId").dataset.done="false";
  $("formTitle").textContent="Nowe zlecenie"; dialog.showModal();
}
function editJob(id){
  const j=jobs.find(x=>String(x.id)===String(id)); if(!j)return;
  $("editId").value=j.id; $("editId").dataset.done=String(j.done);
  $("formTitle").textContent="Edytuj zlecenie";
  $("client").value=j.client; $("phone").value=j.phone||"";
  $("cemetery").value=j.cemetery||""; $("grave").value=j.grave||"";
  $("date").value=j.date||""; $("service").value=j.service||"";
  $("price").value=j.price??""; $("notes").value=j.notes||"";
  dialog.showModal();
}

async function toggleDone(id){
  const j=jobs.find(x=>String(x.id)===String(id)); if(!j)return;
  const newStatus=j.done?"Do wykonania":"Wykonane";
  const {error}=await db.from("zlecenia").update({status:newStatus}).eq("id",id);
  if(error){setMsg("Błąd: "+error.message,true);return}
  await loadJobs();
}

async function deleteJob(id){
  if(!confirm("Usunąć to zlecenie?"))return;
  const {error}=await db.from("zlecenia").delete().eq("id",id);
  if(error){setMsg("Błąd: "+error.message,true);return}
  await loadJobs();
}

$("addBtn").onclick=openNew;
$("cancelBtn").onclick=()=>dialog.close();
$("search").oninput=render; $("filter").onchange=render;

form.onsubmit=async e=>{
  e.preventDefault();
  const id=$("editId").value;
  const row=toRow();
  setMsg("Zapisywanie...");
  let result;
  if(id) result=await db.from("zlecenia").update(row).eq("id",id);
  else result=await db.from("zlecenia").insert(row);
  if(result.error){setMsg("Nie udało się zapisać: "+result.error.message,true);return}
  dialog.close(); await loadJobs();
};

$("loginForm").onsubmit=async e=>{
  e.preventDefault(); $("loginMsg").textContent="Logowanie...";
  const {error}=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
  if(error){$("loginMsg").textContent="Błąd logowania: "+error.message;return}
  $("loginMsg").textContent="";
};

$("logoutBtn").onclick=async()=>{await db.auth.signOut()};

async function showSession(session){
  const logged=!!session;
  $("loginView").classList.toggle("hidden",logged);
  $("appView").classList.toggle("hidden",!logged);
  $("logoutBtn").classList.toggle("hidden",!logged);
  if(logged) await loadJobs();
}

db.auth.onAuthStateChange((_event,session)=>showSession(session));
db.auth.getSession().then(({data})=>showSession(data.session));
