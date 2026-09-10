async function authFetch(url, options={}) {
  const res = await fetch(url, { ...options, credentials:"same-origin", headers:{ ...(options.headers||{}) } });
  if (res.status === 401) { location.href = "/login"; return null; }
  return res;
}
const form=document.getElementById("form");
const fields={n:document.getElementById("pn"),b:document.getElementById("pb"),p:document.getElementById("pp"),s:document.getElementById("ps"),c:document.getElementById("pc"),t:document.getElementById("pt"),i:document.getElementById("pi"),d:document.getElementById("pd")};
async function load(){
  const [sr,or,pr]=await Promise.all([authFetch("/api/stats"),authFetch("/api/orders"),authFetch("/api/products")]);
  if(!sr||!or||!pr)return;
  const stats=await sr.json(), orders=await or.json(), products=await pr.json();
  document.getElementById("p").textContent=stats.products; document.getElementById("o").textContent=stats.orders; document.getElementById("pending").textContent=stats.pending; document.getElementById("r").textContent=Number(stats.revenue).toFixed(2);
  document.getElementById("orders").innerHTML=orders.length?orders.map(o=>`<div class="order"><div><b>#${o.id} — ${escapeHtml(o.customer_name)}</b><small>${escapeHtml(o.phone)} · ${escapeHtml(o.address||"بدون عنوان")}</small><small>${escapeHtml(o.items||"")}</small><strong>${Number(o.total).toFixed(2)} ر.س</strong></div><select onchange="changeStatus(${o.id},this.value)"><option value="new" ${o.status==='new'?'selected':''}>جديد</option><option value="processing" ${o.status==='processing'?'selected':''}>قيد التجهيز</option><option value="shipped" ${o.status==='shipped'?'selected':''}>تم الشحن</option><option value="completed" ${o.status==='completed'?'selected':''}>مكتمل</option><option value="cancelled" ${o.status==='cancelled'?'selected':''}>ملغي</option></select></div>`).join(""):`<div class="empty">لا توجد طلبات حتى الآن.</div>`;
  document.getElementById("productsAdmin").innerHTML=products.map(p=>`<div class="admin-product"><div><img src="${escapeAttr(p.image)}" alt=""><span><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.brand||"")} · ${p.price} ر.س · المخزون ${p.stock}</small></span></div><div><button class="edit" onclick='openEdit(${JSON.stringify(p).replace(/'/g,"&#39;")})'>تعديل</button><button class="delete" onclick="deleteProduct(${p.id})">حذف</button></div></div>`).join("");
}
function escapeHtml(v){return String(v??"").replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function escapeAttr(v){return escapeHtml(v);}
async function changeStatus(id,status){const r=await authFetch(`/api/orders/${id}/status`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});if(r&&r.ok)load();}
async function deleteProduct(id){if(!confirm("هل تريد حذف المنتج؟"))return;const r=await authFetch(`/api/products/${id}`,{method:"DELETE"});if(r&&r.ok)load();}
form.addEventListener("submit",async e=>{
  e.preventDefault();
  const product={name:fields.n.value.trim(),brand:fields.b.value.trim(),price:fields.p.value,stock:fields.s.value,category:fields.c.value,tag:fields.t.value.trim(),image:fields.i.value.trim(),description:fields.d.value.trim()};
  const button=form.querySelector("button[type=submit]");
  const oldText=button.textContent;
  button.disabled=true; button.textContent="جاري الإضافة...";
  try{
    const r=await authFetch("/api/products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(product)});
    if(!r)return;
    const data=await r.json().catch(()=>({}));
    if(!r.ok){alert(data.error||"حصل خطأ أثناء إضافة المنتج");return;}
    alert("تم إضافة المنتج بنجاح ✅");
    form.reset();
    await load();
  }catch(err){
    alert("تعذر الاتصال بالسيرفر. تأكد أن node server.js يعمل.");
  }finally{button.disabled=false;button.textContent=oldText;}
});
const en = document.getElementById("en"), eb = document.getElementById("eb"), ep = document.getElementById("ep"), es = document.getElementById("es"), ec = document.getElementById("ec"), et = document.getElementById("et"), ei = document.getElementById("ei"), ed = document.getElementById("ed");

function openEdit(p){document.getElementById("editModal").classList.remove("hidden");document.getElementById("editForm").dataset.id=p.id;en.value=p.name;eb.value=p.brand||"";ep.value=p.price;es.value=p.stock;ec.value=p.category;et.value=p.tag||"";ei.value=p.image;ed.value=p.description||"";}
function closeEdit(){document.getElementById("editModal").classList.add("hidden");}
document.getElementById("editForm").addEventListener("submit",async e=>{e.preventDefault();const id=e.currentTarget.dataset.id;const body={name:en.value,brand:eb.value,price:ep.value,stock:es.value,category:ec.value,tag:et.value,image:ei.value,description:ed.value};const r=await authFetch(`/api/products/${id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});if(r&&r.ok){closeEdit();load();}});
document.getElementById("logout").onclick=async()=>{await authFetch("/api/logout",{method:"POST"});location.href="/login";};
load();
