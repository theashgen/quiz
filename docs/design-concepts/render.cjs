const {chromium} = require('../../web/node_modules/playwright');
const path = require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
 for (const name of ['a-warm','b-arcade','c-mint']) {
  await page.goto('file://'+path.join(__dirname,name+'.html'));
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:path.join(__dirname,name+'.png'),fullPage:true});
  console.log(name,await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,images:[...document.images].every(i=>i.complete&&i.naturalWidth>0)})));
 }
 await browser.close();
})();
