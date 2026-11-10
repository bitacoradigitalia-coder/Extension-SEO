const test = require('node:test');
const assert = require('node:assert/strict');
const { buildGeoReport } = require('../geo.js');
global.buildGeoReport = buildGeoReport;
const { buildReport, toMarkdown, buildLead, scoreChecks } = require('../analyze.js');

function data({total = 0, lazy = 0} = {}) {
  return {
    url:'https://example.test/page', host:'example.test', path:'/page', hasQuery:false, protocol:'https:',
    title:'Example page title', description:'A useful description for this page.', canonical:'https://example.test/page', canonicalMatches:true,
    hreflang:0, lang:'es', viewport:true, noindex:false, robots:'', robotsTxt:null, favicon:true, llmsTxt:false, webmcp:false,
    accessibility:{unnamedControls:0}, og:{title:'Title',description:'Description',image:'image.jpg'}, twitter:{card:'summary'},
    headings:[{level:1,text:'Title'}], words:400, contentText:'Example content '.repeat(50),
    images:{total,lazy,noAlt:0,missingDimensions:0,emptyAlt:0}, forms:{total:0,contact:0,ctas:0}, performance:{ttfb:100,renderBlockingScripts:0},
    toc:{hasToc:false,sectionAnchors:0}, contentImages:0, videos:0, links:{internal:2,external:0,nofollow:0,emptyAnchors:0,genericAnchors:0},
    schema:{types:[],invalid:0,hasAuthor:false,hasSameAs:false,hasAddress:false,hasReview:false}, author:'',published:false,modified:false,
    social:[],citations:0,authCitations:0,legal:{privacy:false,terms:false,cookies:false},contact:{tel:0,mail:0,page:false,address:false},
    local:{businessSchema:false,hasAddress:false,hasPhone:false,mapEmbed:false,gbpLink:false,napVisible:false,reservaLink:false},
    found:{emails:[],phones:[],whatsapp:''},aboutLink:false,mixed:0,firstPerson:0,caseHits:0,credentialHits:0,awardHits:0,reviewHits:0
  };
}

test('informational checks do not affect scores and unevaluated groups show N/D', () => {
  assert.equal(scoreChecks([{status:'pass'},{status:'fail'},{status:'info'}]), 50);
  assert.equal(scoreChecks([{status:'info'},{status:'info'}]), null);
});

test('lazy loading tolerates up to three images but does not pass one of five', () => {
  const four = buildReport(data({total:4,lazy:1}));
  const five = buildReport(data({total:5,lazy:1}));
  assert.equal(four.seo.checks.find(c=>c.id==='img-lazy').status, 'pass');
  assert.equal(five.seo.checks.find(c=>c.id==='img-lazy').status, 'warn');
});

test('report has ten audit areas and includes the brand footer', () => {
  const report = buildReport(data());
  assert.equal(report.areas.length, 10);
  assert.equal(report.areas.find(a=>a.name==='SEO para IA').score, null);
  assert.equal(report.seo.checks.find(c=>c.id==='llms-txt').status, 'info');
  assert.match(toMarkdown(report), /Informe generado con Primera Vista · Auditor SEO — https:\/\/primeravista\.es$/);
});

test('lead copy contains real line breaks and a configurable signature', () => {
  const report = buildReport(data());
  report.seo.checks.unshift({status:'fail',label:'Missing item',detail:'Check this'});
  const lead = buildLead(report,{name:'Ana',web:'https://ana.example'});
  assert.match(lead.email, /\n\n- Missing item/);
  assert.match(lead.email, /\n\n— Ana · https:\/\/ana\.example$/);
  assert.doesNotMatch(lead.email, /\\n/);
});
