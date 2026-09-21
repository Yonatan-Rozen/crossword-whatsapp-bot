"use strict";

// Scrapes the correct answers for one crossword board from 14across.co.il.
//
// Verified live structure (2026-09): each clue is rendered as
//   <span class="question_number">5 מאוזן:</span>
//   <a class="answer-links" ...>לחצו לפתרון</a>
//   <span class="answer-texts"><span class="actual-answer" data-content="סותימ"></span>...</span>
// all inside the same <p>. The real solution is already in the static HTML as the
// `data-content` attribute (CSS/JS only toggles its visibility on click).

const cheerio = require("cheerio");

function buildUrl({ crosswordId, name, date }) {
  const params = new URLSearchParams();
  if (date) params.set("wantsold", "1");
  params.set("crossword", String(crosswordId));
  if (name) params.set("name", name);
  if (date) params.set("date", date);
  return `https://www.14across.co.il/answers.php?${params.toString()}`;
}

const CLUE_LABEL_RE = /(\d+)\s*(מאוזן|מאונך)/;

function parseEntriesFromDom($) {
  const entries = {};

  $(".question_number").each((_, el) => {
    const label = $(el).text().trim();
    const match = label.match(CLUE_LABEL_RE);
    if (!match) return;

    const [, number, direction] = match;
    const content = $(el)
      .parent()
      .find(".actual-answer")
      .first()
      .attr("data-content");
    if (content) entries[`${number}:${direction}`] = content.trim();
  });

  return entries;
}

const { DATE_RE, normalizeDate, isValidDate } = require("../util/dates");

// The page heading looks like "פתרונות לתשבץ היגיון תרתי משמע, דקל בנו, 04/09/2026" -
// pull out the resolved date and series title (needed when the caller didn't supply a date).
function parseHeading($) {
  const heading = $("h1").first().text().trim();
  const dateMatch = heading.match(DATE_RE);
  const resolvedDate =
    dateMatch && isValidDate(dateMatch) ? normalizeDate(dateMatch) : null;
  let resolvedTitle = heading.replace(/^פתרונות לתשבץ( היגיון)?\s*/, "");
  if (dateMatch) resolvedTitle = resolvedTitle.replace(dateMatch[0], "");
  resolvedTitle = resolvedTitle.replace(/,\s*$/, "").trim();
  return { resolvedDate, resolvedTitle: resolvedTitle || null };
}

async function fetchViaHttp(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
    },
    redirect: "follow",
  });
  return res.text();
}

// Fallback for when plain HTTP gets redirected to an ad interstitial / needs JS rendering.
async function fetchViaBrowser(url) {
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    return await page.content();
  } finally {
    await browser.close();
  }
}

async function fetchAnswerKey({ crosswordId, name, date }) {
  const url = buildUrl({ crosswordId, name, date });
  let html = await fetchViaHttp(url);
  let $ = cheerio.load(html);
  let entries = parseEntriesFromDom($);

  if (Object.keys(entries).length === 0) {
    html = await fetchViaBrowser(url);
    $ = cheerio.load(html);
    entries = parseEntriesFromDom($);
  }

  if (Object.keys(entries).length === 0) {
    return { url, entries: {}, resolvedDate: null, resolvedTitle: null };
  }

  const { resolvedDate, resolvedTitle } = parseHeading($);
  return { url, entries, resolvedDate, resolvedTitle };
}

module.exports = { buildUrl, parseEntriesFromDom, fetchAnswerKey };
