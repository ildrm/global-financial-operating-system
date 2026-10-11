import { currencyScales } from '@gfos/financial-math';
import type { Currency } from '@gfos/financial-math';
export const locales=[
  {code:'en',label:'English',direction:'ltr',available:true},
  {code:'fa',label:'فارسی',direction:'rtl',available:true},
  {code:'tr',label:'Türkçe',direction:'ltr',available:false},
  {code:'fr',label:'Français',direction:'ltr',available:false},
  {code:'hi',label:'हिन्दी',direction:'ltr',available:false},
  {code:'zh-Hans',label:'简体中文',direction:'ltr',available:false},
  {code:'zh-Hant',label:'繁體中文',direction:'ltr',available:false},
  {code:'ja',label:'日本語',direction:'ltr',available:false},
  {code:'es',label:'Español',direction:'ltr',available:false},
  {code:'pt-BR',label:'Português (Brasil)',direction:'ltr',available:false},
  {code:'pt-PT',label:'Português (Portugal)',direction:'ltr',available:false},
  {code:'de',label:'Deutsch',direction:'ltr',available:false},
  {code:'hy',label:'Հայերեն',direction:'ltr',available:false},
  {code:'ar',label:'العربية',direction:'rtl',available:false},
] as const;
export type Locale='en'|'fa';
const en={
  overview:'Overview',accounts:'Accounts',activity:'Activity',reports:'Reports',settings:'Settings',
  title:'Your money, clearly.',subtitle:'A clear view of what came in, what went out, and what is yours.',
  record:'Record activity',cash:'Available cash',income:'Income in period',spending:'Spending in period',
  movement:'Cash movement',yourAccounts:'Your accounts',addAccount:'Add account',recent:'Recent activity',
  viewAll:'View all activity',date:'Date',description:'Description',type:'Type',amount:'Amount',status:'Status',
  recorded:'Recorded',synthetic:'Synthetic workspace · Recorded, not reconciled.',personal:'Personal',
  noActivity:'No activity in this period.',noAccounts:'Start with your first account.',
  emptyHelp:'Add an account and its opening balance to start your book.',loading:'Loading your book…',
  error:'The book could not be loaded.',retry:'Try again',workspace:'Workspace',language:'Language',
  from:'From',to:'To',apply:'Apply dates',newAccount:'Add an account',name:'Account name',kind:'Account type',
  opening:'Opening balance',openingDate:'Opening date',saveAccount:'Create account',cancel:'Cancel',
  bank:'Bank',cashAccount:'Cash',card:'Credit card',loan:'Loan liability',incomeEvent:'Income received',
  expense:'Spending',transfer:'Own-account transfer',borrowing:'Loan received',card_payment:'Card settlement',
  sourceAccount:'Account',otherAccount:'Destination / liability account',effectiveDate:'Accounting date',
  review:'Review activity',post:'Confirm and post',reviewTitle:'Review before posting',back:'Back to edit',
  journal:'Accounting details',debit:'Debit',credit:'Credit',postingNotice:'Posting creates a permanent record. A correction creates a linked reversal.',
  saved:'Activity posted.',checking:'The response was interrupted. Retry the same operation to check whether it was saved.',
  retryPost:'Check and retry',stale:'The book changed. Refresh and review again.',refresh:'Refresh book',
  detail:'Activity details',reverse:'Reverse activity',reason:'Reason for reversal',confirmReverse:'Confirm reversal',
  reversal:'Reversal',openingEvent:'Opening balance',reversed:'Reversed',close:'Close',recordedAt:'Recorded at',
  bookCurrency:'Book currency',quality:'Data quality',qualityHelp:'These balances reflect the records in this book. They have not been compared with a bank statement.',
  reportTitle:'Reports you can trace',reportHelp:'Generate an immutable snapshot of the selected book and period.',
  generate:'Generate snapshot',balances:'Account balances',cashFlow:'Cash flow statement',snapshot:'Snapshot',
  exportCsv:'Export CSV',downloadJson:'Download evidence',methodology:'Methodology',checksum:'Checksum',
  reportUnavailable:'The full 122-report catalog is tracked in the implementation register. Two foundation reports are available in this slice.',
  signIn:'Sign in with your identity provider',demoUser:'Local developer',netReceipt:'Net-receipt basis',
  languageReview:'Persian translations are drafts awaiting terminology review.',savedAccount:'Account created.',
  noSelection:'Choose an account',accountHelp:'Opening cash is balanced against opening equity. Borrowed funds are recorded separately.',
  amountsHelp:'Use the currency’s minor units. Persian and Arabic digits are accepted; ambiguous separators need correction.',
  overviewTable:'Cash balance history',bookVersion:'Book version',viewEvidence:'View evidence',operationReceipt:'Posting receipt',
  reportLoading:'Generating snapshot…',returnOverview:'Return to overview',negativeBalance:'Negative balances are allowed; this book does not confirm bank availability.',
  openingCash:'Opening cash',netMovement:'Net cash movement',closingCash:'Closing cash',
  chartLimit:'For these large balances, use the exact history table below.',
};
const fa:typeof en={
  overview:'نمای کلی',accounts:'حساب‌ها',activity:'فعالیت‌ها',reports:'گزارش‌ها',settings:'تنظیمات',
  title:'پول شما، روشن و دقیق.',subtitle:'نمایی روشن از ورودی‌ها، هزینه‌ها و دارایی‌های شما.',
  record:'ثبت فعالیت',cash:'وجه نقد موجود',income:'درآمد در بازه',spending:'هزینه در بازه',
  movement:'جریان وجه نقد',yourAccounts:'حساب‌های شما',addAccount:'افزودن حساب',recent:'فعالیت‌های اخیر',
  viewAll:'مشاهده همه فعالیت‌ها',date:'تاریخ',description:'شرح',type:'نوع',amount:'مبلغ',status:'وضعیت',
  recorded:'ثبت شده',synthetic:'فضای نمونه · ثبت شده و تطبیق داده نشده.',personal:'شخصی',
  noActivity:'در این بازه فعالیتی ثبت نشده است.',noAccounts:'با نخستین حساب خود شروع کنید.',
  emptyHelp:'حساب و مانده آغازین آن را اضافه کنید.',loading:'در حال دریافت دفتر…',
  error:'دریافت دفتر ناموفق بود.',retry:'تلاش دوباره',workspace:'فضای کاری',language:'زبان',
  from:'از',to:'تا',apply:'اعمال بازه',newAccount:'افزودن حساب',name:'نام حساب',kind:'نوع حساب',
  opening:'مانده آغازین',openingDate:'تاریخ آغاز',saveAccount:'ایجاد حساب',cancel:'انصراف',
  bank:'بانک',cashAccount:'نقد',card:'کارت اعتباری',loan:'بدهی وام',incomeEvent:'درآمد دریافت شده',
  expense:'هزینه',transfer:'انتقال بین حساب‌های خود',borrowing:'دریافت وام',card_payment:'تسویه کارت',
  sourceAccount:'حساب',otherAccount:'حساب مقصد یا بدهی',effectiveDate:'تاریخ حسابداری',
  review:'بررسی فعالیت',post:'تأیید و ثبت',reviewTitle:'بررسی پیش از ثبت',back:'بازگشت به ویرایش',
  journal:'جزئیات حسابداری',debit:'بدهکار',credit:'بستانکار',postingNotice:'ثبت، سابقه‌ای دائمی ایجاد می‌کند. اصلاح با سند معکوس مرتبط انجام می‌شود.',
  saved:'فعالیت ثبت شد.',checking:'پاسخ قطع شد. برای بررسی نتیجه، همان عملیات را دوباره ارسال کنید.',
  retryPost:'بررسی و تلاش مجدد',stale:'دفتر تغییر کرده است. به‌روزرسانی و دوباره بررسی کنید.',refresh:'به‌روزرسانی دفتر',
  detail:'جزئیات فعالیت',reverse:'معکوس کردن فعالیت',reason:'دلیل معکوس کردن',confirmReverse:'تأیید سند معکوس',
  reversal:'سند معکوس',openingEvent:'مانده آغازین',reversed:'معکوس شده',close:'بستن',recordedAt:'زمان ثبت',
  bookCurrency:'ارز دفتر',quality:'کیفیت داده',qualityHelp:'این مانده‌ها بر اساس سوابق دفتر هستند و با صورت‌حساب بانک تطبیق داده نشده‌اند.',
  reportTitle:'گزارش‌های قابل پیگیری',reportHelp:'از دفتر و بازه انتخاب شده، تصویری ثابت و تغییرناپذیر بسازید.',
  generate:'ایجاد تصویر ثابت',balances:'مانده حساب‌ها',cashFlow:'صورت جریان وجه نقد',snapshot:'تصویر ثابت',
  exportCsv:'دریافت CSV',downloadJson:'دریافت شواهد',methodology:'روش محاسبه',checksum:'چک‌سام',
  reportUnavailable:'فهرست کامل ۱۲۲ گزارش در برنامه پیاده‌سازی ثبت شده است. دو گزارش پایه در این مرحله در دسترس هستند.',
  signIn:'ورود با ارائه‌دهنده هویت',demoUser:'توسعه‌دهنده محلی',netReceipt:'مبنای دریافت خالص',
  languageReview:'ترجمه فارسی پیش‌نویس است و به بررسی اصطلاحات نیاز دارد.',savedAccount:'حساب ایجاد شد.',
  noSelection:'حسابی را انتخاب کنید',accountHelp:'وجه نقد آغازین با سرمایه آغازین تراز می‌شود. دریافت وام جداگانه ثبت می‌شود.',
  amountsHelp:'از دقت مجاز ارز استفاده کنید. رقم‌های فارسی و عربی پذیرفته می‌شوند؛ جداکننده مبهم باید اصلاح شود.',
  overviewTable:'تاریخچه مانده نقد',bookVersion:'نسخه دفتر',viewEvidence:'مشاهده شواهد',operationReceipt:'رسید ثبت',
  reportLoading:'در حال ایجاد تصویر ثابت…',returnOverview:'بازگشت به نمای کلی',negativeBalance:'مانده منفی مجاز است؛ دفتر موجودی قابل استفاده بانک را تأیید نمی‌کند.',
  openingCash:'وجه نقد آغازین',netMovement:'خالص جریان نقد',closingCash:'وجه نقد پایانی',
  chartLimit:'برای این مانده‌های بزرگ، از جدول دقیق تاریخچه در پایین استفاده کنید.',
};
export function messages(locale:Locale):typeof en{return locale==='fa'?fa:en;}
export function parseLocalizedAmount(raw:string,locale:Locale):string {
  let value=raw.trim().replace(/[۰-۹٠-٩]/g,ch=>{
    const code=ch.charCodeAt(0);return String(code>=0x06f0?code-0x06f0:code-0x0660);
  });
  const decimalMark=locale==='fa'?'٫':'.';
  const grouping=locale==='fa'?'٬':',';
  if(value.includes(grouping)) {
    const integer=value.split(decimalMark)[0] ?? '';
    const parts=integer.replace(/^-/,'').split(grouping);
    if(!/^\d{1,3}$/.test(parts[0] ?? '') || parts.slice(1).some(p=>!/^\d{3}$/.test(p))) throw new Error('Ambiguous grouping separator.');
    value=value.split(grouping).join('');
  }
  value=value.replace('٫','.');
  if(!/^-?(0|[1-9]\d{0,25})(\.\d{1,12})?$/.test(value)) throw new Error('Enter an unambiguous decimal amount.');
  return value;
}
export function formatMoney(amount:string,currency:string,locale:Locale):string {
  if(!/^-?\d+(\.\d+)?$/.test(amount)) return '—';
  const negative=amount.startsWith('-');
  const [integer='0',fraction='']=amount.replace(/^-/,'').split('.');
  const magnitude=BigInt(integer);
  const signed=negative?(magnitude===0n?-1n:-magnitude):magnitude;
  if(!Object.hasOwn(currencyScales,currency))return '—';
  const scale=currencyScales[currency as Currency];
  if(/[1-9]/.test(fraction.slice(scale)))return '—';
  // CLDR display defaults can differ from the explicit accounting policy.
  // Always retain the book's registered scale, including IRR minor units.
  const formatter=new Intl.NumberFormat(locale,{style:'currency',currency,currencyDisplay:'code',minimumFractionDigits:scale,maximumFractionDigits:scale});
  const parts=formatter.formatToParts(signed);
  const digits=Array.from({length:10},(_,i)=>new Intl.NumberFormat(locale,{useGrouping:false}).format(i));
  return parts.map(part=>{
    if(part.type==='fraction') return fraction.padEnd(part.value.length,'0').slice(0,part.value.length).replace(/\d/g,d=>digits[parseInt(d,10)] ?? d);
    if(part.type==='integer' && negative && magnitude===0n) return digits[0];
    return part.value;
  }).join('');
}

