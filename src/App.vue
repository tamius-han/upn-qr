<script setup lang="ts">
import { nextTick, ref } from "vue";
import * as ibantools from "ibantools";
import unidecode from "unidecode";
import qrcode from "qrcode-generator";
// import QRCode from 'qrcode-svg';
import ISO11649 from "iso-11649";

const LOCALSTORAGE_RECIPIENTS_KEY = "recipients";

const upnData = ref({
  amount: "",
  code: "",
  purpose: "",
  recipientIBAN: "",
  reference: "",
  recipientName: "",
  recipientAddress: "",
  recipientCity: "",
});

const upnErrors = ref({
  amount: false,
  code: false,
  purpose: false,
  recipientIBAN: false,
  reference: false,
  recipientName: false,
  recipientAddress: false,
  recipientCity: false,
});

const upnQrHtml = ref("Izpolni podatke in klikni gumb 'Ustvari QR kode'");
const bcdQrHtml = ref("Izpolni podatke in klikni gumb 'Ustvari QR kode'");
const savingRecipient = ref(false);
const noBorder = ref(false);
const recipientSaveName = ref("");
const savedRecipients = ref([] as any[]);

const saveRecipientInput = ref(null);
const autofocus = ref(null);

// load saved recipients from local storage
const storedRecipientJSONString = localStorage.getItem(LOCALSTORAGE_RECIPIENTS_KEY);
if (storedRecipientJSONString) {
  savedRecipients.value = JSON.parse(storedRecipientJSONString);
}

function clearErrors() {
  return {
    amount: false,
    code: false,
    purpose: false,
    recipientIBAN: false,
    reference: false,
    recipientName: false,
    recipientAddress: false,
    recipientCity: false,
  };
}

/**
 * Does validation for SI00 and SI99 reference models. It can also be used for
 * other SI?? models, but it does not validate them thoroughly as it does not
 * calculate any checksums or shit.
 *
 * Here's the spec btw:
 * https://www.uradni-list.si/files/RS_-2019-034-01510-OB~P001-0000.PDF
 */
function ghettoValidateSIReference(reference: string) {
  reference = reference.trim().replace(" ", "");

  if (reference === "SI99") {
    return true;
  }

  if (reference.startsWith("SI99")) {
    return false;
  }

  if (!/$[0-9\-]*^/.test(reference)) {
    return false;
  }

  const referenceLength = reference.length;
  const segments = reference.split("-").length;

  // reference can have at most 3 segments (at most two dashes)
  // and 20 digits. Because SI?? is present in reference lenght,
  // "20 digits" means referenceLength (sans dashes) 24 char max.
  return segments <= 3 && referenceLength - segments <= 24;
}

/**
 * Processes and validates data
 *
 * spec for UPN and UPN QR:
 * https://www.upn-qr.si/uploads/files/Tehnicni%20standard%20UPN%20QR.pdf
 */
function processUpnQrData() {
  const iban = ibantools.electronicFormatIBAN(upnData.value.recipientIBAN);

  console.info(
    "Checking validity of IBAN",
    upnData.value.recipientIBAN,
    "\nIBAN parsed by ibantools:",
    iban,
    "\nIBAN validity:",
    ibantools.isValidIBAN(iban ?? "")
  );

  upnErrors.value.recipientIBAN =
    !iban || !upnData.value.recipientIBAN.trim() || !ibantools.isValidIBAN(iban);

  // don't crash on empty 'amount' field, instead fail somewhat gracefully:
  let [eur, cents] = ["0", "0"];
  if (upnData.value.amount) {
    [eur, cents] = upnData.value.amount.replace(".", ",").split(",");
    if (eur.length > 9 || cents?.length > 2) {
      upnErrors.value.amount = true;
    }
  } else {
    upnErrors.value.amount = true;
  }

  const eurPad = new Array(9 - eur.length).fill(0);
  const eurPadded = `${eurPad.join("")}${eur}`;
  const centsFilled = !cents ? "00" : cents.length === 1 ? `${cents}0` : cents;
  const amount = `${eurPadded}${centsFilled}`;
  const amountBcd = `${eur}.${centsFilled}`;

  let purposeCode = upnData.value.code.trim() || "OTHR";
  let reference = upnData.value.reference.trim().replace(" ", "") || "SI99";

  if (reference.startsWith("RF")) {
    upnErrors.value.reference = ISO11649.validate(reference);
  } else if (reference.startsWith("SI")) {
    upnErrors.value.reference = !ghettoValidateSIReference(reference);
  }

  if (!upnData.value.purpose.trim()) {
    upnErrors.value.purpose = true;
  }

  if (
    upnErrors.value.recipientIBAN ||
    upnErrors.value.amount ||
    upnErrors.value.reference ||
    upnErrors.value.purpose
  ) {
    throw "Invalid data";
  }

  const processedData = {
    iban,
    amount,
    amountBcd,
    reference,
    purposeCode,
  };

  console.info("QR data processed. Returning:", processedData);

  return processedData;
}

/**
 * Generates text that will be encoded into QR code, for UPN format.
 */
function generateUpnQrText() {
  upnErrors.value = clearErrors();
  const { iban, amount, reference, purposeCode } = processUpnQrData();

  // spec for UPN and UPN QR:
  // https://www.upn-qr.si/uploads/files/Tehnicni%20standard%20UPN%20QR.pdf
  const template = `UPNQR







${amount}


${purposeCode}
${unidecode(upnData.value.purpose)}

${iban}
${reference}
${unidecode(upnData.value.recipientName)}
${unidecode(upnData.value.recipientAddress)}
${unidecode(upnData.value.recipientCity)}`;

  return `${template}\n${template.length}`;
}

/**
 * Generates text that will be encoded into QR code, for international format
 */
function generateBcdQrText() {
  upnErrors.value = clearErrors();
  const { iban, amountBcd } = processUpnQrData();

  const name = unidecode(upnData.value.recipientName);
  const purpose = unidecode(upnData.value.purpose);

  const template = `BCD
001
1
SCT

${name}
${iban}
EUR${amountBcd}

${purpose}
${purpose}
`;

  return template;
}

function generateQr(data: string, type: "svg" | "image" = "svg") {
  console.log("Generating qr code from:", data);
  const qr = qrcode(0, 'H');
  // const qr = new QRCode({
  //   content: data,
  //   ecl: "H",
  //   padding: noBorder.value ? 0 : 2,
  //   join: true,
  //   container: "svg-viewbox",
  // });
  // return qr.svg();

  qr.addData(data.normalize('NFD'));
  qr.make();

  if (type === 'svg') {
    return qr.createSvgTag({scalable: true, margin: (noBorder.value ? 0 : undefined)});
  } else {
    return qr.createImgTag();
  }
}

/**
 * Clears currently generated QR code
 */
function resetQr() {
  bcdQrHtml.value = "Klikni gumb 'Ustvari QR kode'";
  upnQrHtml.value = "Klikni gumb 'Ustvari QR kode'";
}

/**
 * Generates QR codes from entered text
 */
function createQr() {
  try {
    const upnQrText = generateUpnQrText();
    const bcdQrText = generateBcdQrText();

    bcdQrHtml.value = generateQr(bcdQrText);
    upnQrHtml.value = generateQr(upnQrText);
    // (eu as any).value.innerHtml = generateQr(bcdQrText);
    // (slo as any).value.innerHtml = generateQr(upnQrText);
  } catch (e) {
    console.warn("we had a fucky wucky");
    console.error(e);
  }
}

/**
 * Saves QR code SVG
 */
function saveSvg(svg: string, filename: string = "qr.svg") {
  const link = document.createElement("a");
  const file = new Blob([svg], { type: "image/svg+xml" });
  link.href = URL.createObjectURL(file);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function startSaveRecipient() {
  savingRecipient.value = true;

  nextTick(() => (saveRecipientInput?.value as any)?.focus());
}

/**
 * Saves recipients to local storage
 */
function saveRecipient() {
  savedRecipients.value.push({
    ...upnData.value,
    amount: undefined,
    savedName: `${recipientSaveName.value}`,
  });

  console.log("save:", JSON.stringify(savedRecipients.value));

  localStorage.setItem(
    LOCALSTORAGE_RECIPIENTS_KEY,
    JSON.stringify(savedRecipients.value)
  );

  cancelSaveRecipient();
}

/**
 * Cancels saving a recipient to local storage
 */
function cancelSaveRecipient() {
  savingRecipient.value = false;
  recipientSaveName.value = "";
}

/**
 * Loads recipient from recipient list into the UPN form
 * @param recipient
 */
function loadRecipient(recipient: any) {
  upnData.value = { ...recipient, savedName: undefined };
  autofocusInput();
}

/**
 * Removes recipient from the list of saved recipients
 * @param recipientIndex
 */
function removeRecipient(recipientIndex: number) {
  savedRecipients.value.splice(recipientIndex, 1);
  localStorage.setItem(
    LOCALSTORAGE_RECIPIENTS_KEY,
    JSON.stringify(savedRecipients.value)
  );
}

function autofocusInput() {
  (autofocus.value as any)?.focus();
}

function onMounted() {
  nextTick(() => autofocusInput());
}
</script>

<template>
  <header>
    <div class="page-icon w-100">
      <h1 class="no-margin">
        <sub><small>Železna legija predstavlja</small></sub
        ><br />
      </h1>
      <h1>Generator UPN QR kod v sili</h1>
    </div>
  </header>
  <main>
    <div class="manual">
      <p><b>Navodila za uporabo:</b></p>
      <p>
        Vneseš podatke. Klikneš "ustvari QR kode." Ven dobiš dve QR kodi — eno za
        slovenske banke, drugo za revolut pa n26 pa take fore. Izi. Stvar ne validira
        podatkov kaj preveč — je na tebi, da vneseš podatke pravilno.
      </p>
      <p>
        Stvari z zvezdico so obvezne, ostalo je priporočljivo. Aja, pa šumnikov ni. Evropski standard
        ne podpira. Slovenski standard dovoljuje, sam QR knjižnica ne zna uporabit.
      </p>
      <p>
        <small
          >Ta stran je zastonj in brez reklam. Bi bila tudi brez fehtatonov, ampak bom ob
          tej inflaciji čez tri mesce basically na minimalcu. Če uporabljaš pogosto in bi
          mi radi častil pir, potem lahko to storiš
          <a href="https://www.paypal.com/paypalme/tamius">tukaj</a>. Github
          <a href="github.com/tamius-han/upn-qr" target="_blank">tuki</a>.</small
        >
      </p>
    </div>

    <div class="container">
      <div class="data-form">
        <div class="upn-form">
          <h3 class="hmb">Podatki za UPN</h3>
          <div class="field" :class="{ error: upnErrors.amount }">
            <div class="label">Znesek v evrih*</div>
            <div class="input">
              <input
                ref="autofocus"
                v-model="upnData.amount"
                @input="resetQr()"
                @keyup.enter.prevent="createQr()"
                autofocus
              />
            </div>
          </div>
          <div class="field code">
            <div class="label">Koda namena</div>
            <div class="input">
              <input
                v-model="upnData.code"
                @input="resetQr()"
                @keyup.enter.prevent="createQr()"
              />
            </div>
          </div>
          <div class="field purpose" :class="{ error: upnErrors.purpose }">
            <div class="label">Namen plačila*</div>
            <div class="input">
              <input
                v-model="upnData.purpose"
                @input="resetQr()"
                @keyup.enter.prevent="createQr()"
              />
            </div>
          </div>

          <div class="field" :class="{ error: upnErrors.recipientIBAN }">
            <div class="label">IBAN*</div>
            <div class="input">
              <input
                v-model="upnData.recipientIBAN"
                @input="resetQr()"
                @keyup.enter.prevent="createQr()"
              />
            </div>
          </div>

          <div class="field">
            <div class="label" :class="{ error: upnErrors.reference }">
              Referenca prejemnika
            </div>
            <div class="input">
              <input
                v-model="upnData.reference"
                @input="resetQr()"
                @keyup.enter.prevent="createQr()"
              />
            </div>
          </div>
          <div class="field">
            <div class="label">Naziv prejemnika*</div>
            <div class="input">
              <input
                v-model="upnData.recipientName"
                @input="resetQr()"
                @keyup.enter.prevent="createQr()"
              />
            </div>
          </div>
          <div class="field">
            <div class="label">Ulica in hišna številka</div>
            <div class="input">
              <input
                v-model="upnData.recipientAddress"
                @input="resetQr()"
                @keyup.enter.prevent="createQr()"
              />
            </div>
          </div>
          <div class="field">
            <div class="label">Pošta in kraj</div>
            <div class="input">
              <input
                v-model="upnData.recipientCity"
                @input="resetQr()"
                @keyup.enter.prevent="createQr()"
              />
            </div>
          </div>

          <div class="action-row">
            <template v-if="savingRecipient">
              <div class="field flex-grow-1">
                <div class="label">Vnesi ime prejemnika:</div>
                <div class="input">
                  <input
                    ref="saveRecipientInput"
                    v-model="recipientSaveName"
                    @keyup.enter.prevent="saveRecipient()"
                    @keyup.esc.prevent="cancelSaveRecipient()"
                  />
                </div>
              </div>
              <div class="save-input flex-grow-0 flex-shrink-0">
                <div tabindex="0" class="button" @click="saveRecipient()">Shrani</div>
                <div tabindex="0" class="button" @click="cancelSaveRecipient()">
                  Prekliči
                </div>
              </div>
            </template>
            <template v-else>
              <div tabindex="0" class="button" @click="createQr()">Ustvari QR kode</div>
              <div tabindex="0" class="button" @click="startSaveRecipient()">
                Shrani prejemnika
              </div>
            </template>
          </div>
          <div v-if="!savingRecipient" class="field">
            <div class="label">
              <input type="checkbox" v-model="noBorder" style="width: initial" /> Brez
              obrobe okrog QR kod
            </div>
            <small
              ><b
                >Okrog QR kode mora biti za približno dva kvadratka praznega prostora,
                drugače se ne bo skenirala.</b
              >
              Možnost brez obrobe uporabi samo, če nameravaš obrobo okrog QR kode dodati
              kasneje.</small
            >
          </div>
        </div>

        <div class="saved-form">
          <div class="heading">
            <h3 class="hmb">Shranjeni prejemniki</h3>
          </div>
          <div class="saved-recipients">
            <div class="scroller">
              <div
                v-for="(recipient, index) of savedRecipients"
                :key="recipient.savedName"
                class="recipient"
                tabindex="0"
                @click="loadRecipient(recipient)"
              >
                <div class="recipient-data">
                  <div class="saved-name">
                    {{ recipient.savedName }}
                  </div>
                  <div class="saved-data">
                    {{ recipient.recipientName }}
                    <br />
                    <small>{{ recipient.recipientIBAN }}</small>
                  </div>
                </div>
                <div class="button-container">
                  <div class="button slim" @click="loadRecipient(recipient)">Uporabi</div>
                  <div
                    tabindex="0"
                    class="button slim warn"
                    @click="removeRecipient(index)"
                  >
                    Odstrani
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <h1 class="qr-area-heading">QR kode:</h1>

      <div class="qr-area">
        <div class="qr-panel">
          <h2>Tuje banke</h2>
          <div>Revolut, N26, itd.</div>
          <div class="qr-code" v-html="bcdQrHtml"></div>
          <div
            class="button"
            @click="
              saveSvg(
                bcdQrHtml,
                upnData.amount + '-EU-QR-' + upnData.recipientName + '.svg'
              )
            "
          >
            Shrani SVG
          </div>
        </div>
        <div class="qr-panel">
          <h2>Slovenske banke</h2>
          <div>N26, SKB, gor*njska banka, itd.</div>
          <div class="qr-code" v-html="upnQrHtml"></div>
          <div
            class="button"
            @click="
              saveSvg(
                upnQrHtml,
                upnData.amount + '-SLO-QR-' + upnData.recipientName + '.svg'
              )
            "
          >
            Shrani SVG
          </div>
        </div>
      </div>
      <div class="qr-area">
        <div class="qr-panel" style="margin-top: 2rem">
          <h3>Podatki o prejemniku <small>za enostavno kopiranje</small></h3>
          <b>IBAN:</b> {{ upnData.recipientIBAN }}<br />
          <b>Naziv prejemnika:</b> {{ upnData.recipientName }}
          <template v-if="upnData.recipientAddress">
            <b>Naslov:</b> {{ upnData.recipientAddress }}, {{ upnData.recipientCity }}
          </template>
        </div>
      </div>
    </div>
  </main>
  <footer>
    <a href="http://tamius.net" target="_blank">tamius.net</a> —
    <a href="http://stuff.tamius.net/sacred-texts" target="_blank">moj blog in jamranja</a
    >, <a href="https://github.com/tamius-han" target="_blank">moj github</a>,
    <a href="https://www.instagram.com/tamius_han/">moj insta</a>.
  </footer>
</template>

<style scoped>
header {
  line-height: 1.5;
}

h3.hmb {
  margin-bottom: 1.5rem;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

.manual {
  margin-top: 1rem;
  margin-bottom: 3rem;

  border: 1px solid black;
  padding: 1rem;
}

.action-row {
  display: flex;
  flex-direction: row;
  margin-top: 1.5rem;
  justify-content: center;
  width: 100%;
  padding-right: 0.5rem;
}
.action-row .button {
  margin: 0.5rem;
}

.qr-area-heading {
  margin-top: 3rem;
  margin-bottom: 1.5rem;
  margin-left: 1rem;
}

.data-form {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}
.data-form .upn-form {
  flex-basis: 16rem;
  min-width: 375px;
  flex-grow: 2;
  flex-shrink: 1;
}
.data-form .saved-form {
  flex-basis: 16rem;
  min-width: 375px;
  flex-grow: 1;
  flex-shrink: 1;
  position: relative;
  display: flex;
  flex-direction: column;
}

.saved-form .heading {
  padding-left: 0.5rem;
}

.qr-area {
  width: 100%;
  text-align: center;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
}
.qr-panel {
  display: flex;
  flex-direction: column;
}
.qr-code {
  display: block;
  width: 24rem;
  height: 24rem;
  border: 1px dotted rgb(168, 113, 84);
  color: rgb(168, 113, 84);
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 1rem;
}

.upn-form {
  max-width: 42rem;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}
.upn-form .field {
  flex-basis: 100%;
  padding-left: 1rem;
  padding-right: 1rem;
}
.field.error input {
  background-color: rgba(248, 158, 120, 0.449);
  border-color: rgba(248, 158, 120, 1);
}

.upn-form .field input {
  width: 100%;
}
.upn-form .field.code {
  flex-basis: 10rem;
  flex-grow: 1;
  max-width: 10rem;
  flex-shrink: 0;
}
.upn-form .field.purpose {
  flex-basis: 69%;
  flex-grow: 1;
  flex-shrink: 0;
}

.qr-code svg {
  height: 100%;
  width: 100%;
}

.save-input {
  display: flex;
  flex-direction: row;
  align-items: center;
}
.save-input .input {
  flex-grow: 1;
  flex-shrink: 1;
  padding-right: 1rem;
  display: flex;
  justify-content: center;
  height: fit-content;
}
.save-input .input input {
  width: 100%;
}

.save-input .button {
  flex-grow: 0;
  flex-shrink: 0;
}

.save-data {
  margin-bottom: 1rem;
}

.saved-recipients {
  flex-grow: 1;
  flex-shrink: 1;

  position: relative;
}

.saved-recipients .scroller {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: auto;
}

.saved-recipients .recipient:hover,
.saved-recipients .recipient:focus {
  background-color: rgba(255, 171, 102, 0.25);
  cursor: pointer;
}

.saved-recipients .recipient {
  border-top: 1px dotted #fa6;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  padding: 0.5rem;
}
.saved-recipients .recipient:first-child {
  border-top: none;
}

.saved-recipients .recipient .recipient-data {
  flex-grow: 1;
  flex-shrink: 1;
}

.saved-recipients .recipient .recipient-data .saved-name {
  font-weight: bold;
  color: rgb(158, 92, 37);
  font-size: 1.1em;
}

.recipient .button-container {
  flex-grow: 0;
  flex-shrink: 0;
  height: fit-content;
  display: flex;
  flex-direction: column;
}
.recipient .button-container .button {
  background-color: transparent;
  border: none;
  text-decoration: underline;
  color: #fa6;
}
.recipient .button-container .button:hover {
  background-color: rgba(255, 171, 102, 0.125);
}
.recipient .button-container .button.warn:hover {
  background-color: rgb(171, 36, 18);
}

small {
  opacity: 0.5;
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    /* padding-right: calc(var(--section-gap) / 2); */
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }
}

footer {
  border-top: 1px dotted #fa6;
  margin-top: 5rem;
  padding-bottom: 2.5rem;
  text-align: center;
  opacity: 0.75;
  font-size: 0.8rem;
}
</style>
