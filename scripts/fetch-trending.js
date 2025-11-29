const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');

const API_URL = 'https://ghapi.huchen.dev/repositories?since=daily';
const TRENDING_URL = 'https://github.com/trending';
const OUTPUT_FILE = 'data.json';

async function fetchFromAPI() {
  try {
    const res = await axios.get(API_URL, { timeout: 10000 });
    if (res.data && res.data.length) {
      return res.data.map(r => ({
        name: r.name,
        url: r.url,
        desc: r.description,
        language: r.language,
        stars: r.stars,
        range: 'daily'
      }));
    }
    throw new Error('Empty API response');
  } catch (err) {
    console.warn('API fetch failed, falling back to scraping:', err.message);
    return null;
  }
}

async function scrapeTrending() {
  try {
    const { data } = await axios.get(TRENDING_URL);
    const $ = cheerio.load(data);
    const repos = [];

    $('article.Box-row').each((_, el) => {
      const name = $(el).find('h2 a').text().trim().replace(/\s/g, '');
      const url = 'https://github.com' + $(el).find('h2 a').attr('href');
      const desc = $(el).find('p').text().trim() || 'No description';
      const language = $(el).find('[itemprop=programmingLanguage]').text().trim() || 'Unknown';
      const starsText = $(el).find(`a[href$="/stargazers"]`).first().text().trim().replace(',', '');
      const stars = parseInt(starsText || '0', 10);

      repos.push({ name, url, desc, language, stars, range: 'daily' });
    });

    return repos;
  } catch (err) {
    console.error('Scraping failed:', err.message);
    return [];
  }
}

(async () => {
  let repos = await fetchFromAPI();
  if (!repos || !repos.length) {
    repos = await scrapeTrending();
  }

  if (!repos.length) {
    console.error('No repositories fetched. Exiting.');
    process.exit(1);
  }

  await fs.writeJSON(OUTPUT_FILE, repos, { spaces: 2 });
  console.log(`Saved ${repos.length} repos to ${OUTPUT_FILE}`);
})();
