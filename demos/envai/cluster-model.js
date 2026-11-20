/* EnvAI's strict three-level hierarchy: environmental field -> AI class -> tool.
 * This is a pure data model shared by desktop and mobile. There are no
 * "featured" exceptions, catalogue-size thresholds, or uncategorised shortcuts.
 * Every approved tool belongs to exactly one category group and remains
 * accessible even when it is not drawn as an expanded SVG node.
 */
(function(root,factory){'use strict';
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.EnvAIClusters=api;
})(typeof window!=='undefined'?window:null,function(){'use strict';
  const TYPES=['Traditional digital','AI-augmented','AI-native'];
  const TYPE_NAMES={
    'Traditional digital':'Traditional',
    'AI-augmented':'AI-augmented',
    'AI-native':'AI-native'
  };
  const SHORT={'Traditional digital':'trad','AI-augmented':'aug','AI-native':'native'};
  const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const DEFAULT_VISIBLE_LIMIT=8;

  function organise(catalog,domainNames,expandedId=null,maxExpanded=DEFAULT_VISIBLE_LIMIT){
    const items=[],groups=new Map(),counts={};
    const limit=Math.max(1,Math.min(12,Number(maxExpanded)||DEFAULT_VISIBLE_LIMIT));
    for(const domain of domainNames){
      const approved=catalog.filter(t=>t.domain===domain&&
        t.mapVisible!==false&&TYPES.includes(t.aiType));
      const pending=catalog.filter(t=>t.domain===domain&&
        t.aiType==='Unverified'&&t.id.startsWith('lead:'));
      counts[domain]={approved:approved.length,pending:pending.length};
      for(const type of TYPES){
        const matching=approved.filter(t=>t.aiType===type);
        if(!matching.length)continue;
        const id='group:'+slug(domain)+':'+SHORT[type];
        const group={
          id,title:TYPE_NAMES[type]+' · '+matching.length,
          domain,aiType:type,capability:'Explore & decide',signals:[],tags:[],
          _group:true,_members:matching.map(t=>t.id),
          summary:matching.length+' '+TYPE_NAMES[type]+
            ' '+(matching.length===1?'application':'applications')+
            '. Select this category to reveal its tools or browse the complete list.'
        };
        groups.set(id,group);
        items.push(group);
        if(expandedId===id){
          items.push(...matching.slice(0,limit).map(t=>({...t,_groupParent:id})));
        }
      }
      if(pending.length){
        const id='group:'+slug(domain)+':review';
        const group={
          id,title:'New to review · '+pending.length,domain,
          aiType:'Unverified',capability:'Explore & decide',signals:[],tags:[],
          _group:true,_pending:true,_members:pending.map(t=>t.id),
          summary:'Website-backed discoveries awaiting verification. These are not approved tools or a fourth AI category.'
        };
        groups.set(id,group);
        items.push(group);
        if(expandedId===id){
          items.push(...pending.slice(0,limit).map(t=>({...t,_groupParent:id})));
        }
      }
    }
    return {items,groups,counts};
  }
  return Object.freeze({organise,TYPES});
});
