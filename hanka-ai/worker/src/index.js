import { HANKA_SYSTEM_PROMPT } from "./prompt.js";
import { askModel, cleanAnswer, describeResult, extractText, guardGroundedAnswer, validateEvidenceTags } from "./model.js";
import { retrieveContext, upsertDocuments } from "./rag.js";

const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 4000;
const ALLOWED_ROLES = new Set(["user", "assistant"]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = origin === "https://zapytajhanki.com" || origin === "https://www.zapytajhanki.com";
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://zapytajhanki.com",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

function json(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request)
    }
  });
}

function isClearlyCasual(text) {
  const value = String(text || "").trim().toLowerCase();
  if (!value || value.length > 260) return false;
  if (/^(cześć|czesc|hej|hejka|siema|elo|dzień dobry|dzien dobry|dobry wieczór|dobry wieczor|dzięki|dzieki|dziękuję|dziekuje|co tam|co u ciebie|co słychać|co slychac|jak tam|jak leci|jak się masz|jak sie masz|kim jesteś|kim jestes|opowiedz żart|opowiedz zart|powiedz żart|powiedz zart)[!?.\s]*$/i.test(value)) return true;
  if (/^(pokaż|pokaz|powiedz|napisz|zaśpiewaj|zaspiewaj)\b/i.test(value) && !/\b(ile|limit|podatek|prawo|ubezpieczenie|kredyt|401\(?k\)?|ira|social security|medicare|medicaid)\b/i.test(value)) return true;
  if (/\b(czemu|dlaczego)\b.*\b(mówisz|mowisz|piszesz|odpowiadasz|zaczynasz|powtarzasz)\b/i.test(value)) return true;
  return false;
}

function isLikelyFollowUp(messages) {
  if (!Array.isArray(messages) || messages.length < 3) return false;
  const value = String(messages[messages.length - 1]?.content || "").trim().toLowerCase();
  if (!value || value.length > 220) return false;
  return /^(a\s|ale\s|i\s|to\s|no\s|czyli\s|więc\s|wiec\s|co z\s|co jeśli\s|co jesli\s|jak z\s|a na\s|a co\s|a jak\s|a jeśli\s|a jesli\s|masz\s|możesz\s|mozesz\s|jeszcze\s)/i.test(value);
}

function retrievalQuery(messages) {
  const latest = messages[messages.length - 1]?.content || "";
  if (!isLikelyFollowUp(messages)) return latest;
  const history = messages.slice(0, -1);
  const priorUser = [...history].reverse().find((m) => m.role === "user")?.content || "";
  const priorAssistant = [...history].reverse().find((m) => m.role === "assistant")?.content || "";
  const earlierUser = [...history].reverse().filter((m) => m.role === "user")[1]?.content || "";
  return [earlierUser, priorUser, priorAssistant, latest].filter(Boolean).join("\n");
}

function cleanMessages(input) {
  if (!Array.isArray(input)) return null;
  const recent = input.slice(-MAX_MESSAGES);
  const cleaned = [];

  for (const item of recent) {
    if (!item || !ALLOWED_ROLES.has(item.role) || typeof item.content !== "string") return null;
    const content = item.content.trim();
    if (!content || content.length > MAX_MESSAGE_CHARS) return null;
    cleaned.push({ role: item.role, content });
  }

  if (!cleaned.length || cleaned[cleaned.length - 1].role !== "user") return null;
  return cleaned;
}

const SEED_URLS = [
  "https://zapytajhanki.com/california/car-title/",
  "https://zapytajhanki.com/california/disaster-assistance/",
  "https://zapytajhanki.com/california/health-insurance/",
  "https://zapytajhanki.com/california/liheap/",
  "https://zapytajhanki.com/california/medicaid/",
  "https://zapytajhanki.com/california/minimum-wage/",
  "https://zapytajhanki.com/california/overtime/",
  "https://zapytajhanki.com/california/paid-sick-leave/",
  "https://zapytajhanki.com/california/podatki/",
  "https://zapytajhanki.com/california/prawo-jazdy/",
  "https://zapytajhanki.com/california/property-tax/",
  "https://zapytajhanki.com/california/real-id/",
  "https://zapytajhanki.com/california/rejestracja-samochodu/",
  "https://zapytajhanki.com/california/sales-tax/",
  "https://zapytajhanki.com/california/snap/",
  "https://zapytajhanki.com/california/state-id/",
  "https://zapytajhanki.com/california/tenant-rights/",
  "https://zapytajhanki.com/california/ubezpieczenie-samochodu/",
  "https://zapytajhanki.com/california/unemployment/",
  "https://zapytajhanki.com/california/workers-compensation/",
  "https://zapytajhanki.com/christmas/christmas-breakfast-casserole/",
  "https://zapytajhanki.com/christmas/christmas-cookie-platter/",
  "https://zapytajhanki.com/christmas/christmas-crack-saltine-toffee/",
  "https://zapytajhanki.com/christmas/christmas-fudge/",
  "https://zapytajhanki.com/christmas/christmas-ham/",
  "https://zapytajhanki.com/christmas/christmas-morning-cinnamon-rolls/",
  "https://zapytajhanki.com/christmas/christmas-party-w-pracy/",
  "https://zapytajhanki.com/christmas/christmas-potluck/",
  "https://zapytajhanki.com/christmas/eggnog/",
  "https://zapytajhanki.com/christmas/gingerbread-cookies/",
  "https://zapytajhanki.com/christmas/jedzenie-na-christmas/",
  "https://zapytajhanki.com/christmas/peanut-butter-blossoms/",
  "https://zapytajhanki.com/christmas/pecan-pie/",
  "https://zapytajhanki.com/christmas/peppermint-bark/",
  "https://zapytajhanki.com/christmas/prime-rib/",
  "https://zapytajhanki.com/christmas/secret-santa-gifts/",
  "https://zapytajhanki.com/christmas/secret-santa-white-elephant/",
  "https://zapytajhanki.com/christmas/slownik-zwroty-po-angielsku/",
  "https://zapytajhanki.com/christmas/white-elephant-gifts/",
  "https://zapytajhanki.com/dokumenty/real-id/",
  "https://zapytajhanki.com/dokumenty/zgubiona-karta-social-security/",
  "https://zapytajhanki.com/dokumenty/zmiana-adresu/",
  "https://zapytajhanki.com/dom/appraisal-gap/",
  "https://zapytajhanki.com/dom/biweekly-mortgage-payments/",
  "https://zapytajhanki.com/dom/cash-out-refinance-vs-heloc/",
  "https://zapytajhanki.com/dom/closing-costs/",
  "https://zapytajhanki.com/dom/closing-disclosure/",
  "https://zapytajhanki.com/dom/condo-vs-house/",
  "https://zapytajhanki.com/dom/credit-score-mortgage/",
  "https://zapytajhanki.com/dom/down-payment/",
  "https://zapytajhanki.com/dom/earnest-money/",
  "https://zapytajhanki.com/dom/escrow-shortage/",
  "https://zapytajhanki.com/dom/escrow/",
  "https://zapytajhanki.com/dom/fha-vs-conventional/",
  "https://zapytajhanki.com/dom/first-time-home-buyer/",
  "https://zapytajhanki.com/dom/fixed-vs-arm/",
  "https://zapytajhanki.com/dom/gift-funds-down-payment/",
  "https://zapytajhanki.com/dom/heloc-vs-home-equity-loan/",
  "https://zapytajhanki.com/dom/hoa/",
  "https://zapytajhanki.com/dom/home-equity/",
  "https://zapytajhanki.com/dom/homeowners-insurance/",
  "https://zapytajhanki.com/dom/inspection-vs-appraisal/",
  "https://zapytajhanki.com/dom/kupno-domu-przed-sprzedaza/",
  "https://zapytajhanki.com/dom/loan-estimate/",
  "https://zapytajhanki.com/dom/mortgage-1099/",
  "https://zapytajhanki.com/dom/mortgage-bez-green-card/",
  "https://zapytajhanki.com/dom/mortgage-payoff/",
  "https://zapytajhanki.com/dom/mortgage-points/",
  "https://zapytajhanki.com/dom/mortgage-rate-lock/",
  "https://zapytajhanki.com/dom/mortgage-recast/",
  "https://zapytajhanki.com/dom/mortgage-servicer-transfer/",
  "https://zapytajhanki.com/dom/mortgage/",
  "https://zapytajhanki.com/dom/pierwsze-mieszkanie-po-przyjezdzie/",
  "https://zapytajhanki.com/dom/pmi/",
  "https://zapytajhanki.com/dom/preapproval/",
  "https://zapytajhanki.com/dom/problem-ze-splata-mortgage/",
  "https://zapytajhanki.com/dom/property-tax/",
  "https://zapytajhanki.com/dom/refinancing-mortgage/",
  "https://zapytajhanki.com/dom/renters-insurance/",
  "https://zapytajhanki.com/dom/seller-credits/",
  "https://zapytajhanki.com/dom/sprzedaz-domu-z-mortgage/",
  "https://zapytajhanki.com/dom/title-insurance/",
  "https://zapytajhanki.com/dom/wynajem-mieszkania/",
  "https://zapytajhanki.com/dzieci-i-rodzina/504-plan/",
  "https://zapytajhanki.com/dzieci-i-rodzina/529-plan/",
  "https://zapytajhanki.com/dzieci-i-rodzina/after-school-program/",
  "https://zapytajhanki.com/dzieci-i-rodzina/ap-classes/",
  "https://zapytajhanki.com/dzieci-i-rodzina/birth-certificate-dziecka/",
  "https://zapytajhanki.com/dzieci-i-rodzina/bullying-w-szkole/",
  "https://zapytajhanki.com/dzieci-i-rodzina/child-care-assistance/",
  "https://zapytajhanki.com/dzieci-i-rodzina/child-dependent-care-credit/",
  "https://zapytajhanki.com/dzieci-i-rodzina/college-dorm/",
  "https://zapytajhanki.com/dzieci-i-rodzina/community-college/",
  "https://zapytajhanki.com/dzieci-i-rodzina/daycare-vs-preschool/",
  "https://zapytajhanki.com/dzieci-i-rodzina/dependent-care-fsa/",
  "https://zapytajhanki.com/dzieci-i-rodzina/dokumenty-do-szkoly/",
  "https://zapytajhanki.com/dzieci-i-rodzina/dual-enrollment/",
  "https://zapytajhanki.com/dzieci-i-rodzina/dual-language-program/",
  "https://zapytajhanki.com/dzieci-i-rodzina/dwa-paszporty-podroz-polska-usa/",
  "https://zapytajhanki.com/dzieci-i-rodzina/dwujezyczne-dziecko-polski/",
  "https://zapytajhanki.com/dzieci-i-rodzina/dziecko-samo-w-domu/",
  "https://zapytajhanki.com/dzieci-i-rodzina/esl-english-learner/",
  "https://zapytajhanki.com/dzieci-i-rodzina/fafsa/",
  "https://zapytajhanki.com/dzieci-i-rodzina/ferpa-college/",
  "https://zapytajhanki.com/dzieci-i-rodzina/financial-aid-offer/",
  "https://zapytajhanki.com/dzieci-i-rodzina/free-school-lunch/",
  "https://zapytajhanki.com/dzieci-i-rodzina/gpa-high-school/",
  "https://zapytajhanki.com/dzieci-i-rodzina/harcerstwo-polskie-usa/",
  "https://zapytajhanki.com/dzieci-i-rodzina/head-start-early-head-start/",
  "https://zapytajhanki.com/dzieci-i-rodzina/homeschooling/",
  "https://zapytajhanki.com/dzieci-i-rodzina/iep-special-education/",
  "https://zapytajhanki.com/dzieci-i-rodzina/ile-kosztuje-daycare/",
  "https://zapytajhanki.com/dzieci-i-rodzina/jak-aplikowac-na-college/",
  "https://zapytajhanki.com/dzieci-i-rodzina/jak-sprawdzic-daycare/",
  "https://zapytajhanki.com/dzieci-i-rodzina/jak-znalezc-daycare/",
  "https://zapytajhanki.com/dzieci-i-rodzina/kindergarten-pre-k-preschool/",
  "https://zapytajhanki.com/dzieci-i-rodzina/licencja-daycare/",
  "https://zapytajhanki.com/dzieci-i-rodzina/medicaid-chip-dziecko/",
  "https://zapytajhanki.com/dzieci-i-rodzina/nanny-w-usa/",
  "https://zapytajhanki.com/dzieci-i-rodzina/nieobecnosci-truancy/",
  "https://zapytajhanki.com/dzieci-i-rodzina/oceny-a-f-report-card/",
  "https://zapytajhanki.com/dzieci-i-rodzina/parent-teacher-conference/",
  "https://zapytajhanki.com/dzieci-i-rodzina/paszport-usa-dla-dziecka/",
  "https://zapytajhanki.com/dzieci-i-rodzina/pesel-dla-dziecka/",
  "https://zapytajhanki.com/dzieci-i-rodzina/polska-szkola-sobotnia/",
  "https://zapytajhanki.com/dzieci-i-rodzina/polski-paszport-dla-dziecka/",
  "https://zapytajhanki.com/dzieci-i-rodzina/public-vs-private-school/",
  "https://zapytajhanki.com/dzieci-i-rodzina/rejestracja-dziecka-w-polsce/",
  "https://zapytajhanki.com/dzieci-i-rodzina/sat-act/",
  "https://zapytajhanki.com/dzieci-i-rodzina/scholarships-college/",
  "https://zapytajhanki.com/dzieci-i-rodzina/school-bus/",
  "https://zapytajhanki.com/dzieci-i-rodzina/school-district/",
  "https://zapytajhanki.com/dzieci-i-rodzina/seal-of-biliteracy-polski/",
  "https://zapytajhanki.com/dzieci-i-rodzina/snap/",
  "https://zapytajhanki.com/dzieci-i-rodzina/ssn-dla-dziecka/",
  "https://zapytajhanki.com/dzieci-i-rodzina/student-loans/",
  "https://zapytajhanki.com/dzieci-i-rodzina/summer-camp/",
  "https://zapytajhanki.com/dzieci-i-rodzina/szczepienia-do-szkoly/",
  "https://zapytajhanki.com/dzieci-i-rodzina/szkola-w-usa/",
  "https://zapytajhanki.com/dzieci-i-rodzina/trade-school/",
  "https://zapytajhanki.com/dzieci-i-rodzina/transkrypcja-aktu-urodzenia/",
  "https://zapytajhanki.com/dzieci-i-rodzina/wic/",
  "https://zapytajhanki.com/dzieci-i-rodzina/zgoda-rodzica-na-podroz-dziecka/",
  "https://zapytajhanki.com/emerytura/401k/",
  "https://zapytajhanki.com/emerytura/polska-usa/",
  "https://zapytajhanki.com/emerytura/roth-ira/",
  "https://zapytajhanki.com/emerytura/social-security-credits/",
  "https://zapytajhanki.com/emerytura/social-security/",
  "https://zapytajhanki.com/florida/car-title/",
  "https://zapytajhanki.com/florida/health-insurance/",
  "https://zapytajhanki.com/florida/hurricane-disaster-help/",
  "https://zapytajhanki.com/florida/liheap/",
  "https://zapytajhanki.com/florida/medicaid/",
  "https://zapytajhanki.com/florida/minimum-wage/",
  "https://zapytajhanki.com/florida/overtime/",
  "https://zapytajhanki.com/florida/paid-leave/",
  "https://zapytajhanki.com/florida/podatki/",
  "https://zapytajhanki.com/florida/prawo-jazdy/",
  "https://zapytajhanki.com/florida/property-tax/",
  "https://zapytajhanki.com/florida/real-id/",
  "https://zapytajhanki.com/florida/rejestracja-samochodu/",
  "https://zapytajhanki.com/florida/sales-tax/",
  "https://zapytajhanki.com/florida/snap/",
  "https://zapytajhanki.com/florida/state-id/",
  "https://zapytajhanki.com/florida/tenant-rights/",
  "https://zapytajhanki.com/florida/ubezpieczenie-samochodu/",
  "https://zapytajhanki.com/florida/unemployment/",
  "https://zapytajhanki.com/florida/workers-compensation/",
  "https://zapytajhanki.com/halloween/apple-cider/",
  "https://zapytajhanki.com/halloween/bezpieczne-halloween/",
  "https://zapytajhanki.com/halloween/caramel-apples/",
  "https://zapytajhanki.com/halloween/halloween-candy/",
  "https://zapytajhanki.com/halloween/halloween-party/",
  "https://zapytajhanki.com/halloween/halloween-po-angielsku/",
  "https://zapytajhanki.com/halloween/halloween-punch/",
  "https://zapytajhanki.com/halloween/halloween-w-szkole/",
  "https://zapytajhanki.com/halloween/jak-przygotowac-dom/",
  "https://zapytajhanki.com/halloween/jedzenie-na-halloween/",
  "https://zapytajhanki.com/halloween/kostium-na-halloween/",
  "https://zapytajhanki.com/halloween/o-ktorej-trick-or-treating/",
  "https://zapytajhanki.com/halloween/popcorn-balls/",
  "https://zapytajhanki.com/halloween/pumpkin-bread/",
  "https://zapytajhanki.com/halloween/pumpkin-carving/",
  "https://zapytajhanki.com/halloween/pumpkin-pie/",
  "https://zapytajhanki.com/halloween/rice-krispies-treats/",
  "https://zapytajhanki.com/halloween/roasted-pumpkin-seeds/",
  "https://zapytajhanki.com/halloween/sugar-cookies/",
  "https://zapytajhanki.com/halloween/trick-or-treating/",
  "https://zapytajhanki.com/illinois/emissions-test/",
  "https://zapytajhanki.com/illinois/medicaid/",
  "https://zapytajhanki.com/illinois/minimum-wage/",
  "https://zapytajhanki.com/illinois/overtime/",
  "https://zapytajhanki.com/illinois/podatek-dochodowy/",
  "https://zapytajhanki.com/illinois/prawo-jazdy/",
  "https://zapytajhanki.com/illinois/property-tax/",
  "https://zapytajhanki.com/illinois/real-id/",
  "https://zapytajhanki.com/illinois/rejestracja-samochodu/",
  "https://zapytajhanki.com/illinois/state-id/",
  "https://zapytajhanki.com/illinois/ubezpieczenie-samochodu/",
  "https://zapytajhanki.com/illinois/unemployment/",
  "https://zapytajhanki.com/indiana/car-title/",
  "https://zapytajhanki.com/indiana/disaster-assistance/",
  "https://zapytajhanki.com/indiana/health-insurance/",
  "https://zapytajhanki.com/indiana/liheap/",
  "https://zapytajhanki.com/indiana/medicaid/",
  "https://zapytajhanki.com/indiana/minimum-wage/",
  "https://zapytajhanki.com/indiana/overtime/",
  "https://zapytajhanki.com/indiana/paid-sick-leave/",
  "https://zapytajhanki.com/indiana/podatki/",
  "https://zapytajhanki.com/indiana/prawo-jazdy/",
  "https://zapytajhanki.com/indiana/property-tax/",
  "https://zapytajhanki.com/indiana/real-id/",
  "https://zapytajhanki.com/indiana/rejestracja-samochodu/",
  "https://zapytajhanki.com/indiana/sales-tax/",
  "https://zapytajhanki.com/indiana/snap/",
  "https://zapytajhanki.com/indiana/state-id/",
  "https://zapytajhanki.com/indiana/tenant-rights/",
  "https://zapytajhanki.com/indiana/ubezpieczenie-samochodu/",
  "https://zapytajhanki.com/indiana/unemployment/",
  "https://zapytajhanki.com/indiana/workers-compensation/",
  "https://zapytajhanki.com/michigan/car-title/",
  "https://zapytajhanki.com/michigan/disaster-assistance/",
  "https://zapytajhanki.com/michigan/health-insurance/",
  "https://zapytajhanki.com/michigan/liheap/",
  "https://zapytajhanki.com/michigan/medicaid/",
  "https://zapytajhanki.com/michigan/minimum-wage/",
  "https://zapytajhanki.com/michigan/overtime/",
  "https://zapytajhanki.com/michigan/paid-sick-leave/",
  "https://zapytajhanki.com/michigan/podatki/",
  "https://zapytajhanki.com/michigan/prawo-jazdy/",
  "https://zapytajhanki.com/michigan/property-tax/",
  "https://zapytajhanki.com/michigan/real-id/",
  "https://zapytajhanki.com/michigan/rejestracja-samochodu/",
  "https://zapytajhanki.com/michigan/sales-tax/",
  "https://zapytajhanki.com/michigan/snap/",
  "https://zapytajhanki.com/michigan/state-id/",
  "https://zapytajhanki.com/michigan/tenant-rights/",
  "https://zapytajhanki.com/michigan/ubezpieczenie-samochodu/",
  "https://zapytajhanki.com/michigan/unemployment/",
  "https://zapytajhanki.com/michigan/workers-compensation/",
  "https://zapytajhanki.com/new-york/car-title/",
  "https://zapytajhanki.com/new-york/health-insurance/",
  "https://zapytajhanki.com/new-york/medicaid/",
  "https://zapytajhanki.com/new-york/minimum-wage/",
  "https://zapytajhanki.com/new-york/non-driver-id/",
  "https://zapytajhanki.com/new-york/overtime/",
  "https://zapytajhanki.com/new-york/paid-family-leave/",
  "https://zapytajhanki.com/new-york/paid-sick-leave/",
  "https://zapytajhanki.com/new-york/podatek-dochodowy/",
  "https://zapytajhanki.com/new-york/prawo-jazdy/",
  "https://zapytajhanki.com/new-york/property-tax/",
  "https://zapytajhanki.com/new-york/real-id/",
  "https://zapytajhanki.com/new-york/rejestracja-samochodu/",
  "https://zapytajhanki.com/new-york/sales-tax/",
  "https://zapytajhanki.com/new-york/snap/",
  "https://zapytajhanki.com/new-york/tenant-rights/",
  "https://zapytajhanki.com/new-york/ubezpieczenie-samochodu/",
  "https://zapytajhanki.com/new-york/unemployment/",
  "https://zapytajhanki.com/new-york/vehicle-inspection/",
  "https://zapytajhanki.com/new-york/workers-compensation/",
  "https://zapytajhanki.com/ohio/car-title/",
  "https://zapytajhanki.com/ohio/disaster-assistance/",
  "https://zapytajhanki.com/ohio/health-insurance/",
  "https://zapytajhanki.com/ohio/liheap/",
  "https://zapytajhanki.com/ohio/medicaid/",
  "https://zapytajhanki.com/ohio/minimum-wage/",
  "https://zapytajhanki.com/ohio/overtime/",
  "https://zapytajhanki.com/ohio/paid-sick-leave/",
  "https://zapytajhanki.com/ohio/podatki/",
  "https://zapytajhanki.com/ohio/prawo-jazdy/",
  "https://zapytajhanki.com/ohio/property-tax/",
  "https://zapytajhanki.com/ohio/real-id/",
  "https://zapytajhanki.com/ohio/rejestracja-samochodu/",
  "https://zapytajhanki.com/ohio/sales-tax/",
  "https://zapytajhanki.com/ohio/snap/",
  "https://zapytajhanki.com/ohio/state-id/",
  "https://zapytajhanki.com/ohio/tenant-rights/",
  "https://zapytajhanki.com/ohio/ubezpieczenie-samochodu/",
  "https://zapytajhanki.com/ohio/unemployment/",
  "https://zapytajhanki.com/ohio/workers-compensation/",
  "https://zapytajhanki.com/pennsylvania/car-title/",
  "https://zapytajhanki.com/pennsylvania/disaster-assistance/",
  "https://zapytajhanki.com/pennsylvania/health-insurance/",
  "https://zapytajhanki.com/pennsylvania/liheap/",
  "https://zapytajhanki.com/pennsylvania/medicaid/",
  "https://zapytajhanki.com/pennsylvania/minimum-wage/",
  "https://zapytajhanki.com/pennsylvania/overtime/",
  "https://zapytajhanki.com/pennsylvania/paid-sick-leave/",
  "https://zapytajhanki.com/pennsylvania/podatki/",
  "https://zapytajhanki.com/pennsylvania/prawo-jazdy/",
  "https://zapytajhanki.com/pennsylvania/property-tax/",
  "https://zapytajhanki.com/pennsylvania/real-id/",
  "https://zapytajhanki.com/pennsylvania/rejestracja-samochodu/",
  "https://zapytajhanki.com/pennsylvania/sales-tax/",
  "https://zapytajhanki.com/pennsylvania/snap/",
  "https://zapytajhanki.com/pennsylvania/state-id/",
  "https://zapytajhanki.com/pennsylvania/tenant-rights/",
  "https://zapytajhanki.com/pennsylvania/ubezpieczenie-samochodu/",
  "https://zapytajhanki.com/pennsylvania/unemployment/",
  "https://zapytajhanki.com/pennsylvania/workers-compensation/",
  "https://zapytajhanki.com/pieniadze/ach-vs-wire-transfer/",
  "https://zapytajhanki.com/pieniadze/annual-fee/",
  "https://zapytajhanki.com/pieniadze/apr-karta-kredytowa/",
  "https://zapytajhanki.com/pieniadze/authorized-user/",
  "https://zapytajhanki.com/pieniadze/balance-transfer/",
  "https://zapytajhanki.com/pieniadze/bank-account-after-death/",
  "https://zapytajhanki.com/pieniadze/blady-credit-report/",
  "https://zapytajhanki.com/pieniadze/cash-advance/",
  "https://zapytajhanki.com/pieniadze/cashiers-check/",
  "https://zapytajhanki.com/pieniadze/certificate-of-deposit/",
  "https://zapytajhanki.com/pieniadze/charge-off/",
  "https://zapytajhanki.com/pieniadze/chargeback/",
  "https://zapytajhanki.com/pieniadze/checking-vs-savings/",
  "https://zapytajhanki.com/pieniadze/closing-credit-card/",
  "https://zapytajhanki.com/pieniadze/collections/",
  "https://zapytajhanki.com/pieniadze/credit-freeze/",
  "https://zapytajhanki.com/pieniadze/credit-history/",
  "https://zapytajhanki.com/pieniadze/credit-limit-increase/",
  "https://zapytajhanki.com/pieniadze/credit-report/",
  "https://zapytajhanki.com/pieniadze/credit-score-od-zera-po-przyjezdzie/",
  "https://zapytajhanki.com/pieniadze/credit-score/",
  "https://zapytajhanki.com/pieniadze/credit-utilization/",
  "https://zapytajhanki.com/pieniadze/debt-consolidation/",
  "https://zapytajhanki.com/pieniadze/debt-validation/",
  "https://zapytajhanki.com/pieniadze/direct-deposit/",
  "https://zapytajhanki.com/pieniadze/fdic-insurance/",
  "https://zapytajhanki.com/pieniadze/foreign-transaction-fee/",
  "https://zapytajhanki.com/pieniadze/frozen-bank-account/",
  "https://zapytajhanki.com/pieniadze/grace-period/",
  "https://zapytajhanki.com/pieniadze/hard-inquiry-vs-soft-inquiry/",
  "https://zapytajhanki.com/pieniadze/high-yield-savings-account/",
  "https://zapytajhanki.com/pieniadze/identity-theft/",
  "https://zapytajhanki.com/pieniadze/ile-trzeba-zarabiac-w-usa/",
  "https://zapytajhanki.com/pieniadze/joint-bank-account/",
  "https://zapytajhanki.com/pieniadze/konto-bankowe-po-przyjezdzie/",
  "https://zapytajhanki.com/pieniadze/konto-bankowe/",
  "https://zapytajhanki.com/pieniadze/koszty-zycia-w-usa/",
  "https://zapytajhanki.com/pieniadze/late-payment/",
  "https://zapytajhanki.com/pieniadze/lost-stolen-credit-card/",
  "https://zapytajhanki.com/pieniadze/medical-debt/",
  "https://zapytajhanki.com/pieniadze/minimum-payment/",
  "https://zapytajhanki.com/pieniadze/overdraft-fees/",
  "https://zapytajhanki.com/pieniadze/pierwsza-karta-kredytowa/",
  "https://zapytajhanki.com/pieniadze/pod-beneficiary-bank-account/",
  "https://zapytajhanki.com/pieniadze/przelew-polska-usa/",
  "https://zapytajhanki.com/pieniadze/secured-credit-card/",
  "https://zapytajhanki.com/pieniadze/statement-balance-vs-current-balance/",
  "https://zapytajhanki.com/pieniadze/unauthorized-credit-card-transaction/",
  "https://zapytajhanki.com/pieniadze/zelle-scams/",
  "https://zapytajhanki.com/pierwsze-30-dni-w-usa/",
  "https://zapytajhanki.com/podatki/darowizna-z-polski/",
  "https://zapytajhanki.com/podatki/dochod-z-polski/",
  "https://zapytajhanki.com/podatki/fbar-vs-form-8938/",
  "https://zapytajhanki.com/podatki/fbar/",
  "https://zapytajhanki.com/podatki/form-8938/",
  "https://zapytajhanki.com/podatki/jak-dzialaja-podatki/",
  "https://zapytajhanki.com/podatki/konto-w-polsce/",
  "https://zapytajhanki.com/podatki/list-z-irs/",
  "https://zapytajhanki.com/podatki/polska-emerytura-w-usa/",
  "https://zapytajhanki.com/podatki/przeprowadzka-do-usa-podatki/",
  "https://zapytajhanki.com/podatki/spadek-z-polski/",
  "https://zapytajhanki.com/podatki/sprzedaz-mieszkania-w-polsce/",
  "https://zapytajhanki.com/podatki/wynajem-mieszkania-w-polsce/",
  "https://zapytajhanki.com/podatki/zwrot-podatku-irs/",
  "https://zapytajhanki.com/praca/20-dolarow-na-godzine-ile-rocznie/",
  "https://zapytajhanki.com/praca/25-dolarow-na-godzine-ile-rocznie/",
  "https://zapytajhanki.com/praca/401k-loan/",
  "https://zapytajhanki.com/praca/401k-rollover/",
  "https://zapytajhanki.com/praca/401k/",
  "https://zapytajhanki.com/praca/background-check/",
  "https://zapytajhanki.com/praca/child-tax-credit/",
  "https://zapytajhanki.com/praca/cobra-po-utracie-pracy/",
  "https://zapytajhanki.com/praca/dependent-qualifying-child-relative/",
  "https://zapytajhanki.com/praca/dyskryminacja-eeoc/",
  "https://zapytajhanki.com/praca/early-withdrawal-401k-ira/",
  "https://zapytajhanki.com/praca/eitc-earned-income-tax-credit/",
  "https://zapytajhanki.com/praca/employment-verification/",
  "https://zapytajhanki.com/praca/estimated-tax-quarterly-payments/",
  "https://zapytajhanki.com/praca/filing-status/",
  "https://zapytajhanki.com/praca/final-paycheck/",
  "https://zapytajhanki.com/praca/fired-at-will/",
  "https://zapytajhanki.com/praca/fmla/",
  "https://zapytajhanki.com/praca/form-1040-tax-return/",
  "https://zapytajhanki.com/praca/form-1040-x-amended-return/",
  "https://zapytajhanki.com/praca/gross-vs-net-usa/",
  "https://zapytajhanki.com/praca/holiday-pay/",
  "https://zapytajhanki.com/praca/i-9/",
  "https://zapytajhanki.com/praca/irs-free-file/",
  "https://zapytajhanki.com/praca/irs-identity-theft-ip-pin/",
  "https://zapytajhanki.com/praca/irs-payment-plan/",
  "https://zapytajhanki.com/praca/irs-penalties-interest/",
  "https://zapytajhanki.com/praca/irs-tax-transcript/",
  "https://zapytajhanki.com/praca/itin-form-w7/",
  "https://zapytajhanki.com/praca/layoff-warn-act/",
  "https://zapytajhanki.com/praca/maternity-parental-leave/",
  "https://zapytajhanki.com/praca/minimum-wage/",
  "https://zapytajhanki.com/praca/overtime/",
  "https://zapytajhanki.com/praca/pto-vacation-sick-leave/",
  "https://zapytajhanki.com/praca/remote-work-state-taxes/",
  "https://zapytajhanki.com/praca/rmd-required-minimum-distributions/",
  "https://zapytajhanki.com/praca/self-employment-tax/",
  "https://zapytajhanki.com/praca/severance-pay/",
  "https://zapytajhanki.com/praca/standard-vs-itemized-deductions/",
  "https://zapytajhanki.com/praca/stawka-godzinowa-ile-rocznie/",
  "https://zapytajhanki.com/praca/tax-extension-form-4868/",
  "https://zapytajhanki.com/praca/traditional-vs-roth-ira/",
  "https://zapytajhanki.com/praca/unpaid-wages/",
  "https://zapytajhanki.com/praca/utrata-pracy/",
  "https://zapytajhanki.com/praca/w2-vs-1099/",
  "https://zapytajhanki.com/praca/w4/",
  "https://zapytajhanki.com/praca/weekly-vs-biweekly-paycheck/",
  "https://zapytajhanki.com/praca/worker-misclassification/",
  "https://zapytajhanki.com/praca/workers-compensation/",
  "https://zapytajhanki.com/praca/wyplata/",
  "https://zapytajhanki.com/przeprowadzka/dokumentowanie-uszkodzen-mieszkania/",
  "https://zapytajhanki.com/przeprowadzka/internet-po-przeprowadzce/",
  "https://zapytajhanki.com/przeprowadzka/jak-pakowac-talerze-szklo/",
  "https://zapytajhanki.com/przeprowadzka/jak-spakowac-mieszkanie/",
  "https://zapytajhanki.com/przeprowadzka/jak-zabezpieczyc-materac/",
  "https://zapytajhanki.com/przeprowadzka/move-in-inspection/",
  "https://zapytajhanki.com/przeprowadzka/pierwsze-mieszkanie-co-kupic/",
  "https://zapytajhanki.com/przeprowadzka/security-deposit-zwrot-kaucji/",
  "https://zapytajhanki.com/przeprowadzka/ubrania-na-wieszakach/",
  "https://zapytajhanki.com/przeprowadzka/usps-mail-forwarding/",
  "https://zapytajhanki.com/przeprowadzka/utilities-prad-gaz-woda/",
  "https://zapytajhanki.com/samochod/apr/",
  "https://zapytajhanki.com/samochod/claim-denied/",
  "https://zapytajhanki.com/samochod/collision-vs-comprehensive/",
  "https://zapytajhanki.com/samochod/cosigner-auto-loan/",
  "https://zapytajhanki.com/samochod/dealer-fees/",
  "https://zapytajhanki.com/samochod/deductible-auto-insurance/",
  "https://zapytajhanki.com/samochod/diminished-value/",
  "https://zapytajhanki.com/samochod/down-payment-auto-loan/",
  "https://zapytajhanki.com/samochod/early-payoff-auto-loan/",
  "https://zapytajhanki.com/samochod/extended-warranty-service-contract/",
  "https://zapytajhanki.com/samochod/finansowanie/",
  "https://zapytajhanki.com/samochod/full-coverage/",
  "https://zapytajhanki.com/samochod/gap-insurance/",
  "https://zapytajhanki.com/samochod/insurance-lapse/",
  "https://zapytajhanki.com/samochod/koniec-leasingu-wykup/",
  "https://zapytajhanki.com/samochod/kupno-od-osoby-prywatnej/",
  "https://zapytajhanki.com/samochod/kupno-samochodu/",
  "https://zapytajhanki.com/samochod/leasing-vs-financing/",
  "https://zapytajhanki.com/samochod/lemon-law/",
  "https://zapytajhanki.com/samochod/liability-limits/",
  "https://zapytajhanki.com/samochod/new-car-replacement/",
  "https://zapytajhanki.com/samochod/non-owner-insurance/",
  "https://zapytajhanki.com/samochod/odometer-fraud/",
  "https://zapytajhanki.com/samochod/permissive-use/",
  "https://zapytajhanki.com/samochod/pierwszy-samochod-po-przyjezdzie/",
  "https://zapytajhanki.com/samochod/preapproval-auto-loan/",
  "https://zapytajhanki.com/samochod/recall-vin/",
  "https://zapytajhanki.com/samochod/refinansowanie-auto-loan/",
  "https://zapytajhanki.com/samochod/rejestracja-title-transfer/",
  "https://zapytajhanki.com/samochod/rental-car-insurance/",
  "https://zapytajhanki.com/samochod/rental-reimbursement/",
  "https://zapytajhanki.com/samochod/repossession/",
  "https://zapytajhanki.com/samochod/roadside-assistance/",
  "https://zapytajhanki.com/samochod/rodzaje-ubezpieczenia/",
  "https://zapytajhanki.com/samochod/salvage-rebuilt-title/",
  "https://zapytajhanki.com/samochod/sr-22/",
  "https://zapytajhanki.com/samochod/teen-driver-insurance/",
  "https://zapytajhanki.com/samochod/temporary-tags/",
  "https://zapytajhanki.com/samochod/title/",
  "https://zapytajhanki.com/samochod/total-loss/",
  "https://zapytajhanki.com/samochod/trade-in-negative-equity/",
  "https://zapytajhanki.com/samochod/ubezpieczenie/",
  "https://zapytajhanki.com/samochod/uninsured-underinsured-motorist/",
  "https://zapytajhanki.com/samochod/usage-based-insurance/",
  "https://zapytajhanki.com/samochod/uzywany-samochod-vin-inspekcja/",
  "https://zapytajhanki.com/samochod/wypadek-samochodowy-claim/",
  "https://zapytajhanki.com/texas/car-title/",
  "https://zapytajhanki.com/texas/disaster-help/",
  "https://zapytajhanki.com/texas/health-insurance/",
  "https://zapytajhanki.com/texas/liheap/",
  "https://zapytajhanki.com/texas/medicaid/",
  "https://zapytajhanki.com/texas/minimum-wage/",
  "https://zapytajhanki.com/texas/overtime/",
  "https://zapytajhanki.com/texas/paid-leave/",
  "https://zapytajhanki.com/texas/podatki/",
  "https://zapytajhanki.com/texas/prawo-jazdy/",
  "https://zapytajhanki.com/texas/property-tax/",
  "https://zapytajhanki.com/texas/real-id/",
  "https://zapytajhanki.com/texas/rejestracja-samochodu/",
  "https://zapytajhanki.com/texas/sales-tax/",
  "https://zapytajhanki.com/texas/snap/",
  "https://zapytajhanki.com/texas/state-id/",
  "https://zapytajhanki.com/texas/tenant-rights/",
  "https://zapytajhanki.com/texas/ubezpieczenie-samochodu/",
  "https://zapytajhanki.com/texas/unemployment/",
  "https://zapytajhanki.com/texas/workers-compensation/",
  "https://zapytajhanki.com/thanksgiving/co-przyniesc-jako-gosc/",
  "https://zapytajhanki.com/thanksgiving/cranberry-sauce/",
  "https://zapytajhanki.com/thanksgiving/friendsgiving/",
  "https://zapytajhanki.com/thanksgiving/gravy/",
  "https://zapytajhanki.com/thanksgiving/green-bean-casserole/",
  "https://zapytajhanki.com/thanksgiving/ile-indyka-na-osobe/",
  "https://zapytajhanki.com/thanksgiving/indyk-turkey/",
  "https://zapytajhanki.com/thanksgiving/jak-zorganizowac/",
  "https://zapytajhanki.com/thanksgiving/jedzenie-na-thanksgiving/",
  "https://zapytajhanki.com/thanksgiving/leftovers/",
  "https://zapytajhanki.com/thanksgiving/mashed-potatoes/",
  "https://zapytajhanki.com/thanksgiving/podroz-na-thanksgiving/",
  "https://zapytajhanki.com/thanksgiving/potluck/",
  "https://zapytajhanki.com/thanksgiving/slownik-zwroty-po-angielsku/",
  "https://zapytajhanki.com/thanksgiving/stuffing/",
  "https://zapytajhanki.com/thanksgiving/sweet-potato-casserole/",
  "https://zapytajhanki.com/wisconsin/car-title/",
  "https://zapytajhanki.com/wisconsin/disaster-assistance/",
  "https://zapytajhanki.com/wisconsin/health-insurance/",
  "https://zapytajhanki.com/wisconsin/liheap/",
  "https://zapytajhanki.com/wisconsin/medicaid/",
  "https://zapytajhanki.com/wisconsin/minimum-wage/",
  "https://zapytajhanki.com/wisconsin/overtime/",
  "https://zapytajhanki.com/wisconsin/paid-sick-leave/",
  "https://zapytajhanki.com/wisconsin/podatki/",
  "https://zapytajhanki.com/wisconsin/prawo-jazdy/",
  "https://zapytajhanki.com/wisconsin/property-tax/",
  "https://zapytajhanki.com/wisconsin/real-id/",
  "https://zapytajhanki.com/wisconsin/rejestracja-samochodu/",
  "https://zapytajhanki.com/wisconsin/sales-tax/",
  "https://zapytajhanki.com/wisconsin/snap/",
  "https://zapytajhanki.com/wisconsin/state-id/",
  "https://zapytajhanki.com/wisconsin/tenant-rights/",
  "https://zapytajhanki.com/wisconsin/ubezpieczenie-samochodu/",
  "https://zapytajhanki.com/wisconsin/unemployment/",
  "https://zapytajhanki.com/wisconsin/workers-compensation/",
  "https://zapytajhanki.com/zdrowie/chip/",
  "https://zapytajhanki.com/zdrowie/ciaza-ubezpieczenie/",
  "https://zapytajhanki.com/zdrowie/claim-denial-appeal/",
  "https://zapytajhanki.com/zdrowie/cobra/",
  "https://zapytajhanki.com/zdrowie/coordination-of-benefits/",
  "https://zapytajhanki.com/zdrowie/durable-medical-equipment/",
  "https://zapytajhanki.com/zdrowie/emergency-room-bill/",
  "https://zapytajhanki.com/zdrowie/explanation-of-benefits/",
  "https://zapytajhanki.com/zdrowie/facility-fee/",
  "https://zapytajhanki.com/zdrowie/fizjoterapia-ubezpieczenie/",
  "https://zapytajhanki.com/zdrowie/good-faith-estimate/",
  "https://zapytajhanki.com/zdrowie/health-insurance-claim/",
  "https://zapytajhanki.com/zdrowie/health-insurance-premium/",
  "https://zapytajhanki.com/zdrowie/home-health-care/",
  "https://zapytajhanki.com/zdrowie/hsa-vs-fsa/",
  "https://zapytajhanki.com/zdrowie/in-network-vs-out-of-network/",
  "https://zapytajhanki.com/zdrowie/inpatient-vs-observation/",
  "https://zapytajhanki.com/zdrowie/kolonoskopia-ubezpieczenie/",
  "https://zapytajhanki.com/zdrowie/koszty-ubezpieczenia/",
  "https://zapytajhanki.com/zdrowie/kupony-na-leki/",
  "https://zapytajhanki.com/zdrowie/mammografia-ubezpieczenie/",
  "https://zapytajhanki.com/zdrowie/marketplace-aca/",
  "https://zapytajhanki.com/zdrowie/medicaid/",
  "https://zapytajhanki.com/zdrowie/medical-bill/",
  "https://zapytajhanki.com/zdrowie/medicare-advantage-vs-medigap/",
  "https://zapytajhanki.com/zdrowie/medicare-enrollment-periods/",
  "https://zapytajhanki.com/zdrowie/medicare-part-d/",
  "https://zapytajhanki.com/zdrowie/medicare-vs-medicaid/",
  "https://zapytajhanki.com/zdrowie/medicare/",
  "https://zapytajhanki.com/zdrowie/mental-health-ubezpieczenie/",
  "https://zapytajhanki.com/zdrowie/mri-ct-scan-ubezpieczenie/",
  "https://zapytajhanki.com/zdrowie/odnowienie-medicaid/",
  "https://zapytajhanki.com/zdrowie/open-enrollment/",
  "https://zapytajhanki.com/zdrowie/out-of-pocket-maximum/",
  "https://zapytajhanki.com/zdrowie/outpatient-surgery/",
  "https://zapytajhanki.com/zdrowie/prescription-drug-formulary/",
  "https://zapytajhanki.com/zdrowie/preventive-care/",
  "https://zapytajhanki.com/zdrowie/primary-care-doctor/",
  "https://zapytajhanki.com/zdrowie/prior-authorization/",
  "https://zapytajhanki.com/zdrowie/rachunek-radiolog-patolog/",
  "https://zapytajhanki.com/zdrowie/rachunek-za-anestezjologa/",
  "https://zapytajhanki.com/zdrowie/rachunek-za-badania-laboratoryjne/",
  "https://zapytajhanki.com/zdrowie/rachunek-za-karetke/",
  "https://zapytajhanki.com/zdrowie/referral-do-specjalisty/",
  "https://zapytajhanki.com/zdrowie/skilled-nursing-facility/",
  "https://zapytajhanki.com/zdrowie/special-enrollment-period/",
  "https://zapytajhanki.com/zdrowie/telehealth/",
  "https://zapytajhanki.com/zdrowie/ubezpieczenie-dentystyczne/",
  "https://zapytajhanki.com/zdrowie/ubezpieczenie-wzroku/",
  "https://zapytajhanki.com/zdrowie/ubezpieczenie-zdrowotne-po-przyjezdzie/",
  "https://zapytajhanki.com/zdrowie/urgent-care-vs-er/",
  "https://zapytajhanki.com/zdrowie/utrata-ubezpieczenia-z-pracy/"
];

function decodeHtml(text) {
  return String(text || "")
    .split("&nbsp;").join(" ")
    .split("&amp;").join("&")
    .split("&lt;").join("<")
    .split("&gt;").join(">")
    .split("&quot;").join(String.fromCharCode(34))
    .split("&#39;").join("'")
    .split("&apos;").join("'");
}
function htmlToText(html) {
  let text = String(html || "");
  text = text.replace(new RegExp("<script[^>]*>[\\s\\S]*?</script>", "gi"), " ");
  text = text.replace(new RegExp("<style[^>]*>[\\s\\S]*?</style>", "gi"), " ");
  text = text.replace(new RegExp("<br[^>]*>", "gi"), "\n");
  text = text.replace(new RegExp("</(p|li|h1|h2|h3|section|div|ol|ul)>", "gi"), "\n");
  text = text.replace(new RegExp("<[^>]+>", "g"), " ");
  return decodeHtml(text)
    .split("\n")
    .map((line) => line.trim().replace(/ +/g, " "))
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function fetchSeedDocument(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "HankaBrainIndexer/1.0 (+https://zapytajhanki.com/)" }
  });
  if (!response.ok) throw new Error(`Could not fetch ${url}: HTTP ${response.status}`);
  const html = await response.text();
  const titleStart = html.toLowerCase().indexOf("<title");
  const titleOpen = titleStart >= 0 ? html.indexOf(">", titleStart) : -1;
  const titleClose = titleOpen >= 0 ? html.toLowerCase().indexOf("</title>", titleOpen) : -1;
  const titleRaw = titleOpen >= 0 && titleClose > titleOpen ? html.slice(titleOpen + 1, titleClose) : url;
  const articleStart = html.search(new RegExp("<article[^>]*class=[^>]*prose", "i"));
  const articleOpen = articleStart >= 0 ? html.indexOf(">", articleStart) : -1;
  const articleClose = articleOpen >= 0 ? html.toLowerCase().indexOf("</article>", articleOpen) : -1;
  if (articleOpen < 0 || articleClose < 0) throw new Error(`Article body not found: ${url}`);
  const text = htmlToText(html.slice(articleOpen + 1, articleClose));
  if (text.length < 300) throw new Error(`Article body too short: ${url}`);
  return {
    title: htmlToText(titleRaw).split(" | Zapytaj Hanki")[0].trim(),
    url,
    text
  };
}

function authorized(request, env) {
  const expected = env.HANKA_INGEST_SECRET;
  const auth = request.headers.get("Authorization") || "";
  return Boolean(expected && auth === `Bearer ${expected}`);
}

function adminPage() {
  const totalGuides = SEED_URLS.length;
  const totalBatches = Math.ceil(totalGuides / 10);
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Hanka Brain — seed</title><style>body{font:16px/1.45 system-ui;margin:0;background:#f7f7f3;color:#173f32}.w{max-width:620px;margin:auto;padding:28px 18px}input,button{width:100%;box-sizing:border-box;font:inherit;border-radius:14px;padding:14px}input{border:1px solid #ccd5d0;background:#fff}button{margin-top:12px;border:0;background:#173f32;color:#fff;font-weight:800}pre{white-space:pre-wrap;background:#fff;padding:14px;border-radius:14px;border:1px solid #e1e5e2}</style></head><body><main class="w"><h1>Hanka Brain</h1><p>Korpus Hanka Brain: ${totalGuides} przewodników. Sekret zostaje wysłany wyłącznie do tego Workera przez HTTPS i nie jest zapisywany przez stronę.</p><input id="s" type="password" autocomplete="off" placeholder="HANKA_INGEST_SECRET"><button id="b">Załaduj ${totalGuides} przewodników</button><pre id="o">Gotowe do testu.</pre></main><script>b.onclick=async()=>{const secret=s.value.trim();if(!secret){o.textContent="Wpisz sekret.";return}b.disabled=true;o.textContent="Ładowanie partii 1/${totalBatches}…";try{let docs=0,vectors=0,pages=[];for(let batch=0;batch<${totalBatches};batch++){o.textContent="Ładowanie partii "+(batch+1)+"/${totalBatches}…";const r=await fetch("/admin/seed?batch="+batch,{method:"POST",headers:{Authorization:"Bearer "+secret}});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.detail||d.error||("HTTP "+r.status));docs+=d.documents||0;vectors+=d.vectors||0;pages=pages.concat(d.pages||[])}o.textContent=JSON.stringify({ok:true,documents:docs,vectors,pages},null,2)}catch(e){o.textContent=JSON.stringify({error:"Seed failed",detail:e.message},null,2)}finally{b.disabled=false;s.value=""}}</script></body></html>`;
}

function testerPage() {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>Hanka AI Beta</title><style>*{box-sizing:border-box}body{margin:0;background:#f7f7f3;color:#17231d;font:16px/1.45 system-ui,-apple-system,sans-serif}.wrap{max-width:720px;margin:auto;min-height:100vh;padding:24px 16px 120px}h1{margin:8px 0 2px;font-size:30px}.beta{color:#68736d;font-size:14px}.chat{margin-top:24px;display:grid;gap:12px}.msg{padding:13px 15px;border-radius:18px;max-width:88%;white-space:pre-wrap}.user{justify-self:end;background:#173f32;color:#fff}.hanka{justify-self:start;background:#fff;border:1px solid #dfe4df}.sources{justify-self:start;max-width:88%;font-size:14px;color:#59665f}.sources b{display:block;margin-bottom:6px;color:#173f32}.sources a{display:block;color:#2f694c;text-decoration:none;font-weight:700;margin:5px 0}.sources a:hover{text-decoration:underline}.debug{justify-self:start;max-width:88%;font-size:12px;color:#68736d}.debug summary{cursor:pointer;font-weight:700}.debug pre{white-space:pre-wrap;word-break:break-word;background:#eef1ed;padding:10px;border-radius:12px;max-height:320px;overflow:auto}.composer{position:fixed;left:0;right:0;bottom:0;background:#f7f7f3;border-top:1px solid #e1e4e1;padding:12px 16px calc(12px + env(safe-area-inset-bottom))}.row{max-width:720px;margin:auto;display:flex;gap:8px}textarea{flex:1;resize:none;min-height:48px;max-height:120px;border:1px solid #cbd3ce;border-radius:16px;padding:12px 14px;font:inherit}button{border:0;border-radius:16px;padding:0 18px;background:#173f32;color:#fff;font-weight:700}button:disabled{opacity:.5}</style></head><body><main class="wrap"><h1>Hanka</h1><div class="beta">prywatny tester AI · beta</div><div id="chat" class="chat"><div class="msg hanka">Cześć! Jestem Hanka. O co chodzi?</div></div></main><div class="composer"><form id="form" class="row"><textarea id="input" rows="1" maxlength="4000" placeholder="Zapytaj Hankę…" required></textarea><button id="send">Wyślij</button></form></div><script>const form=document.getElementById("form"),input=document.getElementById("input"),chat=document.getElementById("chat"),send=document.getElementById("send"),messages=[];function add(t,w){const d=document.createElement("div");d.className="msg "+w;d.textContent=String(t).replace(/\\*\\*([^*]+)\\*\\*/g,"$1");chat.appendChild(d);scrollTo(0,document.body.scrollHeight)}function addSources(sources){if(!Array.isArray(sources)||!sources.length)return;const unique=[];for(const s of sources){if(s&&s.url&&!unique.some(x=>x.url===s.url))unique.push(s)}if(!unique.length)return;const box=document.createElement("div");box.className="sources";const label=document.createElement("b");label.textContent="Przeczytaj też:";box.appendChild(label);for(const s of unique.slice(0,3)){const a=document.createElement("a");a.href=s.url;a.target="_blank";a.rel="noopener";a.textContent="→ "+(s.title||"Przewodnik Hanki");box.appendChild(a)}chat.appendChild(box);scrollTo(0,document.body.scrollHeight)}function addDebug(debug){if(!debug||!Array.isArray(debug.matches)||!debug.matches.length)return;const d=document.createElement("details");d.className="debug";const s=document.createElement("summary");s.textContent="Brain debug · "+debug.matches.length+" fragmentów";d.appendChild(s);for(const m of debug.matches){const p=document.createElement("pre");p.textContent=(m.score==null?"?":Number(m.score).toFixed(3))+" · "+(m.title||"Bez tytułu")+" · chunk "+m.chunk+"\\n"+(m.text||"(brak tekstu)");d.appendChild(p)}chat.appendChild(d)}form.addEventListener("submit",async e=>{e.preventDefault();const q=input.value.trim();if(!q)return;messages.push({role:"user",content:q});add(q,"user");input.value="";send.disabled=true;send.textContent="…";try{const r=await fetch("/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages})}),data=await r.json();if(!r.ok){messages.pop();throw new Error(data.error+(data.code?" ["+data.code+"]":""))}messages.push({role:"assistant",content:data.answer});add(data.answer,"hanka");addSources(data.sources);addDebug(data.debug)}catch(err){if(messages[messages.length-1]?.role==="user"&&messages[messages.length-1]?.content===q)messages.pop();add("Ups. "+err.message,"hanka")}finally{send.disabled=false;send.textContent="Wyślij";input.focus()}});</script></body></html>`;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(testerPage(), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "hanka-ai-beta" }, 200, request);
    }

    if (url.pathname === "/admin" && request.method === "GET") {
      return new Response(adminPage(), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
    }

    if (url.pathname === "/admin/seed" && request.method === "POST") {
      if (!authorized(request, env)) return json({ error: "Unauthorized" }, 401, request);
      try {
        const batchSize = 10;
        const requestedBatch = Number(url.searchParams.get("batch") || "0");
        const totalBatches = Math.ceil(SEED_URLS.length / batchSize);
        if (!Number.isInteger(requestedBatch) || requestedBatch < 0 || requestedBatch >= totalBatches) {
          return json({ error: "Invalid seed batch", totalBatches }, 400, request);
        }
        const batchUrls = SEED_URLS.slice(requestedBatch * batchSize, (requestedBatch + 1) * batchSize);
        const documents = [];
        for (const seedUrl of batchUrls) documents.push(await fetchSeedDocument(seedUrl));
        const result = await upsertDocuments(env, documents);
        return json({
          ok: true,
          batch: requestedBatch + 1,
          totalBatches,
          documents: documents.length,
          vectors: result.vectors,
          pages: documents.map((d) => ({ title: d.title, url: d.url }))
        }, 200, request);
      } catch (error) {
        console.error("Hanka seed failed", error);
        return json({ error: "Seed failed", detail: String(error?.message || error) }, 502, request);
      }
    }

    if (url.pathname === "/admin/ingest" && request.method === "POST") {
      if (!authorized(request, env)) return json({ error: "Unauthorized" }, 401, request);
      const type = request.headers.get("Content-Type") || "";
      if (!type.includes("application/json")) return json({ error: "Content-Type must be application/json" }, 415, request);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, request); }
      if (!Array.isArray(body?.documents) || !body.documents.length || body.documents.length > 30) {
        return json({ error: "documents must contain 1 to 30 items" }, 400, request);
      }
      try {
        const result = await upsertDocuments(env, body.documents);
        return json({ ok: true, documents: body.documents.length, vectors: result.vectors }, 200, request);
      } catch (error) {
        console.error("Hanka ingest failed", error);
        return json({ error: "Ingest failed" }, 502, request);
      }
    }

    if (url.pathname !== "/chat" || request.method !== "POST") {
      return json({ error: "Not found" }, 404, request);
    }

    const type = request.headers.get("Content-Type") || "";
    if (!type.includes("application/json")) {
      return json({ error: "Content-Type must be application/json" }, 415, request);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, request);
    }

    const messages = cleanMessages(body?.messages);
    if (!messages) {
      return json({ error: "Invalid conversation" }, 400, request);
    }

    try {
      const latestQuestion = messages[messages.length - 1].content;
      const casual = isClearlyCasual(latestQuestion);
      const followUp = isLikelyFollowUp(messages);
      let rag = { context: "", sources: [], matches: [] };

      if (!casual) {
        try {
          rag = await retrieveContext(env, retrievalQuery(messages));
        } catch (error) {
          console.warn("Hanka retrieval unavailable", error);
        }
      }

      if (!rag.context && !casual && !followUp) {
        return json({
          answer: "Nie mam teraz wystarczająco pewnych informacji, żeby odpowiedzieć bez zgadywania.",
          sources: rag.sources,
          debug: { brain: false, matches: rag.matches || [] }
        }, 200, request);
      }

      const ragInstruction = rag.context
        ? `HANKA BRAIN — JEDYNE ŹRÓDŁO FAKTÓW TEJ ODPOWIEDZI
Odpowiedz wyłącznie na podstawie fragmentów poniżej. Parafrazuj i skracaj, ale nie dodawaj wiedzy modelowej.
- Każdy fakt, przykład, produkt, instytucja, liczba, kwota, termin i zalecenie musi występować w trafnym fragmencie. Każdy punkt faktograficzny zakończ ID dowodu, np. [F1] lub [F1][F2].
- Cytuj tylko F1–F4, które rzeczywiście potwierdzają dany punkt. Zachowaj siłę twierdzeń: „kluczowy”, „najważniejszy”, „najlepszy”, wymogi i kolejność tylko gdy źródło mówi to wprost.
- Brakujący szczegół pomiń; nie zgaduj.
- Pisz wyłącznie po polsku, poza naturalnymi terminami USA (np. credit score, secured card).
- Zwykła odpowiedź: 120–180 słów, maks. 3–4 krótkie punkty/akapity. Bez powtórzeń, pobocznych porad i własnych linków.
Przed wysłaniem usuń wszystko, czego nie potwierdzają fragmenty.

${rag.context}`
        : "Brak materiału źródłowego. Jeśli bieżąca wiadomość jest luźną rozmową, komentarzem, żartem, prośbą niefaktograficzną albo odnosi się do samej rozmowy, odpowiedz normalnie w charakterze Hanki. Jeśli jest to kontekstowy follow-up, korzystaj z wcześniejszych wiadomości, ale nie wymyślaj nowych faktów. Gdy pytanie wymaga konkretnych faktów, liczb, aktualnych zasad lub porady, których nie ma w rozmowie, powiedz krótko, że nie masz wystarczająco pewnych informacji.";

      const result = await askModel(env, [
        { role: "system", content: HANKA_SYSTEM_PROMPT },
        { role: "system", content: ragInstruction },
        ...messages
      ]);
      const draftAnswer = extractText(result);
      const groundedAnswer = rag.context ? guardGroundedAnswer(draftAnswer, rag.context) : draftAnswer;
      const evidencedAnswer = rag.context ? validateEvidenceTags(groundedAnswer, rag.matches?.length || 0) : groundedAnswer;
      const answer = cleanAnswer(evidencedAnswer);

      if (!answer) {
        const diagnostic = describeResult(result);
        const codeParts = [
          "AI_NO_TEXT",
          diagnostic.finishReason || "NO_FINISH",
          "C" + diagnostic.contentLength,
          "R" + diagnostic.reasoningLength
        ];
        const code = codeParts.join("_").toUpperCase().replace(/[^A-Z0-9_]/g, "");
        console.warn("Hanka empty model response", { code, diagnostic });
        return json({ error: "Model returned no text", code, diagnostic }, 502, request);
      }

      return json({
        answer,
        sources: casual ? [] : rag.sources,
        debug: casual ? { brain: false, matches: [] } : { brain: Boolean(rag.context), matches: rag.matches || [] }
      }, 200, request);
    } catch (error) {
      console.error("Hanka model error", error);
      return json({ error: "Hanka chwilowo nie odpowiada. Spróbuj ponownie za moment." }, 502, request);
    }
  }
};
