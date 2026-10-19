import { $, escapeHtml, hideOverlay, showOverlay } from "./dom";

/**
 * Angaben für Impressum und Datenschutzerklärung.
 * Vor der Veröffentlichung ausfüllen; leere Felder werden als Platzhalter angezeigt.
 */
const OPERATOR = {
  name: "Santo Lo Tauro",
  street: "Schönaustraße 37",
  city: "40625 Düsseldorf",
  // Die E-Mail steht in zwei Teilen (vor und nach dem @), damit sie nirgends am Stück im Bundle
  // auftaucht. Zusammengesetzt wird sie erst, wenn ein Dialog geöffnet wird.
  emailUser: "fuchs-und-faser",
  emailDomain: "outlook.de",
};

function field(value: string, placeholder: string): string {
  return value
    ? escapeHtml(value)
    : `<span class="placeholder">[${placeholder}]</span>`;
}

function email(): string {
  if (!OPERATOR.emailUser || !OPERATOR.emailDomain) {
    return field("", "E-Mail-Adresse");
  }
  const address = escapeHtml(
    [OPERATOR.emailUser, OPERATOR.emailDomain].join("@"),
  );
  return `<a href="mailto:${address}">${address}</a>`;
}

function showLegal(title: string, body: string): void {
  const el = showOverlay(`
    <h2>${title}</h2>
    <div class="legal">${body}</div>
    <div class="row"><button class="btn primary" id="legal-close">Schließen</button></div>`);
  $("#legal-close", el).onclick = hideOverlay;
  // Der Fokus liegt auf „Schließen“ ganz unten; der Text soll trotzdem oben beginnen.
  $(".dialog", el).scrollTop = 0;
}

export function showImprint(): void {
  showLegal(
    "Impressum",
    `
    <p>Angaben gemäß § 5 DDG</p>
    <p>${field(OPERATOR.name, "Vor- und Nachname")}<br/>
      ${field(OPERATOR.street, "Straße und Hausnummer")}<br/>
      ${field(OPERATOR.city, "PLZ und Ort")}</p>
    <h3>Kontakt</h3>
    <p>E-Mail: ${email()}</p>
    <h3>Verantwortlich für den Inhalt</h3>
    <p>${field(OPERATOR.name, "Vor- und Nachname")}, Anschrift wie oben.</p>
    <p class="muted">Fuchs &amp; Faser ist ein privates, nicht kommerzielles Spieleprojekt.</p>`,
  );
}

export function showPrivacy(): void {
  showLegal(
    "Datenschutz",
    `
    <h3>Verantwortlicher</h3>
    <p>${field(OPERATOR.name, "Vor- und Nachname")}, ${field(OPERATOR.street, "Straße und Hausnummer")},
      ${field(OPERATOR.city, "PLZ und Ort")}, E-Mail: ${email()}</p>
    <h3>Hosting und Server-Logs</h3>
    <p>Diese Seite wird bei Render Services, Inc. (USA) gehostet. Beim Aufruf verarbeitet der Hoster technisch notwendige
      Daten wie IP-Adresse, Zeitpunkt und angefragte Adresse, um die Seite auszuliefern und vor Missbrauch zu schützen.
      Rechtsgrundlage ist unser berechtigtes Interesse am sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO).
      Dabei können Daten in die USA übermittelt werden.</p>
    <h3>Multiplayer</h3>
    <p>Wenn du einen Raum erstellst oder ihm beitrittst, verarbeitet der Server deinen frei gewählten Anzeigenamen,
      dein Tier und deine Spielzüge. Diese Daten liegen nur im Arbeitsspeicher und werden spätestens gelöscht,
      wenn der Raum aufgelöst wird oder der Server neu startet.</p>
    <h3>Speicher im Browser</h3>
    <p>Deine Einstellungen (Spielername, Tipps, Animationen) speichert dein Browser lokal (<code>localStorage</code>).
      Für den Wiederbeitritt zu einem Raum wird für die Dauer der Sitzung ein Schlüssel im <code>sessionStorage</code>
      abgelegt. Diese Daten verlassen deinen Browser nicht dauerhaft und dienen nur der Funktion des Spiels.
      Es gibt keine Cookies, kein Tracking und keine Analyse. Die Schriftart wird von diesem Server geladen, nicht von Dritten.</p>
    <h3>Deine Rechte</h3>
    <p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit
      und Widerspruch sowie das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.</p>`,
  );
}
