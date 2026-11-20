/* Pure EnvAI constellation grouping. All catalogue records remain searchable.
 * When a field becomes dense, show representative tools and category nodes.
 * Clicking a category expands that set; unverified leads have a separate review
 * node and never masquerade as a fourth AI category.
 */
(function(root,factory){'use strict';
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.EnvAIClusters=api;
})(typeof window!=='undefined'?window:null,function(){'use strict';
  const TYPES=['Traditional digital','AI-augmented','AI-native'];
  const TYPE_NAMES={'Traditional digital':'Traditional','AI-augmented':'AI-augmented','AI-native':'AI-native'};
  const SHORT={'Traditional digital':'trad','AI-augmented':'aug','AI-native':'native'};
  const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const EXPANDED_LIMIT=8; // Avoid overflowing mobile even with large future catalogues.
  function organise(catalog,domainNames,expandedId=null,threshold=10){
    const items=[],groups=new Map(),counts={};
    for(const domain of domainNames){
      const approved=catalog.filter(t=>t.domain===domain&&t.mapVisible!==false&&TYPES.includes(t.aiType));
      const pending=catalog.filter(t=>t.domain===domain&&t.aiType==='Unverified'&&t.id.startsWith('lead:'));
      counts[domain]={approved:approved.length,pending:pending.length};
      if(approved.length<=threshold){
        items.push(...approved);
      } else {
        // Existing high-profile entries stay visible; everyone else is accessible
        // through a category node or via the unchanged full-catalogue search.
        const featured=approved.slice(0,2),remainder=approved.slice(2);
        items.push(...featured);
        for(const type of TYPES){
          const matching=remainder.filter(t=>t.aiType===type);
          if(matching.length<3){
            items.push(...matching);
            continue;
          }
          const id='group:'+slug(domain)+':'+SHORT[type];
          const group={id,title:TYPE_NAMES[type]+' · '+matching.length,
            domain,aiType:type,capability:'Explore & decide',signals:[],
            tags:[],_group:true,_members:matching.map(t=>t.id),
            summary:matching.length+' '+TYPE_NAMES[type]+' applications. Select this node to reveal each tool, or open the full group list.'};
          groups.set(id,group);
          items.push(group);
          if(expandedId===id)items.push(...matching.slice(0,EXPANDED_LIMIT).map(t=>({...t,_groupParent:id})));
        }
      }
      if(pending.length){
        const id='group:'+slug(domain)+':review';
        const group={id,title:'New to review · '+pending.length,domain,
          aiType:'Unverified',capability:'Explore & decide',signals:[],
          tags:[],_group:true,_pending:true,_members:pending.map(t=>t.id),
          summary:'Website-backed discoveries awaiting scientific and AI classification checks. They are not approved catalogue entries.'};
        groups.set(id,group);items.push(group);
        if(expandedId===id)items.push(...pending.slice(0,EXPANDED_LIMIT).map(t=>({...t,_groupParent:id})));
      }
    }
    return {items,groups,counts};
  }
  return Object.freeze({organise,TYPES});
});
