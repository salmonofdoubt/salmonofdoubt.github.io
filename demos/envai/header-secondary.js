/* EnvAI secondary-page header controls. Atlas has its own existing dialog/installer. */
(()=>{const $=id=>document.getElementById(id);
 const menu=$('menu'),btn=$('menuBtn'); if(!menu||!btn)return;
 const close=()=>{menu.hidden=true;btn.setAttribute('aria-expanded','false')};
 btn.addEventListener('click',e=>{e.stopPropagation();const open=menu.hidden;menu.hidden=!open;btn.setAttribute('aria-expanded',String(open))});
 document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target)&&!btn.contains(e.target))close()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();if(dialog.open)dialog.close()}});
 menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
 const dialog=document.createElement('dialog');dialog.className='shell-dialog';dialog.setAttribute('aria-label','EnvAI project information');document.body.appendChild(dialog);
 function openDialog(kind){close();const title=document.createElement('h2'),p=document.createElement('p'),exit=document.createElement('button');exit.className='shell-close';exit.textContent='Close';exit.addEventListener('click',()=>dialog.close());
 dialog.replaceChildren();title.textContent=kind==='cite'?'Cite EnvAI':'Install EnvAI';
 if(kind==='cite'){p.textContent='Salmon of Doubt (2026). EnvAI: Environmental Technology & AI Landscape [Interactive software demo].';dialog.append(title,p);const doi=window.SOD_ATLAS_CONFIG?.doi;if(doi){const a=document.createElement('a');a.href='https://doi.org/'+encodeURIComponent(doi);a.target='_blank';a.rel='noopener';a.textContent='DOI: '+doi;dialog.append(a)}else{const note=document.createElement('p');note.textContent='DOI pending — EnvAI has not received its own deposited DOI yet.';dialog.append(note)}}else{p.textContent='Use your browser’s Install app or Add to Home Screen command on HTTPS. In Safari on iPhone or iPad, use Share → Add to Home Screen.';dialog.append(title,p)}dialog.append(exit);dialog.showModal()}
 let deferred=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e});
 $('installBtn')?.addEventListener('click',async()=>{if(deferred){const prompt=deferred;deferred=null;try{await prompt.prompt()}catch{openDialog('install')}}else openDialog('install')});
 $('citeBtn')?.addEventListener('click',()=>openDialog('cite'));
})();
