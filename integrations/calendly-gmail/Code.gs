/**
 * FlowOP CRM — Calendly via Gmail → Supabase
 *
 * Watches Gmail for Calendly host notifications (notifications@calendly.com),
 * parses invitee details, and inserts a row into public.enquiries.
 *
 * SETUP (one time)
 * 1. script.google.com → New project → paste this file → Save.
 * 2. Project Settings → Script properties → add:
 *      SUPABASE_URL          https://YOUR_PROJECT.supabase.co
 *      SUPABASE_SERVICE_KEY  service_role key (Dashboard → Settings → API)
 *      CRM_USER_ID           your auth.users UUID (Dashboard → Authentication → Users)
 *      DEFAULT_STAGE         call_booked   (optional; enquiry_stage enum name)
 *      GMAIL_SEARCH          from:notifications@calendly.com -label:FlowOP-Processed
 * 3. Run setup() once → authorize Gmail + external requests → allow triggers.
 *    Trigger interval: currently every 4 hours (change TRIGGER_EVERY_HOURS below, or edit
 *    in Apps Script → Triggers). Re-running setup() recreates the trigger — confirm the
 *    interval with the project owner before changing it in code.
 * 4. Book a test Calendly meeting → Run processCalendlyEmails() → check Enquiry Log.
 *
 * Uses the Supabase service role key (stored in Script Properties only). Never commit that key.
 */

var PROCESSED_LABEL_NAME = 'FlowOP-Processed';
var TRIGGER_FUNCTION = 'processCalendlyEmails';
/** Time-driven trigger interval. Owner may change this in Apps Script UI — confirm before amending. */
var TRIGGER_EVERY_HOURS = 4;

/** Run once after setting Script Properties. */
function setup() {
  ensureProcessedLabel_();
  removeTriggers_();
  ScriptApp.newTrigger(TRIGGER_FUNCTION)
    .timeBased()
    .everyHours(TRIGGER_EVERY_HOURS)
    .create();
  Logger.log('Setup complete. Trigger runs every ' + TRIGGER_EVERY_HOURS + ' hours.');
}

/** Remove the time-driven trigger. */
function teardown() {
  removeTriggers_();
  Logger.log('Triggers removed.');
}

/** Manual run / time-driven entry point. */
function processCalendlyEmails() {
  var props = PropertiesService.getScriptProperties();
  var supabaseUrl = props.getProperty('SUPABASE_URL');
  var serviceKey = props.getProperty('SUPABASE_SERVICE_KEY');
  var userId = props.getProperty('CRM_USER_ID');
  var defaultStage = props.getProperty('DEFAULT_STAGE') || 'call_booked';
  var searchQuery =
    props.getProperty('GMAIL_SEARCH') ||
    'from:notifications@calendly.com -label:FlowOP-Processed';

  if (!supabaseUrl || !serviceKey || !userId) {
    throw new Error(
      'Missing Script Properties. Set SUPABASE_URL, SUPABASE_SERVICE_KEY, and CRM_USER_ID.'
    );
  }

  var processedLabel = ensureProcessedLabel_();
  var threads = GmailApp.search(searchQuery, 0, 25);
  var created = 0;
  var skipped = 0;

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    if (threadHasLabel_(thread, processedLabel)) {
      skipped++;
      continue;
    }

    var messages = thread.getMessages();
    var markThreadProcessed = false;

    for (var j = 0; j < messages.length; j++) {
      var message = messages[j];
      if (message.getFrom().indexOf('notifications@calendly.com') === -1) {
        continue;
      }

      var subject = message.getSubject() || '';
      var plainBody = message.getPlainBody() || '';
      var htmlBody = message.getBody() || '';
      var messageId = message.getId();

      if (isIgnoredCalendlySubject_(subject)) {
        Logger.log('Skipped (cancel/reschedule): ' + subject);
        markThreadProcessed = true;
        skipped++;
        continue;
      }

      var parsed = parseCalendlyNotification_(subject, plainBody, htmlBody);
      if (!parsed.contact_name && !parsed.email) {
        Logger.log('Could not parse message: ' + subject);
        continue;
      }

      if (enquiryAlreadyExists_(supabaseUrl, serviceKey, userId, parsed)) {
        Logger.log('Skipped (already in Supabase): ' + subject);
        markThreadProcessed = true;
        skipped++;
        continue;
      }

      var row = buildEnquiryRow_(parsed, userId, defaultStage, messageId);
      var inserted = insertEnquiry_(supabaseUrl, serviceKey, row);
      if (!inserted) {
        Logger.log('Supabase insert failed for: ' + subject);
        continue;
      }

      markThreadProcessed = true;
      created++;
    }

    if (markThreadProcessed) {
      thread.addLabel(processedLabel);
    }
  }

  Logger.log('Done. Created ' + created + ', skipped ' + skipped + '.');
}

/** Parse a sample subject/body in the editor (Run → testParse). */
function testParse() {
  var sampleSubject =
    'New Event: Bimal Patel - 09:30am Mon, 31 Aug 2026 - Discovery Call';
  var sampleBody =
    'Hi Bimal Patel,\n\n' +
    'A new event has been scheduled.\n\n' +
    'Event Type:\nDiscovery Call\n\n' +
    'Invitee:\nBimal Patel\n\n' +
    'Invitee Email:\nbimal810@googlemail.com\n\n' +
    'Event Date/Time:\n' +
    '09:30am - Monday, 31 August 2026 (Eastern Time - US & Canada)\n\n' +
    'Location:\nThis is a Google Meet web conference. Join now\n\n' +
    'Invitee Time Zone:\nUK, Ireland, Lisbon Time\n\n' +
    'Questions:\n\n' +
    'Please share anything that will help prepare for our meeting.\n\n' +
    'Just curious\n\n' +
    'View event in Calendly\n';
  var inlineBody =
    'Questions:\n' +
    '* Please share anything that will help prepare for our meeting. * Just curious View event in Calendly\n';
  var sampleHtml =
    '<a href="mailto:bimal810@googlemail.com">bimal810@googlemail.com</a>' +
    '<p>Location:</p><p>This is a Google Meet web conference. <a href="https://meet.google.com">Join now</a></p>' +
    '<h3>Questions</h3><dl><dt>Please share anything that will help prepare for our meeting.</dt>' +
    '<dd>Just curious</dd></dl><a href="https://calendly.com">View event in Calendly</a>';

  var parsed = parseCalendlyNotification_(sampleSubject, sampleBody, sampleHtml);
  Logger.log('Block format: ' + JSON.stringify(parsed, null, 2));

  parsed = parseCalendlyNotification_(sampleSubject, inlineBody, sampleHtml);
  Logger.log('Inline format query_summary: ' + parsed.booking_answers);
  var row = buildEnquiryRow_(parsed, 'user-id', 'call_booked', 'test-msg');
  Logger.log('Row notes: ' + row.notes);
  Logger.log('Row query_summary: ' + row.query_summary);
  Logger.log('Row location: ' + parsed.location);
}

function cleanLocationText_(text) {
  if (!text) return '';

  var out = String(text)
    .replace(/<a[\s\S]*?<\/a>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\bJoin now\b/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  return out;
}

function extractLocation_(body, htmlBody) {
  var fromBody = firstMatch_(body, [
    /Location:\s*\n+([\s\S]*?)(?=\n\s*Invitee Time Zone:|\n\s*Questions:|$)/i,
    /Location:\s*\n\s*([^\n]+)/i,
    /Location:\s*(.+?)(?:\n|$)/i,
  ]);
  fromBody = cleanLocationText_(fromBody);
  if (fromBody && !isJunkParsedValue_(fromBody)) {
    return fromBody;
  }

  if (!htmlBody) return '';

  var section = htmlBody.match(/Location[\s\S]*?(?=Invitee Time Zone|Questions)/i);
  if (!section) return '';

  var fromHtml = cleanLocationText_(
    section[0].replace(/^Location:?\s*/i, '')
  );
  if (fromHtml && !isJunkParsedValue_(fromHtml)) {
    return fromHtml;
  }

  return '';
}

function ensureProcessedLabel_() {
  var label = GmailApp.getUserLabelByName(PROCESSED_LABEL_NAME);
  if (!label) {
    label = GmailApp.createLabel(PROCESSED_LABEL_NAME);
  }
  return label;
}

function removeTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === TRIGGER_FUNCTION) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function threadHasLabel_(thread, label) {
  var labels = thread.getLabels();
  for (var i = 0; i < labels.length; i++) {
    if (labels[i].getName() === label.getName()) {
      return true;
    }
  }
  return false;
}

function isIgnoredCalendlySubject_(subject) {
  var s = subject.toLowerCase();
  return (
    s.indexOf('canceled') !== -1 ||
    s.indexOf('cancelled') !== -1 ||
    s.indexOf('cancellation') !== -1 ||
    s.indexOf('rescheduled') !== -1
  );
}

function normalizeBody_(plainBody, htmlBody) {
  var text = (plainBody || '').trim();
  if (!text && htmlBody) {
    text = htmlBody
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }
  return text.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ');
}

function firstMatch_(text, patterns) {
  for (var i = 0; i < patterns.length; i++) {
    var match = text.match(patterns[i]);
    if (match && match[1]) {
      return String(match[1]).trim();
    }
  }
  return '';
}

function isJunkParsedValue_(value) {
  if (value === null || value === undefined) return true;
  var v = String(value).replace(/\s+/g, ' ').trim();
  if (!v) return true;
  if (/^[•\*\-–—·.]+$/.test(v)) return true;
  if (v.length === 1 && !/[a-zA-Z0-9]/.test(v)) return true;
  return false;
}

function cleanParsedValue_(value) {
  return isJunkParsedValue_(value) ? '' : String(value).replace(/\s+/g, ' ').trim();
}

function firstCleanMatch_(text, patterns) {
  return cleanParsedValue_(firstMatch_(text, patterns));
}

function parseSubject_(subject) {
  var result = {
    contact_name: '',
    event_type: '',
    event_datetime: '',
  };
  if (!subject) return result;

  var alt = subject.match(/^New Event:\s*(.+?)\s*-\s*(.+?)\s*-\s*(.+)$/i);
  if (alt) {
    result.contact_name = cleanParsedValue_(alt[1]);
    result.event_datetime = cleanParsedValue_(alt[2]);
    result.event_type = cleanParsedValue_(alt[3]);
    return result;
  }

  var withFormat = subject.match(
    /(?:New Event:|Confirmed:)\s*(.+?)\s+with\s+(.+?)(?:\s*[-–]|$)/i
  );
  if (withFormat) {
    result.event_type = cleanParsedValue_(withFormat[1]);
    result.contact_name = cleanParsedValue_(withFormat[2]);
  }

  return result;
}

function extractEmailFromHtml_(htmlBody) {
  if (!htmlBody) return '';

  var mailtoMatches = htmlBody.match(/mailto:([^"'\s>?]+)/gi) || [];
  for (var i = 0; i < mailtoMatches.length; i++) {
    var email = cleanParsedValue_(
      mailtoMatches[i].replace(/^mailto:/i, '').replace(/\?.*$/, '')
    );
    if (email && email.indexOf('@') !== -1) {
      return email;
    }
  }

  return firstCleanMatch_(htmlBody, [
    /Invitee Email[\s\S]{0,300}?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
  ]);
}

function extractNameFromHtml_(htmlBody) {
  if (!htmlBody) return '';

  return firstCleanMatch_(htmlBody, [
    /Invitee[\s\S]{0,120}?<a[^>]*>([^<]+)<\/a>/i,
    /Invitee[\s\S]{0,120}?<strong[^>]*>([^<]+)<\/strong>/i,
    /Invitee[\s\S]{0,120}?<td[^>]*>([^<]+)<\/td>/i,
    /Invitee:\s*([^<\n]+)/i,
    /Invitee Name:\s*([^<\n]+)/i,
  ]);
}

function isCalendlyFooterBlock_(block) {
  var s = String(block).toLowerCase();
  return (
    s.indexOf('view event in calendly') !== -1 ||
    s.indexOf('use calendly anywhere') !== -1 ||
    s.indexOf('get calendly for') !== -1 ||
    s.indexOf('see all apps') !== -1 ||
    s.indexOf('chromewebstore.google.com') !== -1 ||
    s.indexOf('addons.mozilla.org') !== -1 ||
    s.indexOf('utm_source=calendly') !== -1 ||
    s.indexOf('utm_medium=email') !== -1 ||
    s.indexOf('calendly.com/help') !== -1
  );
}

function stripQuestionsFooters_(text) {
  if (!text) return '';

  var markers = [
    /View event in Calendly[\s\S]*$/i,
    /\nUse Calendly anywhere[\s\S]*$/i,
    /\nGet Calendly for[\s\S]*$/i,
    /\nSee all apps[\s\S]*$/i,
    /\nhttps?:\/\/chromewebstore[\s\S]*$/i,
    /\nhttps?:\/\/addons\.mozilla[\s\S]*$/i,
    /\nhttps?:\/\/calendly\.com[\s\S]*$/i,
    / <https?:\/\/[\s\S]*$/i,
  ];

  var out = String(text);
  for (var i = 0; i < markers.length; i++) {
    out = out.replace(markers[i], '');
  }

  return out.replace(/[ \t]+$/gm, '').trim();
}

function stripCalendlyFooter_(text) {
  return stripQuestionsFooters_(text).replace(/\s+/g, ' ').trim();
}

function cleanAnswerText_(text) {
  return stripQuestionsFooters_(text).trim();
}

function extractBookingAnswersFromHtml_(htmlBody) {
  if (!htmlBody) return '';

  var sectionMatch = htmlBody.match(/Questions[\s\S]*$/i);
  if (!sectionMatch) return '';

  var section = sectionMatch[0];
  var answers = [];
  var ddMatches = section.match(/<dd[^>]*>([\s\S]*?)<\/dd>/gi) || [];

  for (var i = 0; i < ddMatches.length; i++) {
    var answer = cleanAnswerText_(
      ddMatches[i]
        .replace(/<\/?dd[^>]*>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
    );
    if (answer && !isCalendlyFooterBlock_(answer) && !isJunkParsedValue_(answer)) {
      answers.push(answer);
    }
  }

  return answers.join('\n\n');
}

function extractBookingAnswers_(body, htmlBody) {
  var htmlAnswers = extractBookingAnswersFromHtml_(htmlBody);
  if (htmlAnswers) return htmlAnswers;

  var match = body.match(/Questions:\s*([\s\S]+)$/i);
  if (!match) return '';

  var section = stripQuestionsFooters_(match[1]);
  if (!section) return '';

  var inline = section.match(/^\*\s*([\s\S]+?)\s*\*\s*([\s\S]+)$/);
  if (inline) {
    var inlineAnswer = cleanAnswerText_(inline[2]);
    if (inlineAnswer && !isCalendlyFooterBlock_(inlineAnswer)) {
      return inlineAnswer;
    }
  }

  var blocks = section
    .split(/\n\n+/)
    .map(function (block) {
      return cleanAnswerText_(block);
    })
    .filter(function (block) {
      return block && !isJunkParsedValue_(block) && !isCalendlyFooterBlock_(block);
    });

  if (!blocks.length) return '';

  var answers = [];
  for (var i = 1; i < blocks.length; i += 2) {
    answers.push(blocks[i]);
  }

  return answers.join('\n\n');
}

function parseCalendlyNotification_(subject, plainBody, htmlBody) {
  var fromSubject = parseSubject_(subject);
  var body = normalizeBody_(plainBody, htmlBody);

  var inviteeName =
    fromSubject.contact_name ||
    firstCleanMatch_(body, [
      /Invitee:\s*\n\s*([^\n]+)/i,
      /Invitee:\s*(.+?)(?:\n|$)/i,
      /Invitee Name:\s*\n\s*([^\n]+)/i,
      /Invitee Name:\s*(.+?)(?:\n|$)/i,
    ]) ||
    extractNameFromHtml_(htmlBody);

  var inviteeEmail =
    firstCleanMatch_(body, [
      /Invitee Email:\s*\n\s*([^\s\n<>]+@[^\s\n<>]+)/i,
      /Invitee Email:\s*([^\s\n<>]+@[^\s\n<>]+)/i,
      /Email:\s*([^\s\n<>]+@[^\s\n<>]+)/i,
    ]) || extractEmailFromHtml_(htmlBody);

  var eventType =
    firstCleanMatch_(body, [
      /Event Type:\s*\n\s*([^\n]+)/i,
      /Event Type:\s*(.+?)(?:\n|$)/i,
      /Meeting type:\s*(.+?)(?:\n|$)/i,
    ]) ||
    fromSubject.event_type;

  var eventDateTime =
    firstCleanMatch_(body, [
      /Event Date\/Time:\s*\n\s*([^\n]+)/i,
      /Event Date\/Time:\s*(.+?)(?:\n|$)/i,
      /Date\s*&\s*Time:\s*(.+?)(?:\n|$)/i,
      /When:\s*(.+?)(?:\n|$)/i,
    ]) ||
    fromSubject.event_datetime;

  var location = extractLocation_(body, htmlBody);

  var bookingAnswers = extractBookingAnswers_(body, htmlBody);

  return {
    contact_name: inviteeName,
    email: inviteeEmail,
    event_type: eventType,
    event_datetime: eventDateTime,
    location: location,
    booking_answers: bookingAnswers,
    raw_subject: subject,
  };
}

function buildEnquiryRow_(parsed, userId, defaultStage, messageId) {
  var nextAction = parsed.event_datetime
    ? 'Call booked for ' + parsed.event_datetime
    : 'Call booked via Calendly';

  var noteLines = [];
  if (parsed.event_datetime) noteLines.push(parsed.event_datetime);
  if (parsed.location) noteLines.push(parsed.location);

  return {
    user_id: userId,
    contact_name: parsed.contact_name || parsed.email || 'Calendly invitee',
    company: null,
    email: parsed.email || null,
    source: 'Calendly',
    query_summary: parsed.booking_answers || null,
    stage: defaultStage,
    next_action: nextAction,
    notes: noteLines.length ? noteLines.join('\n') : null,
    date_received: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
  };
}

/** Run once if an older script version cached message IDs and keeps skipping. */
function clearProcessedMessageCache() {
  PropertiesService.getScriptProperties().deleteProperty('PROCESSED_GMAIL_MSG_IDS');
  Logger.log('Cleared PROCESSED_GMAIL_MSG_IDS.');
}

function enquiryAlreadyExists_(supabaseUrl, serviceKey, userId, parsed) {
  var nextAction = parsed.event_datetime
    ? 'Call booked for ' + parsed.event_datetime
    : 'Call booked via Calendly';

  var url =
    supabaseUrl +
    '/rest/v1/enquiries?user_id=eq.' +
    encodeURIComponent(userId) +
    '&next_action=eq.' +
    encodeURIComponent(nextAction) +
    '&select=id&limit=1';

  if (parsed.email) {
    url += '&email=eq.' + encodeURIComponent(parsed.email);
  } else {
    url += '&contact_name=eq.' + encodeURIComponent(parsed.contact_name);
  }

  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: supabaseHeaders_(serviceKey),
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() >= 400) {
    Logger.log('Duplicate check failed: ' + response.getContentText());
    return false;
  }

  var rows = JSON.parse(response.getContentText() || '[]');
  return rows.length > 0;
}

function insertEnquiry_(supabaseUrl, serviceKey, row) {
  var response = UrlFetchApp.fetch(supabaseUrl + '/rest/v1/enquiries', {
    method: 'post',
    headers: Object.assign({}, supabaseHeaders_(serviceKey), {
      Prefer: 'return=minimal',
      'Content-Type': 'application/json',
    }),
    payload: JSON.stringify(row),
    muteHttpExceptions: true,
  });

  var code = response.getResponseCode();
  if (code >= 200 && code < 300) {
    return true;
  }

  Logger.log('Insert error ' + code + ': ' + response.getContentText());
  return false;
}

function supabaseHeaders_(serviceKey) {
  return {
    apikey: serviceKey,
    Authorization: 'Bearer ' + serviceKey,
  };
}
