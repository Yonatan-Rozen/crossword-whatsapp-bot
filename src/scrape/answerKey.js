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
const config = require("../config");

function buildUrl(dateDDMMYYYY) {
  const { baseUrl, wantsold, crossword, name } = config.answersPage;
  const params = new URLSearchParams({
    wantsold: String(wantsold),
    crossword: String(crossword),
    name,
    date: dateDDMMYYYY,
  });
  return `${baseUrl}?${params.toString()}`;
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

async function fetchAnswerKey(dateDDMMYYYY) {
  const url = buildUrl(dateDDMMYYYY);
  let html = await fetchViaHttp(url);
  let entries = parseEntriesFromDom(cheerio.load(html));

  if (Object.keys(entries).length === 0) {
    html = await fetchViaBrowser(url);
    entries = parseEntriesFromDom(cheerio.load(html));
  }

  if (Object.keys(entries).length === 0) {
    throw new Error(
      `Could not find any .question_number/.actual-answer pairs at ${url}`,
    );
  }

  return { url, entries };
}

module.exports = { buildUrl, parseEntriesFromDom, fetchAnswerKey };
