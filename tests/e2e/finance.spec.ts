import { test,expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
const book='33333333-3333-4333-8333-333333333333';
const newBook='55555555-5555-4555-8555-555555555555';
test.beforeAll(async({request})=>{
 // Compile the development routes and assert readiness before timing browser
 // interactions. A cold Next dev compilation is not a financial-load benchmark.
 expect((await request.get('http://127.0.0.1:4000/health')).status()).toBe(200);
 expect((await request.get('/en')).status()).toBe(200);
 expect((await request.get('/api/entities')).status()).toBe(200);
 const overview=await request.get('/api/overview?entityId='+book+'&from=2026-10-01&to=2026-10-31');
 expect(overview.status()).toBe(200);expect((await overview.json()).cash).toBe('7438.60');
});
test('desktop reference balances, evidence, exports, and accessibility',async({page})=>{
 await page.goto('/en?book='+book);
 await expect(page.getByRole('heading',{name:'Your money, clearly.'})).toBeVisible();
 await expect(page.getByRole('heading',{name:/7,438.60/})).toBeVisible();
 await page.screenshot({path:'docs/verification/overview-desktop.png',fullPage:true});
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
 expect(audit.violations).toEqual([]);
 await page.getByRole('button',{name:/^Bank\b/}).click();
 await expect(page.getByRole('heading',{name:'Bank',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Opening balance · Cash',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Reports',exact:true}).click();
 const issued=page.waitForResponse(r=>r.url().endsWith('/api/reports')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Generate snapshot',exact:true}).click();
 const issuedResponse=await issued;expect(issuedResponse.status()).toBe(201);
 expect((await issuedResponse.json()).totals.cash).toBe('7438.60');
 await expect(page.getByRole('heading',{name:'Snapshot · R-D02'})).toBeVisible();
 await page.getByText('View evidence',{exact:true}).click();
 await expect(page.getByText('Checksum:',{exact:false})).toBeVisible();
 const download=page.waitForEvent('download');await page.getByRole('link',{name:'Export CSV'}).click();
 const file=await download;expect(file.suggestedFilename()).toContain('R-D02');
 const csv=await readFile((await file.path())!,'utf8');
 expect(csv).toContain('"Bank","bank","EUR","7408.60"');
 expect(csv).toContain('"Cash","cash","EUR","30.00"');
 const evidenceHref=await page.getByRole('link',{name:'Download evidence',exact:true}).getAttribute('href');
 const evidence=await page.request.get(evidenceHref!);expect(evidence.status()).toBe(200);
 const frozen=await evidence.json();expect(frozen.totals.cash).toBe('7438.60');expect(csv).toContain(frozen.checksum);
 await page.screenshot({path:'docs/verification/snapshot-report.png',fullPage:true});
 const snapshotAudit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();
 expect(snapshotAudit.violations).toEqual([]);
});
test('account setup, keyboard review/post, refresh and reversal',async({page})=>{
 await page.goto('/en?book='+newBook);
 await expect(page.getByRole('button',{name:'Add account',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Add account',exact:true}).click();
 const name='Browser bank '+Date.now();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Account name',{exact:true}).fill(name);
 await dialog.getByLabel('Opening balance',{exact:true}).fill('100.00');
 await dialog.getByLabel('Opening date',{exact:true}).fill('2026-10-01');
 await dialog.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page.locator('.notice[role="status"]')).toContainText('Account created.');
 await page.getByRole('button',{name:'Record activity',exact:true}).click();
 await dialog.getByRole('combobox',{name:'Type',exact:true}).selectOption('income');
 await dialog.getByLabel('Amount · EUR',{exact:true}).fill('50.00');
 await dialog.getByLabel('Description',{exact:true}).fill('Browser synthetic income');
 await dialog.getByLabel('Accounting date',{exact:true}).fill('2026-10-11');
 await dialog.getByRole('combobox',{name:'Account',exact:true}).selectOption({label:name});
 await dialog.getByRole('button',{name:'Review activity'}).focus();
 await page.keyboard.press('Enter');
 await expect(dialog.getByRole('heading',{name:'Review before posting'})).toBeVisible();
 await expect(dialog.getByRole('cell',{name:'Income received',exact:true})).toBeVisible();
 await page.screenshot({path:'docs/verification/posting-review.png'});
 await dialog.getByRole('button',{name:'Confirm and post',exact:true}).focus();await page.keyboard.press('Enter');
 await expect(page.locator('.notice[role="status"]')).toContainText('Activity posted.');
 await page.reload();
 await page.getByRole('button',{name:'Browser synthetic income',exact:true}).first().click();
 await dialog.getByLabel('Reason for reversal',{exact:true}).fill('Reverse the browser test income');
 await dialog.getByLabel('Accounting date',{exact:true}).fill('2026-10-11');
 await dialog.getByRole('button',{name:'Confirm reversal',exact:true}).click();
 await expect(page.locator('.notice[role="status"]')).toContainText('Reversed');
});
test('mobile Persian layout and localized digits preserve canonical dates',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/fa?book='+book);
 await expect(page.getByRole('heading',{name:'پول شما، روشن و دقیق.'})).toBeVisible();
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 await expect(page.getByRole('heading',{name:/۷٬۴۳۸٫۶۰/})).toBeVisible();
 await page.screenshot({path:'docs/verification/overview-mobile-rtl.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:'ثبت فعالیت',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByLabel('مبلغ · EUR',{exact:true}).fill('۱۲٫۵۰');
 await dialog.getByLabel('شرح',{exact:true}).fill('نمونه بررسی ورودی');
 await dialog.getByLabel('تاریخ حسابداری',{exact:true}).fill('2026-10-11');
 await dialog.getByRole('button',{name:'بررسی فعالیت',exact:true}).click();
 await expect(dialog.getByRole('heading',{name:'بررسی پیش از ثبت'})).toBeVisible();
 await expect(dialog.getByText('2026-10-11',{exact:false})).toBeVisible();
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();
 expect(audit.violations).toEqual([]);
 await page.screenshot({path:'docs/verification/review-mobile-rtl.png',fullPage:true});
 await dialog.getByRole('button',{name:'بستن',exact:true}).click();
 await page.goto('/en?book='+newBook+'&from=2026-09-01&to=2026-09-30');
 await expect(page.locator('.summary-grid h2').first()).toContainText('0.00');
 await page.locator('footer').getByRole('link',{name:'فارسی',exact:true}).click();
 await expect(page.locator('#workspace')).toHaveValue(newBook);
 await expect(page.locator('.summary-grid h2').first()).toContainText('۰٫۰۰');
 const switched=new URL(page.url());expect(switched.searchParams.get('from')).toBe('2026-09-01');expect(switched.searchParams.get('to')).toBe('2026-09-30');
});
test('an interrupted posting response resumes the same operation after refresh',async({page})=>{
 for(const outcome of ['connection-lost','uncertain-server-error']){
 await page.goto('/en?book='+newBook);
 await page.getByRole('button',{name:'Record activity',exact:true}).click();
 const dialog=page.getByRole('dialog');
 const label='Response-loss case '+outcome+' '+Date.now();
 await dialog.getByLabel('Amount · EUR',{exact:true}).fill('1.00');
 await dialog.getByLabel('Description',{exact:true}).fill(label);
 await dialog.getByLabel('Accounting date',{exact:true}).fill('2026-10-11');
 await dialog.getByRole('button',{name:'Review activity',exact:true}).click();
 await expect(dialog.getByRole('heading',{name:'Review before posting'})).toBeVisible();
 await page.route('**/api/transactions',async route=>{
   const committed=await route.fetch();
   expect(committed.status()).toBe(201);
   if(outcome==='connection-lost')await route.abort('failed');
   else await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({code:'INTERNAL_ERROR',detail:'Synthetic uncertain server response'})});
 });
 await dialog.getByRole('button',{name:'Confirm and post',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('The response was interrupted.');
 await page.unroute('**/api/transactions');
 await page.reload();
 await expect(page.locator('.notice[role="status"]')).toContainText('Activity posted.');
 await page.getByRole('button',{name:'Activity',exact:true}).click();
 await expect(page.getByRole('button',{name:label,exact:true})).toHaveCount(1);
 }
});

test('web mutation denies a foreign origin and API requires authentication',async({request})=>{
 const csrf=await request.post('/api/accounts',{headers:{Origin:'https://untrusted.example'},data:{}});
 expect(csrf.status()).toBe(403);
 const unauthenticated=await request.get('http://127.0.0.1:4000/api/v1/entities');
 expect(unauthenticated.status()).toBe(401);
});

test('account draft and reversal receipts recover across refresh without repeating effects',async({page})=>{
 await page.goto('/en?book='+newBook);
 await page.getByRole('button',{name:'Add account',exact:true}).click();
 const dialog=page.getByRole('dialog');const name='Recovery bank '+Date.now();
 await dialog.getByLabel('Account name',{exact:true}).fill(name);
 await dialog.getByLabel('Opening balance',{exact:true}).fill('10.00');
 await dialog.getByLabel('Opening date',{exact:true}).fill('2026-10-01');
 await page.route('**/api/accounts',route=>route.abort('failed'));
 await dialog.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('The response was interrupted.');
 expect(await page.evaluate(()=>Object.keys(JSON.parse(sessionStorage.getItem('gfos_pending')!)).sort())).toEqual(['entityId','key']);
 await page.unroute('**/api/accounts');await page.reload();
 await expect(dialog.getByRole('heading',{name:'Check and retry',exact:true})).toBeVisible();
 await expect(dialog.getByText(name,{exact:true})).toBeVisible();
 await dialog.getByRole('button',{name:'Check and retry',exact:true}).click();
 await expect(page.locator('.notice[role="status"]')).toContainText('Account created.');
 await page.getByRole('button',{name:'Accounts',exact:true}).click();
 await expect(page.locator('.account-row').filter({hasText:name})).toHaveCount(1);
 await page.locator('.account-row').filter({hasText:name}).click();
 await page.getByRole('button',{name:'Opening balance · '+name,exact:true}).click();
 const reason='Recovered reversal '+Date.now();
 await dialog.getByLabel('Reason for reversal',{exact:true}).fill(reason);
 await dialog.getByLabel('Accounting date',{exact:true}).fill('2026-10-11');
 await page.route('**/api/journals/*/reverse',async route=>{const committed=await route.fetch();expect(committed.status()).toBe(201);await route.abort('failed');});
 await dialog.getByRole('button',{name:'Confirm reversal',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('The response was interrupted.');
 await page.unroute('**/api/journals/*/reverse');await page.reload();
 await expect(page.locator('.notice[role="status"]')).toContainText('Reversed');
 await page.getByRole('button',{name:'Activity',exact:true}).click();
 await expect(page.getByRole('button',{name:reason,exact:true})).toHaveCount(1);
});

test('a controlled large-balance display preserves exact digits without page overflow',async({page})=>{
 // Presentation-only response fixture. The matching real database aggregate
 // is independently verified by DB-13; this test never posts fabricated facts.
 const response=await page.request.get('/api/overview?entityId='+book+'&from=2026-10-01&to=2026-10-31');
 expect(response.status()).toBe(200);const fixture=await response.json();
 const huge='100000000000000000000004469.99';
 fixture.cash=huge;fixture.income='99999999999999999999999999.99';fixture.spending='0.00';fixture.journals=[];
 fixture.accounts[0].balance=huge;
 fixture.cashSeries=[{date:'2026-10-01',balance:'4470.00'},{date:'2026-10-11',balance:huge}];
 await page.route('**/api/overview?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(fixture)}));
 await page.setViewportSize({width:390,height:844});await page.goto('/en?book='+book);
 await expect(page.locator('.summary-grid h2').first()).toContainText('100,000,000,000,000,000,000,004,469.99');
 await expect(page.getByText('For these large balances, use the exact history table below.',{exact:true})).toBeVisible();
 await page.locator('.chart-table summary').click();
 await expect(page.locator('.chart-table tbody')).toContainText('100,000,000,000,000,000,000,004,469.99');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'docs/verification/large-value-display.png',fullPage:true});
});

