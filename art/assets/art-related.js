(() => {
  function makeDialog() {
    let d=document.getElementById("related-public-dialog");
    if(d) return d;
    d=document.createElement("dialog");
    d.id="related-public-dialog";
    d.className="related-public-dialog";
    d.innerHTML=`<div class="related-public-inner">
      <button class="related-public-close" type="button" aria-label="Close related works">×</button>
      <p class="micro">Related works</p>
      <h2 id="relatedPublicTitle">Related works</h2>
      <div class="related-public-frame" id="relatedPublicFrame"></div>
    </div>`;
    document.body.appendChild(d);
    d.querySelector(".related-public-close").addEventListener("click",()=>d.close());
    d.addEventListener("click",e=>{if(e.target===d)d.close();});
    return d;
  }

  function imagePath(v){
    v=String(v||"");
    return(!v||v.startsWith("http")||v.startsWith("/"))?v:"../"+v;
  }

  function memberHtml(m,i){
    if(m.kind==="reference"){
      const show=m.visibility==="public"&&m.image;
      return `<article class="related-public-item related-public-reference">
        <div class="related-public-number">${i+1}</div>
        <div class="related-public-kind">Reference</div>
        <div class="related-public-media">${show
          ?`<img src="${escapeHtml(imagePath(m.image))}" alt="${escapeHtml(m.alt||m.title||"Reference image")}" loading="lazy">`
          :`<div class="related-public-reference-placeholder"><strong>Reference image</strong><span>Image not reproduced</span></div>`}
        </div>
        <div class="related-public-copy">
          <strong>${escapeHtml(m.title||"Reference")}</strong>
          ${m.creator?`<small>${escapeHtml(m.creator)}</small>`:""}
          ${m.rights?`<small>${escapeHtml(m.rights)}</small>`:""}
          ${m.sourceUrl?`<small><a href="${escapeHtml(m.sourceUrl)}" target="_blank" rel="noopener noreferrer">Source</a></small>`:""}
        </div>
      </article>`;
    }

    const meta=[m.medium,m.collection].filter(Boolean).join(" · ");
    return `<article class="related-public-item">
      <div class="related-public-number">${i+1}</div>
      <div class="related-public-kind">Artwork</div>
      <div class="related-public-media">
        <img src="${escapeHtml(imagePath(m.image||m.thumb||""))}" alt="${escapeHtml(m.alt||m.title||"")}" loading="lazy">
      </div>
      <div class="related-public-copy">
        <strong>${escapeHtml(m.title||"Untitled")}</strong>
        ${meta?`<small>${escapeHtml(meta)}</small>`:""}
      </div>
    </article>`;
  }

  function openGroup(g){
    const d=makeDialog();
    const f=d.querySelector("#relatedPublicFrame");
    const ms=Array.isArray(g.members)?g.members:[];
    if(ms.length<2)return;

    d.querySelector("#relatedPublicTitle").textContent=g.title||"Related works";
    f.classList.remove("related-public-chooser");
    f.innerHTML=ms.map(memberHtml).join("");

    if(!d.open)d.showModal();
    d.querySelector(".related-public-close").focus();
  }

  function chooserHtml(g){
    const ms=Array.isArray(g.members)?g.members:[];
    const thumbs=ms.slice(0,4).map(m=>{
      if(m.kind==="reference"&&!(m.visibility==="public"&&m.thumb)){
        return `<span class="related-public-choice-placeholder">Ref</span>`;
      }
      return `<img src="${escapeHtml(imagePath(m.thumb||m.image||""))}" alt="" loading="lazy">`;
    }).join("");

    return `<button class="related-public-choice" type="button" data-group="${escapeHtml(g.id)}">
      <span class="related-public-choice-thumbs">${thumbs}</span>
      <strong>${escapeHtml(g.title||"Related works")}</strong>
      <small>${ms.length} members</small>
    </button>`;
  }

  function openChooser(gs){
    const d=makeDialog();
    const f=d.querySelector("#relatedPublicFrame");
    d.querySelector("#relatedPublicTitle").textContent="Related groups";
    f.classList.add("related-public-chooser");
    f.innerHTML=gs.map(chooserHtml).join("");

    f.querySelectorAll("[data-group]").forEach(b=>b.addEventListener("click",()=>{
      const g=gs.find(x=>x.id===b.dataset.group);
      if(g)openGroup(g);
    }));

    if(!d.open)d.showModal();
    d.querySelector(".related-public-close").focus();
  }

  function attach(link,gs){
    const valid=gs.filter(g=>Array.isArray(g.members)&&g.members.length>=2);
    if(!valid.length)return;

    const others=new Set();
    valid.forEach(g=>g.members.forEach(m=>{
      const k=`${m.kind}:${m.id}`;
      if(k!==`artwork:${link.dataset.artworkId}`)others.add(k);
    }));

    if(!others.size)return;

    const b=document.createElement("button");
    b.type="button";
    b.className="related-public-trigger";
    b.textContent=`See related · ${others.size}`;

    b.addEventListener("click",e=>{
      e.preventDefault();
      e.stopPropagation();
      valid.length===1?openGroup(valid[0]):openChooser(valid);
    });

    if(link.classList.contains("lead-link")){
      const lead=link.closest(".lead-work");
      if(lead)lead.appendChild(b);
      return;
    }

    const shell=document.createElement("div");
    shell.className="work-card-shell related-public-shell";
    link.parentNode.insertBefore(shell,link);
    shell.appendChild(link);
    shell.appendChild(b);
  }

  async function init(){
    const links=[
      ...document.querySelectorAll(".work-card[data-artwork-id], .lead-link[data-artwork-id]")
    ];
    if(!links.length)return;

    try{
      const r=await fetch(
        "../data/related-public.json?ts="+Date.now(),
        {cache:"no-store"}
      );
      if(!r.ok)return;

      const p=await r.json();
      const sets=Array.isArray(p.sets)?p.sets:[];
      const by=new Map();

      sets.forEach(g=>(g.members||[])
        .filter(m=>m.kind==="artwork"&&m.id)
        .forEach(m=>{
          if(!by.has(m.id))by.set(m.id,[]);
          by.get(m.id).push(g);
        })
      );

      links.forEach(l=>attach(l,by.get(l.dataset.artworkId)||[]));
    }catch(e){
      console.warn("Related works could not be loaded.",e);
    }
  }

  init();
})();