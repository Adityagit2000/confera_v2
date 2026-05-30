import axios from 'axios';
import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables (handles execution from anywhere)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment");
  process.exit(1);
}

const INGEST_URL = `${SUPABASE_URL}/functions/v1/ingest-knowledge`;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const cleanText = (text: string) => {
  return text
    .replace(/<[^>]*>?/gm, ' ') // remove HTML tags
    .replace(/\s+/g, ' ') // normalize whitespace
    .trim();
};

const limitWords = (text: string, maxWords: number = 250) => {
  const words = text.split(' ');
  return words.length > maxWords ? words.slice(0, maxWords).join(' ') + '...' : text;
};

let totalScraped = 0;
let totalStored = 0;
const failedUrls: string[] = [];
let scrapedItems: any[] = [];

// ==========================================
// 1. IndiaBix Scraper (Quantitative Aptitude)
// ==========================================
async function scrapeIndiaBix() {
  const sections = [
    'percentage',
    'profit-and-loss',
    'time-and-distance',
    'probability',
    'number-series',
    'average'
  ];

  console.log(`\n--- Starting IndiaBix Scraper ---`);

  for (const section of sections) {
    for (let page = 1; page <= 10; page++) {
      const url = `https://www.indiabix.com/aptitude/${section}/0${page}001`; // IndiaBix sometimes uses varied paging structures, adapting to standard
      const altUrl = page === 1 ? `https://www.indiabix.com/aptitude/${section}/` : `https://www.indiabix.com/aptitude/${section}/${page > 1 ? `0${page}001` : ''}`;
      
      const targetUrl = page === 1 ? altUrl : `https://www.indiabix.com/aptitude/${section}/page-${page}`;

      try {
        console.log(`Scraping IndiaBix: ${targetUrl}`);
        const response = await axios.get(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const $ = cheerio.load(response.data);

        $('.bix-div-container').each((i, el) => {
          const questionBlock = $(el).find('.bix-td-qtxt').text();
          const optionsBlock = $(el).find('.bix-tbl-options').text();
          const explanation = $(el).find('.bix-ans-description').text();

          const cleanQuestion = cleanText(questionBlock);
          const cleanOptions = cleanText(optionsBlock);
          const cleanExplanation = cleanText(explanation);

          // Need at least question and 2 options worth of text
          if (cleanQuestion.length > 10 && cleanOptions.length > 10) {
            const content = `Question: ${cleanQuestion}\nOptions: ${cleanOptions}\nExplanation: ${cleanExplanation || 'N/A'}`;
            scrapedItems.push({
              topic: `${section.replace(/-/g, ' ')} Problem`,
              subject: 'Quantitative Aptitude',
              branch: 'All',
              content: limitWords(content, 250),
              source: 'IndiaBix'
            });
            totalScraped++;
          }
        });

      } catch (error: any) {
        if (error.response?.status === 404) {
          // Reached end of pages for this section
          break;
        }
        failedUrls.push(targetUrl);
      }

      await delay(1500); // 1.5 second delay
    }
  }
}

// ==========================================
// 2. Sanfoundry Scraper (Digital Electronics)
// ==========================================
async function scrapeSanfoundry() {
  console.log(`\n--- Starting Sanfoundry Scraper ---`);
  
  // Scrape the main index and a few internal pages based on standard Sanfoundry routing
  const urls = [
    'https://www.sanfoundry.com/digital-electronics-questions-answers/',
    'https://www.sanfoundry.com/digital-circuits-questions-answers-boolean-logic-operations/'
  ];

  for (const targetUrl of urls) {
    try {
      console.log(`Scraping Sanfoundry: ${targetUrl}`);
      const response = await axios.get(targetUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124 Safari/537.36' }
      });
      const $ = cheerio.load(response.data);

      $('.entry-content p').each((i, el) => {
        const text = $(el).text();
        // Sanfoundry MCQs usually start with a number followed by dot, e.g., "1. "
        if (/^\d+\./.test(text) && text.includes('a)') && text.includes('b)')) {
          const parts = text.split('View Answer');
          const questionAndOptions = cleanText(parts[0]);
          const explanation = parts.length > 1 ? cleanText(parts[1]) : '';

          if (questionAndOptions.length > 20) {
            const content = `${questionAndOptions}\n${explanation}`;
            scrapedItems.push({
              topic: 'Digital Electronics MCQ',
              subject: 'Digital Electronics',
              branch: 'ECE',
              content: limitWords(content, 250),
              source: 'Sanfoundry'
            });
            totalScraped++;
          }
        }
      });
    } catch (error) {
      failedUrls.push(targetUrl);
    }

    await delay(1500);
  }
}

// ==========================================
// 3. Electrical4U Scraper (EE)
// ==========================================
async function scrapeElectrical4U() {
  console.log(`\n--- Starting Electrical4U Scraper ---`);
  
  const urls = [
    'https://www.electrical4u.com/power-systems-mcq/',
    'https://www.electrical4u.com/control-systems-mcq/'
  ];

  for (const targetUrl of urls) {
    try {
      console.log(`Scraping Electrical4U: ${targetUrl}`);
      const response = await axios.get(targetUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124 Safari/537.36' }
      });
      const $ = cheerio.load(response.data);

      // Structure varies, targeting common list patterns
      $('ol.wp-pro-quiz-questionList li.wp-pro-quiz-questionList').each((i, el) => {
        const questionText = cleanText($(el).find('.wp-pro-quiz-question-text').text());
        const optionsText = cleanText($(el).find('.wp-pro-quiz-question-list').text());
        
        if (questionText.length > 10 && optionsText.length > 10) {
            const content = `Question: ${questionText}\nOptions: ${optionsText}`;
            scrapedItems.push({
              topic: targetUrl.includes('power') ? 'Power Systems' : 'Control Systems',
              subject: targetUrl.includes('power') ? 'Power Systems' : 'Control Systems',
              branch: 'EE',
              content: limitWords(content, 250),
              source: 'Electrical4U'
            });
            totalScraped++;
        }
      });
    } catch (error) {
      failedUrls.push(targetUrl);
    }

    await delay(1500);
  }
}

// ==========================================
// Ingestion Pipeline
// ==========================================
async function uploadToIngestEdgeFunction() {
    console.log(`\n--- Starting Database Ingestion ---`);
    console.log(`Found ${scrapedItems.length} valid items to upload.`);

    const BATCH_SIZE = 10;
    
    for (let i = 0; i < scrapedItems.length; i += BATCH_SIZE) {
        const batch = scrapedItems.slice(i, i + BATCH_SIZE);
        
        try {
            const response = await axios.post(INGEST_URL, { items: batch }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                }
            });

            if (response.data && (response.data.insertedCount !== undefined || response.data.success)) {
                totalStored += batch.length;
            }

            if ((i + batch.length) % 10 === 0) {
                console.log(`Progress: Inserted ${Math.min(i + batch.length, scrapedItems.length)} / ${scrapedItems.length} items`);
            }

        } catch (error: any) {
            console.error(`Error uploading batch: ${error.message}`);
        }

        await delay(1200); // Respect edge function limits
    }
}

// ==========================================
// Main Execution
// ==========================================
async function run() {
  try {
    await scrapeIndiaBix();
    await scrapeSanfoundry();
    await scrapeElectrical4U();
    
    if (scrapedItems.length > 0) {
        await uploadToIngestEdgeFunction();
    }

    console.log(`\n==========================================`);
    console.log(`FINAL SUMMARY`);
    console.log(`==========================================`);
    console.log(`Total Scraped : ${totalScraped}`);
    console.log(`Total Stored  : ${totalStored}`);
    console.log(`Failed URLs   : ${failedUrls.length}`);
    if (failedUrls.length > 0) {
        console.log(`\nFailed URL List:`);
        failedUrls.forEach(url => console.log(`- ${url}`));
    }
    
  } catch (error) {
    console.error("Critical error in scraper:", error);
  }
}

run();
