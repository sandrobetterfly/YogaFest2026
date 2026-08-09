/**
 * YogaFest 2026 — lead-form Google Apps Script Web App.
 *
 * Receives lead-form submissions (forwarded server-to-server by the
 * Cloudflare Worker, worker.js) and appends each one as a row in a
 * Google Sheet. No email is sent — this is the sheet-only replacement
 * for the previous Zoho SMTP notification.
 *
 * --- One-time setup ---
 * 1. Create (or open) the Google Sheet you want leads written to.
 * 2. Extensions -> Apps Script.
 * 3. Delete the default Code.gs contents and paste this file in instead.
 * 4. (Optional) Change SHEET_NAME below if you want a tab name other
 *    than "Leads". The script creates that tab automatically if it
 *    doesn't already exist, with a header row.
 * 5. Deploy -> New deployment -> gear icon -> select type "Web app".
 *      Execute as:      Me
 *      Who has access:  Anyone
 *    Click Deploy, authorize the requested permissions (it needs to
 *    write to this spreadsheet), then copy the Web app URL it gives
 *    you — it looks like:
 *      https://script.google.com/macros/s/AKfycb.../exec
 * 6. Give that URL to whoever configures the Cloudflare Worker — it
 *    gets stored there as the GAS_WEB_APP_URL secret, never committed
 *    to this repo.
 *
 * --- Updating this script later ---
 * Editing the code alone does NOT update the live URL. After changing
 * anything here, go to Deploy -> Manage deployments -> pick the
 * existing deployment -> Edit (pencil icon) -> New version -> Deploy.
 * That keeps the same URL while pushing your changes live.
 */

var SHEET_NAME = 'Leads';

function doPost(e) {
  try {
    var data = parseRequestBody(e);

    var name = cleanField_(data.name, 200);
    var email = cleanField_(data.email, 200);
    var message = cleanField_(data.message, 3000);

    if (!name || !email) {
      return jsonResponse_({ ok: false, error: 'invalid_fields' });
    }

    var sheet = getOrCreateSheet_();
    sheet.appendRow([new Date(), name, email, message]);

    return jsonResponse_({ ok: true });
  } catch (err) {
    return jsonResponse_({ ok: false, error: 'server_error' });
  }
}

// Simple health check so you can confirm the deployment is live by
// opening the Web App URL directly in a browser (GET request).
function doGet() {
  return jsonResponse_({ ok: true, message: 'YogaFest lead-form endpoint is live.' });
}

function parseRequestBody(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return {};
  }
}

function cleanField_(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\r\n]+/g, ' ').trim().slice(0, maxLen);
}

function getOrCreateSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Name', 'Email', 'Message']);
    sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
  }
  return sheet;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
