window.DARK_RIVERS_DATA = Object.freeze({
  meta:{minYear:1971,maxYear:2025},
  reaches:[
    ["r01","North-west headwaters","M398 143 C373 171 356 198 344 235 C333 268 318 292 294 320"],
    ["r02","Northern reach","M452 135 C445 179 434 218 419 256 C404 292 389 322 371 352"],
    ["r03","North-east reach","M584 137 C604 172 619 207 623 244 C627 280 645 303 677 329"],
    ["r04","Eastern reach","M686 226 C672 258 674 294 693 330 C707 358 714 391 706 424"],
    ["r05","Midlands west reach","M365 278 C395 298 418 326 432 360 C449 400 475 424 507 447"],
    ["r06","Midlands east reach","M603 275 C569 294 545 320 530 350 C515 379 507 412 507 447"],
    ["r07","Western reach","M292 335 C329 349 357 374 376 405 C394 434 417 454 452 468"],
    ["r08","Central reach","M371 352 C411 348 450 352 486 367 C525 383 558 387 594 378"],
    ["r09","South-east reach","M594 378 C627 397 647 424 653 456 C660 492 678 516 710 531"],
    ["r10","South-central reach","M507 447 C516 482 511 514 493 548 C478 576 466 602 466 626"],
    ["r11","South-west reach","M452 468 C423 486 398 511 383 540 C366 571 344 590 314 596"],
    ["r12","Lower west reach","M376 405 C348 428 326 453 313 483 C301 511 286 532 266 547"],
    ["r13","Upper central tributary","M486 214 C477 252 480 286 494 316 C505 340 513 352 530 350"],
    ["r14","Eastern tributary","M747 314 C725 321 707 328 693 330 C666 334 635 352 594 378"],
    ["r15","Southern tributary","M573 535 C545 532 517 538 493 548 C466 560 445 578 428 602"]
  ].map(([id,name,d])=>({id,name,d})),
  events:[
    [1971,"r02","Q4","Good"],[1973,"r07","Q3-4","Moderate"],[1975,"r10","Q4-5","High"],
    [1978,"r04","Q3","Poor"],[1980,"r01","Q4","Good"],[1982,"r08","Q4","Good"],
    [1985,"r11","Q3-4","Moderate"],[1987,"r05","Q2-3","Poor"],[1989,"r03","Q5","High"],
    [1991,"r06","Q4","Good"],[1993,"r12","Q2","Bad"],[1995,"r14","Q3-4","Moderate"],
    [1997,"r09","Q3","Poor"],[1999,"r13","Q4","Good"],[2001,"r15","Q4","Good"],
    [2003,"r05","Q3-4","Moderate"],[2005,"r04","Q3-4","Moderate"],[2007,"r12","Q2-3","Poor"],
    [2009,"r07","Q4","Good"],[2011,"r09","Q3-4","Moderate"],[2013,"r11","Q4","Good"],
    [2015,"r01","Q4-5","High"],[2016,"r06","Q3-4","Moderate"],[2017,"r14","Q4","Good"],
    [2018,"r08","Q3","Poor"],[2019,"r03","Q4-5","High"],[2020,"r10","Q4","Good"],
    [2021,"r02","Q3-4","Moderate"],[2022,"r13","Q4","Good"],[2023,"r05","Q4","Good"],
    [2024,"r12","Q3-4","Moderate"],[2025,"r15","Q5","High"]
  ].map(([year,reachId,q,status],i)=>({year,reachId,q,status,station:`Prototype station ${String(i+1).padStart(2,"0")}`}))
});