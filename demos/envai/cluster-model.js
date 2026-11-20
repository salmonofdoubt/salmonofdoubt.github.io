/* EnvAI purpose hierarchy.
 * Environmental field -> what a tool helps investigate -> individual tools.
 * AI type (Traditional / augmented / native) is an independent attribute of
 * each tool, never a navigation level. This pure model drives phone and desktop
 * consistently, without featured exceptions or silently omitted catalogue rows.
 */
(function(root,factory){'use strict';
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.EnvAIClusters=api;
})(typeof window!=='undefined'?window:null,function(){'use strict';
  const TYPES=['Traditional digital','AI-augmented','AI-native'];
  const PURPOSES=[
    {domain:'Land & satellites',id:'earth-observation',label:'Maps & Earth observation',short:'Maps & imagery',
      description:'Discover imagery, geographic basemaps and spatial-analysis tools.'},
    {domain:'Land & satellites',id:'land-change',label:'Land cover & change',short:'Land change',
      description:'Map land cover, detect change and analyse environmental patterns.'},
    {domain:'Land & satellites',id:'forests-restoration',label:'Forests, fire & restoration',short:'Forests & fire',
      description:'Monitor forest condition, wildfire activity and ecosystem restoration.'},

    {domain:'Biodiversity & wildlife',id:'birds-migration',label:'Birds & migration',short:'Birds',
      description:'Identify, observe and track birds and their movements.'},
    {domain:'Biodiversity & wildlife',id:'wildlife-identification',label:'Wildlife identification',short:'Identify wildlife',
      description:'Identify species in photographs, acoustic recordings and camera traps.'},
    {domain:'Biodiversity & wildlife',id:'species-distributions',label:'Species records & distributions',short:'Species records',
      description:'Explore where species occur, their ranges and their conservation status.'},
    {domain:'Biodiversity & wildlife',id:'conservation-habitats',label:'Conservation & habitats',short:'Conservation',
      description:'Investigate protected areas and manage wildlife conservation.'},

    {domain:'Climate & energy',id:'climate-observations',label:'Climate observations',short:'Climate data',
      description:'Explore temperatures, climate datasets, historical change and projections.'},
    {domain:'Climate & energy',id:'air-quality',label:'Air quality & atmosphere',short:'Air quality',
      description:'Investigate air pollution and atmospheric composition.'},
    {domain:'Climate & energy',id:'weather-hazards',label:'Weather & climate hazards',short:'Weather & risks',
      description:'Forecast weather and assess heat, coastal and other climate hazards.'},
    {domain:'Climate & energy',id:'emissions-energy',label:'Emissions & energy',short:'Emissions & energy',
      description:'Track greenhouse gases, electricity generation and energy-system emissions.'},

    {domain:'Water & oceans',id:'rivers-water-quality',label:'Rivers & water quality',short:'Rivers & quality',
      description:'Explore waterbody condition, river monitoring and changes in surface water.'},
    {domain:'Water & oceans',id:'floods-water-stress',label:'Floods & water stress',short:'Floods & stress',
      description:'Investigate flooding, drought and pressures on water availability.'},
    {domain:'Water & oceans',id:'marine-species',label:'Marine life & species',short:'Marine life',
      description:'Identify and monitor fish, cetaceans and other marine animals.'},
    {domain:'Water & oceans',id:'fishing-vessels',label:'Fishing & vessels',short:'Fishing & vessels',
      description:'Monitor fishing activity, maritime traffic and vessel behaviour.'},
    {domain:'Water & oceans',id:'ocean-conditions',label:'Ocean conditions',short:'Ocean data',
      description:'Explore ocean currents, salinity, marine habitats and seabed data.'}
  ];
  const DEFAULT_VISIBLE_LIMIT=8;
  const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const knownPurposes=new Set(PURPOSES.map(p=>p.domain+'|'+p.id));
  function organise(catalog,domainNames,expandedId=null,maxExpanded=DEFAULT_VISIBLE_LIMIT){
    const items=[],groups=new Map(),counts={};
    const limit=Math.max(1,Math.min(12,Number(maxExpanded)||DEFAULT_VISIBLE_LIMIT));
    for(const domain of domainNames){
      const approved=catalog.filter(t=>t.domain===domain&&t.mapVisible!==false&&TYPES.includes(t.aiType));
      const pending=catalog.filter(t=>t.domain===domain&&t.aiType==='Unverified'&&t.id.startsWith('lead:'));
      const unassigned=approved.filter(t=>!knownPurposes.has(domain+'|'+t.purpose));
      counts[domain]={approved:approved.length,pending:pending.length,unassigned:unassigned.length};
      for(const def of PURPOSES.filter(p=>p.domain===domain)){
        const matching=approved.filter(t=>t.purpose===def.id);
        if(!matching.length)continue;
        const id='group:'+slug(domain)+':'+def.id;
        const group={id,title:def.label+' · '+matching.length,
          label:def.label,short:def.short,domain,purpose:def.id,
          aiType:'Purpose group',capability:'Explore & decide',signals:[],tags:[],
          _group:true,_purpose:true,_members:matching.map(t=>t.id),
          summary:def.description+' '+matching.length+
            ' '+(matching.length===1?'tool':'tools')+' available.'};
        groups.set(id,group);items.push(group);
        if(expandedId===id){
          items.push(...matching.slice(0,limit).map(t=>({...t,_groupParent:id})));
        }
      }
      // A newly curated item with missing purpose is *visible* for correction,
      // but can never silently enter an arbitrary environmental group.
      if(unassigned.length){
        const id='group:'+slug(domain)+':unassigned';
        const group={id,title:'Needs topic · '+unassigned.length,
          label:'Needs topic',short:'Needs topic',domain,purpose:null,
          aiType:'Unverified',capability:'Explore & decide',signals:[],tags:[],
          _group:true,_pending:true,_members:unassigned.map(t=>t.id),
          summary:'These approved tools still need a primary environmental-purpose assignment.'};
        groups.set(id,group);items.push(group);
        if(expandedId===id)items.push(...unassigned.slice(0,limit).map(t=>({...t,_groupParent:id})));
      }
      if(pending.length){
        const id='group:'+slug(domain)+':review';
        const group={id,title:'New to review · '+pending.length,
          label:'New to review',short:'New to review',domain,purpose:null,
          aiType:'Unverified',capability:'Explore & decide',signals:[],tags:[],
          _group:true,_pending:true,_members:pending.map(t=>t.id),
          summary:'New websites awaiting validation. Neither their environmental purpose nor their AI classification is approved.'};
        groups.set(id,group);items.push(group);
        if(expandedId===id)items.push(...pending.slice(0,limit).map(t=>({...t,_groupParent:id})));
      }
    }
    return {items,groups,counts};
  }
  return Object.freeze({organise,TYPES,PURPOSES});
});
